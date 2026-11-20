const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { PDFDocument, PDFDict, PDFName, PDFHexString } = require('pdf-lib')
const { load, root } = require('./release-2.1.17-table-review.cjs')
const { PdfDocumentModel } = load('pdf-document')
const work = path.join(root,'tests/tmp/release-2.2.0-annotation-text')
const archive = path.join(root,'tests/fixtures/de7504b89709419a91bce0c0865e21e8.pdf')
const output = path.join(root,'tests/output/release-2.2.0-annotation-text')
const digest = data => createHash('sha256').update(data).digest('hex')
const python = process.env.PDFUCK_PYMUPDF_PYTHON || path.join(root,'tests/tmp/release-2.1.16/venv/bin/python')
const note = '适用于中文 and café、한국어、日本語、العربية 🧑🏽‍🔬\n\nKeep (a) < b & c > d 😀.'
const original = process.argv[2]
const names = ['New plain','New styled','Edited emoji removed','External rich text']

async function main() {
  const result = { original:0, archive:0, synthetic:0, pdfjsRich:0, pdfkit:0, mupdf:0, oldRcFailure:0 }
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const tool = path.join(work,'pdfkit-annotations')
  execFileSync('swiftc',[path.join(__dirname,'release-2.2.0-annotation-readers.swift'),'-o',tool],{stdio:'inherit'})
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  async function inspect(bytes,page) {
    const task = getDocument({data:Uint8Array.from(bytes),standardFontDataUrl:root+'/node_modules/pdfjs-dist/standard_fonts/',useWasm:false})
    try { return await (await (await task.promise).getPage(page)).getAnnotations() }
    finally { await task.destroy() }
  }
  function inspectNative(file,page,expected) {
    const token = `${page}:${digest(expected)}`
    const kit = execFileSync(tool,[file],{encoding:'utf8'}).split(/\r?\n/u)
    const mu = execFileSync(python,['-c',
      'import fitz,hashlib,sys\nd=fitz.open(sys.argv[1])\nfor p in d:\n for a in p.annots() or []:\n  print(str(p.number+1)+":"+hashlib.sha256(a.info["content"].encode()).hexdigest())',file],{encoding:'utf8'}).split(/\r?\n/u)
    assert.ok(kit.includes(token),'PDFKit must return the exact original Unicode and paragraph breaks')
    assert.ok(mu.includes(token),'MuPDF must return the exact original Unicode and paragraph breaks')
    result.pdfkit++; result.mupdf++
  }
  for (const [label,file,find] of [
    ['archive',archive,row=>row.id==='fixture-legacy-comment'],
    ...(original?[['original',original,row=>row.content.startsWith('我突然在想一个问题')]]:[])
  ]) {
    const initial = fs.readFileSync(file)
    const model = await PdfDocumentModel.load(initial)
    const row = model.annotations().find(find)
    assert.ok(row && row.pageIndex===1 && !row.marks.length)
    const baseline = (await inspect(initial,2)).find(item=>item.contentsObj?.str===row.content)
    assert.ok(baseline && !baseline.richText)
    result.oldRcFailure++
    const {data} = await model.prepareSave()
    assert.equal(digest(fs.readFileSync(file)),digest(initial))
    assert.ok(data.length > 0 && model.hasLegacyAnnotationRichText())
    const repaired = (await inspect(data,2)).find(item=>item.contentsObj?.str===row.content)
    assert.ok(repaired && !Object.hasOwn(repaired,'richText'))
    const fixture = path.join(work,label+'-repaired.pdf')
    fs.writeFileSync(fixture,data,{mode:0o600})
    try { inspectNative(fixture,2,row.content) }
    finally { fs.rmSync(fixture,{force:true}) }
    result[label]++
  }
  const d = await PDFDocument.create()
  const page = d.addPage([480,680])
  const foreign = d.context.obj({Type:'Annot',Subtype:'Text',Rect:[30,110,54,132],T:PDFHexString.fromText(names[3]),
    Contents:PDFHexString.fromText(note),
    RC:PDFHexString.of(Buffer.from('<body><p>Third-party English style</p></body>','ascii').toString('hex'))})
  page.node.addAnnot(d.context.register(foreign))
  const model = await PdfDocumentModel.load(await d.save())
  const rect = [{x:50,y:70,width:75,height:12}]
  const add = (name,marks,y) => model.addAnnotation(0,'highlight',rect.map(r=>({...r,y})),note,undefined,undefined,undefined,name,undefined,marks)
  await add(names[0],undefined,80)
  const marks = [{start:0,end:note.length,bold:true,italic:true,underline:true}]
  await add(names[1],marks,120)
  const edited = await add(names[2],marks,180)
  const withoutEmoji = note.replace('🧑🏽‍🔬','').replace('😀','')
  await model.updateAnnotationProperties(edited,withoutEmoji,'#e6ba36')
  const syntheticFile = path.join(output,'multilingual-comments.pdf')
  fs.writeFileSync(syntheticFile,model.bytes)
  const read = await inspect(model.bytes,1)
  for (const name of names.slice(0,3)) {
    const data = read.find(item=>item.titleObj.str===name)
    const expected = name===names[2]?withoutEmoji:note
    assert.equal(data?.contentsObj.str,expected)
    if(name===names[1]){
      assert.equal(data.richText?.str,expected)
      assert.ok(data.richText.html.children[0].children[0].attributes.style.fontWeight==='bold')
      result.pdfjsRich++
    } else assert.ok(!Object.hasOwn(data,'richText'))
    inspectNative(syntheticFile,1,expected)
    result.synthetic++
  }
  const foreignRc = (await PDFDocument.load(model.bytes)).getPage(0).node.Annots().lookup(0,PDFDict).lookup(PDFName.of('RC'))
  assert.equal(foreignRc.decodeText(),foreign.lookup(PDFName.of('RC')).decodeText())
  fs.writeFileSync(path.join(output,'readers.json'),JSON.stringify(result,null,2)+'\n')
  console.log(result)
}
main().catch(error=>{console.error(error);process.exitCode=1})
