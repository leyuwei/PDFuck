import { useRef, useState, type ReactNode } from 'react'
import { ui } from '../lib/i18n'
export function AnnotationEditSplit({ children, preview, enabled }: { children: ReactNode; preview: ReactNode; enabled: boolean }) {
  const [ratio,setRatio]=useState(50),root=useRef<HTMLDivElement>(null)
  const move=(x:number)=>{const r=root.current!.getBoundingClientRect();setRatio(Math.max(20,Math.min(80,(x-r.left)*100/r.width)))}
  return <div ref={root} className={`annotation-edit-split${enabled?' has-preview':''}`} style={enabled?{gridTemplateColumns:`minmax(0,${ratio}fr) 8px minmax(0,${100-ratio}fr)`}:undefined}>
    <div className="annotation-edit-input">{children}</div>{enabled&&<><div className="annotation-edit-divider" role="separator" aria-label={ui('interaction.previewSplit')} aria-orientation="vertical" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio)} tabIndex={0} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);move(e.clientX)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e.clientX)}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setRatio(r=>Math.max(20,Math.min(80,r+(e.key==='ArrowRight'?5:-5))))}}}/><div className="annotation-edit-preview" dir="auto">{preview}</div></>}
  </div>
}
