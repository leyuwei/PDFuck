"""Archive the one-page regression sample using synthetic glyphs and neutral paths."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from tempfile import TemporaryDirectory

import fitz

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
NAME = '4e26cd2ff752427ab6d67223245812ca.pdf'
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)
replacement = archive.rebuilder.replacement


def synthetic(text):
    safe = replacement(text)
    marker = re.match(r'^\([a-z]\)', text, re.I)
    return marker[0] + safe[marker.end():] if marker else safe


def paint(page, bounds):
    rect = fitz.Rect(bounds)
    for index in range(1, 8):
        x = rect.x0 + rect.width * index / 9
        page.draw_line((x, rect.y0 + rect.height * .6), (x, rect.y0 + rect.height * .35),
                       color=(.3, .44, .56), width=1.3, overlay=False)
    page.draw_rect(rect, color=(.44, .48, .53), fill=(.96, .97, .98), width=.45, overlay=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    source = parser.parse_args().source
    before = hashlib.sha256(source.read_bytes()).digest()
    archive.rebuilder.replacement = synthetic
    with TemporaryDirectory(dir=FIXTURES) as directory:
        target = Path(directory) / NAME
        intermediate = target.with_name('synthetic-text.pdf')
        archive.rebuilder.sanitize(source, intermediate, graphic_placeholder=(0, 0, 0, 0))
        with fitz.open(intermediate) as document:
            assert len(document) == 1, 'Use the one-page regression sample'
            page = document[0]
            for bounds in [(67.5, 99.1, 306, 278.2), (306, 99.1, 544.5, 278.2),
                           (106.2, 339.4, 298.9, 432.4), (327, 339, 519.7, 432),
                           (156.9, 478.3, 451.3, 501)]:
                paint(page, bounds)
            document.save(target, garbage=4, deflate=True)
        audit = archive.audit(source, target)
        assert hashlib.sha256(source.read_bytes()).digest() == before
        entry = {'file': NAME, 'pages': 1, 'widgets': 0, 'bytes': target.stat().st_size,
                 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        target.replace(FIXTURES / NAME)
    manifest = FIXTURES / 'sanitization-manifest.json'
    data = json.loads(manifest.read_text())
    data['fixtures'] = [item for item in data['fixtures'] if item['file'] != NAME] + [entry]
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    output = ROOT / 'tests/output/release-2.2.0-interleaved-figures'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'privacy.json').write_text(json.dumps({'fixture': entry, 'audit': audit}, indent=2) + '\n')
    print(json.dumps({'pages': entry['pages'], 'originalLinesChecked': audit['originalLinesChecked']}))


if __name__ == '__main__':
    main()
