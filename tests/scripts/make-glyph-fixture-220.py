"""Create a synthetic font and PDF to reproduce glyphs missing from an embedded subset."""
from io import BytesIO
from pathlib import Path
import fitz
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parents[2]
FONT_NAME = 'PDFuckTestSubset'
SAMPLES = 'A7é中あ한ЖمאअZ'


def font():
    def outline(points):
        pen = TTGlyphPen(None)
        if points:
            pen.moveTo(points[0])
            for point in points[1:]:
                pen.lineTo(point)
            pen.closePath()
        return pen.glyph()

    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(['.notdef', 'A', 'Z'])
    builder.setupCharacterMap({65: 'A', 90: 'Z'})
    builder.setupGlyf({
        '.notdef': outline([]),
        'A': outline([(65, 0), (305, 680), (540, 0)]),
        'Z': outline([(45, 60), (45, 540), (545, 540), (545, 60)])
    })
    builder.setupHorizontalMetrics({name: (620, 45) for name in ['.notdef', 'A', 'Z']})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': FONT_NAME, 'styleName': 'Regular', 'psName': FONT_NAME})
    builder.setupOS2()
    builder.setupPost()
    data = BytesIO()
    builder.save(data)
    return data.getvalue()


def make_fixture():
    with fitz.open() as doc:
        page = doc.new_page(width=600, height=400)
        # Adobe predefined CJK mapping and a non-embedded system fallback.
        page.insert_text((40, 300), '日本語', fontname='japan', fontsize=30)
        def add(obj, stream=None):
            xref = doc.get_new_xref()
            doc.update_object(xref, obj)
            if stream is not None:
                doc.update_stream(xref, stream)
            return xref

        data = font()
        embedded = add(f'<< /Length1 {len(data)} >>', data)
        descriptor = add(f'''<< /Type /FontDescriptor /FontName /{FONT_NAME}
            /Flags 32 /FontBBox [0 -200 620 800] /Ascent 800 /Descent -200 /CapHeight 680
            /StemV 80 /ItalicAngle 0 /FontFile2 {embedded} 0 R >>''')
        cid = add(f'''<< /Type /Font /Subtype /CIDFontType2 /BaseFont /{FONT_NAME}
            /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>
            /FontDescriptor {descriptor} 0 R /DW 1000 /CIDToGIDMap /Identity >>''')

        codes = [1, *range(0x5101, 0x5101 + len(SAMPLES) - 2), 2]
        excluded = {0x5180: ' ', 0x5181: '\ufffd', 0x5182: '\ue000'}
        mappings = {**dict(zip(codes, SAMPLES)), **excluded}
        entries = '\n'.join(f'<{code:04x}> <{char.encode("utf-16-be").hex()}>' for code, char in mappings.items())
        unicode = add('<< >>', f'''/CIDInit /ProcSet findresource begin
12 dict begin begincmap
/CMapName /PDFuckTestMap def
/CMapType 2 def
1 begincodespacerange <0000> <ffff> endcodespacerange
{len(mappings)} beginbfchar
{entries}
endbfchar
endcmap CMapName currentdict /CMap defineresource pop end end'''.encode())
        type0 = f'/Type /Font /Subtype /Type0 /BaseFont /{FONT_NAME} /Encoding /Identity-H /DescendantFonts [{cid} 0 R]'
        mapped = add(f'<< {type0} /ToUnicode {unicode} 0 R >>')
        unmapped = add(f'<< {type0} >>')

        resources = int(doc.xref_get_key(page.xref, 'Resources')[1].split()[0])
        doc.xref_set_key(resources, 'Font/Mapped', f'{mapped} 0 R')
        doc.xref_set_key(resources, 'Font/Unmapped', f'{unmapped} 0 R')
        row = ''.join(f'{code:04x}' for code in codes)
        blanks = ''.join(f'{code:04x}' for code in excluded)
        content = add('<< >>', f'''0 0 0 rg BT /Mapped 36 Tf 9 Tc 40 325 Td <{row}> Tj ET
0 0.5 0 RG BT /Mapped 36 Tf 1 Tr 40 245 Td <5103> Tj ET
BT /Mapped 36 Tf 3 Tr 85 245 Td <5103> Tj ET
BT /Mapped 36 Tf 7 Tr 130 245 Td <5103> Tj ET
BT /Mapped 36 Tf 9 Tc 175 245 Td <{blanks}> Tj ET
BT /Unmapped 36 Tf 310 245 Td <5103> Tj ET
'''.encode())
        doc.xref_set_key(page.xref, 'Contents', '[' + ' '.join(f'{ref} 0 R' for ref in [*page.get_contents(), content]) + ']')
        doc.save(ROOT / 'tests/fixtures/release-2.2.0-glyph-regression.pdf', garbage=4, deflate=True)


if __name__ == '__main__':
    make_fixture()
