# NFC Jukebox enclosure rA

> Archived revision. Current design: [rC](../rC/README.md).

**PLA prototype, 70 mm wide x 50 mm deep x 60 mm tall.** Display at the front,
RC522 horizontal under the roof. Two printed parts, no screws.

Compared with r0, the drawer adds a 45-degree brace under the upper RC522 stop and a sloping roof above the grip opening. The body and interfaces are unchanged.

## Files and printing

- `body.stl`: already oriented with the **flat top** on the print bed.
- `drawer.stl`: floor and rear panel as one part, floor down.
- `jukebox.scad`: editable source for OpenSCAD 2021.01 or later.
- `preview.png`, `assembly.png`: exterior and exploded views.

Starting settings: PLA, 0.2 mm layers, 0.4 mm nozzle, three wall lines.
Use targeted supports for the broad display opening and side openings; inspect the small guides and upper drawer stop. The two former horizontal drawer overhangs are replaced with 45-degree slopes.

## Assembly

1. With the drawer removed, slide the display upward through the open bottom into
   the front guides. Guides retain the outer glass margins; the PCB remains clear.
2. Slide the RC522 in from the rear, antenna side upward, components and soldered
   wires downward. The guide slot is 2.4 mm high.
3. Arrange wires inside. Side openings on both sides allow USB access regardless
   of display orientation.
4. Slide the drawer in from the rear. Its fingers support the display from below.
   Both latch arms engage sideways. To open, press them inward through the two
   lower side openings and pull the drawer out using its rear grip opening.

## Geometry and clearances

Both STLs are closed, consistently oriented meshes with one connected body each.
Closed fit and drawer travel were checked geometrically; the catches deliberately
need to deflect by 0.45 mm during insertion.

The roof is 1.2 mm thick, with 0.8 mm nominal clearance above the RC522 PCB.
The top provides a flat card rest; full-size cards overhang the sides.

## Dimension references

- [Waveshare drawing](https://docs.waveshare.com/assets/images/ESP32-S3-Touch-LCD-2-details-size-278bc3bf787fd611bc1c00415ceca7c9.webp):
  glass 58.8 x 37.1 x 1.1 mm, PCB 48.2 x 35 mm.
- [Joy-IT RC522](https://joy-it.net/en/products/SBC-RFID-RC522): nominal 60 x 40 mm;
  CAD board thickness: 1.6 mm.
