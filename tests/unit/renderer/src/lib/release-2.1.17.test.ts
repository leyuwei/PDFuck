import { describe, it, expect } from 'vitest'
import { abbreviationLinks } from '../../../../../src/renderer/src/lib/document-insights'
import { textItemsToWordBoxes, textSelectionBetween } from '../../../../../src/renderer/src/lib/text-layout'
import pages from '../../../../fixtures/layout-2117.json'

describe('2.1.17 reading regressions', () => {
  it.each([
    ['Radio Access Network (RAN). RAN connects.', 'RAN', 'Radio Access Network'],
    ['réseau local virtuel (VLAN). VLAN.', 'VLAN', 'réseau local virtuel'],
    ['无线接入网络（RAN）。RAN。', 'RAN', '无线接入网络'],
    ['система управления базами данных (СУБД). СУБД.', 'СУБД', 'система управления базами данных']
  ])('finds Unicode definition and occurrences: %s', (text, short, definition) => {
    const hits = abbreviationLinks([{ pageIndex: 0, text }])
    expect(hits.filter(h => h.citation === short)).toHaveLength(2)
    expect(hits[0].reference).toBe(definition)
    expect(hits.map(h => h.anchorOccurrence)).toEqual([0,1])
  })
  it('rejects dates and ordinary parenthetical prose', () => {
    expect(abbreviationLinks([{pageIndex:0,text:'Study (2026), model (ordinary words) and result (x).'}])).toEqual([])
  })
  it.each(pages)('detects layout for sanitized fixture $fixture page $page', page => {
    for (const scale of [.5,1,2]) for (const reverse of [false,true]) {
      const items = reverse ? [...page.items].reverse() : page.items
      const matrix = page.transform.map(n=>n*scale) as [number,number,number,number,number,number]
      const graphics = page.graphics.map(g=>({...g,rect:{x:g.rect.x*scale,y:g.rect.y*scale,width:g.rect.width*scale,height:g.rect.height*scale},rules:g.rules?.map(r=>({x:r.x*scale,y:r.y*scale,width:r.width*scale,height:r.height*scale}))}))
      const words = textItemsToWordBoxes(items as any,page.styles as any,matrix,{},undefined,graphics)
      expect(words[0].columnBoundaries).toHaveLength(page.fixture===3 || page.fixture===4&&page.page===13 ? 0 : 1)
    }
  })
  it('keeps full body rows selected when endpoints are fragmented text runs', () => {
    for (const page of pages) {
      const words=textItemsToWordBoxes(page.items as any,page.styles as any,page.transform as any,{},undefined,page.graphics)
      const rows=new Map<string,number[]>()
      words.forEach((w,i)=>{if(w.visualBlock!==undefined||w.columnAmbiguous||w.rect.height<8)return;const key=`${w.column}:${Math.round(w.baselineY||w.rect.y)}`;rows.set(key,[...(rows.get(key)||[]),i])})
      for(const indices of rows.values()) {
        if(indices.length<3)continue
        indices.sort((a,b)=>words[a].rect.x-words[b].rect.x)
        const first=indices[0],last=indices.at(-1)!,a={wordIndex:first,offset:0},b={wordIndex:last,offset:[...words[last].text].length}
        const selection=textSelectionBetween(words,a,b)
        expect(selection).toBeDefined()
        for (const index of indices) {
          const w=words[index]
          expect(selection!.rects.some(r=>r.x<=w.rect.x+.6&&r.x+r.width>=w.rect.x+w.rect.width-.6&&r.y<=w.rect.y+.6&&r.y+r.height>=w.rect.y+w.rect.height-.6), `fixture ${page.fixture} page ${page.page} missing glyph ${index}`).toBe(true)
        }
        expect(textSelectionBetween(words,b,a)).toEqual(selection)
      }
    }
  })
})
