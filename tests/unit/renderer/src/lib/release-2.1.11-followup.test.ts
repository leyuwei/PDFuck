import { PDFDocument, PDFName, PDFString, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { PdfDocumentModel } from '../../../../../src/renderer/src/lib/pdf-document'
import { detectPageVisuals } from '../../../../../src/renderer/src/lib/page-visuals'
import type { AddAnnotationRequest } from '../../../../../src/renderer/src/types'
import type { WordBox } from '../../../../../src/renderer/src/lib/text-layout'
const rect={x:40,y:100,width:180,height:14}
async function model(){const doc=await PDFDocument.create();doc.addPage([600,800]);doc.addPage([600,800]);return PdfDocumentModel.load(await doc.save())}
const ai=(content:string,extra:Partial<AddAnnotationRequest>={}):AddAnnotationRequest=>({pageIndex:0,kind:'highlight',rects:[{...rect}],content,aiGenerated:true,...extra})
const word=(text:string,x:number,y:number):WordBox=>({text,order:y,rect:{x,y,width:120,height:10},baselineY:y+8,column:0})

describe('2.1.11 follow-up: crop boundary',()=>{
 it('does not list graphics or captions outside any edge of the visible page',()=>{
  const graphics=[{x:-250,y:80,width:200,height:100},{x:601,y:80,width:200,height:100},{x:40,y:-150,width:200,height:100},{x:40,y:801,width:200,height:100}].map(rect=>({rect,image:true,parts:1}))
  const words=[word('Figure 1. Hidden left',-250,200),word('Figure 2. Hidden right',610,200),word('Figure 3. Hidden top',40,-20),word('Table 4. Hidden below',40,850)]
  expect(detectPageVisuals(words,graphics,{width:600,height:800})).toEqual([])
 })
 it('clips partially visible regions on all edges and rejects NaN/infinite geometry',()=>{
  for(const r of [{x:-10,y:30,width:200,height:100},{x:450,y:30,width:200,height:100},{x:40,y:-10,width:200,height:100},{x:40,y:750,width:200,height:100}]){
   const [v]=detectPageVisuals([], [{rect:r,image:true,parts:1}],{width:600,height:800})
   expect(v).toBeDefined();expect(v.rect.x).toBeGreaterThanOrEqual(0);expect(v.rect.y).toBeGreaterThanOrEqual(0);expect(v.rect.x+v.rect.width).toBeLessThanOrEqual(600);expect(v.rect.y+v.rect.height).toBeLessThanOrEqual(800)
  }
  expect(detectPageVisuals([], [{rect:{...rect,x:NaN},image:true,parts:1},{rect:{...rect,width:Infinity},image:true,parts:1}],{width:600,height:800})).toEqual([])
 })
 it('does not infer a borderless table from off-crop text',()=>{
  const words=[word('Table 2. Hidden',610,60)]
  for(let i=0;i<4;i++)words.push(word('Method',610,85+i*18),{...word('10',760,85+i*18),rect:{x:760,y:85+i*18,width:20,height:10}})
  expect(detectPageVisuals(words,[],{width:600,height:800})).toEqual([])
 })
 it('uses the displayed dimensions and origin of a rotated CropBox',async()=>{
  const doc=await PDFDocument.create(),page=doc.addPage([700,900]);page.setCropBox(100,150,400,600);page.setRotation(degrees(90))
  const m=await PdfDocumentModel.load(await doc.save());expect(m.getPageSize(0)).toEqual({width:600,height:400})
  const [visual]=detectPageVisuals([],[{rect:{x:550,y:350,width:100,height:100},image:true,parts:1}],m.getPageSize(0))
  expect(visual.rect).toEqual({x:550,y:350,width:50,height:50})
 })
})

describe('2.1.11 follow-up: shared AI annotation writes',()=>{
 it('merges overlapping independent checks and deduplicates repeated paragraphs across batches',async()=>{
  const m=await model(),[id]=await m.addAnnotations([ai('术语需要统一。')]);await m.addAnnotations([ai('补充证据。',{rects:[{...rect,x:110,width:180}]})]);await m.addAnnotations([ai('术语需要统一。')])
  const [a]=m.annotations();expect(m.annotations()).toHaveLength(1);expect(a.id).toBe(id);expect(a.content).toBe('术语需要统一。\n\n补充证据。');expect(a.rects).toEqual([{...rect,width:250}])
 })
 it('keeps one complete newest rewrite without concatenating alternatives or broadening its source',async()=>{
  const m=await model();await m.addAnnotations([ai('旧的完整改写',{aiRevision:true})]);await m.addAnnotations([ai('新的完整改写',{kind:'replace',rects:[{...rect,x:100,width:80}]})])
  const [a]=m.annotations();expect(m.annotations()).toHaveLength(1);expect(a.kind).toBe('replace');expect(a.content).toBe('新的完整改写');expect(a.rects).toEqual([{...rect,x:100,width:80}])
 })
 it('merges new diagnostics into the explanation of the retained rewrite',async()=>{
  const m=await model();await m.addAnnotations([ai('完整替换文本',{kind:'replace',reason:'统一术语。'})]);await m.addAnnotations([ai('补充因果解释。')])
  const [a]=m.annotations();expect(m.annotations()).toHaveLength(1);expect(a.content).toBe('完整替换文本');expect(a.reason).toBe('统一术语。\n\n补充因果解释。')
 })
 it('handles overlapping findings within one batch, transitive overlaps and adjacent lines independently',async()=>{
  const m=await model();await m.addAnnotations([ai('一'),ai('二',{rects:[{...rect,x:210}]}),ai('三',{rects:[{...rect,x:380}]}),ai('下一行',{rects:[{...rect,y:118}]})])
  expect(m.annotations()).toHaveLength(2);expect(m.annotations()[0].content).toBe('一\n\n二\n\n三')
 })
 it('does not merge different pages or a multi-line bounding-box gap',async()=>{
  const m=await model();await m.addAnnotations([ai('多行',{rects:[rect,{...rect,y:160}]}),ai('中间正文',{rects:[{...rect,y:130}]}),ai('下一页',{pageIndex:1})]);expect(m.annotations()).toHaveLength(3)
 })
 it('preserves manual annotations, human-edited AI content, replies and markup',async()=>{
  const m=await model();const [manual,edited,replied]=await m.addAnnotations([ai('人工',{aiGenerated:false}),ai('待人工编辑',{rects:[{...rect,y:150}]}),ai('已回复',{rects:[{...rect,y:200}]})])
  await m.updateAnnotation(edited,'人工修改的内容');await m.updateAnnotationReply(replied,{status:'handled',content:'人工已核实'})
  await m.addAnnotations([ai('新检查'),ai('新编辑区检查',{rects:[{...rect,y:150}]}),ai('新已回复区检查',{rects:[{...rect,y:200}]})])
  expect(m.annotations()).toHaveLength(6);expect(m.annotations().find(a=>a.id===manual)?.content).toBe('人工');expect(m.annotations().find(a=>a.id===edited)?.content).toBe('人工修改的内容');expect(m.annotations().find(a=>a.id===replied)?.reply?.content).toBe('人工已核实')
 })
 it('does not mistake a manual annotation with an AI reply for AI-authored content',async()=>{
  const m=await model(),[id]=await m.addAnnotations([ai('人工原批注',{aiGenerated:false})]);await m.updateAnnotationReply(id,{status:'custom',content:'AI 回复',aiGenerated:true});await m.addAnnotations([ai('新生成内容')]);expect(m.annotations()).toHaveLength(2);expect(m.annotations().find(a=>a.id===id)?.content).toBe('人工原批注')
 })
 it('persists original anchors for insert/note and uses figure regions instead of nearby note icons',async()=>{
  const m=await model();await m.addAnnotations([ai('原文插入',{kind:'insert',point:{x:220,y:114}})]);let reopened=await PdfDocumentModel.load(m.bytes)
  await reopened.addAnnotations([ai('新的插入',{kind:'insert',point:{x:220,y:114}})]);expect(reopened.annotations()).toHaveLength(1);expect(reopened.annotations()[0].content).toBe('新的插入')
  const n=await model();await n.addAnnotations([ai('图一',{kind:'note',point:{x:280,y:120},rects:[{x:40,y:40,width:220,height:120}]}),ai('图二',{kind:'note',point:{x:281,y:121},rects:[{x:320,y:40,width:220,height:120}]})]);expect(n.annotations()).toHaveLength(2)
  reopened=await PdfDocumentModel.load(n.bytes);await reopened.addAnnotations([ai('图一补充',{kind:'note',point:{x:280,y:120},rects:[{x:40,y:40,width:220,height:120}]})]);expect(reopened.annotations()).toHaveLength(2);expect(reopened.annotations().find(a=>a.content.includes('图一'))?.content).toBe('图一\n\n图一补充')
 })
 it('coalesces repeated whole-document notes at the same point without merging them into marked text',async()=>{
  const m=await model();await m.addAnnotation(0,'note',[],'全文评价一',{x:550,y:42},undefined,undefined,undefined,undefined,undefined,true);await m.addAnnotation(0,'note',[],'全文评价二',{x:550,y:42},undefined,undefined,undefined,undefined,undefined,true);await m.addAnnotations([ai('正文检查',{rects:[{x:550,y:42,width:30,height:20}]})]);expect(m.annotations()).toHaveLength(2);expect(m.annotations()[0].content).toContain('全文评价二')
 })
 it('merges cross-page versions as one group and preserves the group for manual batches',async()=>{
  const m=await model();await m.addAnnotations([ai('旧检查',{groupId:'old'}),ai('旧检查',{groupId:'old',pageIndex:1})]);await m.addAnnotations([ai('新检查',{groupId:'new'}),ai('新检查',{groupId:'new',pageIndex:1})]);expect(m.annotations()).toHaveLength(2);expect(new Set(m.annotations().map(a=>a.groupId)).size).toBe(1);expect(m.annotations().every(a=>a.content==='旧检查\n\n新检查')).toBe(true)
  await m.addAnnotations([ai('人工跨页',{aiGenerated:false,groupId:'manual'}),ai('人工跨页',{aiGenerated:false,groupId:'manual',pageIndex:1})]);expect(m.annotations().filter(a=>a.groupId==='manual')).toHaveLength(2)
 })
 it('is idempotent after reopen and has one atomic undo/redo for a merge',async()=>{
  const m=await model();await m.addAnnotations([ai('第一轮')]);const before=m.bytes;await m.addAnnotations([ai('第二轮')]);const after=m.bytes;await m.undo();expect(m.bytes).toEqual(before);await m.redo();expect(m.bytes).toEqual(after)
  const reopened=await PdfDocumentModel.load(m.bytes);await reopened.addAnnotations([ai('第二轮')]);expect(reopened.annotations()).toHaveLength(1);expect(reopened.bytes).toEqual(after);expect(reopened.canUndo).toBe(false)
 })
 it('validates the entire batch before mutating and rolls back failed merge commits',async()=>{
  const m=await model();await m.addAnnotations([ai('已有检查')]);const before=m.bytes
  await expect(m.addAnnotations([ai('新检查'),ai('非法位置',{rects:[{...rect,x:NaN}]})])).rejects.toThrow();expect(m.bytes).toEqual(before)
  const doc=m as unknown as {document:PDFDocument};const save=doc.document.save;doc.document.save=async()=>{throw Error('write failed')}
  await expect(m.addAnnotations([ai('新检查')])).rejects.toThrow('write failed');expect(m.bytes).toEqual(before);expect(m.annotations()[0].content).toBe('已有检查');void save
 })
})

it('coalesces overlapping AI records from PDFs saved before this fix on the next write',async()=>{
 const doc=await PDFDocument.create(),page=doc.addPage([600,800])
 for(const [id,content] of [['legacy-a','First check'],['legacy-b','Second check']])page.node.addAnnot(doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Highlight',Rect:[40,686,220,700],NM:PDFString.of(id),Contents:PDFString.of(content),PDFuckAI:PDFName.of('true')})))
 const m=await PdfDocumentModel.load(await doc.save());expect(m.annotations()).toHaveLength(2)
 await m.addAnnotations([ai('Third check')]);expect(m.annotations()).toHaveLength(1);expect(m.annotations()[0].id).toBe('legacy-a');expect(m.annotations()[0].content).toBe('First check\n\nSecond check\n\nThird check')
 const reopened=await PdfDocumentModel.load(m.bytes);await reopened.addAnnotations([ai('Third check')]);expect(reopened.annotations()).toHaveLength(1)
})

it('preserves AI annotations that the user recolored or repositioned',async()=>{
 const m=await model(),[colored,moved]=await m.addAnnotations([ai('User color'),ai('User position',{rects:[{...rect,y:200}]})])
 await m.updateAnnotationColor(colored,'#123456');await m.moveAnnotation(moved,5,0)
 await m.addAnnotations([ai('New color-region check'),ai('New position-region check',{rects:[{...rect,y:200}]})])
 expect(m.annotations()).toHaveLength(4);expect(m.annotations().find(a=>a.id===colored)?.color).toBe('#123456');expect(m.annotations().find(a=>a.id===moved)?.rects[0].x).toBe(45)
})
