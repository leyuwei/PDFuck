"""Remove cropped-out content from already public replacement tables without reencoding glyphs."""
import pathlib,json,fitz
root=pathlib.Path(__file__).resolve().parents[2]
manifest=json.loads((root/'tests/fixtures/release-2.1.17-open-tables.json').read_text())
source=fitz.open(root/'tests/fixtures'/manifest['file']);work=root/'tests/tmp/release-2.1.17'
for page,box in [(5,(48,53,564,466)),(8,(311,53,564,458)),(9,(48,53,564,454)),(16,(48,53,564,594)),(21,(321,53,554,133))]:
    crop=fitz.open();crop.insert_pdf(source,from_page=page-1,to_page=page-1)
    crop[0].clip_to_rect(fitz.Rect(box));crop[0].set_cropbox(fitz.Rect(box))
    assert all(fitz.Rect(w[:4]).intersects(crop[0].rect) for w in crop[0].get_text('words'))
    target=work/f'open-table-{page}-only.pdf';crop.save(target,garbage=4,deflate=True);crop.close()
