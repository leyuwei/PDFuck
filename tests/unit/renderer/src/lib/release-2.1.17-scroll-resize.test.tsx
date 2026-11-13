// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ScrollPageHint } from '../../../../../src/renderer/src/components/ScrollPageHint'
import { SIDEBAR_RESIZE_END, useSidebarResize } from '../../../../../src/renderer/src/lib/sidebar-resize'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = '' })
async function hint(height = 800) {
  vi.useFakeTimers(); let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const workspace = document.createElement('div'); workspace.className = 'workspace'
  const viewport = document.createElement('div'), host = document.createElement('div'); workspace.append(viewport, host); document.body.append(workspace)
  Object.defineProperty(viewport, 'clientHeight', { value: height })
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 600, top: 0, bottom: height, width: 600, height, x: 0, y: 0, toJSON() {} })
  const root = createRoot(host), refs = { viewport: { current: viewport }, navigating: { current: false }, restoring: { current: false } }
  const render = async (zoom = 1, documentKey = 'one') => act(async () => root.render(<ScrollPageHint {...refs} zoom={zoom} documentKey={documentKey} pageIndex={12} pageCount={30} />))
  await render()
  const wheel = (options: WheelEventInit = {}) => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, ...options }))
  const scroll = async (delta: number, elapsed = 16, intentional = true) => { now += elapsed; await act(async () => { if (intentional) wheel(); viewport.scrollTop += delta; viewport.dispatchEvent(new Event('scroll')) }) }
  const visible = () => Boolean(host.querySelector('.visible'))
  const close = async () => act(async () => root.unmount())
  return { viewport, workspace, refs, render, wheel, scroll, visible, close, host }
}
it.each([[120,1],[60,4],[150,2],[450,1]])('rejects a minor or isolated wheel movement: %d × %d', async (delta, count) => {
  const h = await hint(); for (let i=0;i<count;i++) await h.scroll(delta); expect(h.visible()).toBe(false); await h.close()
})
it('uses the larger viewport-relative threshold and a bounded speed window', async () => {
  const h = await hint(1000); await h.scroll(250); await h.scroll(250); expect(h.visible()).toBe(false)
  await h.scroll(250); expect(h.visible()).toBe(true); expect(h.host.querySelector('strong')?.textContent).toBe('13')
  await act(async () => vi.advanceTimersByTime(1100)); expect(h.visible()).toBe(false); await h.close()
})
it('requires at least 420 px in a small viewport', async () => {
  const h = await hint(300); await h.scroll(180); await h.scroll(180); expect(h.visible()).toBe(false); await h.scroll(180); expect(h.visible()).toBe(true); await h.close()
})
it('never accumulates slow reading scrolls across a long gesture', async () => {
  const h = await hint(); for (let i=0;i<20;i++) await h.scroll(120,100); expect(h.visible()).toBe(false); await h.close()
})
it('resets direction instead of summing small back-and-forth movements', async () => {
  const h = await hint(); for (const delta of [200,200,-200,-200,200,200]) await h.scroll(delta); expect(h.visible()).toBe(false); await h.close()
})
it('supports fast upward movement but ignores programmatic scrolls without user input', async () => {
  const h = await hint(); await h.scroll(800,16,false); await h.scroll(800,16,false); expect(h.visible()).toBe(false)
  await h.scroll(-300); await h.scroll(-300); expect(h.visible()).toBe(true); await h.close()
})
it.each(['ctrlKey','metaKey'] as const)('rejects zoom-wheel scrolls and clears an existing hint with %s', async key => {
  const h = await hint(); await h.scroll(300); await h.scroll(300); expect(h.visible()).toBe(true)
  await act(async () => { h.wheel({ [key]: true }); h.viewport.scrollTop += 900; h.viewport.dispatchEvent(new Event('scroll')) })
  await h.scroll(900,16,false); expect(h.visible()).toBe(false); await h.close()
})
it('clears stale wheel intent on toolbar/fit zoom and document changes', async () => {
  const h = await hint(); await h.scroll(300); await h.scroll(300); expect(h.visible()).toBe(true)
  await h.render(1.5); await h.scroll(1000,16,false); await h.scroll(1000,16,false); expect(h.visible()).toBe(false)
  await h.scroll(300); await h.scroll(300); expect(h.visible()).toBe(true); await h.render(1.5,'two'); expect(h.visible()).toBe(false); await h.close(); expect(vi.getTimerCount()).toBe(0)
})
it('keeps intentional scrollbar dragging usable at low speed and releases the drag on blur', async () => {
  const h = await hint(); const down = new MouseEvent('pointerdown',{clientX:596,button:0,bubbles:true}); Object.defineProperty(down,'pointerType',{value:'mouse'}); h.viewport.dispatchEvent(down)
  await h.scroll(8,100,false); expect(h.visible()).toBe(true)
  window.dispatchEvent(new Event('blur')); await act(async () => vi.advanceTimersByTime(1100)); await h.scroll(8,100,false); expect(h.visible()).toBe(false); await h.close()
})
it('excludes sidebar resizing, navigation and restoration', async () => {
  const h = await hint(); const panel = document.createElement('aside'); panel.className='sidebar-resizing'; h.workspace.append(panel)
  await h.scroll(400); await h.scroll(400); expect(h.visible()).toBe(false); panel.remove()
  h.refs.navigating.current=true; await h.scroll(400); await h.scroll(400); expect(h.visible()).toBe(false)
  h.refs.navigating.current=false; h.refs.restoring.current=true; await h.scroll(400); await h.scroll(400); expect(h.visible()).toBe(false); await h.close()
})

async function sidebar(side: 'start'|'end', rtl = false) {
  const frames = new Map<number,FrameRequestCallback>(); let id=0, renders=0
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback => { frames.set(++id,callback);return id })
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(key => { frames.delete(key) })
  const captures = new Set<number>()
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({ x:0,y:0,left:0,right:300,top:0,bottom:600,width:300,height:600,toJSON(){} })
  Object.defineProperties(HTMLElement.prototype,{setPointerCapture:{configurable:true,value:(n:number)=>captures.add(n)},hasPointerCapture:{configurable:true,value:(n:number)=>captures.has(n)},releasePointerCapture:{configurable:true,value:(n:number)=>captures.delete(n)}})
  function Probe(){renders++;const r=useSidebarResize(300,220,440,side);return <aside ref={r.panelRef} style={{width:r.width,flexBasis:r.width,direction:rtl?'rtl':'ltr'}}><output>{r.width}</output><div onPointerDown={r.begin} onPointerMove={r.move} onPointerUp={r.finish} onPointerCancel={r.finish} onLostPointerCapture={r.finish}/></aside>}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(<Probe/>));const panel=host.querySelector('aside')!,handle=panel.querySelector('div')!
  async function event(type:string,x:number,button=0,pointerId=1){const event=new MouseEvent(type,{clientX:x,button,bubbles:true});Object.defineProperty(event,'pointerId',{value:pointerId});await act(async()=>handle.dispatchEvent(event))}
  const flush=()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(job=>job(0))}
  return {panel,host,frames,captures,event,flush,renders:()=>renders,close:async()=>act(async()=>root.unmount())}
}
it.each([['start',false,1],['end',false,-1],['start',true,-1],['end',true,1]] as const)('tracks %s sidebar in RTL=%s without rendering the list on every move',async(side,rtl,direction)=>{
  const s=await sidebar(side,rtl),before=s.renders(),ended=vi.fn();window.addEventListener(SIDEBAR_RESIZE_END,ended)
  await s.event('pointerdown',500);expect(s.panel.classList.contains('sidebar-resizing')).toBe(true)
  for(let i=1;i<=80;i++)await s.event('pointermove',500+i*direction)
  expect(s.renders()).toBe(before);expect(s.frames.size).toBe(1);s.flush();expect(s.panel.style.width).toBe('380px');expect(s.panel.querySelector('output')!.textContent).toBe('300')
  await s.event('pointerup',580);expect(s.panel.querySelector('output')!.textContent).toBe('380');expect(s.renders()).toBe(before+1);expect(s.panel.classList.contains('sidebar-resizing')).toBe(false);expect(ended).toHaveBeenCalledOnce();expect(s.captures.size).toBe(0)
  window.removeEventListener(SIDEBAR_RESIZE_END,ended);await s.close()
})
it('clamps live width, flushes the final frame on cancel and ignores other pointers',async()=>{
  const s=await sidebar('start');await s.event('pointerdown',100,2);expect(s.captures.size).toBe(0)
  await s.event('pointerdown',100);await s.event('pointermove',400,0,2);expect(s.frames.size).toBe(0)
  await s.event('pointermove',1000);s.flush();expect(s.panel.style.width).toBe('440px')
  await s.event('pointermove',-1000);await s.event('pointercancel',-1000);expect(s.panel.style.width).toBe('220px');expect(s.frames.size).toBe(0);await s.close()
})
it('commits on blur and removes capture, pending frames and drag markers on unmount',async()=>{
  const s=await sidebar('start');await s.event('pointerdown',100);await s.event('pointermove',120);await act(async()=>window.dispatchEvent(new Event('blur')));expect(s.panel.style.width).toBe('320px')
  await s.event('pointerdown',100);await s.event('pointermove',140);await s.close();expect(s.captures.size).toBe(0);expect(s.frames.size).toBe(0);expect(s.panel.classList.contains('sidebar-resizing')).toBe(false)
})
it('removes the complete background page-number layer and its resize work',()=>{
  const source=readFileSync('src/renderer/src/components/PdfViewer.tsx','utf8'),css=readFileSync('src/renderer/src/overrides.css','utf8')
  expect(source+css).not.toMatch(/page-depth|viewer-inline-size/);expect(source).toContain('zoom={zoom} viewport={viewportRef}')
  expect(css).toContain('.annotation-panel.sidebar-resizing, .bookmark-panel.sidebar-resizing { transition: none; }')
})
