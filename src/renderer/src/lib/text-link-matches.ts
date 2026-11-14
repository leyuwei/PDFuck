import { caretForTextPosition, type WordBox } from './text-layout'
import type { CitationLink } from './document-insights'

/** One character index per page; link geometry must not run pointer-selection heuristics. */
export function textLinkMatches(words: WordBox[], hits: CitationLink[]) {
  const positions: Array<{wordIndex:number;offset:number}> = []
  let source = ''
  words.forEach((word,wordIndex) => {
    if (source && !words[wordIndex-1].spaceAfter) { source += ' '; positions.push({wordIndex,offset:0}) }
    Array.from(word.text + (word.spaceAfter?.text || '')).forEach((char,offset) => {
      for (const unit of char.toLocaleLowerCase()) { source += unit; for(let i=0;i<unit.length;i++) positions.push({wordIndex,offset}) }
    })
  })
  const groups = new Map<string,CitationLink[]>()
  for(const hit of hits) {
    if(!hit.anchor)continue
    const key=`${hit.anchor.toLocaleLowerCase()}-${hit.anchorOccurrence||0}`
    groups.set(key,[...(groups.get(key)||[]),hit])
  }
  const occurrences = new Map<string,number[]>()
  return [...groups].flatMap(([key,hits]) => {
    const needle=hits[0].anchor!.toLocaleLowerCase().replace(/\s+/g,' ').trim()
    if(!occurrences.has(needle)) {
      const offsets:number[]=[];let cursor=0,index:number
      while(needle && (index=source.indexOf(needle,cursor))>=0){offsets.push(index);cursor=index+needle.length}
      occurrences.set(needle,offsets)
    }
    const index=occurrences.get(needle)![hits[0].anchorOccurrence||0]
    if(index===undefined)return []
    const slices=new Map<number,{from:number;to:number}>()
    for(const position of positions.slice(index,index+needle.length)) {
      const existing=slices.get(position.wordIndex)
      slices.set(position.wordIndex,{from:Math.min(existing?.from??position.offset,position.offset),to:Math.max(existing?.to??0,position.offset+1)})
    }
    const rects=[...slices].flatMap(([wordIndex,range])=>{
      const word=words[wordIndex],from=caretForTextPosition(words,{wordIndex,offset:range.from})!,to=caretForTextPosition(words,{wordIndex,offset:range.to})!
      return [{x:Math.min(from.x,to.x),y:word.rect.y,width:Math.abs(to.x-from.x),height:word.rect.height}]
    })
    return [{key,hits,rects}]
  })
}
