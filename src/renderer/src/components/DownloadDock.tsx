import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
export function DownloadDock({ label, percent, onRestore }: { label:string; percent:number; onRestore():void }) {
 const [target,setTarget]=useState<Element|null>(null)
 useEffect(()=>{setTarget(document.querySelector('.app-shell>footer .copyright'))},[])
 return target?createPortal(<button type="button" className="download-dock" onClick={onRestore} aria-label={`${label} · ${Math.round(percent)}%`}><span>{label}</span><progress max={100} value={percent}/><b>{Math.round(percent)}%</b></button>,target):null
}
