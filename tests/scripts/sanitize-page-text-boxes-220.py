"""Rebuild the invoice fixture from synthetic glyphs and geometry."""
import argparse
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
NAME = 'e6462b903ff64e8f9e29d521c37224.pdf'
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    source = parser.parse_args().source
    with TemporaryDirectory(dir=FIXTURES) as directory:
        target = Path(directory) / NAME
        entry = archive.rebuilder.sanitize(source, target, split_graphics=True)
        audit = archive.audit(source, target)
        target.replace(FIXTURES / NAME)
    manifest = FIXTURES / 'sanitization-manifest.json'
    data = json.loads(manifest.read_text())
    data['fixtures'] = [fixture for fixture in data['fixtures'] if fixture['file'] != NAME] + [entry]
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    output = ROOT / 'tests/output/release-2.2.0-page-text-boxes'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'privacy.json').write_text(json.dumps({'fixture': entry, 'audit': audit}, indent=2) + '\n')


if __name__ == '__main__':
    main()
