"""Rebuild the supplied manuscript with synthetic glyphs and neutral diagram geometry."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/fixtures'
NAME = '64dcae10ddce4efa8dcc1175cd61d94a.pdf'
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    source = parser.parse_args().source
    before = hashlib.sha256(source.read_bytes()).digest()
    with TemporaryDirectory(dir=FIXTURES) as directory:
        target = Path(directory) / NAME
        entry = archive.rebuilder.sanitize(source, target, split_graphics=True, preserve_thin_rules=True, close_rule_paths=False)
        audit = archive.audit(source, target)
        assert hashlib.sha256(source.read_bytes()).digest() == before
        target.replace(FIXTURES / NAME)
    manifest = FIXTURES / 'sanitization-manifest.json'
    data = json.loads(manifest.read_text())
    data['fixtures'] = [item for item in data['fixtures'] if item['file'] != NAME] + [entry]
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    output = ROOT / 'tests/output/release-2.2.0-figure-label-protection'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'privacy.json').write_text(json.dumps({'fixture': entry, 'audit': audit}, indent=2) + '\n')
    print(json.dumps({'pages': entry['pages'], 'originalLinesChecked': audit['originalLinesChecked']}))


if __name__ == '__main__':
    main()
