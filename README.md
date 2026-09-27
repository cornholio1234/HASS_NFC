# HASS NFC Jukebox

**Scan a card. Play an audiobook or music.** An ESP32 with an NFC reader starts
Spotify content on your chosen speaker through Spotify Connect or Music Assistant.
Home Assistant manages the cards and pairs each reader with its playback backend
and fixed target speaker.

This is a working DIY project, not a finished plug-and-play product. The published
firmware, dashboard and documentation are in English. **The rC enclosure is a
mechanically revised prototype that has not been physically tested. Read the
printing instructions before printing it.**

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

**Music Assistant is optional.** In Configuration, each reader can use either
Spotify Connect (account plus speaker) or Music Assistant (its target player).
Music Assistant must have the Spotify provider configured to resolve the same card
links. Its provider accounts are managed in Music Assistant. A computer is needed
for setup, not daily operation.

## Home Assistant and firmware included

The repository includes the Home Assistant implementation and **both** ESPHome
firmware configurations, not just the dashboard or enclosure:

| Component | Source | Current behavior |
|---|---|---|
| HA package | [nfc_spotify.yaml](home_assistant/packages/nfc_spotify.yaml) | NFC routing, reader state and display feedback |
| Playback | [player_script.json](home_assistant/nfc_spotify/player_script.json) | Spotify Connect or Music Assistant per reader; fixed target player; audiobook shuffle off |
| Reader configuration | [reader_config_script.json](home_assistant/nfc_spotify/reader_config_script.json) | Separate reader profiles and speaker pairings |
| Controls and enrollment | [reader_control_script.json](home_assistant/nfc_spotify/reader_control_script.json), [reader_session_script.json](home_assistant/nfc_spotify/reader_session_script.json) | Playback controls and per-reader enrollment locks |
| Dashboard | [nfc-card-enroller.js](home_assistant/nfc_spotify/nfc-card-enroller.js) | Batch enrollment, automatic titles, searchable card table and reader configuration |
| 2-inch touch display | [nfc_spotify_player.yaml](esphome/nfc_spotify_player.yaml) | Touch controls, filtered touch input, progress/seeking, cover loading and configurable sleep |
| 1.47B-M office display | [nfc_office_147b.yaml](esphome/nfc_office_147b.yaml) | Display-only reader, configurable sleep, full-brightness rainbow and red connection indicator |

Both boards have been flashed in the project installation and reconnected to Home
Assistant. This is not a complete hardware acceptance test: simultaneous independent
playback, motion sensitivity and enclosure fit still need physical verification.
Personal credentials, reader IDs, speaker profiles and card mappings are excluded.
Supply these for your own installation; precompiled firmware is not published.

## Hardware and requirements

Two firmware variants are available:

- **2-inch touch jukebox:** the hardware and wiring below.
- **1.47B-M office reader, without controls:** [pinout, firmware and setup](docs/OFFICE_147B.md),
  plus a [70 × 50 × 40 mm screwless enclosure](enclosure/office-147b/r0/README.md).
  The office firmware has been flashed and connected to Home Assistant; physical
  enclosure fit is still unverified.
  Its display wakes on movement or a new card scan, not stationary touch.

The original touch firmware targets this hardware:

| Component | Model used |
|---|---|
| Display/controller | Waveshare ESP32-S3-Touch-LCD-2, ST7789, CST816D |
| Motion sensor | Onboard QMI8658, I²C address 0x6B |
| NFC reader | RC522 / MFRC522 over SPI, powered at 3.3 V |
| Cards | RC522-compatible 13.56 MHz cards/tags, such as MIFARE Classic |
| Speaker | A Spotify Connect device or a Music Assistant player |
| Controller | Home Assistant, ESPHome, and Spotify integration or Music Assistant |

Developed with **ESPHome 2026.9.0**. Other display boards, touch controllers and
RC522 variants are not automatically compatible. Card IDs must use the format
`AA-BB-CC-DD` (4–10 bytes); arbitrary UUID tags are not supported. Spotify playback
control requires an appropriate Premium account. Use separate accounts for
independent simultaneous playback.

## Wiring

These pins apply to the **2-inch Touch-LCD-2 only**. For the 1.47B-M, use the
[office pinout](docs/OFFICE_147B.md#rc522-wiring).

| RC522 | ESP32 GPIO / connector | Wire color in the original build |
|---|---|---|
| SDA / SS | GPIO11 | Orange |
| SCK | GPIO14 | Green |
| MOSI | GPIO13 | Red |
| MISO | GPIO12 | Yellow |
| RST | GPIO15 | Blue |
| GND | GND | Black |
| 3.3V | 3V3 | White |
| IRQ | Not connected | – |

**SDA is the SPI chip-select here, not an I²C connection.** Power the RC522 at 3.3 V.
These pins cannot be shared with a connected camera.

## Setup

### 1. Set up the playback backend

For **Spotify Connect**, configure the [native Spotify integration](https://www.home-assistant.io/integrations/spotify/)
for each account you want to use. First check that its `media_player` exists in
Home Assistant and that the target speaker appears in its source list. If Spotify
does not know the speaker yet, select it once in Spotify Connect. Current OAuth
and developer-app requirements are covered by the linked integration guide.

For **Music Assistant**, configure its Spotify provider and add its integration to
Home Assistant. The target speaker must have a Music Assistant `media_player`
entity. This backend does not need a native Spotify entity for the reader.

### 2. Copy the Home Assistant files

Copy [custom_components/nfc_audiobook](home_assistant/custom_components/nfc_audiobook)
to `/config/custom_components/nfc_audiobook`. Restart Home Assistant after copying
this component and the package below. It provides persistent audiobook bookmarks.


1. Enable [packages](https://www.home-assistant.io/docs/configuration/packages/)
   if needed. Add the following beneath the existing `homeassistant:` section in
   `configuration.yaml`; **do not create a second section**:

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
5. Validate the Home Assistant configuration. If packages were just enabled,
   restart Home Assistant once.

### 3. Install scripts and the dashboard

Install Python 3.10+ on your computer, download this repository, and run from its
root directory:

```sh
python -m pip install -r tools/requirements.txt
python tools/install.py --url http://homeassistant.local:8123
```

Use your reachable Home Assistant address. The helper prompts privately for a
long-lived access token belonging to a Home Assistant administrator. It uses the
token only during installation and does not save it. Alternatively, set `HA_URL`
and `HA_TOKEN` environment variables.

The helper creates the four missing scripts, reloads the configuration and creates
the **NFC Cards** dashboard. Existing scripts and dashboard contents are preserved.
The card library and reader profiles start empty. Open `/nfc-cards/enroll`.
Existing dashboards, including legacy routes, are preserved by the installer.

This is a **first-install helper**, not a migration tool. Back up existing
installations and review changes before updating. In particular, preserve live
`variables.card_map` in the playback script and reader profiles in the reader
configuration script: repository templates start empty. Updating only the
dashboard JavaScript does not update the HA scripts or ESPHome firmware. See
[architecture and update boundaries](docs/ARCHITECTURE.md).

### 4. Set up the ESPHome panel

For the **1.47B-M**, follow its [firmware and pairing guide](docs/OFFICE_147B.md#firmware-and-pairing).
The following steps target the **2-inch touchscreen**.

1. Copy `esphome/nfc_spotify_player.yaml` and `esphome/components/` into your ESPHome
   configuration directory, preserving the relative component path.
2. Copy the entries in [secrets.example.yaml](esphome/secrets.example.yaml) into
   your local `secrets.yaml`: Wi-Fi credentials, API encryption key and OTA password.
   Never publish the real secrets file.
3. Adjust `device_name`, `friendly_name` and `home_assistant_url` at the top of the
   YAML. The Home Assistant address must be **reachable from the ESP**.
4. Flash over USB initially and add the device to Home Assistant through ESPHome,
   using the configured API key.
5. Open the device in Home Assistant. Its URL ends in `/config/devices/device/<ID>`.
   Put this **Home Assistant device ID** into the firmware's `reader_id` substitution.
   It is neither the MAC address nor a card UID. Flash the updated firmware.
6. In the ESPHome device options in Home Assistant, enable **Allow the device to
   perform Home Assistant actions**. Otherwise scans and buttons cannot call actions.

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
4. Choose the default type for new cards and shuffle behavior for music.
5. Click **Save pairing**.

If a reader is missing, scan a card with it and reload the page. A reader without
a profile does not start playback. The same card plays the same content on different
readers through each reader's account/speaker pairing.

## Enroll and manage cards

1. Select the intended reader at the top.
2. In **Enroll**, paste one Spotify link per line.
3. **Start enrollment** fetches titles. Optionally use `Custom title | Link` to
   override Spotify's title. Album links start the whole album, not just a track
   selected by the URL's `highlight` parameter.
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
playback. Saved cards has no duplicate reader selector or inspection controls.

## Audiobook bookmarks

Audiobook cards save their chapter and position on the Home Assistant server.
On the 2-inch display, choose **Restart** or **Continue** when a bookmark exists.
A new book starts immediately. For the 1.47B-M without touch controls, use automatic
continuation; **Restart** is available in the dashboard's Enroll tab for its active book.

In each reader's Configuration, set **Audiobook resume** to **Ask on touchscreen**
or **Continue automatically**. The touchscreen option needs the updated 2-inch
firmware. Pending choices expire after two minutes; scanning another card replaces them.

Bookmarks are scoped to the card, content URI and Spotify account. Music Assistant
uses its integration's default playback user. To share progress across backends or
separate listeners using one account, enter the same/different **Bookmark library**
name in the respective reader profiles. This label groups bookmarks; it does not
change the account used for playback.

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
after installing/updating the component. These adapters use the installed Spotify
and Music Assistant integration clients; a future HA update may require adaptation.

## 3D enclosure rC

![Enclosure rC](enclosure/rC/preview.png)

70 × 50 × 60 mm (width × depth × height), display at the front, reader at the top,
PLA, no screws. [CAD, STLs and assembly/printing instructions](enclosure/rC/README.md).

Physical testing of rB revealed fragile display supports, weak catches and a rocking
display. rC uses broad guides rooted in the side walls, a continuous display support,
replaceable clamp strips in three thicknesses, and four solid locking keys securing
the upper and lower rear panel. The USB opening is on the right when viewed from
the front; the left side is closed.

All printable meshes are watertight. The drawer is collision-free at 101 sampled
positions, and nominal glass/PCB envelopes fit. Short bridges remain at the key
holes. **An actual rC print and mechanical testing are still pending.** Older
rB/rA/r0 designs are retained for reference. Print the rC body and drawer together;
older parts are not compatible.

## Limitations and troubleshooting

- Both display variants are deployed in the project installation. Multiple profiles,
  per-reader enrollment locks and routing are implemented/tested; simultaneous
  independent playback with two physical readers has not been verified.
- Spotify/Home Assistant feedback has latency. Progress is extrapolated locally
  between position updates.
- Separate playback and pause/stop timeouts are deployed on both boards. Physical
  motion-wake sensitivity remains provisional: 0.18 g deviation from a moving baseline.
- Missing speakers: check the account and Spotify Connect availability first.
- No scans: check power, SPI wiring and ESPHome logs, then the device ID and reader
  profile. Arbitrary 125 kHz tags are not supported.
- Stale dashboard: reload the browser. Updates need a new resource URL version
  parameter; the installation helper supplies one.
- An abandoned enrollment lock expires within 90 seconds.
- Avoid simultaneous saves from multiple admin pages. The Home Assistant
  configuration API does not offer atomic version checks.

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
