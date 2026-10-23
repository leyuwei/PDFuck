import { describe, expect, it } from 'vitest'
import { detectPageVisuals, isolateVisualWords, pageGraphics, type PageGraphic } from '../../../../../src/renderer/src/lib/page-visuals'
import { textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
const ops = Object.fromEntries(['save','restore','transform','constructPath','endPath','fill','stroke','clip','eoClip','paintFormXObjectBegin','paintFormXObjectEnd','beginGroup','endGroup','paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintSolidColorImageMask','paintImageXObjectRepeat','paintImageMaskXObjectRepeat','paintInlineImageXObjectGroup','paintImageMaskXObjectGroup'].map((key,i)=>[key,i+1]))
const identity: [number,number,number,number,number,number] = [1,0,0,1,0,0]
const path = (bounds: number[], paint = ops.fill): [string,any[]] => ['constructPath',[paint,[],bounds]]
function graphics(commands: Array<[string,any[]]>, viewport = identity) {return pageGraphics({fnArray:commands.map(([op])=>ops[op]),argsArray:commands.map(([,args])=>args)},viewport,ops)}
const rect = (x: number,y: number,width: number,height: number) => ({x,y,width,height})
const word = (text: string,x: number,y: number,width = 180,height = 10): WordBox => ({text,rect:rect(x,y,width,height),baselineY:y+height*.8,order:y,column:0})
const graphic = (x: number,y: number,width: number,height: number): PageGraphic => ({rect:rect(x,y,width,height),image:false,parts:8})
const size = {width:600,height:800}

describe('2.1.11 visible painted bounds',()=>{
 it('clips oversized Form fills without painting the Form BBox itself and restores the parent transform',()=>{
  expect(graphics([['transform',[1,0,0,1,50,60]],['paintFormXObjectBegin',[null,[0,0,240,150]]],path([-150,-500,390,500]),['paintFormXObjectEnd',[]],path([300,300,320,320])]).map(g=>g.rect)).toEqual([rect(50,60,240,150),rect(350,360,20,20)])
  expect(graphics([['paintFormXObjectBegin',[null,[0,0,240,150]]],['paintFormXObjectEnd',[]]])).toEqual([])
 })
 it('composes nested Form matrices and clips in the displayed rotated coordinate system',()=>{
  const commands: Array<[string,any[]]> = [['paintFormXObjectBegin',[[2,0,0,2,10,20],[0,0,100,100]]],['paintFormXObjectBegin',[[1,0,0,1,40,30],[0,0,100,100]]],path([-100,-100,200,200]),['paintFormXObjectEnd',[]],path([0,0,10,10]),['paintFormXObjectEnd',[]]]
  expect(graphics(commands,[0,1,-1,0,800,0]).map(g=>g.rect)).toEqual([rect(580,90,140,120),rect(760,10,20,20)])
 })
 it('applies both clip modes after their consuming paths, including paths that also paint',()=>{
  for(const mode of ['clip','eoClip']) {
   const result=graphics([['save',[]],[mode,[]],path([10,20,110,100],ops.endPath),['transform',[2,0,0,2,0,0]],path([0,0,200,200]),['restore',[]],path([200,200,220,220])])
   expect(result.map(g=>g.rect)).toEqual([rect(10,20,100,80),rect(200,200,20,20)])
  }
  expect(graphics([['clip',[]],path([10,20,110,100]),path([0,0,200,200])]).map(g=>g.rect)).toEqual([rect(10,20,100,80),rect(10,20,100,80)])
 })
 it('discards empty/disjoint clips and restores a previous clip after nested saves',()=>{
  for(const bounds of [[0,0,0,0],[200,200,220,220]]) {
   const result=graphics([['clip',[]],path([10,10,100,100],ops.endPath),['save',[]],['eoClip',[]],path(bounds,ops.endPath),path([-500,-500,500,500]),['paintImageXObject',[]],['restore',[]],path([-500,-500,500,500])])
   expect(result.map(g=>g.rect)).toEqual([rect(10,10,90,90)])
  }
 })
 it('clips every raster instance type before it enters clustering',()=>{
  const commands: Array<[string,any[]]> = [['clip',[]],path([10,10,60,60],ops.endPath),['save',[]],['transform',[100,0,0,100,0,0]],...['paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintSolidColorImageMask'].map(op=>[op,[]] as [string,any[]]),['restore',[]],['paintImageXObjectRepeat',['image',100,100,[0,0,200,0]]],['paintImageMaskXObjectRepeat',['mask',100,0,0,100,[0,0,200,0]]],['paintInlineImageXObjectGroup',[{},[{transform:[100,0,0,100,0,0]},{transform:[100,0,0,100,200,0]}]]],['paintImageMaskXObjectGroup',[[{transform:[100,0,0,100,0,0]},{transform:[100,0,0,100,200,0]}]]]]
  expect(graphics(commands).map(g=>g.rect)).toEqual(Array.from({length:8},()=>rect(10,10,50,50)))
 })
 it('constrains transparency groups without applying their matrix twice or leaking the clip',()=>{
  const result=graphics([['beginGroup',[{matrix:[2,0,0,2,10,20],bbox:[0,0,40,50]}]],['paintFormXObjectBegin',[[2,0,0,2,10,20],[0,0,40,50]]],path([-100,-100,100,100]),['paintFormXObjectEnd',[]],['endGroup',[]],path([300,300,320,320])])
  expect(result.map(g=>g.rect)).toEqual([rect(10,20,80,100),rect(300,300,20,20)])
 })
 it('keeps visible zero-width grid rules, rejects wholly clipped paths and accepts null Form bounds',()=>{
  const result=graphics([['paintFormXObjectBegin',[null,null]],['clip',[]],path([10,10,100,100],ops.endPath),path([50,0,50,200],ops.stroke),path([200,0,200,200],ops.stroke),['paintFormXObjectEnd',[]]])
  expect(result.map(g=>g.rect)).toEqual([rect(50,10,0,90)])
 })
 it('keeps body words out of a clipped figure in both selection directions',()=>{
  const words=[word('Before',40,30),word('Diagram',80,90),word('Figure 1. Caption',40,220),word('Adjacent body column.',330,90,230),word('After',40,280)]
  words.forEach((w,i)=>w.order=i)
  const painted=graphics([['transform',[1,0,0,1,50,60]],['paintFormXObjectBegin',[null,[0,0,240,150]]],path([-150,-500,390,500]),['paintFormXObjectEnd',[]]])
  const regions=detectPageVisuals(words,painted,size),isolated=isolateVisualWords(words,regions)
  expect(regions).toHaveLength(1);expect(regions[0].rect).toEqual(rect(40,60,250,170));expect(isolated[3].visualRegion).toBeUndefined();expect(isolated[4].visualRegion).toBeUndefined()
  const a={wordIndex:0,offset:0},b={wordIndex:4,offset:5},selection=textSelectionBetween(isolated,a,b)!
  expect(selection.text).toBe('Before Adjacent body column. After');expect(textSelectionBetween(isolated,b,a)).toEqual(selection)
 })
})

describe('2.1.11 multi-panel caption bounds',()=>{
 it('binds six explicitly lettered panels into one figure including its complete caption',()=>{
  const words: WordBox[]=[],painted:PageGraphic[]=[]
  for(let i=0;i<6;i++){const x=40+i%2*270,y=60+Math.floor(i/2)*160;painted.push(graphic(x,y,220,130));words.push(word(`(${String.fromCharCode(97+i)})`,x+100,y+135,15))}
  words.push(word('Figure 6. Results: (a) first, (b) second.',40,560,500),word('(c), (d), (e) and (f) final results.',40,574,500),word('The next body paragraph.',40,610,500))
  const result=detectPageVisuals(words,painted,size)
  expect(result).toHaveLength(1);expect(result[0].label).toBe('Figure 6');expect(result[0].rect).toEqual(rect(40,60,500,524));expect(result[0].caption).toContain('final results')
  expect(isolateVisualWords(words,result).at(-1)?.visualRegion).toBeUndefined()
 })
 it('uses the caption font for spacing on pages filled with smaller diagram labels',()=>{
  const words=Array.from({length:30},(_,i)=>word('cell',60+i%5*30,80+Math.floor(i/5)*20,20,5))
  words.push(word('(a)',140,215,12,10),word('(b)',140,500,12,10),word('Figure 3. Workflow (a) structure.',40,528,500,10),word('(b) interactions.',40,542,500,10))
  const result=detectPageVisuals(words,[graphic(40,60,220,150),graphic(40,250,220,240)],size)
  expect(result).toHaveLength(1);expect(result[0].label).toBe('Figure 3');expect(result[0].rect.y+result[0].rect.height).toBe(552)
 })
 it('does not combine lettered figures across intervening body text or a separate caption',()=>{
  const panels=[graphic(40,60,220,130),graphic(40,300,220,130)]
  const labels=[word('(a)',140,200,12),word('(b)',140,440,12),word('Figure 2. Results (a) and (b).',40,465,500)]
  const prose=word('This is ordinary body prose between unrelated diagrams, and it must remain selectable independently of both graphics.',40,240,500)
  const result=detectPageVisuals([...labels,prose],panels,size)
  expect(result).toHaveLength(2);expect(isolateVisualWords([prose],result)[0].visualRegion).toBeUndefined()
  const separate=detectPageVisuals([...labels,word('Figure 1. Separate diagram.',40,220,220)],panels,size)
  expect(separate).toHaveLength(2);expect(separate.map(v=>v.label)).toEqual(['Figure 1','Figure 2'])
 })
 it('rejects a graphic surrounding multiple body columns even when a caption lies inside it',()=>{
  const words=[word('Figure 1. False title',40,210,220)]
  for(let i=0;i<4;i++)for(const x of[40,320])words.push(word('A long line of actual body prose repeated across the columns should never be absorbed into a visual region.',x,80+i*24,230))
  expect(detectPageVisuals(words,[graphic(30,60,540,300)],size)).toEqual([])
 })
})
