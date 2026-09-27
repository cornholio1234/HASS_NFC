"""Bookmark behavior tests with fake HA state and playback clients (no playback)."""
import ast
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import time
import sys
from types import SimpleNamespace as NS
import unittest
from unittest.mock import AsyncMock, Mock, patch
import uuid

SOURCE = Path(__file__).resolve().parents[1] / "home_assistant/custom_components/nfc_audiobook/__init__.py"
namespace = dict(asyncio=NS(sleep=AsyncMock(), Lock=asyncio.Lock), deepcopy=deepcopy,
    time=time, uuid=uuid, json=json, LOGGER=logging.getLogger(__name__),
    HomeAssistantError=RuntimeError, Store=lambda *a: NS(async_save=AsyncMock()), DOMAIN="nfc_audiobook",
    dt_util=NS(utcnow=lambda: datetime.now(timezone.utc), parse_datetime=datetime.fromisoformat))
tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
# Test the actual manager and pure helpers without importing a running HA installation.
tree.body = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))]
exec(compile(tree, str(SOURCE), "exec"), namespace)
Bookmarks = namespace["Bookmarks"]


class BookmarkTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.hass = NS(states=NS(get=Mock(return_value=None), async_set=Mock()))
        self.manager = Bookmarks(self.hass)
        self.request = dict(reader_id="reader", tag_id="AA-BB", key="key", request_id="request",
            expires=time.time()+120, card={"uri":"spotify:album:book", "name":"Book"},
            profile={"player":"media_player.account", "source":"Office", "backend":"spotify"})

    def test_keys_separate_accounts_and_remapped_cards(self):
        key=namespace["bookmark_key"]
        self.assertEqual(key("a","aa","book"),key("a","AA","book"))
        self.assertNotEqual(key("a","AA","book"),key("b","AA","book"))
        self.assertNotEqual(key("a","AA","book"),key("a","AA","other"))

    def test_position_clamps_to_duration_and_pause_does_not_advance(self):
        f=namespace["position_seconds"]
        state=NS(state="paused", attributes={"media_position":12,"media_duration":20})
        self.assertEqual(f(state),12)
        state.attributes["media_position"]=30
        self.assertEqual(f(state),19)

    async def test_spotify_resume_keeps_album_context_and_explicit_speaker(self):
        client=NS(transfer_playback=AsyncMock(),set_shuffle=AsyncMock(),start_playback=AsyncMock())
        current=NS(shuffle=False,device=NS(device_id="office"),item=NS(uri="spotify:track:chapter"),
                   context=NS(uri="spotify:album:book"))
        data=NS(client=client,async_refresh=AsyncMock(),data=NS(current_playback=current))
        runtime=NS(coordinator=data,devices=NS(async_request_refresh=AsyncMock(),
            data=[NS(name="Office",device_id="office")]))
        self.manager.backend=lambda p:(NS(runtime_data=runtime),None)
        await self.manager.spotify_start(self.request,dict(position=43,track_uri="spotify:track:chapter"))
        client.start_playback.assert_awaited_once_with(device_id="office",position=43000,
            context_uri="spotify:album:book",uri_offset="spotify:track:chapter")
        client.set_shuffle.assert_awaited_once_with(state=False,device_id="office")

    async def test_missing_speaker_does_not_fall_back(self):
        client=NS(start_playback=AsyncMock())
        self.manager.backend=lambda p:(NS(runtime_data=NS(coordinator=NS(client=client),
            devices=NS(async_request_refresh=AsyncMock(),data=[]))),None)
        with self.assertRaises(RuntimeError):
            await self.manager.spotify_start(self.request,None)
        client.start_playback.assert_not_awaited()

    async def test_failed_restart_preserves_existing_bookmark(self):
        self.manager.bookmarks["key"]={"position":77,"track_uri":"chapter"}
        self.manager.spotify_start=AsyncMock(side_effect=RuntimeError("offline"))
        with self.assertRaises(RuntimeError):
            await self.manager.start(self.request,"restart")
        self.assertEqual(self.manager.bookmarks["key"]["position"],77)
        self.assertIn("reader",self.manager.pending)

    async def test_foreign_album_does_not_overwrite_bookmark(self):
        self.manager.bookmarks["key"]={"position":77}
        self.hass.states.get.return_value=NS(state="playing",attributes={})
        self.manager.backend=lambda p:(NS(domain="spotify",runtime_data=NS(coordinator=NS(data=NS(
            current_playback=NS(item=NS(uri="other"),device=NS(name="Office"),context=NS(uri="otheralbum")))))),None)
        await self.manager.capture(self.request)
        self.assertEqual(self.manager.bookmarks["key"],{"position":77})

    async def test_stale_dialog_cannot_play_new_card(self):
        self.manager.pending["reader"]=self.request
        self.manager.start=AsyncMock()
        with self.assertRaises(RuntimeError):
            await self.manager.choose(NS(data=dict(reader_id="reader",choice="continue",request_id="old")))
        self.manager.start.assert_not_awaited()

    async def test_ma_resume_keeps_context_and_targets_configured_queue(self):
        self.request['profile']['backend']='music_assistant'
        item=NS(queue_item_id='new',media_item=NS(uri='library://track/42'))
        old=NS(queue_id='office',current_item=NS(queue_item_id='old'))
        queue=NS(queue_id='office',current_item=item,shuffle_enabled=False,items=1)
        queues=NS(get_active_queue=Mock(return_value=old),get=Mock(return_value=queue),
            shuffle=AsyncMock(),play_media=AsyncMock(),seek=AsyncMock(),
            get_queue_items=AsyncMock(return_value=[item]))
        mass=NS(players={'office':NS(available=True,synced_to=None)},player_queues=queues)
        self.manager.backend=lambda p:(NS(runtime_data=NS(mass=mass)),NS(unique_id='office'))
        with patch.dict(sys.modules,{'music_assistant_models.enums':NS(QueueOption=NS(REPLACE='replace'))}):
            await self.manager.ma_start(self.request,dict(position=81,track_uri='library://track/42'))
        queues.play_media.assert_awaited_once_with('office',media='https://open.spotify.com/album/book',
            option='replace',start_item='library://track/42',user=None)
        queues.seek.assert_awaited_once_with('office',81)
        self.assertEqual(self.request['queue_items'],['new'])

    async def test_replaced_ma_queue_does_not_overwrite_bookmark(self):
        self.request.update(queue_id='office',queue_items=['original'])
        self.manager.bookmarks['key']={'position':77}
        self.hass.states.get.return_value=NS(state='playing',attributes={})
        queue=NS(queue_id='office',current_item=NS(queue_item_id='foreign',media_item=NS(uri='other')))
        mass=NS(player_queues=NS(get_active_queue=Mock(return_value=queue)))
        self.manager.backend=lambda p:(NS(domain='music_assistant',runtime_data=NS(mass=mass)),NS(unique_id='office'))
        await self.manager.capture(self.request)
        self.assertEqual(self.manager.bookmarks['key'],{'position':77})

    async def test_storage_roundtrip_includes_active_tracking(self):
        self.manager.bookmarks["key"]={"position":77}
        self.manager.active["player"]=self.request
        await self.manager.save()
        stored=self.manager.store.async_save.call_args.args[0]
        self.manager.store.async_load=AsyncMock(return_value=stored)
        self.manager.bookmarks={}
        self.manager.active={}
        await self.manager.load()
        self.assertEqual(self.manager.bookmarks["key"]["position"],77)
        self.assertEqual(self.manager.active["player"]["tag_id"],"AA-BB")


if __name__ == "__main__":
    unittest.main()
