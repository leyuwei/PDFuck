"""Archive a new PDF with synthetic text and the failing annotation structure."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import pikepdf

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
OUTPUT = ROOT / 'tests/output/release-2.2.0-annotation-text'
NAME = 'de7504b89709419a91bce0c0865e21e8.pdf'
NOTE = '这是一条用于验证多语言备注的测试批注。示例内容包含中文和 example。\n\n另起一段，确认纯文本与换行。'
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('annotation_object', type=int)
    args = parser.parse_args()
    before = digest(args.source)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=FIXTURES) as tmp:
        layout, target = Path(tmp) / 'layout.pdf', Path(tmp) / NAME
        archive.rebuilder.sanitize(args.source, layout, graphic_placeholder=(0, 0, 0, 0))
        audit = archive.audit(args.source, layout)
        with pikepdf.open(args.source) as source, pikepdf.open(layout) as document:
            index, original = next((index, annotation) for index, page in enumerate(source.pages)
                                   for annotation in page.obj.get('/Annots', [])
                                   if annotation.objgen[0] == args.annotation_object)
            assert str(original.Subtype) == '/Highlight' and str(original.PDFuckMarks) == '[]'
            markup = '<body xmlns="http://www.w3.org/1999/xhtml"><p><span>' + NOTE.replace('\n', '<br/>') + '</span></p></body>'
            annotation = document.make_indirect(pikepdf.Dictionary(
                Type=pikepdf.Name.Annot, Subtype=pikepdf.Name.Highlight,
                Rect=pikepdf.Array(map(float, original.Rect)),
                QuadPoints=pikepdf.Array(map(float, original.QuadPoints)),
                Contents=NOTE, RC=markup, PDFuckMarks='[]', PDFuckColor='#e6ba36',
                T='Fixture Reviewer', NM='fixture-legacy-comment', C=pikepdf.Array([.9,.73,.21]), F=4
            ))
            document.pages[index].obj.Annots = pikepdf.Array([annotation])
            document.save(target)
        with pikepdf.open(target) as fixture:
            assert len(fixture.pages) == len(audit['dimensions'])
            notes = [a for p in fixture.pages for a in p.obj.get('/Annots', [])]
            assert len(notes) == 1 and str(notes[0].Contents) == NOTE and str(notes[0].T) == 'Fixture Reviewer'
            assert bytes(notes[0].RC).startswith(b'\xfe\xff') and '/Metadata' not in fixture.Root
            assert '/Names' not in fixture.Root and not fixture.attachments
        assert digest(args.source) == before
        entry = {'file': NAME, 'pages': len(audit['dimensions']), 'widgets': 0,
                 'bytes': target.stat().st_size, 'sha256': digest(target)}
        target.replace(FIXTURES / NAME)
    manifest = FIXTURES / 'sanitization-manifest.json'
    data = json.loads(manifest.read_text())
    data['fixtures'] = [item for item in data['fixtures'] if item['file'] != NAME] + [entry]
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    (OUTPUT / 'privacy.json').write_text(json.dumps({'fixture': entry, 'layoutAudit': audit, 'syntheticNotes': 1}, indent=2) + '\n')
    print(f"{entry['pages']} pages, {audit['originalLinesChecked']} original lines checked, one synthetic legacy annotation")


if __name__ == '__main__':
    main()
