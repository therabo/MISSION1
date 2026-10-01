"""Actual raster footprints from paired same-camera model/background captures.
Full PNGs are temporary; metrics, JPEG samples and contact sheets are archived.
"""
from pathlib import Path
import json,sys,os
from PIL import Image,ImageDraw
import numpy as np
source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
label=sys.argv[3]
data=json.loads((source/(label+'-samples.json')).read_text())
width,height=data.get('viewport',[1280,720])
for row in data['samples']:
 a=np.asarray(Image.open(source/(row['filename']+'-model.png')).convert('RGB')).astype(int)
 b=np.asarray(Image.open(source/(row['filename']+'-background.png')).convert('RGB')).astype(int)
 difference=np.max(np.abs(a-b),axis=2)>5
 difference[-36:,:]=False
 # Credits can change when hiding an attributed model. Restrict differences to
 # its independently projected hull and exclude UI outside that scene envelope.
 hull=row['hull']
 if hull:
  mask=np.zeros(difference.shape,dtype=bool)
  xmin=max(0,int(2*min(p['x'] for p in hull))-4);xmax=min(a.shape[1],int(2*max(p['x'] for p in hull))+5)
  ymin=max(0,int(2*min(p['y'] for p in hull))-4);ymax=min(a.shape[0]-36,int(2*max(p['y'] for p in hull))+5)
  mask[ymin:ymax,xmin:xmax]=True;difference &= mask
 ys,xs=np.where(difference)
 row['raster']={'widthCss':float((max(xs)-min(xs)+1)/2) if len(xs) else 0,'heightCss':float((max(ys)-min(ys)+1)/2) if len(ys) else 0,'areaCss':float(len(xs)/4),'boundingAreaCss':float((max(xs)-min(xs)+1)*(max(ys)-min(ys)+1)/4) if len(xs) else 0}
 row['raster']['occupancyWidth']=row['raster']['widthCss']/width
 row['raster']['occupancyHeight']=row['raster']['heightCss']/height
 # Archive readable CSS-resolution previews; measurements use native DPR-2 PNGs.
 preview=Image.fromarray(a.astype('uint8'))
 preview=preview.resize((a.shape[1]//2,a.shape[0]//2),Image.Resampling.LANCZOS)
 preview.save(out/(row['filename']+'.jpg'),quality=82)
for selected in ['PRIMARY_GP_TLE','NASA_OEM']:
 for kind in ['entry','exit']:
  rows=[r for r in data['samples'] if r['source']==selected and r['kind']==kind]
  sheet=Image.new('RGB',(1280,1350),'#08121c');draw=ImageDraw.Draw(sheet)
  for i,row in enumerate(rows):
   image=Image.open(source/(row['filename']+'-model.png')).convert('RGB');image.thumbnail((426,240))
   x=(i%3)*426;y=(i//3)*270;sheet.paste(image,(x,y));draw.text((x+8,y+242),f"{row['percent']}% / {row['range']:.0f} m / {row['raster']['heightCss']:.1f} px",fill='white')
  sheet.save(out/f'{label}-{selected}-{kind}-contact.jpg',quality=87)
(out/(label+'-projected-samples.json')).write_text(json.dumps(data,indent=2))
print(label, 'samples',len(data['samples']), 'errors',data['errors'])
for src in ['PRIMARY_GP_TLE','NASA_OEM']:
 rows=[r for r in data['samples'] if r['source']==src and r['kind']=='entry'];height=lambda r:r['raster']['heightCss']
 print(src,[(r['percent'],height(r)) for r in rows]);total=height(rows[-1])-height(rows[0])
 print('final growth', {p:100*(height(rows[-1])-height(next(r for r in rows if r['percent']==100-p)))/total for p in [20,10,5]})
