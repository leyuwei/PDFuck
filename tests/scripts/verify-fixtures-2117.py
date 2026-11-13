"""Check the six public PDF archives without needing any private inputs."""
import hashlib,json,pathlib,re
import fitz
root=pathlib.Path(__file__).resolve().parents[2]
manifest=json.loads((root/'tests/fixtures/release-2.1.17-inputs.json').read_text())
global_manifest=json.loads((root/'tests/fixtures/sanitization-manifest.json').read_text())
entries=manifest['fixtures'];assert len(entries)==6
results=[]
for entry in entries:
    assert re.fullmatch(r'[0-9a-f]{32}\.pdf',entry['file'])
    file=root/'tests/fixtures'/entry['file'];assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256']
    assert entry in global_manifest['fixtures']
    with fitz.open(file) as pdf:
        assert len(pdf)==entry['pages'] and pdf.embfile_count()==0 and not pdf.get_toc()
        assert not any(pdf.metadata.get(key) for key in ['title','author','subject','keywords','creator','producer'])
        assert not any(p.get_images() or p.get_links() or list(p.annots() or []) for p in pdf)
        assert sum(len(list(p.widgets() or [])) for p in pdf)==entry['widgets']
        results.append({'file':entry['file'],'sourceSlot':entry['sourceSlot'],'pages':len(pdf),'sha256':entry['sha256'],'metadata':0,'images':0,'links':0,'annotations':0,'attachments':0})
assert sum(r['pages'] for r in results)==18
out=root/'tests/output/release-2.1.17';out.mkdir(parents=True,exist_ok=True)
(out/'archive-verification.json').write_text(json.dumps({'files':6,'pages':18,'results':results},indent=2)+'\n')
print('Verified six sanitized PDFs, eighteen pages, manifest hashes and stripped PDF assets.')
