"""One-time, workspace-bounded migration used for 2.1.10. Never deletes input."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
KEEP = {'macos-installer-icon.cjs', 'package-macos.sh', 'package-windows.ps1',
        'patch-windows-printer-native.cjs', 'render-app-icon.cjs', 'windows-installer-artwork.cjs'}

def move(old, new):
    source, target = ROOT / old, ROOT / new
    assert source.resolve().is_relative_to(ROOT) and target.resolve().is_relative_to(ROOT)
    assert source.exists() and not target.exists(), (old, new)
    target.parent.mkdir(parents=True, exist_ok=True)
    source.rename(target)

def main():
    assert (ROOT / 'tmp').exists(), 'Migration has already run'
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    mapping = {}
    for name in tracked:
        p = Path(name)
        if '.test.' in p.name and p.parts[0] == 'src':
            mapping[name] = 'tests/unit/' + '/'.join(p.parts[1:])
        elif p.parts and p.parts[0] == 'scripts' and p.name not in KEEP:
            mapping[name] = 'tests/' + name
        elif p.parts and p.parts[0] == 'docs' and p.suffix == '.md' and p.name not in {'DESIGN.md', 'VI-TYPOGRAPHY.md'}:
            mapping[name] = 'tests/' + name
    # Reusable inputs are tracked outside the existing tmp/output ignore rules.
    fixtures = [p for p in (ROOT / 'tmp').glob('*.pdf') if not p.name.startswith(('ocr-', 'page-', 'pdf-links-', 'release-', 'eps-'))]
    for p in fixtures:
        mapping['tmp/' + p.name] = 'tests/fixtures/' + p.name
    pairs = sorted(mapping.items(), key=lambda x: len(x[0]), reverse=True)
    for old, new in pairs:
        move(old, new)
    move('tmp', 'tests/tmp')
    move('output', 'tests/output')

    for original in tracked:
        if not original or original == '.gitignore':
            continue
        current = mapping.get(original, original)
        p = ROOT / current
        if p.suffix not in {'.ts', '.tsx', '.cjs', '.json', '.md', '.ps1', '.sh'} or not p.is_file():
            continue
        text = p.read_text(encoding='utf-8-sig')
        before = text
        if '.test.' in p.name:
            def module_path(match):
                quote, spec = match.groups()
                target = (ROOT / original).parent / spec
                candidates = [target, Path(str(target) + '.ts'), Path(str(target) + '.tsx')]
                resolved = next((q.resolve() for q in candidates if q.exists() or q.resolve().relative_to(ROOT).as_posix() in mapping), None)
                if resolved is None:
                    return match.group(0)
                rel = resolved.relative_to(ROOT).as_posix()
                destination = ROOT / mapping.get(rel, rel)
                if resolved.suffix in {'.ts', '.tsx'} and not spec.endswith(resolved.suffix):
                    destination = destination.with_suffix('')
                updated = os.path.relpath(destination, p.parent).replace('\\', '/')
                if not updated.startswith('.'):
                    updated = './' + updated
                return quote + updated + quote
            text = re.sub(r"(['\"])(\.{1,2}/[^'\"\n]+)\1", module_path, text)
        if original.startswith('scripts/') and current.startswith('tests/scripts/'):
            text = re.sub(r"(__dirname,\s*['\"])\.\.(['\"])", r'\g<1>../..\2', text)
            text = re.sub(r"(['\"])\.\./(?=(?:package(?:-lock)?\.json|out/|src/|resources/|release/|node_modules/|output/|tmp/))", r'\1../../', text)
            text = text.replace("$PSScriptRoot '..'", "$PSScriptRoot '../..'")
        # Longest exact paths first, then generated files/caches.
        for old, new in pairs:
            text = text.replace(old, new).replace(old.replace('/', '\\'), new.replace('/', '\\'))
        text = re.sub(r'(?<![\w/])tmp/', 'tests/tmp/', text)
        text = re.sub(r'(?<![\w/])output/', 'tests/output/', text)
        text = re.sub(r"(['\"])tmp\1(?=\s*[,\)])", r'\1tests/tmp\1', text)
        text = re.sub(r"(['\"])output\1(?=\s*[,\)])", r'\1tests/output\1', text)
        text = re.sub(r'(?<![\w\\])output\\', r'tests\\output\\', text)
        if p.suffix == '.md':
            def link(match):
                label, target = match.groups()
                if re.match(r'(?:https?:|#|/)', target) or ' ' in target:
                    return match.group(0)
                absolute = ((ROOT / original).parent / target).resolve()
                if not absolute.is_relative_to(ROOT):
                    return match.group(0)
                rel = absolute.relative_to(ROOT).as_posix()
                dest = ROOT / mapping.get(rel, rel)
                if not dest.exists():
                    return match.group(0)
                return '[' + label + '](' + os.path.relpath(dest, p.parent).replace('\\', '/') + ')'
            text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
        if text != before:
            p.write_text(text, encoding='utf-8', newline='\n')
    # Fixture aliases are private migration-only state, never a saved lookup.
    recorded = {old: new for old, new in mapping.items() if not new.startswith('tests/fixtures/')}
    (ROOT / 'tests/migration-map.json').write_text(json.dumps(recorded, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'moved': len(mapping), 'unit': sum('.test.' in x for x in mapping), 'scripts': sum(x.startswith('scripts/') for x in mapping), 'fixtures': len(fixtures)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
