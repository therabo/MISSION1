import struct,json,hashlib,numpy as np
from pathlib import Path
import os
repo=Path(os.environ.get('MISSION1_REPO_ROOT',Path(__file__).resolve().parents[4]))
evidence=Path(os.environ.get('MISSION1_EVIDENCE_DIR','/tmp/mission1-rendering-evidence'));evidence.mkdir(parents=True,exist_ok=True)
p=repo/'frontend/public/models/iss-vtad-source-png.glb'; raw=p.read_bytes(); n=struct.unpack_from('<I',raw,12)[0]; g=json.loads(raw[20:20+n]); b=raw[28+n:]
def local(node):
 if 'matrix' in node:return np.array(node['matrix']).reshape(4,4,order='F')
 t=np.eye(4);t[:3,3]=node.get('translation',[0,0,0]);x,y,z,w=node.get('rotation',[0,0,0,1]);r=np.eye(4);r[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];return t@r@np.diag(node.get('scale',[1,1,1])+[1])
from collections import defaultdict
seen={};dups=[];deg=[];normals={}
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];item=np.dtype(dtype).itemsize;return np.ndarray((a['count'],k),dtype=dtype,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',k*item),item))
def walk(i,parent):
 node=g['nodes'][i];m=parent@local(node)
 if 'mesh' in node:
  for pi,prim in enumerate(g['meshes'][node['mesh']]['primitives']):
   pts=accessor(prim['attributes']['POSITION']);world=(m@np.column_stack([pts,np.ones(len(pts))]).T).T[:,:3];idx=accessor(prim['indices']).ravel() if 'indices'in prim else np.arange(len(pts));tri=world[idx.reshape(-1,3)];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1);deg.append({'node':i,'name':node['name'],'material':prim.get('material'),'degenerate':int((area<1e-9).sum())})
   for face in tri[area>1e-9]:
    key=tuple(sorted(tuple(v) for v in np.round(face,5)));rec=(i,pi,prim.get('material'))
    normal=np.cross(face[1]-face[0],face[2]-face[0]);normal/=np.linalg.norm(normal)
    if key in seen:dups.append({'first':seen[key],'second':rec,'windingDot':float(np.dot(normal,normals[key]))})
    else:seen[key]=rec;normals[key]=normal
 for c in node.get('children',[]):walk(c,m)
for i in g['scenes'][g.get('scene',0)]['nodes']:walk(i,np.eye(4))
counts=defaultdict(int)
for d in dups:counts[(tuple(d['first']),tuple(d['second']))]+=1
summary=[{'first':a,'second':bb,'count':n,'names':[g['nodes'][a[0]]['name'],g['nodes'][bb[0]]['name']],'materials':[g['materials'][a[2]]['name'] if a[2] is not None else 'default',g['materials'][bb[2]]['name'] if bb[2] is not None else 'default']}for (a,bb),n in sorted(counts.items(),key=lambda x:-x[1])]
(evidence/'geometry-overlap.json').write_text(json.dumps({'toleranceMeters':1e-5,'nonDegenerateDuplicateFaces':len(dups),'faces':dups,'groups':summary,'degenerateTriangles':[d for d in deg if d['degenerate']]},indent=2));print(json.dumps(summary[:20],indent=2))
