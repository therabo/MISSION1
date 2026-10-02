"""Native current/old-gap/off raster controls, at the SAME current camera pose."""
from pathlib import Path
import json,gzip,sys,hashlib,zipfile
import numpy as np
from PIL import Image
writeSequences='--metrics-only' not in sys.argv[3:]
raw=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True);runs=[];metrics=[]
for f in sorted(raw.glob('*.json.gz')):
 frames=json.loads(gzip.decompress(f.read_bytes()));run=[];images=[]
 for row in frames:
  prefix=f.stem.removesuffix('.json')+f'-{row["frame"]:03d}'
  current=np.asarray(Image.open(raw/(prefix+'-current.png')).convert('RGB'),dtype=np.int16)
  old=np.asarray(Image.open(raw/(prefix+'-previous-gap.png')).convert('RGB'),dtype=np.int16)
  off=np.asarray(Image.open(raw/(prefix+'-off.png')).convert('RGB'),dtype=np.int16)
  clip=row['rasterClip'];m=row['mask'];yy,xx=np.indices(current.shape[:2]);x=xx/2+clip['x'];y=yy/2+clip['y'];outside=np.hypot(x-m['center']['x'],y-m['center']['y'])>m['radius']+1
  before=np.asarray(Image.open(raw/(prefix+'-off-before.png')).convert('RGB'),dtype=np.int16)
  noise=np.max(np.abs(before-off),axis=2)
  # Presence uses absolute color change: a valid cyan/amber line can darken a
  # bright atmosphere/cloud pixel instead of increasing its accent channel.
  line=(np.max(np.abs(current-off),axis=2)>noise+8)&outside
  oldLine=(np.max(np.abs(old-off),axis=2)>noise+8)&outside
  changed=(np.max(np.abs(current-old),axis=2)>noise+8)&outside
  expected=[p for p in row['safeRasterScreens'] if clip['x']+6<=p['x']<=clip['x']+clip['width']-6 and clip['y']+6<=p['y']<=clip['y']+clip['height']-6]
  missed=[]
  for p in expected:
   px=int(round((p['x']-clip['x'])*2));py=int(round((p['y']-clip['y'])*2))
   if not line[max(0,py-12):py+13,max(0,px-12):px+13].any():missed.append(p)
  r=dict(frame=row['frame'],source=row['source'],path=f.name,foregroundPixels=int(line.sum()),previousGapForegroundPixels=int(oldLine.sum()),gapInducedCompleteHide=bool(oldLine.any() and not line.any()),gapInducedChangedPixels=int(changed.sum()),maxGapInducedChannelDelta=int(np.max(np.abs(current-old)[outside])),strongExpectedPointsInCrop=len(expected),missingExpectedPoints=missed,unexpectedGpuHidden=bool(expected and not line.any()))
  run.append(r);metrics.append(r)
  if writeSequences:
   difference=np.clip(np.abs(current-off),0,255).astype(np.uint8);difference[~outside]=0;images.append(Image.fromarray(difference).crop((80,260,280,640)))
 runs.append(dict(file=f.name,frames=len(run),unexpectedGpuHiddenFrames=sum(r['unexpectedGpuHidden'] for r in run),missingExpectedPoints=sum(len(r['missingExpectedPoints']) for r in run),gapInducedCompleteHideFrames=sum(r['gapInducedCompleteHide'] for r in run),maxGapInducedChangedPixels=max(r['gapInducedChangedPixels'] for r in run),maxGapInducedChannelDelta=max(r['maxGapInducedChannelDelta'] for r in run)))
 # Native-pixel on/off difference sequence; real-model circle excluded.
 # Full original current/old/off PNG frames are preserved externally.
 if writeSequences:images[0].save(out/(f.stem.removesuffix('.json')+'.webp'),save_all=True,append_images=images[1:],duration=40,loop=0,lossless=True)
 (out/f.name).write_bytes(f.read_bytes())
(out/'gpu-origin-metrics.json.gz').write_bytes(gzip.compress(json.dumps(metrics).encode()))
(out/'gpu-origin-summary.json').write_text(json.dumps(dict(method='250 consecutive native frames/path/source/build; current, previous endpoint-fade boundary, and off-before/off-after at identical CURRENT camera; compact spatial protection is held at the current pose and has no temporal handoff. Width/style/geometry unchanged. Absolute color difference exceeds measured background noise +8/255; model circle excluded. Expected centerline alpha>=0.10 checked within 6 CSS px neighborhood. Root timestamps remain analytical and are not aliased to GPU pixel epochs.',runs=runs),indent=2))
print(json.dumps(runs,indent=1))
