"""Archive nine synthetic pages with separately drawn layout and figure geometry."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import fitz

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
FILENAME = 'a7264eca2cd44af9ad0a68ca83dbbbe5.pdf'
FRAMES = {
    2: (34.625, 25.625, 538.375, 211.375),
    4: (34.625, 25.625, 434.25, 254.945),
    5: (34.625, 25.625, 538.375, 302.125),
    6: (243.3, 25.625, 434, 186.525),
    7: (138.775, 25.74, 538.375, 274.375),
    8: (34.625, 25.625, 538.375, 251.875),
}
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def add_layout(doc):
    for number, page in enumerate(doc, start=1):
        if number in FRAMES:
            frame = fitz.Rect(FRAMES[number])
            # Neutral shapes preserve relative scale. Every symbol, series and image is new.
            for i in range(3):
                x = frame.x0 + frame.width * (.2 + .2 * i)
                y = frame.y0 + frame.height * (.48 + (i % 2) * .07)
                page.draw_rect(fitz.Rect(x, y, x + frame.width * .07, y + frame.height * .18),
                               color=(.35, .45, .55), fill=(.91, .94, .96), width=.35, overlay=False)
            page.draw_rect(frame, color=(.28, .32, .36), width=.35, overlay=False)
        if 2 <= number <= 9:
            left = 34.5 if number % 2 == 0 else 138.9
            page.draw_rect(fitz.Rect(left, 25.5, left + 399.6, 728 if number < 9 else 476),
                           color=None, fill=(.985, .985, .985), overlay=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    output = ROOT / 'tests/output/release-2.2.0-visuals'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output) as directory:
        layout = Path(directory) / 'layout.pdf'
        archive.rebuilder.sanitize(args.source, layout, graphic_placeholder=(0, 0, 0, 0))
        target = Path(directory) / FILENAME
        with fitz.open(layout) as doc:
            assert len(doc) == 9 and all(page.rotation == 0 for page in doc)
            add_layout(doc)
            doc.save(target, garbage=4, deflate=True)
        report = archive.audit(args.source, target)
        entry = {'file': FILENAME, 'pages': len(report['dimensions']), 'widgets': 0,
                 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        target.replace(FIXTURES / FILENAME)
    (FIXTURES / 'release-2.2.0-visual-inputs.json').write_text(json.dumps({
        'version': '2.2.0', 'policy': 'synthetic glyphs and diagram placeholders; no original PDF objects or pixels',
        'fixtures': [entry]
    }, indent=2) + '\n')
    manifest_path = FIXTURES / 'sanitization-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['fixtures'] = [fixture for fixture in manifest['fixtures'] if fixture['file'] != FILENAME] + [entry]
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'privacy.json').write_text(json.dumps({'fixture': entry, 'report': report}, indent=2) + '\n')
    print(json.dumps({'pages': entry['pages'], 'originalLinesChecked': report['originalLinesChecked']}))


if __name__ == '__main__':
    main()
