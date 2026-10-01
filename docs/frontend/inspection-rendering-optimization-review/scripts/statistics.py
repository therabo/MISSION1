import json,numpy as np
from pathlib import Path
from PIL import Image,ImageDraw
import os
root=Path(os.environ.get('MISSION1_EVIDENCE_DIR','/tmp/mission1-rendering-evidence'))
rois={'central_modules':(1110,620,1400,990),'starboard_truss':(1530,605,1800,705),'solar_array':(1830,430,2080,545)}
variants=['original','flat-normal','rough','specular-aa','fxaa','final']
def motion(paths):
 out={}
 for name,(x0,y0,x1,y1) in rois.items():
  a=np.stack([np.asarray(Image.open(p).crop((x0,y0,x1,y1)),dtype=float)[:,:,:3] for p in paths])
  d=np.abs(np.diff(a,axis=0));out[name]={'meanAdjacentRgbDelta':float(d.mean()),'p95Delta':float(np.percentile(d,95)),'p99Delta':float(np.percentile(d,99)),'over40':int((d>40).sum()),'maximumMeanFrameDelta':float(d.mean(axis=(1,2,3)).max())}
 return out
material={v:motion([root/f'material-{v}-{i}.png' for i in range(16)])for v in variants}
(root/'material-statistics.json').write_text(json.dumps({'angleStepDegrees':.015,'fixedUtc':'2026-09-30T15:45:59.975908Z','rois':rois,'results':material},indent=2))
outline={};static={}
for phase in range(2):
 for source in ['PRIMARY_GP_TLE','NASA_OEM']:
  for state in ['on','off']:
   outline[f'{phase}-{source}-{state}']=motion([root/f'outline-{phase}-{source}-{state}-{i}.png' for i in range(16)])
  a=np.asarray(Image.open(root/f'static-{phase}-{source}-0.png'),dtype=int);b=np.asarray(Image.open(root/f'static-{phase}-{source}-1.png'),dtype=int);d=np.abs(a-b)
  static[f'{phase}-{source}']={'meanAbsoluteDelta':float(d.mean()),'maximumDelta':int(d.max()),'changedChannels':int((d!=0).sum())}
occupancy={}
for r in [95,90,85]:
 a=np.asarray(Image.open(root/f'occupancy-{r}-model.png'),dtype=int)[:,:,:3];b=np.asarray(Image.open(root/f'occupancy-{r}-background.png'),dtype=int)[:,:,:3]
 mask=np.max(np.abs(a-b),axis=2)>5
 # Exclude the credit strip from the station raster measurement.
 mask[1320:]=False
 ys,xs=np.where(mask)
 box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
 occupancy[str(r)]={'nativePixelBox':box,'cssWidth':(box[2]-box[0])/2,'cssHeight':(box[3]-box[1])/2,'widthFraction':(box[2]-box[0])/2560,'heightFraction':(box[3]-box[1])/1440,'silhouettePixelAreaFraction':float(mask.mean()),'differenceThresholdRgb':5}
(root/'raster-statistics.json').write_text(json.dumps({'occupancy':occupancy,'static':static,'outlineMotion':outline,'rois':rois},indent=2))
contact=Image.new('RGB',(6*410,620),(10,20,28));draw=ImageDraw.Draw(contact)
for i,v in enumerate(variants):
 im=Image.open(root/f'material-{v}-7.png').crop((1050,570,1460,1170));contact.paste(im,(i*410,20));draw.text((i*410+10,3),v,fill='white')
contact.save(root/'material-contact.png')
print(json.dumps({'material':material,'occupancy':occupancy,'static':static},indent=2))
