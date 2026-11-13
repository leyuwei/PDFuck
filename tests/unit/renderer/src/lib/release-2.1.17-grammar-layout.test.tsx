// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it} from 'vitest'
import {grammarPassages,grammarIssue} from '../../../../../src/renderer/src/lib/grammar-passages'
import {HistoryIcon} from '../../../../../src/renderer/src/components/HistoryIcon'
import {messages,INTERFACE_LANGUAGES,translateMessage,type TranslationKey} from '../../../../../src/shared/i18n-catalogue'
import type {WordBox} from '../../../../../src/renderer/src/lib/text-layout'
const w=(text:string,x:number,y:number,column=0):WordBox=>({text,rect:{x,y,width:text.length*6,height:10},order:y*1000+x,column,baselineY:y+8})
function line(text:string,y=20,column=0){let x=20+column*300;return text.split(' ').map(t=>{const word=w(t,x,y,column);x+=t.length*6+5;return word})}
it('keeps columns and offsets separate while excluding tables, figures and bibliography',()=>{
 const words=[...line('These is an important result from the experiment.'),...line('They are useful results from the second column.',20,1),...line('References',50,1),...line('[1] An invented title with bad grammar are.',70,1),...line('[2] Another invented reference with invalid grammar.',90,1),...line('These is a table row and should be ignored.',50).map(q=>({...q,visualRegion:0})),...line('These is a cell and should be ignored.',80).map(q=>({...q,tableCell:0} as WordBox))]
 const p=grammarPassages(3,words);expect(p).toHaveLength(2);expect(p[0].text).toBe('These is an important result from the experiment.');expect(p[1].text).toBe('They are useful results from the second column.')
 const issue=grammarIssue(p[0],{offset:6,length:2,message:'Agreement',ruleId:'AGREEMENT',replacements:['are']},'Grammar');expect(issue).toEqual(expect.objectContaining({pageIndex:3,term:'is',message:'Agreement',replacement:'are',rects:[words[1].rect]}))
})
it('joins PDF hyphenation and preserves match geometry across both source lines',()=>{
 const p=grammarPassages(0,[...line('The experi-',20),...line('mental findings are highly relevant and reliable.',32)])[0];expect(p.text).toContain('experimental');const from=p.text.indexOf('experimental');const issue=grammarIssue(p,{offset:from,length:12,message:'test',ruleId:'test',replacements:[]},'Grammar');expect(issue?.rects).toHaveLength(2)
})
it('masks equations and numeric citations without shifting UTF-16 result positions',()=>{
 const p=grammarPassages(0,line('The 🧪 results with Φ ≥ 0 and [12] show these is an error.'))[0];expect(p.text).not.toContain('Φ');expect(p.text).not.toContain('[12]');const index=p.text.indexOf('is');const issue=grammarIssue(p,{offset:index,length:2,message:'Agreement',ruleId:'A',replacements:['are']},'Grammar');expect(issue?.rects?.[0]).toEqual(p.spans.find(s=>s.word.text==='is')!.word.rect)
 const protectedRange=p.protected[0];expect(grammarIssue(p,{offset:protectedRange[0],length:1,message:'bad',ruleId:'bad',replacements:[]},'Grammar')).toBeUndefined()
})
it('reconstructs adjacent Chinese glyphs without inserting false spaces',()=>{
 const text='我们应该削减不必要的开消，并仔细核对本次实验获得的所有结果。',words=[...text].map((c,i)=>w(c,20+i*10,20));const p=grammarPassages(0,words)[0];expect(p.language).toBe('zh');expect(p.text).toBe(text)
})
it('identifies unsupported Korean instead of checking it as English',()=>{const p=grammarPassages(0,line('우리는 이 실험에서 얻은 모든 결과를 신중하게 검토하고 충분히 설명해야 합니다.'))[0];expect(p.language).toBe('ko')})
it('skips an incomplete first sentence and invoice-like numeric fields',()=>{
 expect(grammarPassages(0,line('2026 123456789012345678901234567890 abcdefghijklmnopqrstuvwxyz'))).toEqual([])
 const p=grammarPassages(0,line('with incomplete context. These are complete and reliable results.'))[0];expect(p.text).toBe('These are complete and reliable results.')
})
it('uses equal vector arrow geometry with a mirrored redo icon',async()=>{const el=document.createElement('div'),root=createRoot(el);await act(async()=>root.render(<><HistoryIcon direction="undo"/><HistoryIcon direction="redo"/></>));const icons=el.querySelectorAll('svg');expect(icons).toHaveLength(2);expect([...icons].every(e=>e.getAttribute('viewBox')==='0 0 24 24'&&e.getAttribute('aria-hidden')==='true')).toBe(true);expect(icons[1].querySelector('g')?.getAttribute('transform')).toBe('translate(24 0) scale(-1 1)');await act(async()=>root.unmount())})
it.each(INTERFACE_LANGUAGES)('has complete local grammar progress, suggestions and errors in %s',lang=>{const keys=Object.keys(messages).filter(k=>k.startsWith('grammar.')) as TranslationKey[];expect(keys).toHaveLength(13);for(const key of keys){expect(messages[key][lang]).toBeTruthy();expect(translateMessage(lang,key,{done:2,total:3})).not.toMatch(/^grammar\.|\{(?:done|total)\}/)}})

import {textSelectionBetween,textCaretAtPoint} from '../../../../../src/renderer/src/lib/text-layout'
it('retains true spanning headings when the endpoints belong to opposite columns',()=>{
 const words=[{...w('Heading',30,20,0),columnAmbiguous:true},{...w('across',310,20,1),columnAmbiguous:true},w('left body',30,80,0),w('right body',310,80,1)]
 const selection=textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:1,offset:6});expect(selection?.text).toBe('Heading across');expect(selection?.rects.every(r=>r.y<40)).toBe(true)
})
it('does not clamp a drag that actually reaches text in the next column',()=>{
 const words=[{...w('left',50,20),columnBoundaries:[300]},{...w('right',310,20,1),columnBoundaries:[300]}];const caret=textCaretAtPoint(words,{x:320,y:25},{wordIndex:0,offset:0});expect(words[caret!.wordIndex].column).toBe(1)
})
it('keeps table-cell selection inside its original cell even near a column gutter',()=>{
 const rect={x:260,y:20,width:50,height:15},words=[{...w('cell',265,20),tableCell:0,tableCellRect:rect,columnBoundaries:[300]},{...w('other',315,20,1),tableCell:1,tableCellRect:{x:312,y:20,width:70,height:15},columnBoundaries:[300]}];const caret=textCaretAtPoint(words,{x:325,y:25},{wordIndex:0,offset:0});expect(words[caret!.wordIndex].tableCell).toBe(0)
})
