"""QA artifact tooling only; never touches application images/assets.

Contact sheets index every original screenshot for human visual review.
Lossless conversion verifies decoded RGBA equality before removing a PNG.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, hashlib, json, re
from concurrent.futures import ThreadPoolExecutor

base = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['sheets', 'supplements', 'compress'])
args = parser.parse_args()

if args.action == 'sheets':
    out = base / 'review'
    out.mkdir(exist_ok=True)
    previous = {x['sheet']: x for x in json.loads((out/'manifest.json').read_text())} if (out/'manifest.json').exists() else {}
    manifest = []
    for build, kind in [(b,k) for k in ['final','edge-states'] for b in ['development','production']]:
        folder = base / kind / build
        report_file = folder / 'matrix.json'
        if not report_file.exists():
            continue
        data = json.loads(report_file.read_text())
        for state in data['states']:
            for group in ['wide', 'compact']:
                entries = [e for e in state['entries'] if (e['width'] >= 900) == (group == 'wide')]
                cols = 3 if group == 'wide' else 4
                tile_width = 640 if group == 'wide' else 430
                tile_height = max(round(e['height'] * min(1, tile_width/e['width'])) for e in entries) + 28
                sheet = Image.new('RGB', (cols*tile_width, ((len(entries)+cols-1)//cols)*tile_height), '#121722')
                draw = ImageDraw.Draw(sheet)
                filenames = []
                for i, entry in enumerate(entries):
                    file = folder / entry['screenshot']
                    image = Image.open(file).convert('RGB')
                    image.thumbnail((tile_width, tile_height-28))
                    x, y = (i%cols)*tile_width, (i//cols)*tile_height
                    draw.text((x+5, y+5), f"{entry['width']} x {entry['height']} | {state['state']}", fill='white')
                    sheet.paste(image, (x, y+28))
                    filenames.append(str(file.relative_to(base)))
                filename = f"{'' if kind == 'final' else 'edge-'}{build}-{state['state']}-{group}.jpg"
                sheet.save(out/filename, quality=94, subsampling=0)
                manifest.append({'sheet': filename, 'screenshots': filenames, 'reviewed': previous.get(filename, {}).get('reviewed', False)})
    manifest.extend(e for e in previous.values() if e['sheet'].startswith('extra-'))
    (out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'{len(manifest)} contact sheets, {sum(len(x["screenshots"]) for x in manifest)} screenshots')
elif args.action == 'supplements':
    out=base/'review'
    old=json.loads((out/'manifest.json').read_text())
    previous={e['sheet']:e for e in old}
    manifest=[e for e in old if not e['sheet'].startswith('extra-')]
    for folder_name in ['native','interactions','edge']:
        folders=sorted({f.parent for f in (base/folder_name).rglob('*') if f.suffix in ['.png', '.webp']})
        for folder in folders:
            files=sorted(f for f in folder.iterdir() if f.suffix in ['.png', '.webp'])
            for group in ['wide','compact']:
                chosen=[f for f in files if (Image.open(f).width>=900)==(group=='wide')]
                for chunk in range(0,len(chosen),10):
                    entries=chosen[chunk:chunk+10]
                    cols,tile_width=(3,640) if group=='wide' else (4,430)
                    tile_height=max(round(Image.open(f).height*min(1,tile_width/Image.open(f).width)) for f in entries)+28
                    sheet=Image.new('RGB',(cols*tile_width,((len(entries)+cols-1)//cols)*tile_height),'#121722')
                    draw=ImageDraw.Draw(sheet)
                    for i,f in enumerate(entries):
                        im=Image.open(f).convert('RGB');im.thumbnail((tile_width,tile_height-28))
                        x,y=(i%cols)*tile_width,(i//cols)*tile_height
                        draw.text((x+5,y+5),f.name,fill='white');sheet.paste(im,(x,y+28))
                    filename='extra-'+str(folder.relative_to(base)).replace('/','-')+'-'+group+'-'+str(chunk//10)+'.jpg'
                    sheet.save(out/filename,quality=94,subsampling=0)
                    manifest.append({'sheet':filename,'screenshots':[str(f.relative_to(base)) for f in entries],'reviewed':previous.get(filename,{}).get('reviewed',False)})
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Supplement sheets: '+str(sum(e['sheet'].startswith('extra-') for e in manifest)))
else:
    def convert(file):
            original = file.read_bytes()
            image = Image.open(file).convert('RGBA')
            dest = file.with_suffix('.webp')
            image.save(dest, lossless=True, method=3)
            decoded = Image.open(dest).convert('RGBA')
            assert image.size == decoded.size and image.tobytes() == decoded.tobytes(), file
            result={'png': str(file.relative_to(base)), 'webp': str(dest.relative_to(base)),
                              'pngSha256': hashlib.sha256(original).hexdigest(),
                              'webpSha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'rgbaIdentical': True}
            file.unlink()
            return result
    files=[p for folder in ['audit', 'iteration-1', 'iteration-3', 'final', 'interactions', 'native', 'edge', 'edge-states'] for p in sorted((base/folder).rglob('*.png'))]
    with ThreadPoolExecutor(max_workers=4) as pool:
        converted=list(pool.map(convert,files))
    replacements={Path(item['png']).name: Path(item['webp']).name for item in converted}
    for file in base.rglob('*.json'):
        if file.name == 'lossless-artifacts.json':
            continue
        content = file.read_text()
        content = re.sub(r'[^/"\s]+\.png', lambda m: replacements.get(m[0], m[0]), content)
        file.write_text(content)
    (base/'lossless-artifacts.json').write_text(json.dumps(converted, indent=2)+'\n')
    print(f'{len(converted)} screenshot artifacts converted; every decoded pixel verified identical')
