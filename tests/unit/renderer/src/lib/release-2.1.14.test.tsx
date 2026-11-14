// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { findTextMatches } from '../../../../../src/renderer/src/lib/document-search'
import { isolateVisualWords } from '../../../../../src/renderer/src/lib/page-visuals'
import { textSelectionBetween, textCaretAtPoint, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import { bodySelectionBetween } from '../../../../../src/renderer/src/lib/page-text-selection'
import { loadFullReviewPrompt, saveFullReviewPrompt } from '../../../../../src/renderer/src/lib/full-review-prompt'
import { SearchPanel } from '../../../../../src/renderer/src/components/SearchPanel'
import { activeBookmarkIdForPosition } from '../../../../../src/renderer/src/components/BookmarkPanel'
import { messages, INTERFACE_LANGUAGES } from '../../../../../src/shared/i18n-catalogue'
const box = (text: string, x: number, y: number, extra: Partial<WordBox> = {}): WordBox => ({ text, rect: { x,y,width:40,height:10 }, order: y*100+x, column:0, baselineY:y+8, ...extra })
const range = (words: WordBox[], reverse=false) => textSelectionBetween(words, reverse?{wordIndex:words.length-1,offset:Array.from(words.at(-1)!.text).length}:{wordIndex:0,offset:0}, reverse?{wordIndex:0,offset:0}:{wordIndex:words.length-1,offset:Array.from(words.at(-1)!.text).length})
const options = { caseSensitive:false, fuzzy:false, regex:false, wholeWord:true }
describe('2.1.14 text and search regression', () => {
  it.each([false,true])('selects two prose lines below expanded table bounds, reverse=%s', reverse => {
    const words = isolateVisualWords([box('章程第5.1条',40,130),box('3.4条规定',40,150)], [{kind:'table',caption:'Table',label:'Table',rect:{x:20,y:50,width:300,height:95},cells:[{x:20,y:50,width:300,height:60}]}])
    expect(words.every(w => w.visualRegion === undefined && w.tableCell === undefined)).toBe(true)
    expect(range(words,reverse)?.text.replace(/\s/g,'')).toBe('章程第5.1条3.4条规定')
  })
  it.each([false,true])('retains inline citation glyphs and wrapped prose, reverse=%s', reverse => {
    const words=[box('前文',40,30),box('[1]',85,30,{visualBlock:5,columnAmbiguous:true}),box('后文',130,30),box('下一行',40,50)]
    expect(range(words,reverse)?.text.replace(/\s/g,'')).toBe('前文[1]后文下一行')
  })
  it('preserves table cell protection in both directions and clamps overshoot', () => {
    const bounds={x:20,y:20,width:100,height:60}
    const words=[box('上行',30,30,{tableCell:0,tableCellRect:bounds,visualRegion:0}),box('下行',30,50,{tableCell:0,tableCellRect:bounds,visualRegion:0}),box('相邻单元格',150,50,{tableCell:1,tableCellRect:{...bounds,x:130},visualRegion:0})]
    expect(textCaretAtPoint(words,{x:400,y:55},{wordIndex:0,offset:0})?.wordIndex).toBe(1)
    expect(range(words)?.text.replace(/\s/g,'')).toBe('上行下行')
    expect(textSelectionBetween(words,{wordIndex:1,offset:2},{wordIndex:0,offset:0})?.text.replace(/\s/g,'')).toBe('上行下行')
  })
  it('keeps figures and cells out of body ranges across pages', () => {
    const words=[box('Before',30,10),box('Figure',30,30,{visualRegion:1}),box('Cell',30,50,{visualRegion:2,tableCell:0,tableCellRect:{x:20,y:40,width:80,height:30}}),box('After',30,90)]
    expect(bodySelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:3,offset:5})?.text).toBe('Before After')
  })
  it.each(['cat','café','данные','كتاب','한글'])('matches complete Unicode words: %s', query => {
    const text=`${query} ${query}x x${query} ${query}_ ${query}2 ${query}`
    expect(findTextMatches(text,query,options).map(m=>m.start)).toEqual([0,text.length-query.length])
  })
  it('respects combining marks, case sensitivity, regex and whitespace matching', () => {
    expect(findTextMatches('cafe\u0301 cafe','cafe',options)).toHaveLength(1)
    expect(findTextMatches('Cat cat','cat',{...options,caseSensitive:true})).toHaveLength(1)
    expect(findTextMatches('cats cat','cat.',{...options,regex:true})).toHaveLength(1)
    expect(findTextMatches('c a t','cat',{...options,fuzzy:true,wholeWord:false})).toHaveLength(1)
  })
  it('restores empty custom prompts and tolerates malformed/unavailable storage', () => {
    saveFullReviewPrompt({presetId:'',instruction:''}); expect(loadFullReviewPrompt()).toEqual({presetId:'',instruction:''})
    expect(loadFullReviewPrompt({getItem:()=>'{'})).toBeUndefined()
    expect(()=>saveFullReviewPrompt({presetId:'',instruction:'custom'},{setItem:()=>{throw Error('denied')}})).not.toThrow()
  })
  it('uses exact dense bookmark positions without rounding them to page numbers', () => {
    const bookmarks=[{id:'a',title:'A',pageIndex:0,position:.5,open:true,children:[]},{id:'b',title:'B',pageIndex:0,position:.5002,open:true,children:[]}]
    expect(activeBookmarkIdForPosition(bookmarks,0,.5001)).toBe('a')
    expect(activeBookmarkIdForPosition(bookmarks,0,.5002)).toBe('b')
  })
  it('provides every new label in all interface languages', () => {
    for (const key of ['ui.wholeWordMatch','ui.mergeDestinationQuestion','ui.insertIntoCurrentDocument','ui.createNewMergedDocument','ui.customTemplate'] as const) {
      for (const language of INTERFACE_LANGUAGES) expect(messages[key][language]?.length).toBeGreaterThan(0)
    }
  })
  afterEach(()=>{localStorage.clear()})
  it('reapplies newly selected search text to an already open panel and enables whole word directly', async () => {
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
    const props={source:'cat cats',onClose:()=>{},onFocusTarget:()=>{}}
    await act(async()=>root.render(<SearchPanel {...props} initialQuery="cat" focusToken={1}/>))
    const input=document.querySelector<HTMLInputElement>('.pdf-search-input-row input')!
    expect(input.value).toBe('cat')
    const word=document.querySelectorAll<HTMLInputElement>('.pdf-search-options input')[2]
    expect(word.disabled).toBe(false)
    await act(async()=>word.click());expect(document.querySelectorAll<HTMLInputElement>('.pdf-search-options input')[1].checked).toBe(false)
    await act(async()=>root.render(<SearchPanel {...props} initialQuery="cats" focusToken={2}/>))
    expect(input.value).toBe('cats')
    await act(async()=>root.unmount());host.remove()
  })
})
