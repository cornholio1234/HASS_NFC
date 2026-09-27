"""Check printed solids, assembled clearances and cover travel after latch release."""
import json
from pathlib import Path
import warnings
import numpy as np
import trimesh

root = Path(__file__).resolve().parent
report = {}
meshes = {}
for name, dims in [("base", [96, 82, 28.6]), ("cover", [96, 82, 41.6])]:
    mesh = trimesh.load(root / f"{name}.stl", force="mesh")
    assert mesh.is_watertight and mesh.is_winding_consistent, name
    assert mesh.body_count == 1 and mesh.volume > 0, name
    assert np.allclose(mesh.extents, dims, atol=0.001), (name, mesh.extents)
    assert abs(mesh.bounds[0, 2]) < .001, (name, mesh.bounds)
    meshes[name] = mesh
    report[name] = {"watertight": True, "connected_parts": mesh.body_count,
                    "dimensions_mm": mesh.extents.tolist(), "volume_mm3": float(mesh.volume)}

base = meshes["base"]
cover = meshes["cover"].copy()
cover.vertices = np.column_stack((cover.vertices[:, 0], 82-cover.vertices[:, 1], 46-cover.vertices[:, 2]))

def box(origin, size):
    result = trimesh.creation.box(extents=size)
    result.apply_translation(np.asarray(origin) + np.asarray(size)/2)
    return result

def intersection(a, b):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return trimesh.boolean.intersection([a, b], engine="manifold")

def overlap(a, b):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return abs(float(intersection(a,b).volume))

checks = {
    "esp_pcb": ([10,7,29.6], [28,55,1.6]),
    "esp_components_and_buttons": ([10,7,31.2], [28,55,8]),
    "esp_left_plugs_and_wire_bends": ([9,8,6], [5,49,23.6]),
    "esp_right_plugs_and_wire_bends": ([34,8,6], [5,49,23.6]),
    "usb_plug_insertion": ([12,-20,27], [24,27,12]),
    "rc522_pcb": ([48,10,40.8], [40,60,1.6]),
    "rc522_components": ([48,10,32.8], [40,60,8]),
    "rc522_plugs_and_wire_bends": ([54,8,13], [30,12,27.8]),
}
envelopes = {name: box(*data) for name, data in checks.items()}
report["assembled_shell_overlap_mm3"] = overlap(base, cover)
assert report["assembled_shell_overlap_mm3"] < .001
for name, envelope in envelopes.items():
    amount = overlap(base, envelope) + overlap(cover, envelope)
    assert amount < .001, (name, amount)
    report[name] = {"origin_mm": checks[name][0], "size_mm": checks[name][1], "overlap_mm3": amount}

# Foam fills the designed gaps, without compressing the PCB against the cover.
for y in (24,44):
    pad = box([17,y,28.6], [14,10,1])
    assert overlap(base,pad) + overlap(cover,pad) < .001
for x in (50,80):
    for y in (12,62):
        pad = box([x,y,42.4],[6,6,2])
        assert overlap(base,pad) + overlap(cover,pad) < .001

# The latch noses deliberately retain the cover. Model their released position
# by removing only the outward projection; this is a kinematic clearance check.
cuts = [box([x,21,23.19], [1.02,10,2.64]) for x in (1.79,93.19)]
cuts += [box([x,59,23.19], [1.02,10,2.64]) for x in (1.79,93.19)]
released = trimesh.boolean.difference([base,*cuts], engine="manifold")
worst = 0
for dz in np.arange(0,50.01,1):
    moving = cover.copy()
    moving.apply_translation([0,0,dz])
    worst = max(worst, overlap(released,moving))
    for name, envelope in envelopes.items():
        if name.startswith("esp") or name.startswith("usb"):
            assert overlap(moving,envelope) < .001, ("cover travel",name,dz)
        elif name.startswith("rc522"):
            lifted = envelope.copy()
            lifted.apply_translation([0,0,dz])
            assert overlap(released,lifted) < .001, ("reader travel",name,dz)
            for fixed_name, fixed in envelopes.items():
                if fixed_name.startswith("esp") or fixed_name.startswith("usb"):
                    assert overlap(lifted,fixed) < .001, ("reader travel",name,fixed_name,dz)
assert worst < .001, worst
report["cover_lift_after_latch_release"] = {"sampled_positions":51,"maximum_overlap_mm3":worst}
report["mounting"] = {"esp_foam_mm":1,"rc522_foam_mm":2,"roof_minimum_mm":1.3,
                      "latch_deflection_mm":.6,"latch_vertical_clearance_mm":.2,
                      "pcb_clamping_preload_mm":0}
report["scope"] = "Nominal geometry and clearance checks. Print, latch force, adhesive retention and hardware fit require a physical assembly."
(root / "mesh-check.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,indent=2))
