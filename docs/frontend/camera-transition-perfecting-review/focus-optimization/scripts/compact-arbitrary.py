"""Preserve each eight-pose visual sequence as a readable contact sheet.

Only deletes exact diagnostic JPEG paths listed by this script after writing
their sheet; source JSON and all prior committed evidence remain untouched.
"""
from pathlib import Path
import json, sys
from PIL import Image, ImageDraw
root=Path(sys.argv[1]);label=sys.argv[2]
data=json.loads((root/(label+'-arbitrary.json')).read_text())
for kind,items in [('entry',data['entries']),('exit',data['exits'])]:
    for row in items:
        name=row['name'].removeprefix('from-') if kind=='exit' else row['name']
        files=[root/f"{label}-{row['source']}-{kind}-{name}-{p}.jpg" for p in [0,10,20,30,50,70,90,100]]
        if not all(f.exists() for f in files): continue
        sheet=Image.new('RGB',(1280,780),'#07111a');draw=ImageDraw.Draw(sheet)
        draw.text((8,4),f"{label} / {row['source']} / {kind} / {name} / {row['duration']} s",fill='white')
        for i,file in enumerate(files):
            with Image.open(file) as im:
                im.thumbnail((426,240));x=(i%3)*426;y=25+(i//3)*250;sheet.paste(im,(x,y));draw.text((x+8,y+223),file.stem.rsplit('-',1)[-1]+'%',fill='white')
        sheet.save(root/f"{label}-{row['source']}-{kind}-{name}-contact.jpg",quality=85)
        for file in files: file.unlink()
print(label,'compacted')
