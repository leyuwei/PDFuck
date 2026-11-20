import { PDFDict, PDFDocument, PDFHexString, PDFName } from 'pdf-lib'
import { expect, it } from 'vitest'
import { PdfDocumentModel } from '../../../../../src/renderer/src/lib/pdf-document'

const legacyBody = '<body xmlns="http://www.w3.org/1999/xhtml"><p><span>旧格式示例</span></p></body>'
const note = '中文和 café；符号 <>& (示例) 😀\n\n第二段：日本語 한국어 العربية 🧑🏽‍🔬'
const rects = [{x:36, y:72, width:80, height:12}]
const marks = [{start:0,end:note.length,bold:true,italic:true}]
const RC = PDFName.of('RC')
const MARKS = PDFName.of('PDFuckMarks')

async function pdfWithLegacy() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([420,540])
  doc.addPage([420,540])
  for (const [id, flags] of [['plain','[]'],['styled',JSON.stringify(marks)],['imported',undefined]] as const) {
    const dict = doc.context.obj({
      Type:'Annot',Subtype:'Text',Rect:[36,36,58,58],Contents:PDFHexString.fromText(note),
      NM:PDFHexString.fromText(id),RC:PDFHexString.fromText(legacyBody),T:PDFHexString.fromText('审阅者'),
      ...(flags === undefined ? {} : {PDFuckColor:PDFHexString.fromText('#123456'),PDFuckMarks:PDFHexString.fromText(flags)})
    })
    page.node.addAnnot(doc.context.register(dict))
  }
  return doc.save({useObjectStreams:false})
}

async function annotations(bytes: Uint8Array, page = 0) {
  const pdf = await PDFDocument.load(bytes)
  return (pdf.getPage(page).node.Annots()?.asArray() || []).map(ref => pdf.context.lookup(ref,PDFDict))
}

it('writes new plain comments and saves plain edits without a competing RC field', async () => {
  const model = await PdfDocumentModel.load(await pdfWithLegacy())
  const id = await model.addAnnotation(1,'highlight',rects,note,undefined,undefined,undefined,'测试员')
  expect(model.annotations().find(annotation=>annotation.id===id)?.content).toBe(note)
  let [added] = await annotations(model.bytes,1)
  expect(added.lookup(PDFName.Contents,PDFHexString).asBytes().slice(0,2)).toEqual(new Uint8Array([254,255]))
  expect(added.has(RC)).toBe(false)
  await model.updateAnnotationProperties(id,note.replace('😀',''),'#ffbb42')
  ;[added] = await annotations(model.bytes,1)
  expect(added.has(RC)).toBe(false)
  expect(added.has(MARKS)).toBe(false)
  expect(added.lookup(PDFName.Contents,PDFHexString).decodeText()).toBe(note.replace('😀',''))
})

it('keeps formatting with ASCII XHTML character references including complete emoji code points', async () => {
  const model = await PdfDocumentModel.load(await pdfWithLegacy())
  const middleOfEmoji = note.indexOf('😀')+1
  const marks = [{start:middleOfEmoji,end:middleOfEmoji+1,bold:true}]
  const id = await model.addAnnotation(1,'note',rects,note,undefined,undefined,undefined,undefined,undefined,marks)
  const [dict] = await annotations(model.bytes,1)
  const rich = dict.lookup(RC,PDFHexString)
  expect(Array.from(rich.asBytes()).every(byte=>byte>=32 && byte<=126)).toBe(true)
  expect(rich.decodeText()).toContain('xfa:contentType="text/html"')
  expect(rich.decodeText()).toContain('<span style="font-weight:bold">&#x1f600;</span>')
  expect(rich.decodeText()).toContain('&lt;&gt;&amp;')
  expect(rich.decodeText()).toContain('<br/><br/>')
  expect(model.annotations().find(annotation=>annotation.id===id)?.marks).toEqual(marks)
})

it('rewrites old rich comments on clean save while keeping the original snapshot and third-party entries intact', async () => {
  const original = await pdfWithLegacy()
  const model = await PdfDocumentModel.load(original)
  const before = model.annotations()
  const prepared = await model.prepareSave()
  const [plain,styled,imported] = await annotations(prepared.data)
  expect(plain.has(RC)).toBe(false)
  expect(styled.lookup(RC,PDFHexString).decodeText()).toContain('font-weight:bold;font-style:italic')
  expect(imported.lookup(RC,PDFHexString).decodeText()).toBe(legacyBody)
  for (const dict of [plain,styled,imported]) expect(dict.lookup(PDFName.Contents,PDFHexString).decodeText()).toBe(note)
  expect(model.bytes).toEqual(original)
  expect(model.dirty).toBe(false)
  expect(model.canUndo).toBe(false)
  expect(model.hasLegacyAnnotationRichText()).toBe(true)
  model.markSaved('saved.pdf',prepared)
  const again = await model.prepareSave()
  expect(again.repairedDocument).toBeUndefined()
  expect(again.data).toEqual(prepared.data)
  expect(model.annotations()).toEqual(before)
  expect(model.canUndo).toBe(false)
})

it('repairs page exports independently, with undo able to restore editable originals', async () => {
  const model = await PdfDocumentModel.load(await pdfWithLegacy())
  const [plain,styled,imported] = await annotations(await model.pageSubset([0]))
  expect(plain.has(RC)).toBe(false)
  expect(styled.lookup(RC,PDFHexString).decodeText()).toContain('&#x1f600;')
  expect(imported.lookup(RC,PDFHexString).decodeText()).toBe(legacyBody)
  expect(model.hasLegacyAnnotationRichText()).toBe(true)
  await model.updateAnnotation('styled',note+' updated')
  const data = await model.prepareSave()
  model.markSaved('saved.pdf', data)
  await model.undo()
  expect(model.annotations().find(annotation=>annotation.id==='styled')?.content).toBe(note)
  expect(model.hasLegacyAnnotationRichText()).toBe(true)
  await model.redo()
  expect(model.hasLegacyAnnotationRichText()).toBe(false)
})

it('keeps grouped annotations in sync when formatting or emoji is removed', async () => {
  const model = await PdfDocumentModel.load(await pdfWithLegacy())
  const groupId = 'sample-group'
  const [first] = await model.addAnnotations([0,1].map(pageIndex=>({pageIndex,kind:'underline',rects,content:note,groupId,marks})))
  await model.updateAnnotationProperties(first,'保留所有中文\n并删除 emoji','#e6ba36')
  const group = model.annotations().filter(row=>row.groupId===groupId)
  expect(group.map(row=>row.content)).toEqual(['保留所有中文\n并删除 emoji','保留所有中文\n并删除 emoji'])
  for (const page of [0,1]) expect((await annotations(model.bytes,page)).at(-1)!.has(RC)).toBe(false)
})

it('uses the standard plain field for text containing characters XML cannot represent', async () => {
  const model = await PdfDocumentModel.load(await pdfWithLegacy())
  const text = '中文\u0001文本'
  await model.addAnnotation(1,'note',rects,text,undefined,undefined,undefined,undefined,undefined,[{start:0,end:4,bold:true}])
  const [dict] = await annotations(model.bytes,1)
  expect(dict.lookup(PDFName.Contents,PDFHexString).decodeText()).toBe(text)
  expect(dict.has(RC)).toBe(false)
})
