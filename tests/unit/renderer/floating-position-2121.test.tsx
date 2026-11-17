// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useFloatingWindow } from '../../../src/renderer/src/lib/floating-window'
let root:Root,host:HTMLDivElement,windowHook:ReturnType<typeof useFloatingWindow>
function Window({active=true,storageKey='test-window',bottomRight=true,resizable=false}:{active?:boolean;storageKey?:string;bottomRight?:boolean;resizable?:boolean}){windowHook=useFloatingWindow(active,bottomRight,{storageKey,resizable});return <div ref={windowHook.ref} style={windowHook.style}><header>Window</header></div>}
async function render(props:Parameters<typeof Window>[0]={}){await act(async()=>root.render(<Window {...props}/>))}
async function move(dx:number,dy:number){const target=host.querySelector('header')!;await act(async()=>windowHook.dragHandlers.onPointerDown({button:0,preventDefault(){},target,clientX:10,clientY:10,pointerId:1,currentTarget:{setPointerCapture(){}}} as any));await act(async()=>windowHook.dragHandlers.onPointerMove({clientX:10+dx,clientY:10+dy} as any));windowHook.dragHandlers.onPointerUp()}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const x=parseFloat(this.style.left)||100,y=parseFloat(this.style.top)||100;return {x,y,left:x,top:y,right:x+200,bottom:y+150,width:200,height:150,toJSON(){}}});vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(200);vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(150)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.restoreAllMocks()})
it('restores a dragged bottom-right window after hiding and showing',async()=>{await render();await move(-200,-100);const saved={...windowHook.style};await render({active:false});await render();expect(windowHook.style).toEqual(saved)})
it('restores a window after unmounting on a document tab change',async()=>{await render({bottomRight:false});await move(90,70);const saved={...windowHook.style};await act(async()=>root.unmount());root=createRoot(host);await render({bottomRight:false});expect(windowHook.style).toEqual(saved)})
it('keeps different feature positions independent',async()=>{await render({storageKey:'one'});await move(-100,-100);const one={...windowHook.style};await render({storageKey:'two'});await move(-250,-50);const two={...windowHook.style};expect(two).not.toEqual(one);await render({storageKey:'one'});expect(windowHook.style).toEqual(one);await render({storageKey:'two'});expect(windowHook.style).toEqual(two)})
it('clamps a restored position to the available viewport',async()=>{localStorage.setItem('test-window.position',JSON.stringify({left:8000,top:9000}));await render();expect(windowHook.style?.left).toBe(816);expect(windowHook.style?.top).toBe(610)})
it('leaves existing size records intact while remembering position',async()=>{localStorage.setItem('test-window',JSON.stringify({width:420,height:320}));await render({resizable:true});await move(-70,-60);expect(JSON.parse(localStorage.getItem('test-window')!)).toEqual({width:420,height:320});expect(localStorage.getItem('test-window.position')).toBeTruthy()})
it.each(['null','{"left":"bad","top":12}','{"left":12}'])('ignores invalid position data %s',async value=>{localStorage.setItem('test-window.position',value);await render();expect(Number.isFinite(windowHook.style?.left)).toBe(true);expect(Number.isFinite(windowHook.style?.top)).toBe(true)})
it('supports dragging when persistent storage is unavailable',async()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked')});await render();await move(-90,-90);expect(windowHook.style?.left).toBe(718)})
it('preserves each mounted document window when another tab moves the same feature',async()=>{
 await render();await move(-100,-100);const original={...windowHook.style};await render({active:false});
 const secondHost=document.createElement('div');document.body.append(secondHost);const second=createRoot(secondHost)
 try{await act(async()=>second.render(<Window/>));await move(-300,-150);expect(windowHook.style).not.toEqual(original);await render();expect(windowHook.style).toEqual(original)}finally{await act(async()=>second.unmount());secondHost.remove()}
})
