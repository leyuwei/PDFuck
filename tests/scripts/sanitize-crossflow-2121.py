import argparse,importlib.util,json,pathlib,secrets,hashlib
import fitz
ROOT=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('source',type=pathlib.Path);parser.add_argument('--page',type=int,required=True);args=parser.parse_args()
spec=importlib.util.spec_from_file_location('archive',ROOT/'tests/scripts/sanitize-fixtures-2117.py');archive=importlib.util.module_from_spec(spec);spec.loader.exec_module(archive)
before=hashlib.sha256(args.source.read_bytes()).hexdigest();temporary=ROOT/'tests/tmp/release-2.1.21-crossflow';temporary.mkdir(parents=True,exist_ok=True);excerpt=temporary/'original-page.pdf'
with fitz.open(args.source) as original,fitz.open() as page:
 assert 1<=args.page<=len(original)
 page.insert_pdf(original,from_page=args.page-1,to_page=args.page-1);page.save(excerpt)
manifest=ROOT/'tests/fixtures/release-2.1.21-crossflow-inputs.json'
name=json.loads(manifest.read_text())['fixtures'][0]['file'] if manifest.exists() else secrets.token_hex(16)+'.pdf'
target=ROOT/'tests/fixtures'/name;entry=archive.rebuilder.sanitize(excerpt,target,split_graphics=True);privacy=archive.audit(excerpt,target)
assert hashlib.sha256(args.source.read_bytes()).hexdigest()==before
entry['sourcePage']=args.page;manifest.write_text(json.dumps({'version':'2.1.21','policy':'replacement text and geometry only','fixtures':[entry]},indent=2)+'\n')
p=ROOT/'tests/fixtures/sanitization-manifest.json';data=json.loads(p.read_text());data['fixtures']=[e for e in data['fixtures'] if e['file']!=name]+[entry];p.write_text(json.dumps(data,indent=2)+'\n')
out=ROOT/'tests/output/release-2.1.21-crossflow';out.mkdir(parents=True,exist_ok=True);(out/'privacy.json').write_text(json.dumps(privacy,indent=2)+'\n');print(json.dumps(entry))
