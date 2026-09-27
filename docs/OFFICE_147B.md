# Office reader: ESP32-S3-LCD-1.47B-M

This is a second, display-only NFC jukebox variant. It shows artwork, title,
artist and progress on a 320 × 172 landscape screen. There are no touch buttons,
seek zones or media-control action handlers. A card scan still starts playback
through the shared Home Assistant card library and this reader's own profile.

**Status:** built with ESPHome 2026.9.0, flashed to the project board and connected
to Home Assistant. OTA updates and configurable timeout values have been verified.
Motion-wake sensitivity and physical enclosure fit still need verification.

## Exact hardware variant

Use **Waveshare ESP32-S3-LCD-1.47B** or **1.47B-M**. The M suffix means pre-soldered
headers. This is not the non-B USB-A board and not the Touch-LCD-1.47. Their pin
assignments differ. The B board has 16 MB flash, 8 MB octal PSRAM, ST7789 LCD and
an onboard QMI8658 IMU. No touchscreen is fitted.

## RC522 wiring

The header labels below refer to GPIO numbers, not physical pin positions.

| RC522 label | Board header label | Wire color used in the original project |
|---|---|---|
| SDA / SS | **11** | Orange |
| SCK | **7** | Green |
| MOSI | **8** | Red |
| MISO | **9** | Yellow |
| RST | **10** | Blue |
| 3.3V | **3V3** | White |
| GND | **G / GND** | Black |
| IRQ | Leave unconnected | — |

GPIO7–11 are adjacent free pins on the header. With the board viewed from the rear
and the USB-C connector at the top, they are on the right, below GND: 11, 10, 9,
8, 7 from top to bottom. 3V3 is on the other header. Follow the printed labels.
Use **3V3**, not 5V/VBUS or BAT. SDA on the RC522 is the SPI chip-select in this setup.

The firmware uses a separate SPI bus at 1 MHz for the reader. Board-reserved pins:

| Function | GPIO |
|---|---|
| LCD MOSI / clock | 45 / 40 |
| LCD CS / DC / reset | 42 / 41 / 39 |
| LCD backlight | 46 |
| QMI8658 SDA / SCL | 48 / 47 |
| RGB LED | 38, playback rainbow / connection status |
| SD card | 14, 15, 16, 17, 18, 21, unused by this firmware |

## Firmware and pairing

Source: [nfc_office_147b.yaml](../esphome/nfc_office_147b.yaml).

1. Copy the source into your ESPHome configuration directory. It uses only native
   ESPHome components and does not need the CST816 override.
2. Supply your Wi-Fi, API key and OTA password through `secrets.yaml`, using
   [secrets.example.yaml](../esphome/secrets.example.yaml). Set a unique device name
   and the Home Assistant URL.
3. For the first flash, connect USB-C with a data cable. Build in ESPHome and use
   its browser/USB installation flow. If needed, hold BOOT while connecting USB,
   release it after the serial port appears, then flash.
4. Add the device to Home Assistant through ESPHome. Allow it to perform Home
   Assistant actions. Copy its HA device ID from `/config/devices/device/<ID>` into
   the `reader_id` substitution, then rebuild and upload through OTA.
5. In **NFC Cards → Configuration → Pair another reader**, select the new device,
   its playback backend and the office speaker. For Spotify Connect, select the
   Spotify account and source; for Music Assistant, select the target player entity.
   Save the pairing.
6. Scan a known card. The shared library already contains its content; no duplicate
   card enrollment is needed. Verify that playback goes to the intended speaker.

Until a matching profile exists, the display shows **Pair reader in Home Assistant**.
Separate simultaneous playback requires separate Spotify accounts. A new reader
does not alter the existing reader's profile automatically.

Display timeouts can be set per reader in NFC Cards → Configuration: one for playback and one for paused/stopped playback. Both default to 60 seconds; 0 keeps the display on. Values persist on the device. A playback-state change restarts the inactivity timer. The onboard RGB LED cycles through rainbow colors at **100% brightness** while the assigned player is playing and turns off while paused/stopped. A missing Home Assistant state subscription takes priority and lights the LED solid red at 25% brightness; log-only API connections do not count as Home Assistant.
NFC, Wi-Fi and playback continue. Nudge the device or scan a card to wake it. This
board has no touch sensor, so touching stationary glass alone cannot wake it.
The provisional motion threshold is a 0.18 g change from a moving baseline.

## Flat enclosure

[CAD, STLs and assembly instructions](../enclosure/office-147b/r0/README.md).
70 × 50 × 40 mm (width × depth × height), display front, card reader under the top.
This is a new prototype, not a physically validated fit. Module depth, USB plug
size and actual solder/header clearance must be checked before final assembly.

## Manufacturer references

- [Board and interfaces](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.47B)
- [Circuit schematic](https://files.waveshare.com/wiki/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B_schematic_diagram.pdf)
- [Board dimensions](https://www.waveshare.com/img/devkit/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B-details-size.jpg)
- [Header pinout](https://www.waveshare.com/img/devkit/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B-details-inter.jpg)
- [Manufacturer demo](https://files.waveshare.com/wiki/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B-Demo.zip)

The demo confirms 172 × 320 pixels, a 34-pixel X offset in display RAM, BGR color
order and the LCD GPIO mapping. References remain with their original owners;
their drawings and demo source are not redistributed in this repository.
