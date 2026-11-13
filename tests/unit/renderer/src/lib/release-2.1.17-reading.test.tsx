// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {loadReadingTools,saveReadingTools} from '../../../../../src/renderer/src/lib/reading-tools'
import {bookmarkFocusRects} from '../../../../../src/renderer/src/lib/bookmark-focus'
import {abbreviationLinks} from '../../../../../src/renderer/src/lib/document-insights'
import {messages,INTERFACE_LANGUAGES,translateMessage} from '../../../../../src/shared/i18n-catalogue'
import {ScrollWindow} from '../../../../../src/renderer/src/components/ScrollWindow'
import {ToolPanel} from '../../../../../src/renderer/src/components/ToolPanel'
import {SearchPanel} from '../../../../../src/renderer/src/components/SearchPanel'
import type {WordBox} from '../../../../../src/renderer/src/lib/text-layout'
vi.mock('../../../../../src/renderer/src/lib/pdfjs',()=>({getDocument:vi.fn(),AnnotationMode:{ENABLE:1},PDFJS_WASM_URL:''}))
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();document.body.innerHTML=''})
it('persists all three switches independently by document and retains explicit off with no results',()=>{
 saveReadingTools({'/a.pdf':{citation:true,visual:false,abbreviation:true},'/b.pdf':{citation:false,visual:true,abbreviation:false}})
 expect(loadReadingTools()).toEqual({'/a.pdf':{citation:true,visual:false,abbreviation:true},'/b.pdf':{citation:false,visual:true,abbreviation:false}})
 const next=loadReadingTools();next['/a.pdf'].abbreviation=false;saveReadingTools(next);expect(loadReadingTools()['/a.pdf'].abbreviation).toBe(false);expect(loadReadingTools()['/b.pdf'].visual).toBe(true)
})
it.each(['null','[]','bad','{"/a.pdf":{"citation":"true","visual":1,"abbreviation":true},"/b.pdf":null}'])('rejects malformed stored preferences: %s',value=>{
 localStorage.setItem('pdfuck.reading-tools.v1',value);const loaded=loadReadingTools();expect(loaded['/b.pdf']).toBeUndefined();if(loaded['/a.pdf'])expect(loaded['/a.pdf']).toEqual({citation:false,visual:false,abbreviation:true});else expect(loaded).toEqual({})
})
it('keeps tool switches usable when local storage is unavailable',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('unavailable')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('full')});expect(loadReadingTools()).toEqual({});expect(()=>saveReadingTools({})).not.toThrow()
})
it('tags abbreviation definitions so popups never inherit citation wording',()=>{
 const hits=abbreviationLinks([{pageIndex:0,text:'Radio Access Network (RAN). RAN.'}]);expect(hits.length).toBe(2);expect(hits.every(h=>h.kind==='abbreviation'&&h.reference==='Radio Access Network')).toBe(true)
})
it.each(INTERFACE_LANGUAGES)('provides complete waiting and definition labels in %s',language=>{
 for(const key of ['reading.preparing','reading.failed','reading.definition','reading.viewDefinition','reading.copyDefinition','reading.definitionCopied'] as const){expect(messages[key][language]).toBeTruthy();expect(translateMessage(language,key,{tools:'RAN'})).not.toMatch(/reading\.|\{tools\}/)}
})
const word=(text:string,x:number,y:number):WordBox=>({text,rect:{x,y,width:45,height:12},order:y*100+x,column:0,baselineY:y+10})
it('flashes the bookmark start line at its destination and does not include the next paragraph',()=>{
 const words=[word('header',40,20),word('Section',40,300),word('Two',90,300),word('paragraph',40,330)]
 expect(bookmarkFocusRects(words,800,.375,'Section Two')).toEqual([{x:40,y:300,width:95,height:12}])
 expect(bookmarkFocusRects(words,800,undefined,'Section Two')).toEqual([{x:40,y:300,width:95,height:12}])
 expect(bookmarkFocusRects([],800,.375,'unknown')).toEqual([])
})
const common={module:'view' as const,activeTool:'none' as const,mode:'continuous' as const,hasDocument:true,dirty:false,readOnly:false,exportFormat:'pdf' as const,exportDpi:144,pdfExportMode:'combined' as const,theme:'light' as const,accent:'#5575de',hasCustomAccent:false,documentBackground:'#fff',hasCustomDocumentBackground:false,onTool:vi.fn(),onMode:vi.fn(),onDeletePages:vi.fn(),onMergeFiles:vi.fn(),onSave:vi.fn(),onExport:vi.fn(),onExportFormat:vi.fn(),onExportDpi:vi.fn(),onPdfExportMode:vi.fn(),onSearch:vi.fn(),onVisuals:vi.fn(),onAbbreviations:vi.fn(),onCitations:vi.fn(),onGrammar:vi.fn(),onTheme:vi.fn(),onAccent:vi.fn(),onClearAccent:vi.fn(),onDocumentBackground:vi.fn(),onClearDocumentBackground:vi.fn(),onAddAiAnnotation:vi.fn(),onCopy:vi.fn()}
it('gives all six reading actions an icon and exposes each toggle state independently',async()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el)
 await act(async()=>root.render(<ToolPanel {...common} citationsEnabled visualsEnabled={false} abbreviationsEnabled/>))
 const buttons=[...el.querySelectorAll('.reading-tools button')];expect(buttons).toHaveLength(6);expect(buttons.every(b=>b.querySelector('svg[aria-hidden="true"]'))).toBe(true)
 expect(buttons.filter(b=>b.hasAttribute('aria-pressed')).map(b=>b.getAttribute('aria-pressed'))).toEqual(['false','true','true']);expect(buttons.filter(b=>b.classList.contains('active'))).toHaveLength(2)
 await act(async()=>root.unmount())
})
it('automatically makes ordinary modal titles draggable while panel headings stay unchanged',async()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el)
 await act(async()=>root.render(<><ScrollWindow className="modal"><h2>Dialog</h2><input defaultValue="editable"/></ScrollWindow><ScrollWindow className="tool-panel"><h2>Panel</h2><p>body</p></ScrollWindow></>))
 expect(el.querySelector('.modal')?.getAttribute('data-floating-window')).toBe('true');expect(el.querySelector('.modal h2')?.hasAttribute('data-floating-heading')).toBe(true);expect(el.querySelector('.tool-panel h2')?.hasAttribute('data-floating-heading')).toBe(false);expect(el.querySelector('input')?.value).toBe('editable')
 await act(async()=>root.unmount())
})
it('retains only the search title and preserves source searching',async()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el)
 await act(async()=>root.render(<SearchPanel source="source words" sourceLabel="Markdown" onClose={()=>{}} onFocusTarget={()=>{}}/>))
 const heading=document.querySelector('.pdf-search-heading')!;expect(heading.querySelector('b')?.textContent).toBe('搜索文档');expect(heading.querySelector('small')).toBeNull();expect(document.querySelector('input')?.getAttribute('aria-label')).toBe('搜索文档')
 await act(async()=>root.unmount())
})

it('highlights the bookmark heading without flashing same-baseline prose in the adjacent column',()=>{
 const words=[word('Section',40,300),word('Two',90,300),word('unrelated',350,300),word('paragraph',40,330)]
 expect(bookmarkFocusRects(words,800,.375,'Section Two')).toEqual([{x:40,y:300,width:95,height:12}])
})
