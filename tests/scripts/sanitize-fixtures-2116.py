"""Build public, synthetic layout replicas. Never copy original PDF objects or pixels."""
import argparse, hashlib, json, pathlib, re, shutil
import fitz

ROOT = pathlib.Path(__file__).resolve().parents[2]
PRIVATE = ROOT / 'tests/tmp/release-2.1.16/private-fixtures'
PUBLIC = ROOT / 'tests/fixtures'
LATIN = 'sampletextlayoutcontent'
CJK = '测试样本文字内容布局数据'


def replacement(text):
    # Only standard figure/table markers survive, so discovery still has semantic labels.
    marker = re.match(r'^(?:Fig\.?|Figure|TABLE|Table|图|表)\s*(?:[IVX]+|\d+)?[.:]?', text)
    prefix = marker.end() if marker else 0
    result = []
    for i, c in enumerate(text):
        if i < prefix or c.isspace(): result.append(c)
        elif '\u3400' <= c <= '\u9fff' or '\u3040' <= c <= '\ud7af': result.append(CJK[i % len(CJK)])
        elif c.isalpha(): result.append(LATIN[i % len(LATIN)].upper() if c.isupper() else LATIN[i % len(LATIN)])
        elif c.isdigit(): result.append(str((i * 3 + 7) % 10))
        elif c in '.,;:!?()[]{}+-=/<>%': result.append(c)
        else: result.append('x')
    return ''.join(result)


def sanitize(source, target):
    original = fitz.open(source)
    print('Rebuilding',target.name,flush=True)
    clean = fitz.open()
    form_count = 0
    for old in original:
        page = clean.new_page(width=old.rect.width, height=old.rect.height)
        page.insert_font(fontname='safe', fontbuffer=fitz.Font('cjk').buffer)
        safe_font = fitz.Font('cjk')
        # Preserve only straight table rules. All other graphics become plain placeholders.
        rules=page.new_shape()
        for drawing in old.get_drawings():
            for part in drawing['items']:
                if part[0] == 'l':
                    a, b = part[1:3]
                    if abs(a.x-b.x) < .1 or abs(a.y-b.y) < .1:
                        rules.draw_line(a,b)
                elif part[0] == 're' and part[1].width >= 30 and part[1].height >= 20: rules.draw_rect(part[1])
        rules.finish(color=(.45,.45,.45),width=.3)
        rules.commit()
        # No source image is embedded, including scans, signatures, logos and QR codes.
        for image in old.get_image_info():
            rect = fitz.Rect(image['bbox']) & page.rect
            if not rect.is_empty: page.draw_rect(rect,color=(.65,.65,.65),fill=(.94,.94,.94),width=.4)
        shape=page.new_shape()
        for block in old.get_text('rawdict')['blocks']:
            for line in block.get('lines',[]):
                dx,dy=line['dir']
                for span in line['spans']:
                    chars=span['chars']; text=''.join(c['c'] for c in chars); safe=replacement(text)
                    for index,(char,new) in enumerate(zip(chars,safe)):
                        if new.isspace(): continue
                        x,y=char['origin']; rect=fitz.Rect(char['bbox']); size=span['size']
                        next_origin=chars[index+1]['origin'] if index+1<len(chars) else None
                        advance=((next_origin[0]-x)*dx+(next_origin[1]-y)*dy) if next_origin else (rect.width if abs(dx)>.5 else rect.height)
                        natural=safe_font.text_length(new,fontsize=size)
                        if natural <= 0 or advance <= 0: continue
                        # Keep each source advance and baseline, without retaining source glyph data.
                        matrix=fitz.Matrix(dx*advance/natural,dy*advance/natural,-dy,dx,0,0)
                        shape.insert_text((x,y),new,fontname='safe',fontsize=size,morph=(fitz.Point(x,y),matrix),color=(0,0,0))
        shape.commit()
        for old_widget in old.widgets() or []:
            widget=fitz.Widget(); widget.field_name=f'field_{form_count:04d}'; form_count+=1
            widget.field_type=old_widget.field_type; widget.rect=old_widget.rect; widget.field_flags=old_widget.field_flags
            if widget.field_type in [fitz.PDF_WIDGET_TYPE_COMBOBOX,fitz.PDF_WIDGET_TYPE_LISTBOX]: widget.choice_values=['Sample A','Sample B']
            if widget.field_type==fitz.PDF_WIDGET_TYPE_TEXT: widget.field_value=replacement(old_widget.field_value or '')
            try: page.add_widget(widget)
            except ValueError:
                widget.field_type=fitz.PDF_WIDGET_TYPE_TEXT; widget.field_value=''; page.add_widget(widget)
        page.set_rotation(old.rotation)
    clean.set_metadata({})
    clean.subset_fonts()
    target.parent.mkdir(parents=True,exist_ok=True)
    clean.save(target,garbage=4,deflate=True)
    clean.close()
    with fitz.open(target) as check:
        assert len(check)==len(original)
        assert not check.embfile_count() and not check.get_toc()
        assert not any(p.get_images() for p in check)
        assert sum(len(list(p.widgets() or [])) for p in check)==form_count
        assert not any(p.annots() and list(p.annots()) for p in check)
        # The writer starts from an empty document: metadata, hidden text, attachments,
        # original images, fonts, structure trees, URLs and revisions cannot be copied.
    return {'file':target.name,'pages':len(original),'widgets':form_count,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--rebuild',action='store_true');args=parser.parse_args()
    if not args.rebuild: parser.error('Use --rebuild; originals must be available in the ignored private backup.')
    PRIVATE.mkdir(parents=True,exist_ok=True)
    for file in PUBLIC.glob('*.pdf'):
        backup=PRIVATE/file.name
        if not backup.exists(): shutil.copyfile(file,backup)
    report=[]
    for file in sorted(PRIVATE.glob('*.pdf')):
        target=PUBLIC/file.name; temporary=target.with_suffix('.safe.pdf')
        report.append(sanitize(file,temporary)); temporary.replace(target);report[-1]['file']=target.name
    (PUBLIC/'sanitization-manifest.json').write_text(json.dumps({'policy':'synthetic text; no original pixels or PDF objects','fixtures':report},indent=2)+'\n')
    print(json.dumps({'files':len(report),'pages':sum(r['pages'] for r in report),'widgets':sum(r['widgets'] for r in report)}))

if __name__=='__main__': main()
