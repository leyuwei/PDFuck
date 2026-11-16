import type { WordBox } from './text-layout'
import type { PageGraphic } from './page-visuals'
/** Repeated small numeric rails outside prose are editorial line numbers. */
export function pageLineNumbers(words:WordBox[],graphics:PageGraphic[]):Set<WordBox> {
 const prose=words.filter(w=>/\p{L}/u.test(w.text)),result=new Set<WordBox>()
 if(!prose.length)return result
 const left=Math.min(...prose.map(w=>w.rect.x)),right=Math.max(...prose.map(w=>w.rect.x+w.rect.width))
 const candidates=words.filter(w=>/^\d{1,4}$/.test(w.text)&&w.rect.width<w.rect.height*3&&(w.rect.x+w.rect.width<left-w.rect.height*.5||w.rect.x>right+w.rect.height*.5)&&!graphics.some(g=>w.rect.x+w.rect.width/2>=g.rect.x&&w.rect.x+w.rect.width/2<=g.rect.x+g.rect.width&&w.rect.y+w.rect.height/2>=g.rect.y&&w.rect.y+w.rect.height/2<=g.rect.y+g.rect.height))
 const rails:WordBox[][]=[]
 for(const word of candidates){const rail=rails.find(r=>Math.abs((r[0].rect.x+r[0].rect.width)-(word.rect.x+word.rect.width))<word.rect.height*.4||Math.abs(r[0].rect.x-word.rect.x)<word.rect.height*.4);if(rail)rail.push(word);else rails.push([word])}
 for(const rail of rails){const em=rail[0].rect.height;if(rail.length<8||Math.max(...rail.map(w=>w.rect.y))-Math.min(...rail.map(w=>w.rect.y))<em*10)continue
  const aligned=rail.filter(n=>{const row=prose.filter(w=>Math.abs((w.baselineY??w.rect.y)-(n.baselineY??n.rect.y))<Math.max(em,w.rect.height)*.6);return row.reduce((count,w)=>count+w.text.length,0)>=30&&row.some(w=>w.rect.height>em*1.03)})
  if(aligned.length>=rail.length*.5)rail.forEach(w=>result.add(w))
 }
 return result
}
