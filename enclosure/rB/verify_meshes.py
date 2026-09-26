"""Run with Python + trimesh + numpy + scipy. Does not alter the meshes."""
import json
from pathlib import Path
import numpy as np
import trimesh

root = Path(__file__).resolve().parent
results = {}
for name in ('gehaeuse.stl', 'einschub.stl'):
    mesh = trimesh.load(root / name)
    assert mesh.is_watertight, name
    assert mesh.is_winding_consistent, name
    assert mesh.body_count == 1, name
    assert mesh.volume > 0, name
    assert mesh.bounds[0, 2] >= -1e-5, name
    if name == 'gehaeuse.stl':
        assert np.allclose(mesh.extents, [70, 60, 50]), mesh.extents
        # Geometric screen only: not a slicer simulation or print validation.
        # Ignore the first layer and numerical noise around exactly 45 degrees.
        downward = (mesh.face_normals[:, 2] < -0.708) & (mesh.triangles_center[:, 2] > 0.21)
        overhang_area = float(mesh.area_faces[downward].sum())
        assert overhang_area < 0.01, overhang_area
    results[name] = {
        'watertight': bool(mesh.is_watertight),
        'winding_consistent': bool(mesh.is_winding_consistent),
        'bodies': int(mesh.body_count),
        'bounds_mm': mesh.bounds.tolist(),
        'volume_mm3': float(mesh.volume),
    }
    if name == 'gehaeuse.stl':
        results[name]['downward_area_steeper_than_45deg_above_first_layer_mm2'] = overhang_area
(root / 'mesh-check.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
