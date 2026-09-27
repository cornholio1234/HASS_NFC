# HASS NFC Jukebox

ESPHome NFC readers for playing Spotify albums, playlists and tracks through
Home Assistant. Each reader has a fixed playback backend and target speaker.
A shared dashboard manages card mappings, reader profiles and audiobook bookmarks.

## Features

- Assign Spotify albums, playlists and individual tracks to NFC cards.
- Enroll cards in batches; fetch Spotify titles automatically when enrollment starts.
- Share one card library across readers with separate accounts and speakers.
- Search, sort, rename and inspect cards; delete and restore mappings.
- Mark audiobooks: shuffle is actively turned off and verified before playback.
- Touchscreen with title, artist, cover, progress, play/pause, previous/next and seeking.
- Native Home Assistant dashboard: **Enroll | Saved cards | Configuration**.
- Configure separate display timeouts for playback and pause/stop per reader
  in the Configuration tab (0 = always on; default 60 seconds each). Settings
  persist on the device. Wake by movement or a new card; the 2-inch board also
  supports touch wake without triggering playback controls. The office RGB LED
  runs a rainbow at **100% brightness** during playback, turns off when paused or
  stopped, and shows solid red when the Home Assistant state connection is missing.

Each reader uses Spotify Connect or Music Assistant. Spotify Connect profiles
specify an account and source. Music Assistant profiles specify a target player;
the Spotify provider and its accounts are configured in Music Assistant.

## Repository contents

The repository contains HA configuration, dashboard code, ESPHome firmware and CAD.

| Component | Source | Current behavior |
|---|---|---|
| HA package | [nfc_spotify.yaml](home_assistant/packages/nfc_spotify.yaml) | NFC routing, reader state and display feedback |
| Playback | [player_script.json](home_assistant/nfc_spotify/player_script.json) | Spotify Connect or Music Assistant per reader; fixed target player; audiobook shuffle off |
| Reader configuration | [reader_config_script.json](home_assistant/nfc_spotify/reader_config_script.json) | Separate reader profiles and speaker pairings |
| Controls and enrollment | [reader_control_script.json](home_assistant/nfc_spotify/reader_control_script.json), [reader_session_script.json](home_assistant/nfc_spotify/reader_session_script.json) | Playback controls and per-reader enrollment locks |
| Dashboard | [nfc-card-enroller.js](home_assistant/nfc_spotify/nfc-card-enroller.js) | Batch enrollment, automatic titles, searchable card table and reader configuration |
| Audiobook bookmarks | [nfc_audiobook](home_assistant/custom_components/nfc_audiobook) | Persistent chapter/position storage and playback adapters |
| 2-inch touch display | [nfc_spotify_player.yaml](esphome/nfc_spotify_player.yaml) | Touch controls, filtered touch input, progress/seeking, cover loading and configurable sleep |
| 1.47B-M office display | [nfc_office_147b.yaml](esphome/nfc_office_147b.yaml) | Display-only reader, configurable sleep, full-brightness rainbow and red connection indicator |

Firmware, dashboard and documentation are in English. Credentials, reader IDs,
speaker profiles and card mappings are configured locally.

## Hardware and requirements

Two firmware variants are available:

- **2-inch touch reader:** playback controls, progress seeking and audiobook choices.
- **1.47B-M office reader, without controls:** [pinout, firmware and setup](docs/OFFICE_147B.md),
  plus a [70 × 50 × 40 mm screwless enclosure](enclosure/office-147b/r0/README.md).

Hardware requirements:

| Component | Specification |
|---|---|
| Display/controller | Waveshare ESP32-S3-Touch-LCD-2, ST7789, CST816D |
| Motion sensor | Onboard QMI8658, I²C address 0x6B |
| NFC reader | RC522 / MFRC522 over SPI, powered at 3.3 V |
| Cards | RC522-compatible 13.56 MHz cards/tags, such as MIFARE Classic |
| Speaker | A Spotify Connect device or a Music Assistant player |
| Controller | Home Assistant, ESPHome, and Spotify integration or Music Assistant |

Firmware targets **ESPHome 2026.9.0**. Card UIDs use hyphen-separated hexadecimal
bytes, for example `AA-BB-CC-DD` (4–10 bytes). Spotify playback requires Premium;
independent simultaneous playback requires separate accounts.

## Wiring

These pins apply to the **2-inch Touch-LCD-2 only**. For the 1.47B-M, use the
[office pinout](docs/OFFICE_147B.md#rc522-wiring).

| RC522 | ESP32 GPIO / connector | Wire color |
|---|---|---|
| SDA / SS | GPIO11 | Orange |
| SCK | GPIO14 | Green |
| MOSI | GPIO13 | Red |
| MISO | GPIO12 | Yellow |
| RST | GPIO15 | Blue |
| GND | GND | Black |
| 3.3V | 3V3 | White |
| IRQ | Not connected | – |

SDA is the SPI chip-select. These GPIOs overlap with the camera interface.

## Setup

### 1. Set up the playback backend

For **Spotify Connect**, configure the [native Spotify integration](https://www.home-assistant.io/integrations/spotify/)
for each playback account. The target speaker must appear in the player's source
list; select it in Spotify Connect to make it available. OAuth and developer-app
setup are covered by the integration guide.

For **Music Assistant**, configure its Spotify provider and add its integration to
Home Assistant. The target speaker must have a Music Assistant `media_player`
entity.

### 2. Copy the Home Assistant files

Copy [custom_components/nfc_audiobook](home_assistant/custom_components/nfc_audiobook)
to `/config/custom_components/nfc_audiobook` for persistent audiobook bookmarks.

1. Enable [packages](https://www.home-assistant.io/docs/configuration/packages/)
   under the existing `homeassistant:` section in `configuration.yaml`:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

2. Copy [nfc_spotify.yaml](home_assistant/packages/nfc_spotify.yaml) to
   `/config/packages/nfc_spotify.yaml`.
3. Copy [nfc-card-enroller.js](home_assistant/nfc_spotify/nfc-card-enroller.js) to
   `/config/www/nfc/nfc-card-enroller.js`.
4. Scripts must be writable through Home Assistant's script configuration API.
   The usual configuration is `script: !include scripts.yaml`.
5. Validate the Home Assistant configuration and restart Home Assistant.

### 3. Install scripts and the dashboard

With Python 3.10+, run from the repository root:

```sh
python -m pip install -r tools/requirements.txt
python tools/install.py --url http://homeassistant.local:8123
```

Set `--url` to the Home Assistant address. The helper prompts for an administrator's
long-lived access token. Alternatively, set `HA_URL` and `HA_TOKEN` environment
variables. The token is not stored.

The helper creates the four missing scripts, reloads the configuration and creates
the **NFC Cards** dashboard. Existing scripts and dashboard contents are preserved.
The card library and reader profiles start empty. Open `/nfc-cards/enroll`.

For updates, preserve `variables.card_map` in the playback script and
`variables.profiles` in the reader configuration script. The installer creates
missing scripts and leaves existing scripts unchanged. Component, script,
dashboard and firmware updates are separate installation steps; see
[architecture and storage](docs/ARCHITECTURE.md).

### 4. Set up the ESPHome panel

For the **1.47B-M**, follow its [firmware and pairing guide](docs/OFFICE_147B.md#firmware-and-pairing).
The following steps target the **2-inch touchscreen**.

1. Copy `esphome/nfc_spotify_player.yaml` and `esphome/components/` into your ESPHome
   configuration directory, preserving the relative component path.
2. Copy the entries in [secrets.example.yaml](esphome/secrets.example.yaml) into
   your local `secrets.yaml`: Wi-Fi credentials, API encryption key and OTA password.
3. Adjust `device_name`, `friendly_name` and `home_assistant_url` at the top of the
   YAML using a Home Assistant address reachable from the ESP.
4. Flash over USB initially and add the device to Home Assistant through ESPHome,
   using the configured API key.
5. Open the device in Home Assistant. Its URL ends in `/config/devices/device/<ID>`.
   Put this **Home Assistant device ID** into the firmware's `reader_id` substitution.
   Flash the updated firmware.
6. In the ESPHome device options in Home Assistant, enable **Allow the device to
   perform Home Assistant actions**.

Each additional identical display reader needs a unique device name and its own
`reader_id`. Later account/speaker changes happen in the dashboard without flashing.
Other NFC readers without displays can be used if they send compatible
`tag_scanned` events with their Home Assistant device ID.

### 5. Pair a reader

Open **NFC Cards → Configuration → Pair another reader**:

1. Select the NFC reader and give it a name.
2. Select **Playback via**: Spotify Connect or Music Assistant.
3. For Spotify Connect, select the account/player and its target speaker. For Music
   Assistant, select the target speaker/player entity directly; provider accounts
   are configured in Music Assistant. Scans and controls use this fixed pairing.
4. Choose the default card type, music shuffle behavior, display timeouts and
   audiobook continuation mode.
5. Click **Save pairing**.

If a reader is missing, scan a card with it and reload the page. A reader without
a profile does not start playback. The same card plays the same content on different
readers through each reader's account/speaker pairing.

## Enroll and manage cards

1. Select the intended reader at the top.
2. In **Enroll**, paste one Spotify link per line.
3. **Start enrollment** fetches titles. Optionally use `Custom title | Link` to
   override Spotify's title. Album links start the whole album; `highlight`
   parameters are ignored.
4. Scan cards one at a time, removing each card between scans. Set an item's type
   to **Audiobook** when appropriate.
5. Click **Save batch** once every item has a UID.

Scans from this reader do not start playback during enrollment. Other readers
remain available. Drafts survive stopping and switching tabs. Previously saved
cards are replaced only through explicit reassignment.

In **Saved cards**, search by UID/title/type. Click the ID, Title, Type or Assigned
column header to cycle **ascending → descending → default (title A–Z)**. New
assignments record their timestamp; old cards without one sort last by date.
Reconstructed dates are marked **≈**. Use the pencil to rename, open
Spotify with the link icon, or remove a mapping with the red ×. **Undo deletion**
works in the same browser. The physical card is neither written nor erased.
**Inspect cards**, in the **Enroll** tab, shows IDs and titles without starting
playback.

## Audiobook bookmarks

Audiobook cards save their chapter and position on the Home Assistant server.
On the 2-inch display, choose **Restart** or **Continue** when a bookmark exists.
A new book or a bookmark within the first 60 seconds of the book restarts immediately.
For the 1.47B-M without touch controls, use automatic
continuation; **Restart** is available in the dashboard's Enroll tab for its active book.

In each reader's Configuration, set **Audiobook resume** to **Ask on touchscreen**
or **Continue automatically**. The touchscreen option uses the 2-inch
firmware. Pending choices expire after two minutes; scanning another card replaces them.

Bookmarks are scoped to the card, content URI and Spotify account. Music Assistant
uses its integration's default playback user. To share progress across backends or
separate listeners using one account, enter the same/different **Bookmark library**
name in the respective reader profiles. Playback accounts remain configured in
the backend settings.

The component samples playback every five seconds and saves before card changes
and at HA shutdown. Data survives restart in `/config/.storage/nfc_audiobook`;
include it in backups. Playback feedback latency can affect the last saved seconds.
Spotify resumes within the original album/playlist using its chapter offset; Music
Assistant rebuilds the original context using `start_item` and then seeks. Both
keep the fixed target speaker and disable shuffle. Failed playback retains the
previous bookmark. Music cards retain their existing behavior.

Updating an existing installation requires the custom component, HA package,
play-card script (preserve `variables.card_map`), dashboard JS and touchscreen
firmware. The first-install helper does not replace existing scripts. Restart HA
after installing/updating the component. The adapters use the Spotify and Music
Assistant integration clients supplied with Home Assistant.

## Headless enclosure

The [ESP32-WROOM / RC522 enclosure](enclosure/headless-wroom/rA/README.md) measures
96 × 82 × 46 mm and consists of a base and a removable cover. Four latches secure
the housing; four printed edge clips retain each PCB on its supports. Both boards
stay on the base when the cover is removed. The open base provides access to both
ESP32 header rows. CAD, print-ready STLs, assembly views and clearance checks are
included. It uses the standard AZ-Delivery ESP32 Dev Kit C V4 layout.

## 3D enclosure rC

![Enclosure rC](enclosure/rC/preview.png)

70 × 50 × 60 mm (width × depth × height), display at the front, reader at the top,
PLA, no screws. [CAD, STLs and assembly/printing instructions](enclosure/rC/README.md).

rC uses guides rooted in the side walls, a continuous display support,
replaceable clamp strips in three thicknesses, and four solid locking keys securing
the upper and lower rear panel. The USB opening is on the right when viewed from
the front.

Dimensions, print orientations and fit parameters are documented with the model.
Earlier designs remain under `enclosure/r0`, `rA` and `rB`. Body and drawer parts
must use the same revision.

## Limitations and troubleshooting

- Spotify/Home Assistant feedback has latency. Progress is extrapolated locally
  between position updates.
- Missing speakers: check the account and Spotify Connect availability first.
- No scans: check power, SPI wiring and ESPHome logs, then the device ID and reader
  profile. Arbitrary 125 kHz tags are not supported.
- Stale dashboard: reload the browser. Updates need a new resource URL version
  parameter; the installation helper supplies one.
- An abandoned enrollment lock expires within 90 seconds.
- Concurrent configuration edits are checked before saving. The Home Assistant
  API does not provide atomic version checks.

## Development, architecture and license

```sh
node home_assistant/nfc_spotify/test_card.cjs
python -m unittest discover -s tools -p "test_*.py"
```

[Architecture and storage](docs/ARCHITECTURE.md) ·
[MIT license](LICENSE) · [Third-party licenses](THIRD_PARTY_NOTICES.md)

Original project code, documentation and CAD use the MIT license. **Exception:**
the vendored ESPHome C++ touch driver remains GPLv3; its Python files use MIT.
No credentials, private card libraries or precompiled firmware are included.
