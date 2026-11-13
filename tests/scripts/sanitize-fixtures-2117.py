"""Archive six supplied inputs as synthetic PDFs; never retain originals or pixels."""
import argparse, hashlib, importlib.util, json, pathlib, secrets
import fitz
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('fixture_rebuilder',ROOT/'tests/scripts/sanitize-fixtures-2116.py')
rebuilder=importlib.util.module_from_spec(spec);spec.loader.exec_module(rebuilder)
PUBLIC=ROOT/'tests/fixtures'
MANIFEST=PUBLIC/'release-2.1.17-inputs.json'

def audit(source,target):
    before=hashlib.sha256(source.read_bytes()).hexdigest()
    with fitz.open(source) as original,fitz.open(target) as clean:
        assert len(original)==len(clean)
        assert clean.embfile_count()==0 and not clean.get_toc()
        assert not any(clean.metadata.get(k) for k in ['title','author','subject','keywords','creator','producer'])
        assert not any(p.get_images() or p.get_links() or list(p.annots() or []) for p in clean)
        cleaned=''.join(''.join(p.get_text().split()) for p in clean)
        checked=0
        for p in original:
            for line in p.get_text().splitlines():
                text=''.join(line.split())
                if len(text)>=24 and sum(c.isalnum() for c in text)>=12:
                    assert text not in cleaned, 'Original text survived sanitization'
                    checked+=1
        dimensions=[{'width':p.rect.width,'height':p.rect.height,'rotation':p.rotation} for p in clean]
    assert hashlib.sha256(source.read_bytes()).hexdigest()==before
    return {'originalLinesChecked':checked,'sourceUnmodified':True,'images':0,'links':0,'annotations':0,'attachments':0,'dimensions':dimensions}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('sources',nargs=6,type=pathlib.Path);args=parser.parse_args()
    previous=json.loads(MANIFEST.read_text())['fixtures'] if MANIFEST.exists() else []
    entries=[];reports=[]
    for slot,source in enumerate(args.sources):
        name=previous[slot]['file'] if slot<len(previous) else secrets.token_hex(16)+'.pdf'
        target=PUBLIC/name
        temporary=target.with_suffix('.safe.pdf')
        try:
            entry=rebuilder.sanitize(source,temporary,split_graphics=True)
            privacy=audit(source,temporary)
            temporary.replace(target)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        entry.update(file=name,sourceSlot=slot+1)
        entries.append(entry);reports.append({'sourceSlot':slot+1,'file':name,**privacy})
    MANIFEST.write_text(json.dumps({'version':'2.1.17','policy':'synthetic text and geometry; no original pixels or PDF objects','fixtures':entries},indent=2)+'\n')
    global_manifest=PUBLIC/'sanitization-manifest.json'
    data=json.loads(global_manifest.read_text());new_names={e['file'] for e in entries}
    data['fixtures']=[e for e in data['fixtures'] if e['file'] not in new_names]+entries
    global_manifest.write_text(json.dumps(data,indent=2)+'\n')
    out=ROOT/'tests/output/release-2.1.17';out.mkdir(parents=True,exist_ok=True)
    (out/'input-privacy.json').write_text(json.dumps({'fixtures':len(entries),'pages':sum(e['pages'] for e in entries),'reports':reports},indent=2)+'\n')
    print(json.dumps({'fixtures':len(entries),'pages':sum(e['pages'] for e in entries),'originalLinesChecked':sum(r['originalLinesChecked'] for r in reports)}))
if __name__=='__main__':main()
