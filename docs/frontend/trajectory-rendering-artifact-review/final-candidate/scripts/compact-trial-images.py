"""Preserve raw diagnostic PNGs externally, keep full JPEG views and native details in Git."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json
from PIL import Image
root=Path(__file__).resolve().parents[1]
dirs=[root/x for x in ['candidate-dev','trial2','trial3','trial4/origin','trial4/stress','trial5']]
files=[p for d in dirs for p in d.glob('*.png')]
archive=Path('/Users/daniel/Desktop/mission1-trajectory-trial-native-images.zip')
if archive.exists():raise SystemExit('Archive already exists; never replace a preservation archive.')
manifest=[]
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
 for p in files:
  rel=str(p.relative_to(root));data=p.read_bytes();z.writestr(rel,data);manifest.append(dict(path=rel,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
with ZipFile(archive) as z:
 for p,row in zip(files,manifest):
  if hashlib.sha256(z.read(row['path'])).hexdigest()!=row['sha256']:raise SystemExit('Archive verification failed.')
  Image.open(p).convert('RGB').save(p.with_suffix('.jpg'),quality=90)
  p.unlink()
(root/'trial-image-preservation.json').write_text(json.dumps(dict(archive=str(archive),count=len(files),originals=manifest),indent=2))
print('Preserved and verified',len(files),'native PNGs externally; full review JPEGs retained.')
