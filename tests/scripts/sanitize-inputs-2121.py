import importlib.util,json,pathlib,secrets,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('archive',ROOT/'tests/scripts/sanitize-fixtures-2117.py');archive=importlib.util.module_from_spec(spec);spec.loader.exec_module(archive)
manifest=ROOT/'tests/fixtures/release-2.1.21-inputs.json';old=json.loads(manifest.read_text())['fixtures'] if manifest.exists() else [];entries=[];reports=[]
for slot,name in enumerate(['document.pdf']):
 source=pathlib.Path('/Users/yuwei/Desktop')/name
 target=ROOT/'tests/fixtures'/(old[slot]['file'] if slot<len(old) else secrets.token_hex(16)+'.pdf')
 entry=archive.rebuilder.sanitize(source,target,split_graphics=True);reports.append(archive.audit(source,target));entry['sourceSlot']=slot+1;entries.append(entry)
manifest.write_text(json.dumps({'version':'2.1.21','policy':'replacement content and geometry only','fixtures':entries},indent=2)+'\n')
p=ROOT/'tests/fixtures/sanitization-manifest.json';data=json.loads(p.read_text());names={e['file'] for e in entries};data['fixtures']=[e for e in data['fixtures'] if e['file'] not in names]+entries;p.write_text(json.dumps(data,indent=2)+'\n')
out=ROOT/'tests/output/release-2.1.21';out.mkdir(parents=True,exist_ok=True);(out/'privacy.json').write_text(json.dumps(reports,indent=2)+'\n');print(json.dumps(entries))
