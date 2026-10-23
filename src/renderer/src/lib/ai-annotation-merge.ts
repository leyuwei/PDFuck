import type { AddAnnotationRequest, PdfRect } from '../types'

export interface ExistingAiAnnotation { id: string; request: AddAnnotationRequest }
export interface AiAnnotationWrite { request: AddAnnotationRequest; id?: string; removeIds: string[]; unchanged?: boolean }
const revision = (r: AddAnnotationRequest) => Boolean(r.aiRevision || ['replace','insert','delete','ai_polish'].includes(r.kind))
const pointOnly = (r: AddAnnotationRequest) => !r.rects.length && Boolean(r.point)
const anchors = (r: AddAnnotationRequest): PdfRect[] => r.rects.length ? r.rects : r.point ? [{...r.point,width:20,height:20}] : []
const key = (text: string) => text.normalize('NFKC').replace(/\s+/gu,' ').trim()
function uniqueText(texts: Array<string | undefined>): string {
  const seen = new Set<string>()
  return texts.flatMap(text => (text || '').trim().split(/\n\s*\n/u)).filter(text => { const value = key(text); if (!value || seen.has(value)) return false; seen.add(value); return true }).join('\n\n')
}
function overlap(a: PdfRect, b: PdfRect): boolean {
  const width = Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)
  const height = Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)
  return width > .5 && height >= Math.min(a.height,b.height) * .5
}
function mergedRects(rects: PdfRect[]): PdfRect[] {
  const result: PdfRect[] = []
  for (const rect of rects) {
    let value = {...rect}
    for (let i=0;i<result.length;) {
      const other=result[i]
      if (overlap(value,other)) {
        const x=Math.min(value.x,other.x),y=Math.min(value.y,other.y)
        value={x,y,width:Math.max(value.x+value.width,other.x+other.width)-x,height:Math.max(value.y+value.height,other.y+other.height)-y}
        result.splice(i,1);i=0
      } else i++
    }
    result.push(value)
  }
  return result.sort((a,b)=>a.y-b.y||a.x-b.x)
}

/** Merge only editable AI records; callers keep manual/replied records out of this set. */
export function planAiAnnotationWrites(existing: ExistingAiAnnotation[], incoming: AddAnnotationRequest[]): AiAnnotationWrite[] {
  const manual = incoming.filter(request=>!request.aiGenerated).map(request=>({request,removeIds:[]}))
  const nodes = [...existing.map(value=>({...value,incoming:false})),...incoming.filter(request=>request.aiGenerated).map(request=>({request,id:undefined as string|undefined,incoming:true}))]
  const pending=new Set(nodes.map((_,i)=>i)),writes: AiAnnotationWrite[]=[]
  const connected=(a: typeof nodes[number],b: typeof nodes[number]) => {
    if (!a.request.aiGenerated || !b.request.aiGenerated) return false
    if (a.request.groupId && a.request.groupId === b.request.groupId) return true
    if (a.request.pageIndex !== b.request.pageIndex || pointOnly(a.request) !== pointOnly(b.request)) return false
    if (pointOnly(a.request)) return a.request.kind === b.request.kind && Math.abs(a.request.point!.x-b.request.point!.x)<1 && Math.abs(a.request.point!.y-b.request.point!.y)<1
    return anchors(a.request).some(left=>anchors(b.request).some(right=>overlap(left,right)))
  }
  while(pending.size) {
    const first=pending.values().next().value!,indices=[first];pending.delete(first)
    for(let i=0;i<indices.length;i++)for(const other of pending)if(connected(nodes[indices[i]],nodes[other])){indices.push(other);pending.delete(other)}
    const group=indices.sort((a,b)=>a-b).map(i=>nodes[i]),fresh=group.filter(node=>node.incoming)
    if(!fresh.length)continue
    const revisions=group.filter(node=>revision(node.request)),winner=(revisions.length?revisions:fresh).at(-1)!
    // A replacement is complete for its own original range; never apply it to a union of different ranges.
    const source=revisions.length?group.filter(node=>node===winner||winner.request.groupId&&node.request.groupId===winner.request.groupId&&node.request.content===winner.request.content):group
    const pages=[...new Set(source.map(node=>node.request.pageIndex))]
    const groupId=pages.length>1?group.find(node=>node.id&&node.request.groupId)?.request.groupId||winner.request.groupId||`pdfuck-group-${crypto.randomUUID()}`:undefined
    const content=revisions.length?winner.request.content:uniqueText(group.map(node=>node.request.content))
    const reason=uniqueText([...group.map(node=>node.request.reason),...(revisions.length?group.filter(node=>!revision(node.request)&&key(node.request.content||'')!==key(content||'')).map(node=>node.request.content):[])])||undefined
    const removed=group.flatMap(node=>node.id?[node.id]:[])
    for(const pageIndex of pages) {
      const local=source.filter(node=>node.request.pageIndex===pageIndex),base=group.find(node=>node.id&&node.request.pageIndex===pageIndex)
      const kind=!revisions.length&&winner.request.kind==='note'&&local.some(node=>!['note','insert'].includes(node.request.kind))?'highlight':winner.request.kind
      const isPoint=local.every(node=>pointOnly(node.request))
      const rects=isPoint?[]:mergedRects(local.flatMap(node=>anchors(node.request)))
      const point=['note','insert'].includes(kind)?local.at(-1)!.request.point||{x:rects[0].x,y:rects[0].y}:undefined
      const request: AddAnnotationRequest={...winner.request,pageIndex,kind,rects,point,content,reason,groupId,aiRevision:Boolean(revisions.length)}
      const old=base?.request
      const unchanged=group.filter(node=>node.id&&node.request.pageIndex===pageIndex).length===1&&old?.kind===kind&&old.content===content&&old.reason===reason&&old.groupId===groupId&&revision(old)===revision(request)&&JSON.stringify(anchors(old))===JSON.stringify(anchors(request))
      writes.push({request,id:base?.id,removeIds:removed,unchanged})
    }
  }
  return [...manual,...writes]
}
