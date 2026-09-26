# Local CST816 input validation

Copied from the installed ESPHome 2026.9.0 CST816 component (ESPHome: C++ under GPLv3; Python under MIT).
Only the touchscreen platform is used in this project.

The local change rejects non-single-touch samples and coordinates outside the
configured calibration bounds before calling `add_raw_touch_position_`.
Bounds are checked after the configured axis swap, matching ESPHome's calibration
order. Endpoints are accepted. Invalid samples preserve an existing touch rather
than synthesizing a release and another press.

Reason: on 2026-09-26 at 13:13:41 the panel reported swapped raw coordinates
3328,64. ESPHome clamped these to screen coordinates 319,175 and the Next button
sent a media_next_track service call at 13:13:42.

This rejects out-of-range data; it does not identify the electrical cause or
reject ghost touches whose coordinates happen to lie within the valid bounds.
Keep this local change when upgrading ESPHome, or remove the override once an
equivalent upstream guard is verified.

License text: [LICENSE](LICENSE). Modifications dated 2026-09-26.
