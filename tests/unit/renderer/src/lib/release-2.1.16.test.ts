import { describe, expect, it } from 'vitest'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { textCaretAtPoint, textItemsToWordBoxes, textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import { selectionTextItems } from '../../../../../src/renderer/src/lib/selection-text-items'

const styles = { f: { fontFamily: 'serif', ascent: .8, descent: -.2, vertical: false } }
const item = (str: string, x: number, y: number, width = 220, size = 10): TextItem => ({ str, width, height: size, transform: [size,0,0,size,x,800-y], fontName: 'f', dir: 'ltr', hasEOL: true })
const box = (text: string, x: number, y: number, column: number, extra: Partial<WordBox> = {}): WordBox => ({text,order:y*100+x,column,columnBoundaries:[300],rect:{x,y,width:100,height:10},baselineY:y+8,...extra})
const languages = ['连续多行正文测试','ordinary body paragraph','日本語の本文を選択','본문을선택합니다','корректный текст абзаца','selección del párrafo','sélection du paragraphe','Absatz vollständig wählen','seleção do parágrafo','اختيار النص الكامل']

describe('2.1.16 selection domains', () => {
  it.each([1,2,3,4].flatMap(columns=>[.5,1,2.16].map(scale=>({columns,scale}))))('preserves $columns columns at scale $scale with a narrow gutter', ({columns,scale}) => {
    const items: TextItem[]=[]
    for(let row=0;row<12;row++) {
      for(let col=0;col<columns;col++) items.push(item('Ordinary paragraph sample',40+col*118,60+row*14,110))
      items.push(item(String(row),40+columns*118+8,60+row*14,8,8))
    }
    expect(textItemsToWordBoxes(items,styles,[scale,0,0,-scale,0,800*scale])[0].columnBoundaries).toHaveLength(columns-1)
  })
  it.each(languages)('detects a local two-column prose band in %s', text => {
    const items: TextItem[] = []
    for (let row=0;row<24;row++) items.push(item(String(row),20,40+row*9,8,7),item('1.25',420,40+row*9,22,7))
    for (let row=0;row<6;row++) items.push(item(text,40,380+row*14),item(text,320,380+row*14))
    const words=textItemsToWordBoxes(items,styles,[1,0,0,-1,0,800])
    expect(words[0].columnBoundaries).toHaveLength(1)
    expect(words[0].columnBoundaries![0]).toBeGreaterThan(260)
    expect(words[0].columnBoundaries![0]).toBeLessThan(320)
  })
  it('does not turn a ruled table with long text cells into newspaper columns', () => {
    const items: TextItem[]=[]
    for(let row=0;row<12;row++) for(let col=0;col<4;col++) items.push(item('Sample text',40+col*130,70+row*18,105))
    const graphics=[60,100,180,285].map(y=>({image:false,parts:1,rect:{x:35,y,width:520,height:0}}))
    expect(textItemsToWordBoxes(items,styles,[1,0,0,-1,0,800],{},undefined,graphics)[0].columnBoundaries).toEqual([])
  })
  it.each([false,true])('distinguishes a framed form from a page border around prose, prose=%s', prose => {
    const items: TextItem[]=[]
    for(let row=0;row<8;row++) for(const x of [40,320]) items.push(item('Sample paragraph text',x,80+row*18,prose?220:100))
    const rules=[{x:30,y:50,width:530,height:0},{x:30,y:300,width:530,height:0},{x:30,y:50,width:0,height:250},{x:560,y:50,width:0,height:250}]
    const words=textItemsToWordBoxes(items,styles,[1,0,0,-1,0,800],{},undefined,[{image:false,parts:1,rect:{x:30,y:50,width:530,height:250},rules}])
    expect(words[0].columnBoundaries).toHaveLength(prose?1:0)
  })
  it('keeps manual boundaries even inside a ruled region', () => {
    const words=textItemsToWordBoxes([item('Sample paragraph',40,70),item('Other paragraph',320,70)],styles,[1,0,0,-1,0,800],{},{columnBoundaries:[300]})
    expect(words[0].columnBoundaries).toEqual([300])
  })
  it('recognizes columns when every glyph is a separate PDF text object', () => {
    const items: TextItem[]=[]
    for(let row=0;row<10;row++) for(const x of [40,320]) for(let col=0;col<36;col++) items.push(item('文',x+col*6,60+row*14,6))
    expect(textItemsToWordBoxes(items,styles,[1,0,0,-1,0,800])[0].columnBoundaries).toHaveLength(1)
  })
  it.each([false,true])('groups disconnected halves of a spanning equation before body selection, reverse=%s', reverse => {
    const items=[item('P(w) = a / (b + w)',80,40,180,16),item('+ c / (d + w) (32)',320,40,210,16)]
    for(let row=0;row<12;row++) items.push(item('Left body paragraph sample',40,120+row*14),item('Right body paragraph sample',320,120+row*14))
    const words=textItemsToWordBoxes(items,styles,[1,0,0,-1,0,800]),first=words.findIndex(w=>w.text==='Left'),last=words.length-1-[...words].reverse().findIndex(w=>w.text==='sample'),a={wordIndex:first,offset:0},b={wordIndex:last,offset:6}
    const text=textSelectionBetween(words,reverse?b:a,reverse?a:b)?.text
    expect(text).toContain('Right body')
    expect(text).not.toContain('(32)')
    expect(text).not.toContain('P(w)')
  })
  it('places a caret on the right half of a spanning caption instead of remote column text', () => {
    const words=[box('caption right',320,80,0),box('right body',320,400,1)]
    expect(textCaretAtPoint(words,{x:360,y:85})?.wordIndex).toBe(0)
  })
  it.each([false,true])('excludes an earlier spanning equation during cross-column selection, reverse=%s', reverse => {
    const words=[box('left body',40,400,0),box('left end',40,420,0),box('formula',330,40,1,{visualBlock:0}),box('right body',330,440,1)]
    const a={wordIndex:0,offset:0},b={wordIndex:3,offset:10}
    expect(textSelectionBetween(words,reverse?b:a,reverse?a:b)?.text).toBe('left body left end right body')
  })
  it.each([false,true])('preserves full intermediate CJK rows and partial endpoints, reverse=%s', reverse => {
    const words=[box('甲乙丙丁',28,40,0,{columnBoundaries:[]}),box('连续完整正文包含数字123及标点。',28,60,0,{columnBoundaries:[],rect:{x:28,y:60,width:530,height:10}}),box('戊己庚辛',28,80,0,{columnBoundaries:[]})]
    const a={wordIndex:0,offset:2},b={wordIndex:2,offset:2}
    expect(textSelectionBetween(words,reverse?b:a,reverse?a:b)?.text.replace(/\s/g,'')).toBe('丙丁连续完整正文包含数字123及标点。戊己')
  })
  it('keeps a table-cell selection within its original cell', () => {
    const bounds={x:30,y:30,width:120,height:60}
    const words=[box('First',40,40,0,{tableCell:0,tableCellRect:bounds}),box('Second',40,60,0,{tableCell:0,tableCellRect:bounds}),box('Neighbor',200,60,0,{tableCell:1,tableCellRect:{...bounds,x:190}})]
    expect(textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:2,offset:8})?.text).toBe('First Second')
  })
})

const ops={save:1,restore:2,setGState:3,setFont:4,showText:5,beginMarkedContent:6,endMarkedContent:7,beginMarkedContentProps:8}
const glyphs=(text:string)=>Array.from(text,unicode=>({unicode}))
describe('2.1.16 watermark selection filtering',()=>{
  it('reads font and opacity inherited from an ExtGState',()=>{
    const body=item('Body paragraph',40,100),mark=item('Overlay',40,100)
    expect(selectionTextItems([body,mark],{fnArray:[4,5,3,5],argsArray:[['f',10],[glyphs(body.str)],[[['Font',['f',18]],['ca',.2]]],[glyphs(mark.str)]]},ops)).toEqual([body])
  })
  it('filters long marked text without spreading an unbounded glyph array',()=>{
    const mark=item('sample'.repeat(25000),40,100)
    expect(selectionTextItems([mark],{fnArray:[4,6,5,7],argsArray:[['f',10],['Watermark'],[glyphs(mark.str)],[]]},ops)).toEqual([])
  })
  it.each(languages)('ignores a translucent overlay while keeping the underlying text in %s',text=>{
    const body=item(text,40,100),mark=item(text,40,100)
    const selected=selectionTextItems([body,mark],{fnArray:[4,5,1,3,5,2],argsArray:[['f',10],[glyphs(text)],[],[[['ca',.18]]],[glyphs(text)],[]]},ops)
    expect(selected).toEqual([body])
  })
  it('keeps a faint non-overlapping footnote and an ordinary rotated label',()=>{
    const body=item('Body paragraph',40,100),note=item('Footnote',40,700),label={...item('Axis label',20,200),transform:[0,10,-10,0,20,600]}
    expect(selectionTextItems([body,note,label],{fnArray:[4,5,3,5],argsArray:[['f',10],[glyphs(body.str)],[[['ca',.2]]],[glyphs(note.str)]]},ops)).toEqual([body,note,label])
  })
  it('ignores an explicitly tagged opaque watermark and restores marked-content state',()=>{
    const mark=item('REVIEW COPY',40,100),body=item('Ordinary text',40,120)
    expect(selectionTextItems([mark,body],{fnArray:[4,8,5,7,5],argsArray:[['f',10],['Watermark',{}],[glyphs(mark.str)],[],[glyphs(body.str)]]},ops)).toEqual([body])
  })
  it('ignores a large diagonal overlay without removing a vertical label',()=>{
    const body=item('Body paragraph',80,95),mark={...item('DRAFT COPY',40,100,300,40),transform:[30,30,-30,30,40,700]},label={...item('Vertical label',20,200),transform:[0,10,-10,0,20,600]}
    expect(selectionTextItems([body,mark,label],{fnArray:[],argsArray:[]},ops)).toEqual([body,label])
  })
})
