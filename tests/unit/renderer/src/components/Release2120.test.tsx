// @vitest-environment jsdom
import {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {it,expect,vi,afterEach,beforeEach} from 'vitest'
vi.mock('../../../../../src/renderer/src/lib/pdfjs',()=>({AnnotationMode:{DISABLE:0},getDocument:vi.fn(),PDFJS_WASM_URL:''}))
import {ButtonHints} from '../../../../../src/renderer/src/components/ButtonHints'
import {AnnotationDialog} from '../../../../../src/renderer/src/components/Dialogs'
import {AppUpdateDownload} from '../../../../../src/renderer/src/components/AppUpdateDownload'
import {ResourceDownloadDialog} from '../../../../../src/renderer/src/components/ResourceDownloadDialog'
import {saveAnnotationView} from '../../../../../src/renderer/src/lib/annotation-preferences'
import {selectionTextItems} from '../../../../../src/renderer/src/lib/selection-text-items'
import {useFloatingWindow} from '../../../../../src/renderer/src/lib/floating-window'
import {INTERFACE_LANGUAGES,messages} from '../../../../../src/shared/i18n-catalogue'
let root:Root,host:HTMLDivElement
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}})})
afterEach(async()=>{await act(async()=>root.unmount());document.body.innerHTML='';vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();saveAnnotationView({markdown:false})})
it('delays meaningful icon hints by 1.5 seconds and suppresses duplicate labels and annotation content',async()=>{
 vi.useFakeTimers();await act(async()=>root.render(<><button title="Save a copy"><svg/></button><button title="保存">保存</button><span role="button" title="Full comment">comment</span><div className="annotation-row"><button title="Annotation content">note</button></div><ButtonHints/></>))
 const buttons=host.querySelectorAll('button');await act(async()=>buttons[0].dispatchEvent(new MouseEvent('pointerover',{bubbles:true})));await act(async()=>vi.advanceTimersByTime(1499));expect(document.querySelector('.app-button-hint')).toBeNull();await act(async()=>vi.advanceTimersByTime(1));expect(document.querySelector('.app-button-hint')?.textContent).toBe('Save a copy')
 for(const target of [buttons[1],host.querySelector('[role="button"]')!,buttons[2]]){await act(async()=>buttons[0].dispatchEvent(new MouseEvent('pointerout',{bubbles:true})));await act(async()=>target.dispatchEvent(new MouseEvent('pointerover',{bubbles:true})));await act(async()=>vi.advanceTimersByTime(1600));expect(document.querySelector('.app-button-hint')).toBeNull()}
})
it('keeps normal body text beside a formula when tiny diagram labels dominate item counts',()=>{
 const item=(str:string,x:number,y:number,size:number,width:number)=>({str,dir:'ltr',width,height:size,transform:[size,0,0,size,x,y],fontName:'f',hasEOL:false})
 const body=item('normal selected body text',50,300,10,130),fraction=item('(·)',177,300,10,12),small=Array.from({length:30},(_,i)=>item('x',i*3,50,3,2));const input=[body,fraction,...small]
 expect(selectionTextItems(input as any,{fnArray:[],argsArray:[]},{})).toEqual(input)
})
it('renders the editor and Markdown preview in a keyboard-adjustable split and normalizes source line wraps',async()=>{
 saveAnnotationView({markdown:true});await act(async()=>root.render(<AnnotationDialog state={{kind:'note',initial:'**Hello**',source:[{pageIndex:0,pieces:[{text:'A line\nwrapped para-\ngraph',selected:true}]}]}} onCancel={()=>{}} onSubmit={()=>{}}/>))
 expect(host.querySelector('.annotation-edit-input .rich-editor-content')).toBeTruthy();expect(host.querySelector('.annotation-edit-preview strong')?.textContent).toBe('Hello');expect(host.querySelector('.annotation-source-passage p')?.textContent).toBe('A line wrapped paragraph')
 const separator=host.querySelector('[role="separator"]')!;await act(async()=>separator.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));expect(separator.getAttribute('aria-valuenow')).toBe('55')
})
it.each(INTERFACE_LANGUAGES)('has complete localized updater text and split labels in %s',language=>{for(const [key,value]of Object.entries(messages).filter(([key])=>key.startsWith('updates.')||key==='interaction.previewSplit'))expect(value[language],key).toBeTruthy()})
it('minimizes an update into the copyright position, retains progress updates and restores the dialog',async()=>{
 const footer=document.createElement('footer');footer.innerHTML='<span class="copyright">copyright</span>';const shell=document.createElement('div');shell.className='app-shell';shell.append(footer);document.body.append(shell)
 let listener:(s:any)=>void=()=>{};const state={version:'2.1.21',name:'PDFuck-2.1.21-macOS.dmg',phase:'downloading',downloaded:50,total:100,speed:1}
 Object.assign(window,{desktop:{updateState:async()=>state,onUpdateState:(f:typeof listener)=>{listener=f;return()=>{}},updateAction:vi.fn(),installUpdate:vi.fn()}})
 await act(async()=>root.render(<AppUpdateDownload/>));await act(async()=>host.querySelector<HTMLButtonElement>('.download-minimize')!.click());expect(host.querySelector('.update-download-backdrop')).toBeNull();expect(footer.querySelector('.download-dock progress')?.getAttribute('value')).toBe('50')
 await act(async()=>listener({...state,downloaded:75}));expect(footer.querySelector('.download-dock b')?.textContent).toBe('75%');await act(async()=>footer.querySelector<HTMLButtonElement>('button')!.click());expect(host.querySelector('.update-download-backdrop')).toBeTruthy()
})
it('minimizes feature downloads without sending pause or cancel',async()=>{
 const shell=document.createElement('div');shell.className='app-shell';shell.innerHTML='<footer><span class="copyright">copyright</span></footer>';document.body.append(shell)
 const resourceAction=vi.fn();Object.assign(window,{desktop:{onResourceState:()=>()=>{},resourceState:async()=>({id:'test',request:{kind:'grammar'},phase:'downloading',downloaded:25,total:100,speed:1,files:[]}),onWindowRequestClose:()=>()=>{},resourceProxy:async()=>({mode:'system',url:'',username:''}),resourceAction}})
 await act(async()=>root.render(<ResourceDownloadDialog/>));await act(async()=>host.querySelector<HTMLButtonElement>('.download-minimize')!.click());expect(shell.querySelector('.download-dock b')?.textContent).toBe('25%');expect(resourceAction).not.toHaveBeenCalled()
})
it('allows a floating window moved upward to use the newly available height',async()=>{
 const Window=()=>{const f=useFloatingWindow(true,false,{resizable:true,minWidth:200,minHeight:160});return <div ref={f.ref} style={f.style}/>}
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return new DOMRect(parseFloat(this.style.left)||50,parseFloat(this.style.top)||120,parseFloat(this.style.width)||400,parseFloat(this.style.height)||300)})
 HTMLElement.prototype.setPointerCapture=vi.fn();HTMLElement.prototype.hasPointerCapture=()=>false
 await act(async()=>root.render(<Window/>));const el=host.firstElementChild as HTMLElement
 await act(async()=>el.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:200,clientY:420})));await act(async()=>el.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:200,clientY:650})))
 expect(parseFloat(el.style.height)).toBeGreaterThan(500);expect(el.style.maxHeight).toBe(`${window.innerHeight-120-8}px`)
})
