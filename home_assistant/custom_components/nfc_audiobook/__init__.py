"""Persistent, account-scoped audiobook bookmarks for NFC readers."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
import logging
import json
import time
import uuid

import voluptuous as vol

from homeassistant.core import SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

DOMAIN = "nfc_audiobook"
LOGGER = logging.getLogger(__name__)
CONFIG_SCHEMA = vol.Schema({vol.Optional(DOMAIN): vol.Schema({})}, extra=vol.ALLOW_EXTRA)


def bookmark_key(library, tag, uri):
    # URI prevents a remapped physical card from inheriting the previous book.
    return "|".join((library, tag.upper(), uri))


def in_opening_minute(track_uri, position, tracks):
    """Compare book position, including elapsed chapters, with the 60s threshold."""
    offset = 0.0
    for uri, duration in tracks:
        if uri == track_uri:
            return 0 <= offset + position < 60
        if duration is None or duration <= 0:
            return False
        offset += duration
        if offset >= 60:
            return False
    return False


def position_seconds(state):
    position = float(state.attributes.get("media_position") or 0)
    stamp = state.attributes.get("media_position_updated_at")
    if isinstance(stamp, str):
        stamp = dt_util.parse_datetime(stamp)
    if state.state == "playing" and stamp:
        position += max(0, (dt_util.utcnow() - stamp).total_seconds())
    duration = float(state.attributes.get("media_duration") or 0)
    return max(0, min(position, max(0, duration - 1)) if duration else position)


async def async_setup(hass, config):
    manager = Bookmarks(hass)
    await manager.load()
    hass.data[DOMAIN] = manager
    hass.services.async_register(
        DOMAIN, "prepare", manager.prepare,
        schema=vol.Schema({vol.Required("reader_id"): str, vol.Required("tag_id"): str,
                           vol.Required("card"): dict, vol.Required("profile"): dict}),
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN, "choose", manager.choose,
        schema=vol.Schema({vol.Required("reader_id"): str,
                           vol.Required("choice"): vol.In(["restart", "continue"]),
                           vol.Optional("request_id", default=""): str}),
    )
    async_track_time_interval(hass, manager.tick, timedelta(seconds=5))
    hass.bus.async_listen_once("homeassistant_stop", manager.stopping)
    manager.publish()
    return True


class Bookmarks:
    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, DOMAIN)
        self.bookmarks = {}
        self.active = {}
        self.pending = {}
        self.errors = {}
        self.locks = {}
        self.polling = False

    async def load(self):
        data = await self.store.async_load() or {}
        self.bookmarks = data.get("bookmarks", {})
        self.active = data.get("active", {})

    def payload(self):
        return {"bookmarks": deepcopy(self.bookmarks), "active": deepcopy(self.active)}

    async def save(self):
        await self.store.async_save(self.payload())

    def publish(self):
        dialogs = {rid: {k: p.get(k) for k in ("request_id", "title", "track_title", "position")}
                   for rid, p in self.pending.items()}
        self.hass.states.async_set("sensor.nfc_audiobook", len(self.bookmarks), {
            "friendly_name": "NFC Audiobook Bookmarks",
            "pending": {rid: {k: v for k, v in p.items() if k in (
                "request_id", "title", "track_title", "position", "expires", "tag_id")}
                for rid, p in self.pending.items()},
            "active": {p["reader_id"]: {"tag_id": p["tag_id"], "title": p["card"]["name"]}
                       for p in self.active.values()},
            "errors": self.errors,
            "displays_json": "BOOK:" + json.dumps(dialogs, ensure_ascii=False),
        })

    def backend(self, profile):
        entity = er.async_get(self.hass).async_get(profile["player"])
        if not entity or not entity.config_entry_id:
            raise HomeAssistantError("Player integration is unavailable")
        entry = self.hass.config_entries.async_get_entry(entity.config_entry_id)
        expected = profile.get("backend", "spotify")
        if not entry or entry.domain != expected or not getattr(entry, "runtime_data", None):
            raise HomeAssistantError("Player does not match the configured playback backend")
        return entry, entity

    def library(self, profile):
        entry, _ = self.backend(profile)
        explicit = profile.get("bookmark_library", "").strip()
        if explicit:
            return "listener:" + explicit
        if entry.domain == "spotify":
            return "spotify:" + entry.runtime_data.coordinator.current_user.user_id
        # All automated MA calls use its default playback user, unless explicitly set.
        return "ma:" + entry.entry_id + ":" + profile.get("ma_username", "default")

    def lock(self, profile):
        entry, entity = self.backend(profile)
        key = entry.entry_id if entry.domain == "spotify" else entity.unique_id
        return self.locks.setdefault(key, asyncio.Lock())

    def valid_request(self, request):
        rid = request["reader_id"]
        state = self.hass.states.get("sensor.nfc_jukebox_profiles")
        current = (state.attributes.get("profiles", {}) if state else {}).get(rid)
        if current != request["profile"]:
            raise HomeAssistantError("Reader pairing changed; scan the card again")
        sessions = self.hass.states.get("sensor.nfc_jukebox_sessions")
        if sessions and float(sessions.attributes.get("leases", {}).get(rid, 0)) > time.time():
            raise HomeAssistantError("Reader is in enrollment mode")

    async def prepare(self, call):
        request = deepcopy(dict(call.data))
        rid, profile, card = request["reader_id"], request["profile"], request["card"]
        self.valid_request(request)
        async with self.lock(profile):
            await self.capture_all()
            # Any new scan supersedes an older dialog on this reader.
            self.pending.pop(rid, None)
            self.errors.pop(rid, None)
            player = profile["player"]
            self.active.pop(player, None)
            await self.save()
            if card.get("kind") != "audiobook":
                self.publish()
                return {"handled": False}
            key = bookmark_key(self.library(profile), request["tag_id"], card["uri"])
            request.update(key=key, request_id=uuid.uuid4().hex, expires=time.time() + 120,
                           title=card["name"])
            mark = self.bookmarks.get(key, {})
            request.update(track_title=mark.get("track_title", ""), position=mark.get("position", 0))
            restart = not mark or await self.near_beginning(request, mark)
            if not restart and profile.get("resume_mode", "auto") == "ask":
                self.pending[rid] = request
                self.publish()
            else:
                await self.start(request, "restart" if restart else "continue")
            return {"handled": True}

    async def near_beginning(self, request, mark):
        position = float(mark.get("position", 0))
        if position < 0 or position >= 60:
            return False
        uri = request["card"]["uri"]
        if uri.startswith("spotify:track:"):
            return True
        try:
            async with asyncio.timeout(10):
                entry, _ = self.backend(request["profile"])
                if entry.domain == "spotify":
                    client = entry.runtime_data.coordinator.client
                    if uri.startswith("spotify:album:"):
                        items = await client.get_album_tracks(uri)
                    else:
                        items = [item.track for item in await client.get_playlist_items(uri)]
                    tracks = [(item.uri, item.duration_ms / 1000) for item in items]
                else:
                    music = entry.runtime_data.mass.music
                    item = await music.get_item_by_uri("https://open.spotify.com/" + "/".join(uri.split(":")[1:]))
                    getter = music.get_album_tracks if uri.startswith("spotify:album:") else music.get_playlist_tracks
                    items = await getter(item.item_id, item.provider)
                    tracks = [(item.uri, item.duration) for item in items]
            return in_opening_minute(mark["track_uri"], position, tracks)
        except Exception:
            # An unavailable track list must never turn a later chapter into a restart.
            LOGGER.debug("Could not resolve audiobook opening position", exc_info=True)
            return False

    async def choose(self, call):
        rid = call.data["reader_id"]
        request = self.pending.get(rid)
        # The dashboard can restart the currently active book on a display-only reader.
        if not request and call.data["choice"] == "restart" and not call.data["request_id"]:
            request = next((a for a in self.active.values() if a["reader_id"] == rid), None)
        if not request:
            raise HomeAssistantError("No audiobook is waiting or active")
        if call.data["request_id"] and call.data["request_id"] != request["request_id"]:
            raise HomeAssistantError("This audiobook request has been replaced")
        if rid in self.pending and request["expires"] < time.time():
            self.pending.pop(rid, None)
            self.publish()
            raise HomeAssistantError("Choice expired; scan the card again")
        self.valid_request(request)
        async with self.lock(request["profile"]):
            if call.data["request_id"] and rid not in self.pending:
                raise HomeAssistantError("This choice has already been handled")
            if rid in self.pending and self.pending[rid]["request_id"] != request["request_id"]:
                raise HomeAssistantError("Scan changed while waiting")
            await self.capture_all()
            self.active.pop(request["profile"]["player"], None)
            await self.start(request, call.data["choice"])

    async def start(self, request, choice):
        rid = request["reader_id"]
        self.pending.pop(rid, None)
        self.errors.pop(rid, None)
        self.publish()
        mark = deepcopy(self.bookmarks.get(request["key"])) if choice == "continue" else None
        try:
            if request["profile"].get("backend", "spotify") == "spotify":
                await self.spotify_start(request, mark)
            else:
                await self.ma_start(request, mark)
            self.active[request["profile"]["player"]] = request
            # A restart replaces the old mark only once playback has succeeded.
            if choice == "restart":
                self.bookmarks.pop(request["key"], None)
            await self.capture(request)
            await self.save()
        except Exception as err:
            self.errors[rid] = "Playback failed; bookmark kept. " + str(err)
            self.pending[rid] = dict(request, request_id=uuid.uuid4().hex, expires=time.time() + 120)
            LOGGER.exception("Audiobook playback failed for reader %s", rid)
            raise HomeAssistantError("Audiobook playback failed; bookmark kept") from err
        finally:
            self.publish()

    async def spotify_start(self, request, mark):
        profile, uri = request["profile"], request["card"]["uri"]
        entry, _ = self.backend(profile)
        data = entry.runtime_data
        await data.devices.async_request_refresh()
        device = next((d for d in data.devices.data if d.name == profile.get("source")), None)
        if not device or not device.device_id:
            raise HomeAssistantError("Configured Spotify speaker is not available")
        client = data.coordinator.client
        await client.transfer_playback(device.device_id)
        await client.set_shuffle(state=False, device_id=device.device_id)
        await data.coordinator.async_refresh()
        current = data.coordinator.data.current_playback
        if not current or current.shuffle or current.device.device_id != device.device_id:
            raise HomeAssistantError("Spotify did not confirm speaker and shuffle off")
        args = {"device_id": device.device_id, "position": int(mark["position"] * 1000) if mark else 0}
        if uri.startswith("spotify:track:"):
            args["uris"] = [uri]
        else:
            args["context_uri"] = uri
            if mark:
                args["uri_offset"] = mark["track_uri"]
        await client.start_playback(**args)
        for _ in range(10):
            await asyncio.sleep(1)
            await data.coordinator.async_refresh()
            current = data.coordinator.data.current_playback
            if current and current.item and current.device.device_id == device.device_id:
                context = current.context.uri if current.context else current.item.uri
                if context == uri and (not mark or current.item.uri == mark["track_uri"]):
                    return
        raise HomeAssistantError("Spotify did not confirm the requested audiobook chapter")

    async def ma_start(self, request, mark):
        from music_assistant_models.enums import QueueOption
        profile, uri = request["profile"], request["card"]["uri"]
        entry, entity = self.backend(profile)
        mass = entry.runtime_data.mass
        player = mass.players.get(entity.unique_id)
        if not player or not player.available:
            raise HomeAssistantError("Configured Music Assistant speaker is unavailable")
        if player.synced_to:
            raise HomeAssistantError("This speaker is a group member; configure the group player")
        queue = mass.player_queues.get_active_queue(entity.unique_id)
        queue_id = queue.queue_id if queue else entity.unique_id
        old_item_id = queue.current_item.queue_item_id if queue and queue.current_item else None
        await mass.player_queues.shuffle(queue_id, False)
        # Explicit target queue; never choose another playing speaker as fallback.
        media = "https://open.spotify.com/" + "/".join(uri.split(":")[1:])
        await mass.player_queues.play_media(queue_id, media=media, option=QueueOption.REPLACE,
            start_item=mark["track_uri"] if mark else None, user=profile.get("ma_username"))
        for _ in range(20):
            await asyncio.sleep(1)
            queue = mass.player_queues.get(queue_id)
            item = queue.current_item if queue else None
            if item and item.queue_item_id != old_item_id and item.media_item and not queue.shuffle_enabled and (
                    not mark or item.media_item.uri == mark["track_uri"]):
                break
        else:
            raise HomeAssistantError("Music Assistant did not confirm chapter and shuffle off")
        if mark:
            await mass.player_queues.seek(queue_id, int(mark["position"]))
        request["queue_id"] = queue_id
        # Queue-item IDs change when another album replaces this queue. Do not
        # accidentally attribute unrelated music to the active audiobook.
        ids = []
        for offset in range(0, queue.items, 500):
            ids.extend(i.queue_item_id for i in await mass.player_queues.get_queue_items(queue_id, offset=offset))
        request["queue_items"] = ids

    async def capture(self, request):
        profile = request["profile"]
        state = self.hass.states.get(profile["player"])
        if not state or state.state not in ("playing", "paused"):
            return
        entry, entity = self.backend(profile)
        if entry.domain == "spotify":
            current = entry.runtime_data.coordinator.data.current_playback
            if not current or not current.item or current.device.name != profile.get("source"):
                return
            context = current.context.uri if current.context else current.item.uri
            if context != request["card"]["uri"]:
                return
            track_uri = current.item.uri
            # A state refresh can lag behind a backend chapter transition.
            if state.attributes.get("media_content_id") != track_uri:
                return
            position = position_seconds(state)
            title = state.attributes.get("media_title", "")
        else:
            mass = entry.runtime_data.mass
            queue = mass.player_queues.get_active_queue(entity.unique_id)
            if not queue or queue.queue_id != request.get("queue_id") or not queue.current_item:
                return
            item = queue.current_item
            if item.queue_item_id not in request.get("queue_items", []) or not item.media_item:
                return
            track_uri = item.media_item.uri
            position = max(0, float(queue.corrected_elapsed_time))
            if item.duration:
                position = min(position, max(0, item.duration - 1))
            title = item.name
        self.bookmarks[request["key"]] = {
            "track_uri": track_uri, "track_title": title,
            "position": position, "updated_at": dt_util.utcnow().isoformat(),
        }

    async def capture_all(self):
        for request in list(self.active.values()):
            try:
                await self.capture(request)
            except Exception:
                LOGGER.debug("Bookmark capture skipped while player unavailable", exc_info=True)

    async def tick(self, now):
        if self.polling:
            return
        self.polling = True
        try:
            await self.capture_all()
            for rid, pending in list(self.pending.items()):
                if pending["expires"] < time.time():
                    del self.pending[rid]
            await self.save()
            self.publish()
        finally:
            self.polling = False

    async def stopping(self, event):
        await self.capture_all()
        await self.save()
