"""Verify the newest public archive without access to its private source."""
import hashlib,json,pathlib,re
import fitz
root=pathlib.Path(__file__).resolve().parents[2]
entry=json.loads((root/'tests/fixtures/release-2.1.17-selection-latest.json').read_text());entries=json.loads((root/'tests/fixtures/sanitization-manifest.json').read_text())['fixtures']
assert entry in entries and re.fullmatch(r'[a-f0-9]{32}\.pdf',entry['file'])
file=root/'tests/fixtures'/entry['file'];assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256']
with fitz.open(file) as pdf:
 assert len(pdf)==1 and not pdf.get_toc() and pdf.embfile_count()==0
 assert not any(pdf.metadata.get(k) for k in ['title','author','subject','keywords','creator','producer'])
 assert all(not p.get_images() and not p.get_links() and not list(p.annots() or []) and not list(p.widgets() or []) for p in pdf)
assert len(entries)==31 and sum(e['pages'] for e in entries)==272
privacy=json.loads((root/'tests/output/release-2.1.17/selection-latest-privacy.json').read_text());assert privacy['sourceUnmodified'] and privacy['originalLinesChecked']==87
report={'file':entry['file'],'sha256':entry['sha256'],'pages':1,'metadata':0,'images':0,'links':0,'annotations':0,'attachments':0,'sourceLongLinesRemoved':87,'sourceUnmodified':True,'totalArchivedFiles':len(entries),'totalArchivedPages':sum(e['pages'] for e in entries)}
(root/'tests/output/release-2.1.17/selection-latest-archive.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
