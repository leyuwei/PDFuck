"""Archive the supplied one-page selection regression input with replacement text and no source assets."""
import argparse,hashlib,importlib.util,json,pathlib,secrets
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('archive',ROOT/'tests/scripts/sanitize-fixtures-2117.py');archive=importlib.util.module_from_spec(spec);spec.loader.exec_module(archive)
parser=argparse.ArgumentParser();parser.add_argument('source',type=pathlib.Path);args=parser.parse_args()
manifest=ROOT/'tests/fixtures/release-2.1.17-selection-latest.json';old=json.loads(manifest.read_text()) if manifest.exists() else {}
name=old.get('file',secrets.token_hex(16)+'.pdf');target=ROOT/'tests/fixtures'/name;temporary=target.with_suffix('.safe.pdf')
source_hash=hashlib.sha256(args.source.read_bytes()).hexdigest()
try:
 entry=archive.rebuilder.sanitize(args.source,temporary,split_graphics=True)
 privacy=archive.audit(args.source,temporary)
 assert hashlib.sha256(args.source.read_bytes()).hexdigest()==source_hash
 temporary.replace(target)
except Exception:
 temporary.unlink(missing_ok=True);raise
entry.update(file=name,sourceSlot='selection-20261113',screenshotPages=[1])
manifest.write_text(json.dumps(entry,indent=2)+'\n')
global_path=ROOT/'tests/fixtures/sanitization-manifest.json';global_data=json.loads(global_path.read_text());global_data['fixtures']=[r for r in global_data['fixtures'] if r['file']!=name]+[entry];global_path.write_text(json.dumps(global_data,indent=2)+'\n')
(ROOT/'tests/output/release-2.1.17/selection-latest-privacy.json').write_text(json.dumps(privacy,indent=2)+'\n')
print(json.dumps({'file':name,'pages':entry['pages'],'originalLinesChecked':privacy['originalLinesChecked']}))
