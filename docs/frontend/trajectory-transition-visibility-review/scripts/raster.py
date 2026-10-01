"""Measure actual model raster; discard only task-owned redundant PNG pairs."""
from pathlib import Path
import json,sys
from PIL import Image,ImageDraw
import numpy as np
source,out,label=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]
out.mkdir(parents=True,exist_ok=True)
d=json.loads((source/(label+'-samples.json')).read_text());width,height=d['viewport']
for row in d['samples']:
 a=np.asarray(Image.open(source/(row['stem']+'-model.png')).convert('RGB')).astype(int)
 b=np.asarray(Image.open(source/(row['stem']+'-background.png')).convert('RGB')).astype(int)
 diff=np.max(np.abs(a-b),axis=2)>5;diff[-36:,:]=False
 hull=row['hull'];mask=np.zeros(diff.shape,dtype=bool)
 if hull:
  xmin=max(0,int(2*min(p['x'] for p in hull))-4);xmax=min(a.shape[1],int(2*max(p['x'] for p in hull))+5)
  ymin=max(0,int(2*min(p['y'] for p in hull))-4);ymax=min(a.shape[0]-36,int(2*max(p['y'] for p in hull))+5)
  mask[ymin:ymax,xmin:xmax]=True;diff &=mask
 ys,xs=np.where(diff)
 row['raster']={'widthCss':float((max(xs)-min(xs)+1)/2) if len(xs) else 0,'heightCss':float((max(ys)-min(ys)+1)/2) if len(ys) else 0,'pixelsCss':float(len(xs)/4)}
 row['raster']['widthPercent']=100*row['raster']['widthCss']/width;row['raster']['heightPercent']=100*row['raster']['heightCss']/height
 for suffix in ['-model.png','-background.png']:(source/(row['stem']+suffix)).unlink()
(out/(label+'-samples.json')).write_text(json.dumps(d,indent=2)+'\n')
for selected in ['PRIMARY_GP_TLE','NASA_OEM']:
 for kind in ['entry','exit']:
  rows=[r for r in d['samples'] if r['source']==selected and r['kind']==kind];sheet=Image.new('RGB',(1200,1040),'#08121c');draw=ImageDraw.Draw(sheet)
  for i,row in enumerate(rows):
   im=Image.open(source/(row['stem']+'.jpg'));im.thumbnail((400,225));x=i%3*400;y=i//3*208;im.thumbnail((360,180));sheet.paste(im,(x,y));draw.text((x+8,y+182),f"{row['fraction']*100:g}% / {row['range']:.0f}m / v={row['visibility']}",fill='white')
  sheet.save(out/f'{label}-{selected}-{kind}.jpg',quality=82)
print([(r['fraction'],round(r['range']),r['raster']) for r in d['samples'] if r['source']=='PRIMARY_GP_TLE' and r['kind']=='exit'])
