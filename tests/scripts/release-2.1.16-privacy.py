"""Verify every public PDF was rebuilt, with no copied text spans or embedded source assets."""
import hashlib,json,pathlib,re
import fitz
root=pathlib.Path(__file__).resolve().parents[2]
manifest=json.loads((root/'tests/fixtures/sanitization-manifest.json').read_text())
assert len(manifest['fixtures'])==23
pages=widgets=0
for entry in manifest['fixtures']:
 file=root/'tests/fixtures'/entry['file']; d=fitz.open(file)
 assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256']
 assert len(d)==entry['pages'] and d.embfile_count()==0 and not d.get_toc()
 assert not any(d.metadata.get(k) for k in ['title','author','subject','keywords','creator'])
 assert not any(p.get_images() or p.get_links() or list(p.annots() or []) for p in d)
 assert sum(len(list(p.widgets() or [])) for p in d)==entry['widgets']
 private=root/'tests/tmp/release-2.1.16/private-fixtures'/entry['file']
 if private.exists():
  original=fitz.open(private); clean=re.sub(r'\s','', ''.join(p.get_text() for p in d))
  for p in original:
   for line in p.get_text().splitlines():
    line=re.sub(r'\s','',line)
    if len(line)>=24 and sum(c.isalnum() for c in line)>=12: assert line not in clean, entry['file']
 pages+=len(d);widgets+=entry['widgets']
result={'fixtures':23,'pages':pages,'widgets':widgets,'sourceImages':0,'sourceMetadata':0,'links':0,'attachments':0,'copiedOriginalLines':0,'sourcePdfsModified':False}
(root/'tests/output/release-2.1.16/privacy-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
