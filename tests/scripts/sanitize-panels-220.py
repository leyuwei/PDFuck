"""Rebuild confidential layout with invented glyphs and panels at the two regression sites."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import fitz

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
NAME = '5a9d8b21713c4e0b98c2a475f691e30d.pdf'
FRAMES = {
    6: [(49, 89.1, 252, 189.2), (49, 323.4, 252, 189.2),
        (317.4, 106.2, 241.2, 69.6), (318.8, 187.4, 239.8, 73.4),
        (317.4, 274.5, 241.2, 71), (317.4, 356.9, 241.2, 74)],
    16: [(49, 89.1, 288, 111.6), (49, 245.2, 252, 146.2)],
}
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    source = parser.parse_args().source
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    output = ROOT / 'tests/output/release-2.2.0-panels'
    output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=FIXTURES) as directory:
        layout, target = Path(directory) / 'layout.pdf', Path(directory) / NAME
        archive.rebuilder.sanitize(source, layout, graphic_placeholder=(0, 0, 0, 0))
        with fitz.open(layout) as doc:
            for number, frames in FRAMES.items():
                page = doc[number - 1]
                for x, y, w, h in frames:
                    shape = page.new_shape()
                    shape.draw_rect((x, y, x + w, y + h))
                    shape.finish(fill=(.95, .96, .98), color=None)
                    for index in range(3):
                        left = x + w * (.12 + index * .28)
                        top = y + h * (.18 + (index % 2) * .25)
                        shape.draw_rect((left, top, left + w * .12, top + h * .3))
                        shape.finish(fill=(.65, .75, .79), color=None)
                    shape.commit(overlay=False)
            doc.save(target, garbage=4, deflate=True)
        report = archive.audit(source, target)
        assert hashlib.sha256(source.read_bytes()).hexdigest() == before
        entry = {'file': NAME, 'pages': len(report['dimensions']), 'widgets': 0,
                 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        target.replace(FIXTURES / NAME)
    manifest = FIXTURES / 'sanitization-manifest.json'
    data = json.loads(manifest.read_text())
    data['fixtures'] = [item for item in data['fixtures'] if item['file'] != NAME] + [entry]
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    (output / 'privacy.json').write_text(json.dumps({'fixture': entry, 'audit': report}, indent=2) + '\n')
    print(f"{entry['pages']} pages, {report['originalLinesChecked']} original lines checked")


if __name__ == '__main__':
    main()
