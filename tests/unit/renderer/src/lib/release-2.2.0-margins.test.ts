import { describe, expect, it } from 'vitest'
import { classifyPageMargins, marginSamples } from '../../../../../src/renderer/src/lib/page-margins'
import { bodySelectionBetween } from '../../../../../src/renderer/src/lib/page-text-selection'
import { textCaretAtPoint, textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'

const viewport = { width: 600, height: 720 }
const word = (text: string, x: number, y: number, width=85, height=8): WordBox =>
  ({text,rect:{x,y,width,height},baselineY:y+height,order:0,column:x<300?0:1})
const rule = (x: number,y: number,width: number,height=0) => ({rect:{x,y,width,height},parts:1,image:false})
const marked = (words: WordBox[], graphics: ReturnType<typeof rule>[] = [], peers: WordBox[][] = []) => {
  const evidence = classifyPageMargins(words,viewport,graphics,peers.map(page=>marginSamples(page,viewport.height)))
  return words.map((word,order)=>({...word,order,visualRegion:evidence.get(word)}))
}

describe('automatic header and footer selection domains', () => {
  it.each([
    '研究简报 第１２期','最新の研究報告 第１２号','연구 회보 제12호','دورية الأبحاث العدد ١٢','Выпуск Исследований 12',
    'Issue research 12','Edición investigadora 12','Édition recherche 12','Forschungsausgabe 12','Edição do boletim 12'
  ])('matches repeated text and folios independently of document script (%s)', text => {
    const words=[word(text,42,17),word('A unique larger heading',42,49,250,15),word('A body paragraph',42,122,218,10),word('١٥',549,692,12)]
    const peer=[word(text.replace(/\p{Nd}+/gu,'28'),380,17),word('١٦',45,691,12)]
    expect(marked(words,[],[peer]).map(w=>w.visualRegion)).toEqual([-1,undefined,undefined,-2])
  })

  it('keeps detached multi-line furniture separate with local rules on a one-page PDF', () => {
    const words=[word('Header edition',34,14),word('Header office',34,27),word('Body continues here',34,68,155,10),
      word('Body remains to the end',34,642,160,10),word('Footer contact',340,669),word('Footer terms',34,685)]
    expect(marked(words,[rule(34,42,535),rule(34,656,535)]).map(w=>w.visualRegion)).toEqual([-1,-1,undefined,undefined,-2,-2])
  })

  it('keeps a compact heading above the top rule of a separately stroked figure', () => {
    const words=[word('Opening heading',34,20),word('First paragraph starts here',34,150,197,10)]
    expect(marked(words,[rule(32,41,536),rule(32,113,536),rule(32,41,0,72),rule(568,41,0,72)]).every(w=>w.visualRegion===undefined)).toBe(true)
  })

  it('protects a nearby footnote imprint sharing a folio row and retains the last body paragraph', () => {
    const words=[word('Last body line',45,650,195,10),word('Special issue imprint',44,691,159),word('29',510,690,12)]
    const peer=[word('31',43,690,12)]
    expect(marked(words,[],[peer]).map(w=>w.visualRegion)).toEqual([undefined,-2,-2])
  })

  it('keeps same-size body lines repeating on consecutive pages inside the reading region', () => {
    const words=[word('Running issue',48,20),word('Continuing example text',46,62,218,10),
      word('First body column',44,132,200,10),word('Last body paragraph',45,650,225,10)]
    expect(marked(words,[],[words]).map(w=>w.visualRegion)).toEqual([-1,undefined,undefined,undefined])
  })

  it('selects explicit footer text alone in both directions and skips both edge regions in a body range', () => {
    const words=marked([word('Masthead',40,16),word('First body',44,600,112,10),
      word('Footer notice',45,680),word('Second body',324,120,120,10),word('Terms apply',52,694)],
    [rule(38,49,524),rule(38,652,524)])
    const a={wordIndex:1,offset:0},b={wordIndex:3,offset:11}
    for(const pick of [textSelectionBetween,bodySelectionBetween]){
      expect(pick(words,a,b)?.text).toBe('First body Second body')
      expect(pick(words,b,a)).toEqual(pick(words,a,b))
    }
    const point={x:75,y:683}
    expect(textCaretAtPoint(words,point)?.wordIndex).toBe(2)
    expect(words[textCaretAtPoint(words,point,a)!.wordIndex].visualRegion).toBeUndefined()
    const f={wordIndex:2,offset:0},g={wordIndex:4,offset:11}
    expect(textSelectionBetween(words,f,g)?.text).toBe('Footer notice Terms apply')
    expect(textSelectionBetween(words,g,f)).toEqual(textSelectionBetween(words,f,g))
  })
})
