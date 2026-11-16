// @vitest-environment jsdom
import {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ButtonHints} from '../../../../../src/renderer/src/components/ButtonHints'
import {useFloatingWindow} from '../../../../../src/renderer/src/lib/floating-window'
import {textSelectionBetween,type WordBox} from '../../../../../src/renderer/src/lib/text-layout'
import {setInterfaceLanguage} from '../../../../../src/renderer/src/lib/i18n'
import {INTERFACE_LANGUAGES,messages} from '../../../../../src/shared/i18n-catalogue'
let host:HTMLDivElement,root:Root
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}})})
afterEach(async()=>{await act(async()=>root.unmount());document.body.innerHTML='';vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();setInterfaceLanguage('zh')})
function Window(){const floating=useFloatingWindow(true,false,{resizable:true,minWidth:200,minHeight:160});return <div ref={floating.ref} style={floating.style}/>}
it.each(['w','e','n','s'])('resizes from the %s edge and preserves the opposite edge',async edge=>{
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return new DOMRect(parseFloat(this.style.left)||200,parseFloat(this.style.top)||150,parseFloat(this.style.width)||400,parseFloat(this.style.height)||300)})
 HTMLElement.prototype.setPointerCapture=vi.fn();HTMLElement.prototype.hasPointerCapture=()=>false
 await act(async()=>root.render(<Window/>));const el=host.firstElementChild as HTMLElement
 const x=edge==='w'?200:edge==='e'?600:400,y=edge==='n'?150:edge==='s'?450:300
 await act(async()=>el.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:y})))
 await act(async()=>el.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:x+(edge==='w'?-40:edge==='e'?40:0),clientY:y+(edge==='n'?-30:edge==='s'?30:0)})))
 const r=el.getBoundingClientRect();expect(edge==='w'||edge==='e'?r.width:r.height).toBe(edge==='w'||edge==='e'?440:330)
 if(edge==='w')expect(r.right).toBe(600);if(edge==='n')expect(r.bottom).toBe(450)
 await act(async()=>el.dispatchEvent(new MouseEvent('pointerup',{bubbles:true})))
})
it('shows a custom hint for disabled controls, keeps it across child hover and restores native title',async()=>{
 vi.useFakeTimers();await act(async()=>root.render(<><button disabled title="Fit width"><span>icon</span></button><ButtonHints/></>));const button=host.querySelector('button')!,child=button.firstElementChild!
 await act(async()=>child.dispatchEvent(new MouseEvent('pointerover',{bubbles:true})));await act(async()=>vi.advanceTimersByTime(1500));expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Fit width');expect(button.hasAttribute('title')).toBe(false);expect(button.getAttribute('aria-describedby')).toContain('pdfuck-button-hint')
 await act(async()=>child.dispatchEvent(new MouseEvent('pointerout',{bubbles:true,relatedTarget:button})));expect(document.querySelector('[role="tooltip"]')).toBeTruthy()
 await act(async()=>button.dispatchEvent(new MouseEvent('pointerout',{bubbles:true})));expect(button.title).toBe('Fit width');expect(button.hasAttribute('aria-describedby')).toBe(false);expect(document.querySelector('[role="tooltip"]')).toBeNull()
})
it('uses localized accessible labels for keyboard focus and clears on scroll',async()=>{vi.useFakeTimers();await act(async()=>root.render(<><button aria-label="模型设置"><svg/></button><ButtonHints/></>));await act(async()=>host.querySelector('button')!.focus());await act(async()=>vi.runOnlyPendingTimers());expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('模型设置');await act(async()=>document.dispatchEvent(new Event('scroll')));expect(document.querySelector('[role="tooltip"]')).toBeNull()})
it.each(INTERFACE_LANGUAGES)('has meaningful navigation and zoom labels in %s',language=>{for(const key of ['interaction.zoomIn','interaction.zoomOut','interaction.previous','interaction.next'] as const)expect(messages[key][language]).toBeTruthy()})
it('retains mixed-run intervening words while excluding the adjacent column',()=>{
 const make=(text:string,x:number,y:number,width:number,column=0):WordBox=>({text,rect:{x,y,width,height:10},textRunRect:{x,y,width,height:10},order:0,column,columnBoundaries:[300],baselineY:y+8})
 const words=[make('first',50,100,60),make('short',50,115,30),make('formula',170,115,80),make('last',50,130,60),make('neighbor',320,115,190,1)].map((w,order)=>({...w,order,textRun:order}))
 const s=textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:3,offset:4})!
 expect(s.text).toContain('formula');expect(s.text).not.toContain('neighbor');expect(s.rects.every(r=>r.x+r.width<=300)).toBe(true)
 expect(textSelectionBetween(words,{wordIndex:3,offset:4},{wordIndex:0,offset:0})).toEqual(s)
})
