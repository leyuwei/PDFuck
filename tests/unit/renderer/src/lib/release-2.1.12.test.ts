import {readFileSync} from 'node:fs'
import {PDFDocument,PDFName,PDFDict,PDFRef,PDFRawStream} from 'pdf-lib'
import {describe,expect,it} from 'vitest'
import {annotationOperationsFilter} from '../../../../../src/renderer/src/lib/pdf-annotation-render'
import {PdfDocumentModel} from '../../../../../src/renderer/src/lib/pdf-document'
import {pageGraphics,detectPageVisuals,isolateVisualWords,type PageGraphic} from '../../../../../src/renderer/src/lib/page-visuals'
import {detectTableGrids} from '../../../../../src/renderer/src/lib/table-cells'
import {textSelectionBetween,textSelectionForQuery,textCaretAtPoint,moveTextPosition,type WordBox} from '../../../../../src/renderer/src/lib/text-layout'
import {bodySelectionBetween} from '../../../../../src/renderer/src/lib/page-text-selection'
import {flattenPdfuckAnnotationsForPrint,imposePdfForPrint,DEFAULT_PRINT_PDF_OPTIONS} from '../../../../../src/renderer/src/lib/print-layout'
import {styledTextRaster} from '../../../../../src/renderer/src/lib/styled-text'
const rect=(x:number,y:number,width:number,height:number)=>({x,y,width,height})
const word=(text:string,x:number,y:number,width=50):WordBox=>({text,rect:rect(x,y,width,10),order:y*100+x,column:x<150?0:1,baselineY:y+8})
const graphic=(x:number,y:number,width:number,height:number):PageGraphic=>({rect:rect(x,y,width,height),image:false,parts:1})
const size={width:600,height:800},ops=Object.fromEntries(['save','restore','transform','constructPath','endPath','stroke','paintFormXObjectBegin','paintFormXObjectEnd','beginAnnotation','endAnnotation','paintImageXObject'].map((k,i)=>[k,i+1]))
const grid=(merged=false):PageGraphic[]=>[...([60,100,140].map(y=>graphic(40,y,220,0))),graphic(40,60,0,80),graphic(150,merged?100:60,0,merged?40:80),graphic(260,60,0,80)]
const words=()=>[word('左上第一行',50,70),word('右上',160,70),word('左上第二行',50,84),word('左下',50,110),word('右下',160,110)]
const prepared=()=>{const original=words();original.forEach((w,i)=>w.order=i);return isolateVisualWords(original,detectPageVisuals(original,grid(),size))}

describe('2.1.12 native appearance preservation',()=>{
 it('suppresses exactly the overlaid annotation block while retaining widgets, FreeText and dependencies elsewhere',()=>{
  const list={fnArray:[50,ops.beginAnnotation,51,ops.endAnnotation,ops.beginAnnotation,52,ops.endAnnotation,ops.beginAnnotation,53,ops.endAnnotation],argsArray:[[],['widget'],[],[],['overlay'],[],[],['external-FreeText'],[],[]]}
  const filter=annotationOperationsFilter(list,['overlay'],ops)
  expect(list.fnArray.map((_,i)=>filter(i))).toEqual([true,true,true,true,false,false,false,true,true,true])
  expect(list.fnArray.every((_,i)=>annotationOperationsFilter(list,[],ops)(i))).toBe(true)
 })
 it('keeps all 142 real fields, their values and appearance references after an edit, undo/redo and reopen',async()=>{
  const bytes=new Uint8Array(readFileSync('tests/fixtures/39fb2a5696459c9b2d0e09f8334797c3.pdf'))
  const snapshot=async(data:Uint8Array)=>{const d=await PDFDocument.load(data),fields=d.getForm().getFields();return fields.map(f=>({name:f.getName(),value:(f as unknown as {getText:()=>string|undefined}).getText()||'',widgets:f.acroField.getWidgets().map(w=>w.dict.get(PDFName.of('AP'))?.toString())}))}
  const original=await snapshot(bytes);expect(original).toHaveLength(142);expect(original.filter(f=>f.value)).toHaveLength(31)
  const m=await PdfDocumentModel.load(bytes);await m.addAnnotation(0,'highlight',[rect(80,80,100,12)],'test');expect(await snapshot(m.bytes)).toEqual(original)
  expect(m.annotations()[0].pdfAnnotationId).toMatch(/^\d+R$/);await m.undo();expect(await snapshot(m.bytes)).toEqual(original);await m.redo();expect(await snapshot((await PdfDocumentModel.load(m.bytes)).bytes)).toEqual(original)
 })
 it('retains the original form and paints its 142 printable appearances into a temporary print source',async()=>{
  const bytes=readFileSync('tests/fixtures/39fb2a5696459c9b2d0e09f8334797c3.pdf'),d=await PDFDocument.load(bytes)
  expect(flattenPdfuckAnnotationsForPrint(d)).toBe(142)
  const printed=await PDFDocument.load(await imposePdfForPrint(bytes,[0,1],{...DEFAULT_PRINT_PDF_OPTIONS,multiPage:true,rows:1,columns:2}))
  expect(printed.getPageCount()).toBe(1);expect(printed.getPage(0).node.Resources()?.toString()).toContain('XObject')
  expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(142)
 })
 it('prints regenerated appearances when a populated field has no AP stream',async()=>{
  const d=await PDFDocument.create(),p=d.addPage([600,800]),form=d.getForm(),field=form.createTextField('missing');field.setText('Recovered value');field.addToPage(p,{x:40,y:300,width:200,height:30});form.updateFieldAppearances();field.acroField.getWidgets()[0].dict.delete(PDFName.of('AP'))
  const printed=await PDFDocument.load(await imposePdfForPrint(await d.save({updateFieldAppearances:false}),[0],DEFAULT_PRINT_PDF_OPTIONS))
  const resources=printed.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'),PDFDict),embedded=printed.context.lookup(resources.values()[0])
  if(!(embedded instanceof PDFRawStream))throw new Error('Missing embedded print page')
  expect(embedded.dict.lookup(PDFName.of('Resources'),PDFDict).lookup(PDFName.of('XObject'),PDFDict).keys()).toHaveLength(1)
 })
 it('exposes PDF reference ids for overlaid native marks and added text without relying on NM',async()=>{
  const d=await PDFDocument.create(),p=d.addPage([600,800]);const ref=d.context.register(d.context.obj({Type:'Annot',Subtype:'Highlight',Rect:[40,40,80,55],NM:'external-name',QuadPoints:[40,55,80,55,40,40,80,40]}));p.node.addAnnot(ref)
  const m=await PdfDocumentModel.load(await d.save());expect(m.annotations()[0].pdfAnnotationId).toBe(`${ref.objectNumber}R`)
  await m.addText(0,rect(40,50,200,40),'Text',{font:'Helvetica',size:16,bold:false,italic:false,align:'left',color:'#000000'})
  expect(m.textObjects()[0].pdfAnnotationId).toMatch(/^\d+R$/)
  const doc=await PDFDocument.load(m.bytes),annots=doc.getPage(0).node.Annots()!;expect(annots.lookup(0,PDFDict).get(PDFName.of('NM'))?.toString()).toContain('external-name');expect(annots.get(0)).toBeInstanceOf(PDFRef)
 })
})

describe('2.1.12 actual table rules',()=>{
 it('identifies an uncaptioned repeated grid and keeps adjacent prose outside it',()=>{
  const source=[...words(),word('下面是正文',40,160,300)],visuals=detectPageVisuals(source,grid(),size)
  expect(visuals).toHaveLength(1);expect(visuals[0].kind).toBe('table');expect(visuals[0].cells).toHaveLength(4);expect(visuals[0].rect).toEqual(rect(40,60,220,80));expect(isolateVisualWords(source,visuals).at(-1)?.tableCell).toBeUndefined()
 })
 it('does not treat annotation appearances as document grid evidence',()=>{
  const painted=pageGraphics({fnArray:[ops.beginAnnotation,ops.constructPath,ops.endAnnotation,ops.constructPath],argsArray:[['widget'],[ops.stroke,[[0,40,60,1,260,60]],[40,60,260,60]],[],[ops.stroke,[[0,40,100,1,260,100]],[40,100,260,100]]]},[1,0,0,1,0,0],ops)
  expect(painted).toHaveLength(1);expect(painted[0].rect.y).toBe(100)
 })
 it('retains a merged header as one cell rather than splitting it at a lower-row divider',()=>{
  const tables=detectTableGrids(words(),grid(true),size)
  expect(tables).toHaveLength(1);expect(tables[0].cells).toEqual([rect(40,60,220,40),rect(40,100,110,40),rect(150,100,110,40)])
 })
 it('joins fragmented and thin filled borders but requires every edge of each cell',()=>{
  const split=grid().flatMap(g=>g.rect.width?[graphic(g.rect.x,g.rect.y,g.rect.width/2-.25,.6),graphic(g.rect.x+g.rect.width/2+.25,g.rect.y,g.rect.width/2-.25,.6)]:[g])
  expect(detectTableGrids(words(),split,size)[0].cells).toHaveLength(4)
  expect(detectTableGrids(words(),grid().filter(g=>g.rect.x!==260),size)).toEqual([])
 })
 it('extracts individual rules from one stroked path after a nested Form transform and rotated viewport',()=>{
  const data=[0,40,60,1,260,60,0,40,100,1,260,100,0,40,140,1,260,140,0,40,60,1,40,140,0,150,60,1,150,140,0,260,60,1,260,140]
  const painted=pageGraphics({fnArray:[ops.paintFormXObjectBegin,ops.constructPath,ops.paintFormXObjectEnd],argsArray:[[[1,0,0,1,10,20],[0,0,300,200]],[ops.stroke,[data],[40,60,260,140]],[]]},[0,1,-1,0,800,0],ops)
  expect(painted[0].rules).toHaveLength(6)
  const text=[word('A',645,55),word('B',685,55),word('C',645,165),word('D',685,165)]
  expect(detectTableGrids(text,painted,{width:800,height:600})[0].cells).toHaveLength(4)
 })
 it('does not infer cells from an image, axes, a single box, empty background or nonfinite geometry',()=>{
  for(const painted of [[graphic(40,60,220,80)],grid().map(g=>({...g,image:true})),[graphic(40,60,220,0),graphic(40,60,0,80)],grid().map(g=>({...g,rect:{...g.rect,x:Infinity}}))])expect(detectTableGrids(words(),painted,size)).toEqual([])
  expect(detectTableGrids([],grid(),size)).toEqual([])
 })
 it('rejects dense plot grids whose interior cells are mostly empty',()=>{
  const rules=[...[60,100,140,180,220].map(y=>graphic(40,y,220,0)),...[40,95,150,205,260].map(x=>graphic(x,60,0,160))]
  expect(detectTableGrids([word('legend',50,70,30),word('series',160,110,30)],rules,size)).toEqual([])
 })
 it('keeps separate tables independent and ignores a figure reference beside a ruled table',()=>{
  const other=grid().map(g=>({...g,rect:{...g.rect,x:g.rect.x+300}})),text=[...words(),...words().map(w=>({...w,rect:{...w.rect,x:w.rect.x+300}})),word('图6（a）显示正文引用。',40,150,200)]
  const visuals=detectPageVisuals(text,[...grid(),...other],size)
  expect(visuals).toHaveLength(2);expect(visuals.every(v=>v.kind==='table'&&v.cells?.length===4&&v.rect.height===80)).toBe(true)
 })
})

describe('2.1.12 cell selection domains',()=>{
 it('selects all lines of one cell in both directions without adjacent column/row words',()=>{
  const w=prepared(),a={wordIndex:0,offset:0},b={wordIndex:2,offset:6},selection=textSelectionBetween(w,a,b)!
  expect(selection.text.replace(/\s/g,'')).toBe('左上第一行左上第二行');expect(textSelectionBetween(w,b,a)).toEqual(selection)
  expect(selection.rects.every(r=>r.x>=40&&r.y>=60&&r.x+r.width<=150&&r.y+r.height<=100)).toBe(true)
 })
 it('clamps a caret and a drag crossing another cell to the anchor cell',()=>{
  const w=prepared(),a={wordIndex:0,offset:0},caret=textCaretAtPoint(w,{x:550,y:500},a)!
  expect(caret.wordIndex).toBe(2)
  const selection=textSelectionBetween(w,a,{wordIndex:4,offset:2})!
  expect(selection.text.replace(/\s/g,'')).toBe('左上第一行左上第二行');expect(selection.rects.every(r=>r.x+r.width<=150&&r.y+r.height<=100)).toBe(true)
 })
 it('keeps a horizontal overshoot on a short wrapped final line rather than jumping to a longer line above',()=>{
  const bounds=rect(40,60,220,80),w=[{...word('First long line',50,70,200),tableCell:0,tableCellRect:bounds},{...word('End',50,90,25),tableCell:0,tableCellRect:bounds}]
  expect(textCaretAtPoint(w,{x:500,y:95},{wordIndex:0,offset:0})?.wordIndex).toBe(1)
  const selected=textSelectionBetween([...w,word('outside',400,90)],{wordIndex:0,offset:0},{wordIndex:2,offset:7})!
  expect(selected.text).toContain('End')
 })
 it('clips oversized glyph selection bounds to the cell and constrains keyboard movement',()=>{
  const w=prepared();w[0].selectionRect=rect(35,55,140,60)
  const selected=textSelectionBetween(w,{wordIndex:0,offset:0},{wordIndex:0,offset:6})!
  expect(selected.rects[0].y).toBe(60);expect(selected.rects[0].y+selected.rects[0].height).toBe(100)
  expect(moveTextPosition(w,{wordIndex:0,offset:5},1)).toEqual({wordIndex:2,offset:0})
  expect(moveTextPosition(w,{wordIndex:2,offset:5},1)).toEqual({wordIndex:2,offset:5})
  expect(moveTextPosition(w,{wordIndex:0,offset:0},-1)).toEqual({wordIndex:0,offset:0})
 })
 it('keeps body drags outside the whole table while exact AI/search quotes can cross cell boundaries',()=>{
  const original=[word('Before',40,30),...words(),word('After',40,180)],w=isolateVisualWords(original,detectPageVisuals(original,grid(),size));w.forEach((v,i)=>v.order=i)
  expect(bodySelectionBetween(w,{wordIndex:0,offset:0},{wordIndex:6,offset:5})!.text).toBe('Before After')
  const exact=textSelectionForQuery(w,'左下 右下',{includeAllMatchedWords:true})!
  expect(exact.text).toBe('左下右下')
  expect(textSelectionForQuery(w,'左下 右下')!.text).toBe('左下右下')
 })
 it('does not start a selection in an empty cell and follows visual order for keyboard continuation',()=>{
  const original=words(),visuals=detectPageVisuals(original,grid(),size),cells=visuals.flatMap(v=>v.cells||[]),w=isolateVisualWords(original,visuals).filter(v=>v.tableCell!==3)
  expect(textCaretAtPoint(w,{x:200,y:120},undefined,cells)).toBeUndefined()
  const first=w[0],last=w[2],shuffled=[last,first]
  expect(moveTextPosition(shuffled,{wordIndex:1,offset:5},1)).toEqual({wordIndex:0,offset:0})
 })
 it('preserves a one-cell multiline RTL domain',()=>{
  const bounds=rect(40,60,220,80),w=[{...word('واحد',150,70),tableCell:0,tableCellRect:bounds,rtl:true},{...word('اثنان',70,90),tableCell:0,tableCellRect:bounds,rtl:true},word('neighbor',330,90)]
  const selection=textSelectionBetween(w,{wordIndex:0,offset:0},{wordIndex:1,offset:5})!
  expect(selection.text).toContain('واحد');expect(selection.text).toContain('اثنان');expect(selection.text).not.toContain('neighbor')
 })
})

it('keeps ordinary Latin additions on the existing standard PDF font path',async()=>{
 expect(await styledTextRaster('Normal text',rect(40,40,200,40),{style:{font:'Helvetica',size:16,bold:false,italic:false,color:'#000000',align:'left'}})).toBeUndefined()
})
