"""Install missing NFC scripts and dashboard. Existing scripts are never replaced."""
import argparse
import asyncio
import getpass
import hashlib
import json
import os
from pathlib import Path

import aiohttp

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_FILES = {
    "nfc_jukebox_play_card": "player_script.json",
    "nfc_jukebox_reader_config": "reader_config_script.json",
    "nfc_jukebox_session": "reader_session_script.json",
    "nfc_jukebox_control": "reader_control_script.json",
}


async def install(url, token):
    async with aiohttp.ClientSession(headers={"Authorization": "Bearer " + token},
                                     timeout=aiohttp.ClientTimeout(total=60)) as http:
        async def api(method, path, data=None):
            async with http.request(method, url + "/api/" + path, json=data) as response:
                value = await response.json() if response.content_type == "application/json" else await response.text()
                if response.status >= 400:
                    raise RuntimeError(f"{method} {path}: HTTP {response.status}")
                return value

        # Server files must already have been copied by the user.
        async with http.get(url + "/local/nfc/nfc-card-enroller.js") as response:
            if response.status != 200:
                raise RuntimeError("Copy nfc-card-enroller.js to /config/www/nfc/ first.")
            deployed_js = await response.read()
        expected_js = (ROOT / "home_assistant/nfc_spotify/nfc-card-enroller.js").read_bytes()
        if deployed_js.replace(b"\r\n", b"\n").strip() != expected_js.replace(b"\r\n", b"\n").strip():
            raise RuntimeError("The server's dashboard file differs from this checkout. Copy the matching file first.")
        check = await api("POST", "config/core/check_config", {})
        if check.get("result") != "valid":
            raise RuntimeError("HA configuration validation failed. Check Home Assistant logs before installing.")
        folder = ROOT / "home_assistant/nfc_spotify"
        for script, file in SCRIPT_FILES.items():
            path = "config/script/config/" + script
            async with http.get(url + "/api/" + path) as response:
                status = response.status
            if status == 200:
                print("Keeping existing script:", script)
            elif status == 404:
                await api("POST", path, json.loads((folder / file).read_text(encoding="utf-8-sig")))
                print("Created script:", script)
            else:
                raise RuntimeError(f"Cannot inspect {script}: HTTP {status}")
        await api("POST", "services/script/reload", {})
        await api("POST", "services/template/reload", {})
        await api("POST", "services/automation/reload", {})
        await api("POST", "services/script/nfc_jukebox_reader_config", {})
        await api("GET", "states/sensor.nfc_jukebox_profiles")
        await api("GET", "states/sensor.nfc_jukebox_runtime")

        ws_url = url.replace("https://", "wss://", 1).replace("http://", "ws://", 1) + "/api/websocket"
        async with http.ws_connect(ws_url) as ws:
            await ws.receive_json()
            await ws.send_json({"type": "auth", "access_token": token})
            if (await ws.receive_json()).get("type") != "auth_ok":
                raise RuntimeError("Home Assistant authentication failed.")
            request_id = 0

            async def call(command):
                nonlocal request_id
                request_id += 1
                await ws.send_json(dict(command, id=request_id))
                while True:
                    result = await ws.receive_json()
                    if result.get("id") != request_id:
                        continue
                    if not result.get("success"):
                        raise RuntimeError(f"{command['type']}: {result.get('error', {}).get('message', 'failed')}")
                    return result.get("result")

            resources = await call({"type": "lovelace/resources"})
            resource_url = "/local/nfc/nfc-card-enroller.js?v=" + hashlib.sha256(expected_js).hexdigest()[:12]
            existing = next((r for r in resources if r["url"].split("?")[0] == "/local/nfc/nfc-card-enroller.js"), None)
            command = {"type": "lovelace/resources/update" if existing else "lovelace/resources/create",
                       "res_type": "module", "url": resource_url}
            if existing:
                command["resource_id"] = existing["id"]
            await call(command)
            dashboards = await call({"type": "lovelace/dashboards/list"})
            existing_dashboard = next((d for d in dashboards if d["url_path"] in ("nfc-cards", "nfc-karten")), None)
            if not existing_dashboard:
                await call({"type": "lovelace/dashboards/create", "url_path": "nfc-cards",
                            "title": "NFC Cards", "icon": "mdi:cards", "require_admin": True,
                            "show_in_sidebar": True})
                await call({"type": "lovelace/config/save", "url_path": "nfc-cards",
                            "config": json.loads((folder / "dashboard.json").read_text(encoding="utf-8-sig"))})
                print("Created NFC Cards dashboard.")
            else:
                print("Keeping existing NFC Cards dashboard.")
        print("Ready:", url + "/" + existing_dashboard["url_path"] if existing_dashboard else url + "/nfc-cards/enroll")
        print("Add your reader/account/speaker under Configuration. No example mappings were installed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("HA_URL", "http://homeassistant.local:8123"))
    args = parser.parse_args()
    token = os.environ.get("HA_TOKEN") or getpass.getpass("Home Assistant administrator token (hidden): ")
    if not token:
        parser.error("A Home Assistant token is required.")
    try:
        asyncio.run(install(args.url.rstrip("/"), token))
    except (RuntimeError, aiohttp.ClientError, asyncio.TimeoutError) as exc:
        parser.exit(1, f"Installation stopped: {exc}\n")


if __name__ == "__main__":
    main()
