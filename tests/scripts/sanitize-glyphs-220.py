"""Archive this input's layout without copying any original PDF objects."""
import argparse
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
FILENAME = '43758d35fbe94821a2cb6e877c271bd6.pdf'
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    out = ROOT / 'tests/output/release-2.2.0-glyphs'
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=out) as directory:
        target = Path(directory) / FILENAME
        entry = archive.rebuilder.sanitize(args.source, target, preserve_thin_rules=True)
        report = archive.audit(args.source, target)
        target.replace(FIXTURES / FILENAME)
    (FIXTURES / 'release-2.2.0-glyph-inputs.json').write_text(json.dumps({
        'version': '2.2.0',
        'policy': 'synthetic text and geometry; no original pixels or PDF objects',
        'fixtures': [entry]
    }, indent=2) + '\n')
    manifest_path = FIXTURES / 'sanitization-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['fixtures'] = [fixture for fixture in manifest['fixtures'] if fixture['file'] != FILENAME] + [entry]
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    (out / 'privacy.json').write_text(json.dumps({'fixture': entry, 'report': report}, indent=2) + '\n')
    print(json.dumps({'pages': entry['pages'], 'originalLinesChecked': report['originalLinesChecked']}))


if __name__ == '__main__':
    main()
