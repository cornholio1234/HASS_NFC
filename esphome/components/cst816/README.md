# Local CST816 input validation

Based on the ESPHome 2026.9.0 CST816 touchscreen component.
License: C++ under GPLv3; Python under MIT.

The local change rejects non-single-touch samples and coordinates outside the
configured calibration bounds before calling `add_raw_touch_position_`.
Bounds are checked after the configured axis swap, matching ESPHome's calibration
order. Endpoints are accepted. Invalid samples preserve an existing touch rather
than synthesizing a release and another press.

License text: [LICENSE](LICENSE). Modifications dated 2026-09-26.
