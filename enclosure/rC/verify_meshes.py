"""Geometric checks only; no substitute for printing and fitting real hardware."""
import json
from pathlib import Path
import numpy as np
import trimesh
root = Path(__file__).resolve().parent
results = {}
expected = {'gehaeuse.stl':1,'einschub.stl':1,'riegel.stl':4,'riegel-lose.stl':4,
            'klemmleisten-normal.stl':2,'klemmleisten-eng.stl':2,'klemmleisten-lose.stl':2}
for name, count in expected.items():
    m = trimesh.load(root/name)
    assert m.is_watertight and m.is_winding_consistent, name
    assert m.body_count == count, (name, m.body_count)
    assert all(p.volume > 0 for p in m.split()), name
    assert abs(m.bounds[0,2]) < 1e-5, (name, m.bounds)
    if name == 'gehaeuse.stl':
        assert np.allclose(m.extents,[70,60,50]), m.extents
    down=(m.face_normals[:,2] < -0.708)&(m.triangles_center[:,2] > .21)
    results[name]={'watertight':True,'consistent_winding':True,'bodies':int(m.body_count),
      'extents_mm':m.extents.tolist(),'volume_mm3':float(m.volume),
      'downward_area_above_first_layer_mm2':float(m.area_faces[down].sum())}
# Transform exports back into assembly coordinates.
b=trimesh.load(root/'gehaeuse.stl'); b.vertices=np.column_stack((b.vertices[:,0],b.vertices[:,2],60-b.vertices[:,1]))
d=trimesh.load(root/'einschub.stl');d.apply_translation([0,0,.9])
inter=trimesh.boolean.intersection([b,d],engine='manifold')
assert abs(inter.volume)<1e-6, inter.volume
results['closed_body_drawer_overlap_mm3']=float(inter.volume)
# Sample the complete 50 mm withdrawal path at 0.5 mm steps.
travel_max=0.0
for dy in np.arange(0,50.01,.5):
    moving=d.copy(); moving.apply_translation([0,dy,0])
    hit=trimesh.boolean.intersection([b,moving],engine='manifold')
    travel_max=max(travel_max,abs(float(hit.volume)))
assert travel_max<1e-5, travel_max
results['drawer_travel_101_positions_max_overlap_mm3']=travel_max
# Nominal glass, display PCB and RFID board must not intersect the plastics.
for label, extents, origin in [('glass',[58.8,1.1,37.1],[5.6,2,11.45]),
                             ('display_pcb',[48.2,1.6,35],[10.9,4.6,12.5]),
                             ('rfid_pcb',[60,40,1.6],[5,5,56.4])]:
    h=trimesh.creation.box(extents=extents)
    h.apply_translation(np.array(origin)+np.array(extents)/2)
    v=sum(abs(trimesh.boolean.intersection([plastic,h],engine='manifold').volume) for plastic in (b,d))
    assert v<1e-3,(label,v)
    results[label+'_body_drawer_overlap_mm3']=float(v)
# Narrow sloped strips meet the retaining rails, not the narrower PCB.
for fit in [0,.15,.30]:
    s=trimesh.load(root/('klemmleisten-'+{0:'eng',.15:'normal',.30:'lose'}[fit]+'.stl'))
    # First strip is printed at X 0..2.8. Test it then its mirrored copy.
    a=min(s.split(),key=lambda x:x.bounds[0,0])
    a.vertices=np.column_stack((a.vertices[:,0]+5.8,a.vertices[:,2]+3.1+fit,48.15-a.vertices[:,1]))
    # Printed transform uses glass_z+glass_h-0.4 = 48.15.
    overlap=trimesh.boolean.intersection([b,a],engine='manifold')
    assert abs(overlap.volume)<1e-4, (fit,overlap.volume)
    results[f'left_strip_{fit}_body_overlap_mm3']=float(overlap.volume)
results['limits']='Nominal hardware envelopes only. No physical fit, strength or slicer validation.'
(root/'mesh-check.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
