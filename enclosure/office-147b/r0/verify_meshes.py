"""Geometry checks for the office prototype; not a physical fit/strength test."""
from pathlib import Path
import json
import warnings
import numpy as np
import trimesh

root=Path(__file__).resolve().parent
results={}
meshes={}
names=['body','drawer','retainer','retainer-4mm','retainer-5mm','retainer-6mm','retainer-8mm','keys']
for name in names:
    m=trimesh.load(root/(name+'.stl'))
    assert m.is_watertight and m.is_winding_consistent,name
    assert m.body_count==(4 if name=='keys' else 1),(name,m.body_count)
    assert all(x.volume>0 for x in m.split()),name
    assert abs(m.bounds[0,2])<1e-5,(name,m.bounds)
    down=(m.face_normals[:,2]<-.708)&(m.triangles_center[:,2]>.21)
    results[name]={'watertight':True,'bodies':m.body_count,'extents_mm':m.extents.tolist(),
                   'volume_mm3':float(m.volume),'downward_area_mm2':float(m.area_faces[down].sum())}
    meshes[name]=m
assert np.allclose(meshes['body'].extents,[70,40,50])
body=meshes['body'].copy()
body.vertices=np.column_stack((body.vertices[:,0],body.vertices[:,2],40-body.vertices[:,1]))
drawer=meshes['drawer'].copy();drawer.apply_translation([0,0,.9])

def overlap(a,b):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore',RuntimeWarning)
        return abs(float(trimesh.boolean.intersection([a,b],engine='manifold').volume))

def envelope(origin,extents):
    m=trimesh.creation.box(extents=extents)
    m.apply_translation(np.array(origin)+np.array(extents)/2)
    return m

worst=0
for dy in np.arange(0,50.01,.5):
    moving=drawer.copy();moving.apply_translation([0,dy,0])
    worst=max(worst,overlap(body,moving))
assert worst<1e-4,worst
results['drawer_travel_101_positions_overlap_mm3']=worst

for depth in [4,5,6,7,8]:
    name='retainer' if depth==7 else f'retainer-{depth}mm'
    retainer=meshes[name].copy()
    v=retainer.vertices.copy()
    retainer.vertices=np.column_stack((v[:,0]+14.815,28.5-v[:,2],v[:,1]+5.8))
    assert overlap(body,retainer)<1e-4
    assert overlap(drawer,retainer)<1e-4
    module=envelope([16.815,2,6],[36.37,depth,20.32])
    assert overlap(body,module)<1e-4
    assert overlap(drawer,module)<1e-4
    assert overlap(retainer,module)<1e-4
    for z in [6,23.32]:
        header=envelope([20.815,2+depth,z],[23,15,3])
        assert overlap(retainer,header)<1e-4,(depth,'header clearance')
    worst=0
    for dz in np.arange(0,30.01,.5):
        moving=retainer.copy();moving.apply_translation([0,0,-dz])
        worst=max(worst,overlap(body,moving),overlap(module,moving))
    assert worst<1e-4,(depth,worst)
    results[f'retainer_{depth}mm_insertion_overlap_mm3']=worst

for label,origin,extents in [('rc522_pcb',[5,5,36.4],[60,40,1.6]),
                             ('rc522_components',[7,7,29.4],[56,36,7])]:
    box=envelope(origin,extents)
    v=overlap(body,box)+overlap(drawer,box)+overlap(retainer,box)
    assert v<1e-3,(label,v)
    results[label+'_overlap_mm3']=v
results['limits']='Board footprint sourced; module thickness, window alignment, plugs, solder and component envelopes provisional. No physical print/fit/strength/RFID test.'
(root/'mesh-check.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,indent=2))
