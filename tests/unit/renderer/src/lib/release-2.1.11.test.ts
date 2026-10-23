import { describe, expect, it } from 'vitest'
import { detectPageVisuals, isolateVisualWords, pageGraphics, type PageGraphic } from '../../../../../src/renderer/src/lib/page-visuals'
import { textItemsToWordBoxes, textSelectionBetween, textSelectionForQuery, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import { bodySelectionBetween } from '../../../../../src/renderer/src/lib/page-text-selection'
import { visualHits } from '../../../../../src/renderer/src/lib/document-insights'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
const size = {width: 600,height:800}
const word = (text: string,x: number,y: number,width = 150): WordBox => ({text,rect:{x,y,width,height:10},order:y,baselineY:y+8,column:0})
const graphic = (x: number,y: number,width: number,height: number,image = true,parts = 1): PageGraphic => ({rect:{x,y,width,height},image,parts})
const ops = Object.fromEntries(['save','restore','transform','constructPath','endPath','paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintSolidColorImageMask','paintImageXObjectRepeat','paintImageMaskXObjectRepeat','paintInlineImageXObjectGroup','paintImageMaskXObjectGroup'].map((key,i)=>[key,i+1]))

describe('2.1.11 complete selection bounds',()=>{
  it('covers Chinese, kana and Hangul below the baseline at three zooms without changing caret widths or layout',()=>{
    for(const scale of [.75,1,1.96]) for(const text of ['为了串起文章，','中文かな한글']) {
      const item = {str:text,transform:[20,0,0,20,10,100],width:text.length*20,height:20,fontName:'f',dir:'ltr',hasEOL:true} as TextItem
      const words=textItemsToWordBoxes([item],{f:{fontFamily:'sans-serif',ascent:.8,descent:-.2,vertical:false}},[scale,0,0,-scale,0,300*scale])
      const selected=textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:0,offset:text.length})!
      expect(selected.rects[0].y).toBeCloseTo((200-18)*scale)
      expect(selected.rects[0].y+selected.rects[0].height).toBeCloseTo((200+4.4)*scale)
      expect(selected.rects[0].width).toBeCloseTo(item.width*scale)
      expect(words[0].rect.height).toBeCloseTo(20*scale)
      expect(textSelectionBetween(words,{wordIndex:0,offset:text.length},{wordIndex:0,offset:0})).toEqual(selected)
    }
  })
  it('uses valid PDF descenders for Latin but rejects extreme font descriptors',()=>{
    for(const descent of [-.3,-12]){
      const item={str:'glyph',transform:[10,0,0,10,10,100],width:25,height:10,fontName:'f',dir:'ltr'} as TextItem
      const w=textItemsToWordBoxes([item],{f:{fontFamily:'serif',ascent:.9,descent,vertical:false}},[1,0,0,-1,0,300])[0]
      expect(w.selectionRect!.height).toBeCloseTo(descent===-.3?12:10)
    }
  })
})

describe('2.1.11 shared figure/table regions',()=>{
  it('associates each image only with its own caption and ignores prose references',()=>{
    const words=[word('See Figure 1 and Table 2 in the following discussion.',40,40,400),word('Figure 1. Measured response',40,225,200),word('Figure 2. Separate image',330,225,210),word('The body continues here.',40,270,450)]
    const visuals=detectPageVisuals(words,[graphic(40,80,220,135),graphic(330,80,220,135)],size)
    expect(visuals.map(v=>v.label)).toEqual(['Figure 1','Figure 2'])
    expect(visuals[0].rect.x+visuals[0].rect.width).toBeLessThan(330)
    expect(visuals.every(v=>v.rect.y+v.rect.height<270)).toBe(true)
    expect(visualHits([{pageIndex:0,text:'Figure 1 Table 2',visuals}])).toHaveLength(2)
    expect(visualHits([{pageIndex:0,text:'See Figure 1. n=20; mean=1.0 | x | y |'}])).toEqual([])
  })
  it('identifies connected vector table paths and Chinese captions, without page background or prose',()=>{
    const visuals=detectPageVisuals([word('表1 实验结果',45,65,180),word('正文继续描述完整实验流程。',45,235,400)], [graphic(0,0,600,800),graphic(45,85,240,130,false,7)],size)
    expect(visuals).toHaveLength(1); expect(visuals[0].kind).toBe('table');expect(visuals[0].rect).toEqual({x:45,y:65,width:240,height:150})
  })
  it('detects a captioned borderless table only with repeated aligned cell rows',()=>{
    const rows=[word('Table 3. Results',40,60)]
    for(let i=0;i<3;i++) rows.push(word('Group',40,80+i*18,35),word(String(i),150,80+i*18,20))
    expect(detectPageVisuals(rows,[],size)).toHaveLength(1)
    expect(detectPageVisuals([word('Table 3 shows the results.',40,60),word('Normal prose follows here.',40,80,300)],[],size)).toEqual([])
  })
  it('rejects scans, page decorations, underlines, equation-size paths and table mentions',()=>{
    const graphics=[graphic(0,0,600,800),graphic(20,20,500,4,false),graphic(80,300,65,15,false,10)]
    expect(detectPageVisuals([word('Figure 2 is discussed below.',40,50),word('Table 2 shows the results.',40,200)],graphics,size)).toEqual([])
  })
  it('keeps multi-line captions together and stops before normal body spacing',()=>{
    const words=[word('Fig. 4. A long caption',40,210,210),word('continued on the second line',40,224,210),word('Body starts at a normal paragraph gap.',40,250,400)]
    const visuals=detectPageVisuals(words,[graphic(40,80,220,120)],size)
    expect(visuals).toHaveLength(1);expect(visuals[0].caption).toContain('second line');expect(visuals[0].rect.y+visuals[0].rect.height).toBe(234)
  })
  it('skips chart text and captions in body selection in both directions but allows independent figure selection and exact quotes',()=>{
    const original=[word('Before',40,40),word('Chart',40,100),word('Figure 1. Caption',40,210),word('After',40,270)]
    const words=isolateVisualWords(original,detectPageVisuals(original,[graphic(40,80,220,120)],size))
    words.forEach((w,i)=>w.order=i)
    const start={wordIndex:0,offset:0},end={wordIndex:3,offset:5}
    const selection=textSelectionBetween(words,start,end)!
    expect(selection.text).toBe('Before After');expect(textSelectionBetween(words,end,start)).toEqual(selection)
    expect(textSelectionBetween(words,{wordIndex:1,offset:0},{wordIndex:2,offset:17})!.text).toContain('Caption')
    expect(textSelectionForQuery(words,'Chart Figure 1. Caption',{includeAllMatchedWords:true})!.text).toContain('Caption')
  })
  it('uses transformed vector bounds, clips and repeated raster image instances correctly',()=>{
    const graphics=pageGraphics({fnArray:[ops.save,ops.transform,ops.paintImageXObjectRepeat,ops.paintImageMaskXObjectRepeat,ops.constructPath,ops.constructPath,ops.restore],argsArray:[[],[2,0,0,2,10,20],['img',20,30,[0,0,100,0]],['mask',10,0,0,10,[30,20]], [99,[],[0,0,20,30]], [ops.endPath,[],[0,0,600,800]],[]]},[1,0,0,1,0,0],ops)
    expect(graphics.map(g=>g.rect)).toEqual([{x:10,y:20,width:40,height:60},{x:210,y:20,width:40,height:60},{x:70,y:60,width:20,height:20},{x:10,y:20,width:40,height:60}])
  })
  it('merges a transitive vector grid once and identifies substantial uncaptioned figures',()=>{
    const lines=[graphic(40,100,200,0,false),graphic(40,150,200,0,false),graphic(40,100,0,50,false),graphic(240,100,0,50,false)]
    expect(detectPageVisuals([word('Table 1. Results',40,75)],lines,size)).toHaveLength(1)
    expect(detectPageVisuals([], [graphic(40,100,200,100,false,8)],size)).toHaveLength(1)
  })
})

it('joins a borderless table split into false newspaper columns without crossing into the neighboring table',()=>{
  const words=[word('Table 1. Grid',40,60,100),{...word('Table 2. Borderless',330,60,150),column:1,textRun:10},{...word('results',485,60,35),column:2,textRun:10}]
  for(let i=0;i<3;i++)words.push({...word('Method',330,85+i*22,45),column:1},{...word(String(i),470,85+i*22,20),column:2})
  const visuals=detectPageVisuals(words,[graphic(40,85,210,100,false,7)],size)
  expect(visuals.map(v=>v.label)).toEqual(['Table 1','Table 2'])
  expect(visuals[1].caption).toContain('results')
  expect(visuals[1].rect.width).toBeGreaterThanOrEqual(190)
  const isolated=isolateVisualWords(words,visuals)
  expect(textSelectionBetween(isolated,{wordIndex:3,offset:0},{wordIndex:8,offset:1})!.text).toContain('2')
})

it('includes table notes without absorbing the following prose paragraph',()=>{
 const words=[word('Table 1. Results',40,60),word('Note: Values include uncertainty.',40,210,220),word('The next body paragraph begins here.',40,240,400)]
 const visuals=detectPageVisuals(words,[graphic(40,80,220,120,false,7)],size)
 expect(visuals[0].rect.y+visuals[0].rect.height).toBe(220)
 expect(isolateVisualWords(words,visuals)[2].visualRegion).toBeUndefined()
})

it('keeps a cross-page body drag out of leading and trailing figure regions, including figure-only pages',()=>{
 const words=[{...word('Table title',40,30),visualRegion:0},word('Body begins',40,200),word('Body ends',40,260),{...word('Figure caption',40,400),visualRegion:1}]
 words.forEach((w,i)=>w.order=i)
 const a={wordIndex:0,offset:0},b={wordIndex:3,offset:14}
 expect(bodySelectionBetween(words,a,b)!.text).toBe('Body begins Body ends')
 expect(bodySelectionBetween(words,b,a)).toEqual(bodySelectionBetween(words,a,b))
 expect(bodySelectionBetween(words.slice(0,1),a,{wordIndex:0,offset:11})).toBeUndefined()
})
