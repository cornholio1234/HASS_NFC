# Third-party licenses

The root MIT license applies to this project's original dashboard, configuration,
installation tooling, documentation and CAD designs. It does not replace
licenses for third-party code.

## ESPHome CST816 component

`esphome/components/cst816/` derives from ESPHome **2026.9.0**:
https://github.com/esphome/esphome/tree/2026.9.0/esphome/components/cst816

Copyright (c) 2019 ESPHome. Per upstream's license, the C++ runtime (`.cpp`, `.h`)
is GPLv3; the Python code is MIT. The complete upstream license is included at
[esphome/components/cst816/LICENSE](esphome/components/cst816/LICENSE).

Local changes dated 2026-09-26 reject invalid touch counts and out-of-range raw
coordinates before dispatch. The C++ modifications remain under the upstream
GPLv3 license. The hardware cause of invalid readings has not been established.

Compiled ESPHome firmware incorporates GPLv3 runtime code. This repository
publishes source, not prebuilt firmware; do not describe compiled firmware as
MIT-only. ESPHome and its build dependencies retain their respective licenses.

Spotify, Home Assistant, Waveshare and ESPHome are independent projects/products;
their names identify compatibility. No Spotify audio, artwork or account data
is bundled. Hardware drawings are linked as references, not redistributed.
