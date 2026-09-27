# Office reader: ESP32-S3-LCD-1.47B-M

Display-only NFC reader with artwork, title, artist and progress on a 320 × 172
landscape screen. Card scans use the shared Home Assistant card library and the
reader's playback profile. Firmware targets ESPHome 2026.9.0.

## Hardware

Supported boards: **Waveshare ESP32-S3-LCD-1.47B** and **1.47B-M** (pre-soldered
headers). Both have 16 MB flash, 8 MB octal PSRAM, an ST7789 LCD, QMI8658 IMU
and RGB LED. Input is provided by the NFC reader and motion sensor.

## RC522 wiring

| RC522 label | Board GPIO / connector | Wire color |
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
8, 7 from top to bottom. 3V3 is on the other header. RC522 supply voltage is 3.3 V;
SDA is the SPI chip-select.

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

1. Copy the source into the ESPHome configuration directory. This variant uses
   native ESPHome components.
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
6. Scan a mapped card to start playback on the configured speaker.

Each reader uses a separate profile. Independent simultaneous playback requires
separate Spotify accounts.

Display timeouts are set in **NFC Cards → Configuration**, separately for playback
and pause/stop. Both default to 60 seconds; 0 keeps the display on. Values persist
on the device. A playback-state change restarts the inactivity timer.

| LED state | Meaning |
|---|---|
| Rainbow, 100% brightness | Playback active |
| Off | Paused or stopped |
| Red, 25% brightness | Home Assistant state connection unavailable |

NFC, Wi-Fi and playback continue while the backlight is off. Motion or a card scan
wakes the display. The motion threshold is a 0.18 g change from a moving baseline.

## Audiobook continuation

Set **Audiobook resume → Continue automatically** in this reader profile. Saved
chapters resume automatically; restart the active audiobook from the dashboard
Enroll tab. Bookmarks are stored in Home Assistant.

## Manufacturer references

- [Board and interfaces](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.47B)
- [Circuit schematic](https://files.waveshare.com/wiki/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B_schematic_diagram.pdf)
- [Board dimensions](https://www.waveshare.com/img/devkit/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B-details-size.jpg)
- [Header pinout](https://www.waveshare.com/img/devkit/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B-details-inter.jpg)
- [Manufacturer demo](https://files.waveshare.com/wiki/ESP32-S3-LCD-1.47B/ESP32-S3-LCD-1.47B-Demo.zip)

Display configuration: 172 × 320 pixels, 34-pixel X offset, BGR color order,
90° landscape rotation.
