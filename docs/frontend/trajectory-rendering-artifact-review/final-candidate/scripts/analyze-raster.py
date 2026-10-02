"""Compare actual isolated on/off raster against genuine projected source segments."""
from pathlib import Path
import json, sys, io, zipfile, hashlib
import numpy as np
from PIL import Image, ImageDraw
folder=Path(sys.argv[1]);report=[]
archive=None;archived={}
def loadImage(path):
 global archive,archived
 if path.exists():return Image.open(path)
 # Baseline is immutable; its native originals were verified and compacted.
 # Never substitute archived images for a current candidate capture.
 if not path.name.startswith(('accepted-baseline-raster-','baseline-boundary-')):raise FileNotFoundError(path)
 if archive is None:
  manifest=json.loads((folder.parent/'final-native-capture-preservation.json').read_text())
  archive=zipfile.ZipFile(manifest['archive']);archived={r['path']:r for r in manifest['originals']}
 row=archived[str(path.resolve())];data=archive.read(row['archivePath']);assert hashlib.sha256(data).hexdigest()==row['sha256']
 return Image.open(io.BytesIO(data))
for data in sorted(folder.glob('*-sweep.json')):
 build=json.loads(data.read_text())
 for pose in build['poses']:
  prefix=f"{build['label']}-{pose['source']}-{pose['name']}"
  off=np.asarray(loadImage(folder/(prefix+'-off.png')).convert('RGB'),dtype=np.int16)
  beforeFile=folder/(prefix+'-off-before.png');noise=np.max(np.abs(np.asarray(loadImage(beforeFile).convert('RGB'),dtype=np.int16)-off),axis=2) if beforeFile.exists() or beforeFile.name.startswith(('accepted-baseline-raster-','baseline-boundary-')) else np.zeros(off.shape[:2],dtype=np.int16)
  points=np.array([[p['pixel']['x'],p['pixel']['y']] if p['pixel'] else [np.nan,np.nan] for p in pose['projectedSamples']])
  clipped=pose.get('projectedClippedSegments')
  if clipped is not None:
   segments=np.array([[[p['x'],p['y']] for p in segment] for segment in clipped]);a,b=segments[:,0],segments[:,1]
  else:a,b=points[:-1],points[1:]
  good=np.isfinite(a).all(axis=1)&np.isfinite(b).all(axis=1);a,b=a[good],b[good]
  for layer,width in [('body',8),('halo',20),('both',20)]:
   fn=folder/(prefix+'-'+layer+'.png');im=loadImage(fn).convert('RGB');on=np.asarray(im,dtype=np.int16)
   threshold=pose.get('analysisThreshold',8);delta=np.max(np.abs(on-off),axis=2);accent=on[:,:,1]-off[:,:,1]>threshold if pose['source']=='PRIMARY_GP_TLE' else on[:,:,0]-off[:,:,0]>threshold;ys,xs=np.nonzero((delta>noise+threshold)&accent)
   pixels=np.column_stack([xs/2+420,ys/2+200]);edge=b-a
   hull=np.array([[p['x'],p['y']] for p in pose['hull']]);hullEdge=np.roll(hull,-1,axis=0)-hull
   rel=pixels[:,None,:]-hull[None,:,:];cross=hullEdge[None,:,0]*rel[:,:,1]-hullEdge[None,:,1]*rel[:,:,0]
   # Texture/PBR/OIT differences on the station are not trajectory coverage.
   outsideModel=np.any(cross < -np.sqrt(np.sum(hullEdge*hullEdge,axis=1))[None,:],axis=1)
   pixels=pixels[outsideModel]
   if len(pixels):
    phase=np.clip(np.sum((pixels[:,None,:]-a[None,:,:])*edge[None,:,:],axis=2)/np.maximum(np.sum(edge*edge,axis=1),1e-12),0,1)
    distances=np.sqrt(np.sum((pixels[:,None,:]-(a[None,:,:]+phase[:,:,None]*edge[None,:,:]))**2,axis=2)).min(axis=1)
   else:distances=np.array([])
   outside=distances>(width+.5)/2+1.5
   row=dict(build=build['label'],source=pose['source'],pose=pose['name'],layer=layer,foregroundPixels=len(pixels),pixelsOutsideCoverage=int(outside.sum()),maxDistanceCssPixels=float(distances.max()) if len(distances) else None)
   report.append(row)
   # Compact native-pixel detail of station and nearby fold for direct review.
   im.crop((240,0,640,700)).save(folder/(prefix+'-'+layer+'-detail.png'))
   diff=np.clip(np.abs(on-off)*4,0,255).astype(np.uint8);Image.fromarray(diff).crop((240,0,640,700)).save(folder/(prefix+'-'+layer+'-difference.png'))
(folder/'raster-analysis.json').write_text(json.dumps(report,indent=2))
for b in sorted(set(x['build'] for x in report)):
 rows=[x for x in report if x['build']==b]
 print(b,'poses',len(rows)//3,'leaking cases',sum(x['pixelsOutsideCoverage']>0 for x in rows),'outside pixels',sum(x['pixelsOutsideCoverage'] for x in rows))
 for x in rows:
  if x['pixelsOutsideCoverage']>0:print(x)
