"""Rebuild table-only clips from public fixtures, so hidden source body text cannot enter UI probes."""
import importlib.util,pathlib,fitz
root=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('rebuilder',root/'tests/scripts/sanitize-fixtures-2116.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
# Input is already public replacement text; retain its structural caption markers.
module.replacement=lambda text:text
source=fitz.open(root/'tests/fixtures/e632ab34f7d9583abb798469556cceef.pdf')
work=root/'tests/tmp/release-2.1.17'
for page,box in [(2,(52,77,561,281)),(5,(56,88,303,167))]:
    crop=fitz.open();crop.insert_pdf(source,from_page=page,to_page=page)
    crop[0].set_cropbox(fitz.Rect(box))
    intermediate=work/f'public-table-{page}-crop.pdf';crop.save(intermediate);crop.close()
    module.sanitize(intermediate,work/f'public-table-{page}-only.pdf',split_graphics=True)
