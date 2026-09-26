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
        assert np.allclose(mesh.extents, [70, 50, 60]), mesh.extents
    results[name] = {
        'watertight': bool(mesh.is_watertight),
        'winding_consistent': bool(mesh.is_winding_consistent),
        'bodies': int(mesh.body_count),
        'bounds_mm': mesh.bounds.tolist(),
        'volume_mm3': float(mesh.volume),
    }
(root / 'mesh-check.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
