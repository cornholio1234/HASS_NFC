"""Check printed solids, assembled clearances and cover travel after latch release."""
import json
from pathlib import Path
import warnings
import numpy as np
import trimesh

root = Path(__file__).resolve().parent
report = {}
meshes = {}
for name, dims in [("base", [96, 82, 43.8]), ("cover", [96, 82, 41.6])]:
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
    "esp_pcb": ([10,7,29.6], [27.94,48.26,1.6]),
    "esp_components_and_buttons": ([11,7,31.2], [25.94,54.3,8]),
    "esp_left_plugs_and_wire_bends": ([9,8,6], [5,49,23.6]),
    "esp_right_plugs_and_wire_bends": ([34,8,6], [5,49,23.6]),
    "usb_plug_insertion": ([12,-20,27], [24,27,12]),
    "rc522_pcb": ([48,10,40.8], [40,60,1.6]),
    "rc522_components": ([50,10,32.8], [36,60,8]),
    "rc522_plugs_and_wire_bends": ([54,8,13], [30,12,27.8]),
}
envelopes = {name: box(*data) for name, data in checks.items()}
report["assembled_shell_overlap_mm3"] = overlap(base, cover)
assert report["assembled_shell_overlap_mm3"] < .001
for name, envelope in envelopes.items():
    amount = overlap(base, envelope) + overlap(cover, envelope)
    assert amount < .001, (name, amount)
    report[name] = {"origin_mm": checks[name][0], "size_mm": checks[name][1], "overlap_mm3": amount}

# Every board is supported and positively captured in all six translation
# directions. This checks the retention geometry, not spring force.
for name in ("esp_pcb", "rc522_pcb"):
    contacts = {}
    for axis in range(3):
        for sign in (-1,1):
            moved = envelopes[name].copy()
            delta = np.zeros(3); delta[axis] = sign*.1
            moved.apply_translation(delta)
            amount = overlap(base,moved)
            assert amount > .01, ("unrestrained PCB",name,axis,sign,amount)
            contacts[f'{"xyz"[axis]}{sign:+d}'] = amount
    report[name]["retention_contacts_at_0_1_mm_translation"] = contacts

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
        assert overlap(moving,envelope) < .001, ("cover travel",name,dz)
assert worst < .001, worst
report["cover_lift_after_latch_release"] = {"sampled_positions":51,"maximum_overlap_mm3":worst}
report["mounting"] = {"pcb_clips_per_board":4,"pcb_thickness_mm":1.6,"roof_minimum_mm":1.3,
                      "floor_mm":3.6,"pcb_clip_leaf_mm":2.4,"pcb_clip_root_mm":3.2,
                      "pcb_clip_widths_mm":{"esp32":12,"rc522":10},
                      "latch_deflection_mm":.6,"latch_vertical_clearance_mm":.2,
                      "pcb_clamping_preload_mm":0}
report["scope"] = "Nominal geometry and clearance checks. Printed clip fit, retention force and hardware fit require a physical assembly."
(root / "mesh-check.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,indent=2))
