"""Rebuild two caption-selection inputs with synthetic text and graphics."""
import argparse
import importlib.util
import json
import pathlib
import secrets
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'tests/fixtures'
MANIFEST = PUBLIC / 'release-2.2.0-caption-inputs.json'
FIGURE_BOUNDS = [(49, 56, 563, 246), (49, 575, 563, 718)]
spec = importlib.util.spec_from_file_location('archive', ROOT / 'tests/scripts/sanitize-fixtures-2117.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('sources', nargs=2, type=pathlib.Path)
    args = parser.parse_args()
    previous = json.loads(MANIFEST.read_text())['fixtures'] if MANIFEST.exists() else []
    reports, entries = [], []
    work = ROOT / 'tests/tmp/release-2.2.0-captions'
    work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work) as directory:
        for slot, source in enumerate(args.sources, start=1):
            name = previous[slot-1]['file'] if previous else f'{secrets.token_hex(16)}.pdf'
            target = pathlib.Path(directory) / name
            entry = archive.rebuilder.sanitize(source, target, graphic_placeholder=FIGURE_BOUNDS[slot-1])
            assert entry['pages'] == 1 and entry['widgets'] == 0
            reports.append({'sourceSlot': slot, **archive.audit(source, target)})
            entries.append({**entry, 'sourceSlot': slot})
        for entry in entries:
            (pathlib.Path(directory) / entry['file']).replace(PUBLIC / entry['file'])

    MANIFEST.write_text(json.dumps({'version': '2.2.0',
        'policy': 'synthetic text and geometry; no original pixels or PDF objects',
        'fixtures': entries}, indent=2) + '\n')
    global_path = PUBLIC / 'sanitization-manifest.json'
    global_manifest = json.loads(global_path.read_text())
    names = {entry['file'] for entry in entries}
    global_manifest['fixtures'] = [entry for entry in global_manifest['fixtures'] if entry['file'] not in names] + entries
    global_path.write_text(json.dumps(global_manifest, indent=2) + '\n')
    output = ROOT / 'tests/output/release-2.2.0-captions'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'privacy.json').write_text(json.dumps({'fixtures': entries, 'reports': reports}, indent=2) + '\n')
    print(json.dumps({'fixtures': len(entries), 'originalLinesChecked': sum(report['originalLinesChecked'] for report in reports)}))


if __name__ == '__main__':
    main()
