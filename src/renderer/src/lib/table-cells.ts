import type { PdfRect } from '../types'
import type { PageGraphic } from './page-visuals'
import type { WordBox } from './text-layout'

export interface TableGrid { rect: PdfRect; cells: PdfRect[] }
interface Rule { at: number; from: number; to: number }

/** Require closed, repeated cells; a rectangle or chart axes alone is not a table. */
export function detectTableGrids(words: WordBox[], graphics: PageGraphic[], size: {width:number;height:number}): TableGrid[] {
  const heights=words.map(w=>w.rect.height).filter(h=>Number.isFinite(h)&&h>0).sort((a,b)=>a-b),em=heights[Math.floor(heights.length/2)]||10,tolerance=Math.max(.75,em*.1)
  const horizontal:Rule[]=[],vertical:Rule[]=[]
  for(const r of graphics.flatMap(g=>g.image?[]:g.rules||[g.rect])) {
    if(![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<0||r.height<0)continue
    const x=Math.max(0,r.x),y=Math.max(0,r.y),right=Math.min(size.width,r.x+r.width),bottom=Math.min(size.height,r.y+r.height)
    if(right<x||bottom<y)continue
    const width=right-x,height=bottom-y
    if(height<=tolerance*2&&width>=em*1.5)horizontal.push({at:y+height/2,from:x,to:right})
    else if(width<=tolerance*2&&height>=em*.8)vertical.push({at:x+width/2,from:y,to:bottom})
  }
  const merge=(rules:Rule[])=>{
    const merged:Rule[]=[]
    for(const rule of rules.sort((a,b)=>a.at-b.at||a.from-b.from)) {
      let next={...rule}
      for(let i=0;i<merged.length;) {
        const other=merged[i]
        if(Math.abs(next.at-other.at)<=tolerance&&Math.max(next.from-other.to,other.from-next.to,0)<=tolerance*2) {
          next={at:(next.at+other.at)/2,from:Math.min(next.from,other.from),to:Math.max(next.to,other.to)};merged.splice(i,1);i=0
        }else i++
      }
      merged.push(next)
    }
    return merged.sort((a,b)=>a.at-b.at)
  }
  const hs=merge(horizontal),vs=merge(vertical),cells:PdfRect[]=[]
  for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++) {
    const left=vs[i],right=vs[j],top=Math.max(left.from,right.from),bottom=Math.min(left.to,right.to)
    if(right.at-left.at<em*1.5||bottom-top<em*.8)continue
    const edges=hs.filter(h=>h.at>=top-tolerance&&h.at<=bottom+tolerance&&h.from<=left.at+tolerance&&h.to>=right.at-tolerance)
    for(let k=1;k<edges.length;k++) {
      const y=edges[k-1].at,b=edges[k].at
      if(b-y<em*.8||vs.some(v=>v.at>left.at+tolerance&&v.at<right.at-tolerance&&Math.min(v.to,b)-Math.max(v.from,y)>tolerance))continue
      cells.push({x:left.at,y,width:right.at-left.at,height:b-y})
    }
  }
  const groups:PdfRect[][]=[]
  const adjacent=(a:PdfRect,b:PdfRect)=>((Math.abs(a.x+a.width-b.x)<=tolerance||Math.abs(b.x+b.width-a.x)<=tolerance)&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>tolerance)||((Math.abs(a.y+a.height-b.y)<=tolerance||Math.abs(b.y+b.height-a.y)<=tolerance)&&Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>tolerance)
  for(const cell of cells) {
    const group=[cell]
    for(let i=0;i<groups.length;) {
      if(groups[i].some(a=>group.some(b=>adjacent(a,b)))){group.push(...groups[i]);groups.splice(i,1);i=0}else i++
    }
    groups.push(group)
  }
  return groups.flatMap(cells=>{
    if(cells.length<3||!cells.some(c=>Math.abs(c.x-cells[0].x)>tolerance)||!cells.some(c=>Math.abs(c.y-cells[0].y)>tolerance))return []
    const occupied=cells.filter(c=>words.some(w=>w.text.trim()&&w.rect.x+w.rect.width/2>=c.x&&w.rect.x+w.rect.width/2<=c.x+c.width&&w.rect.y+w.rect.height/2>=c.y&&w.rect.y+w.rect.height/2<=c.y+c.height))
    if(occupied.length<Math.max(2,Math.ceil(cells.length/2)))return []
    const x=Math.min(...cells.map(c=>c.x)),y=Math.min(...cells.map(c=>c.y))
    return [{rect:{x,y,width:Math.max(...cells.map(c=>c.x+c.width))-x,height:Math.max(...cells.map(c=>c.y+c.height))-y},cells:cells.sort((a,b)=>a.y-b.y||a.x-b.x)}]
  })
}
