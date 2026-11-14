import { describe,it,expect } from 'vitest'
import { abbreviationLinks } from '../../../../../src/renderer/src/lib/document-insights'
import { textLinkMatches } from '../../../../../src/renderer/src/lib/text-link-matches'

describe('2.1.17 requirement review',()=>{
 it.each([
 ['RAN (Radio Access Network) uses RAN.','RAN','Radio Access Network'],
 ['无线接入网络（RAN），RAN 提供接入。','RAN','无线接入网络'],
 ['RAN（无线接入网络）提供 RAN 接入。','RAN','无线接入网络'],
 ['Réseau local virtuel (VLAN). VLAN works.','VLAN','Réseau local virtuel'],
 ['ニューラルネットワーク（NN）。NN。','NN','ニューラルネットワーク'],
 ['Long Term Evolution (LTE). LTE.','LTE','Long Term Evolution']
 ])('extracts forward/reverse Unicode definitions %s',(text,short,definition)=>{
 const hits=abbreviationLinks([{pageIndex:0,text}]);expect(hits.filter(h=>h.citation===short)).toHaveLength(2);expect(hits[0].reference).toBe(definition)
 })
 it('retains redefinitions and links later uses to the nearer definition',()=>{
 const hits=abbreviationLinks([{pageIndex:0,text:'Access Point (AP). AP.'},{pageIndex:1,text:'Action Potential (AP). AP.'}]);expect(hits.filter(h=>h.pageIndex===0).every(h=>h.reference==='Access Point')).toBe(true);expect(hits.filter(h=>h.pageIndex===1).every(h=>h.reference==='Action Potential')).toBe(true)
 })
 it('does not link the interior of another word instead of the abbreviation',()=>{
 const text='CRAN uses Radio Access Network (RAN). RAN.';expect(abbreviationLinks([{pageIndex:0,text}]).map(h=>h.anchorOccurrence)).toEqual([1,2])
 })
 it('places link geometry on all matched fragments without pointer flow cropping',()=>{
 const words=Array.from({length:1000},(_,i)=>({text:'RAN',order:i,column:0,rect:{x:i%20*20,y:Math.floor(i/20)*12,width:18,height:10}}))
 const hits=words.map((_,i)=>({pageIndex:0,label:'RAN',context:'Radio Access Network',citation:'RAN',reference:'Radio Access Network',anchor:'RAN',anchorOccurrence:i}))
 const matches=textLinkMatches(words,hits);expect(matches).toHaveLength(1000);expect(matches[999].rects).toEqual([words[999].rect])
 })
})
