import type { GrammarMatch } from '../../../shared/grammar'
import type { GrammarIssue } from './document-insights'
import type { WordBox } from './text-layout'
export interface GrammarPassage { pageIndex:number; text:string; language?:string; spans:Array<{from:number;to:number;word:WordBox}>; protected:Array<[number,number]> }
const referenceHeading=/^(?:(?:\d+[.\s]+|[IVX]+[.\s]+)?(?:references|bibliography|références|literatur(?:verzeichnis)?|referencias|referências|参考文献|参考資料|참고\s*문헌|список\s+литературы|المراجع))\s*$/iu
const referenceNumber=/^\[\s*\d{1,4}\s*\]\s*\p{L}/u

/** PDF columns, display objects and source offsets are kept separate from linguistic rules. */
export function grammarPassages(pageIndex:number,words:WordBox[]):GrammarPassage[] {
  const result:GrammarPassage[]=[],body=words.filter(w=>w.visualRegion===undefined&&w.tableCell===undefined&&w.text.trim()&&!/^[⋆★∗*]+$/.test(w.text))
  const heights=body.map(w=>w.rect.height).sort((a,b)=>a-b),em=heights[Math.floor(heights.length/2)]||10
  let afterReferences=false
  for(const column of [...new Set(body.map(w=>w.column??0))].sort((a,b)=>a-b)) {
    const members=body.filter(w=>(w.column??0)===column && w.rect.height>=em*.78)
    const lines:Array<{y:number;words:WordBox[];text:string}>=[]
    for(const w of members.sort((a,b)=>(a.baselineY??a.rect.y)-(b.baselineY??b.rect.y)||a.rect.x-b.rect.x)) {
      const y=w.baselineY??w.rect.y,last=lines.at(-1)
      if(last&&Math.abs(last.y-y)<em*.4)last.words.push(w)
      else lines.push({y,words:[w],text:''})
    }
    for(const line of lines){const direction=line.words.filter(w=>w.rtl).length>line.words.length/2?-1:1;line.words.sort((a,b)=>direction*(a.rect.x-b.rect.x));line.text=line.words.map(w=>w.text).join(' ')}
    const refs=lines.filter(l=>referenceNumber.test(l.text))
    const referenceTop=refs.length>=2?refs[0].y:Infinity
    const left=Math.min(...members.map(w=>w.rect.x)),right=Math.max(...members.map(w=>w.rect.x+w.rect.width))
    let paragraph:WordBox[]=[],previous:typeof lines[number]|undefined
    const flush=()=>{
      if(!paragraph.length)return
      let text='',spans:GrammarPassage['spans']=[]
      for(const word of paragraph){
        const prior=spans.at(-1),lineBreak=prior&&Math.abs((prior.word.baselineY??prior.word.rect.y)-(word.baselineY??word.rect.y))>em*.5
        if(lineBreak&&/[-\u00ad]$/.test(text)&&/^\p{Ll}/u.test(word.text)){text=text.slice(0,-1);if(prior)prior.to--}
        else if(text&&!/\s$/.test(text)&&!/[（(]$/.test(text)&&! /^[,.;:!?，。；：！？、)）]/.test(word.text)&&!(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}，。；：！？、]$/u.test(text)&&/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word.text)))text+=' '
        const from=text.length;text+=word.text;spans.push({from,to:text.length,word})
      }
      paragraph=[]
      if((text.match(/\p{L}/gu)||[]).length<25 || text.length>12000 || (text.match(/\d/gu)||[]).length>(text.match(/\p{L}/gu)||[]).length*.5)return
      // A cropped page may begin halfway through a sentence; do not invent a missing subject.
      if(/^\p{Ll}/u.test(text)){const stop=text.search(/[.!?。！？]\s/);if(stop<0)return;const cut=stop+2;text=text.slice(cut);spans=spans.filter(s=>s.to>cut).map(s=>({...s,from:Math.max(0,s.from-cut),to:s.to-cut}))}
      if(!text.trim())return
      const language=/[\uac00-\ud7af]/u.test(text)?'ko':/[\u3040-\u30ff]/u.test(text)?'ja':/[\u3400-\u9fff]/u.test(text)?'zh':/[\u0600-\u06ff]/u.test(text)?'ar':undefined
      const protectedRanges:Array<[number,number]>=[]
      for(let i=0;i<spans.length;i++){
        const span=spans[i],token=span.word.text,previous=spans[i-1]?.word.text||'',next=spans[i+1]?.word.text||''
        const math=/[=<>≥≤∑∫±×÷∈∞^_]/u.test(token)||/^\d+(?:[.,]\d+)*(?:%|[a-z])?$/iu.test(token)||/^[\p{Script=Greek}]$/u.test(token)&&/\p{Script=Latin}/u.test(text)||/^[A-Za-z]$/.test(token)&&(/[=<>≥≤\d]/u.test(previous+next)||/^[A-Za-z]$/.test(previous)||/^[A-Za-z]$/.test(next))
        if(math)protectedRanges.push([span.from,span.to])
      }
      for(const match of text.matchAll(/(?:https?:\/\/|doi:|www\.)\S+|\[[\d,\s–-]+\]/giu))protectedRanges.push([match.index!,match.index!+match[0].length])
      const chars=text.split('');for(const[from,to]of protectedRanges)for(let i=from;i<to;i++)chars[i]=' '
      result.push({pageIndex,text:chars.join(''),language,spans,protected:protectedRanges})
    }
    for(const line of lines){
      if(referenceHeading.test(line.text)){flush();afterReferences=true;continue}
      if(afterReferences||line.y>=referenceTop){flush();continue}
      const previousRight=previous?Math.max(...previous.words.map(w=>w.rect.x+w.rect.width)):right
      if(previous&&(line.y-previous.y>em*1.9 || line.words[0].rect.x>left+em*.7&&(/[.!?。！？]$/.test(previous.text)||previousRight<right-em*3))){flush()}
      paragraph.push(...line.words);previous=line
    }
    flush()
  }
  return result
}

export function grammarIssue(passage:GrammarPassage,match:GrammarMatch,label:string):GrammarIssue|undefined {
  if(passage.protected.some(([from,to])=>match.offset<to&&match.offset+match.length>from))return
  const spans=passage.spans.filter(s=>s.from<match.offset+match.length&&s.to>match.offset)
  if(!spans.length)return
  const term=passage.text.slice(match.offset,match.offset+match.length)
  return {pageIndex:passage.pageIndex,label,term,anchor:term,message:match.message,ruleId:match.ruleId,replacement:match.replacements[0],rects:spans.map(s=>s.word.rect),context:passage.text.slice(Math.max(0,match.offset-45),Math.min(passage.text.length,match.offset+match.length+65))}
}
