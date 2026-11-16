import { useEffect, useState } from 'react'
import type { AppUpdateState } from '../../../shared/app-update'
import { messages,type TranslationKey } from '../../../shared/i18n-catalogue'
import { ui,t,useInterfaceLanguage } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { DownloadDock } from './DownloadDock'
import './resource-download.css'
export function AppUpdateDownload(){
 useInterfaceLanguage()
 const [state,setState]=useState<AppUpdateState>(),[minimized,setMinimized]=useState(false),[error,setError]=useState('')
 const floating=useFloatingWindow(state?.version&&!minimized)
 useEffect(()=>{let active=true,seen=false;const off=window.desktop.onUpdateState(s=>{seen=true;setState(s)});void window.desktop.updateState().then(s=>{if(active&&!seen)setState(s)}).catch(()=>{});return()=>{active=false;off()}},[])
 useEffect(()=>{setMinimized(false);setError('')},[state?.version])
 if(!state)return null
 const percent=Math.min(100,state.total?state.downloaded*100/state.total:0),active=['queued','downloading','verifying'].includes(state.phase),key=state.error as TranslationKey
 const action=async(a:'start'|'pause'|'cancel')=>{setError('');try{await window.desktop.updateAction(a)}catch{setError(ui('updates.unavailable'))}}
 if(minimized)return <DownloadDock label={ui('updates.title')} percent={percent} onRestore={()=>setMinimized(false)}/>
 return <div className="modal-backdrop resource-backdrop update-download-backdrop"><div ref={floating.ref} style={floating.style} className="modal resource-download-dialog" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
  <header {...floating.dragHandlers}><div><h2 id="app-update-title">{ui('updates.title')}</h2><span>{state.version}</span></div><button type="button" className="download-minimize" aria-label={ui('ui.minimizeWindow')} onClick={()=>setMinimized(true)}>−</button><button type="button" aria-label={ui('ui.close')} onClick={()=>void action('cancel')}>×</button></header>
  <div className="resource-download-body"><p>{ui(state.phase==='ready'?'updates.ready':'updates.description')}</p><b dir="auto">{state.name}</b><progress max={100} value={percent}/><p>{Math.round(percent)}% · {(state.downloaded/1048576).toFixed(1)} / {(state.total/1048576).toFixed(1)} MiB</p>{state.phase==='paused'&&<p>{ui('ui.pause')}</p>}{(error||state.error)&&<p role="alert">{error||(key in messages?t(key):ui('updates.unavailable'))}</p>}</div>
  <footer className="modal-actions"><button type="button" onClick={()=>void action('cancel')}>{ui('ui.cancel')}</button>{state.phase==='ready'?<button type="button" className="primary" onClick={()=>{void window.desktop.installUpdate().catch(()=>setError(ui('updates.installUnavailable')))}}>{ui('updates.install')}</button>:<button type="button" className="primary" disabled={state.phase==='verifying'} onClick={()=>void action(active?'pause':'start')}>{ui(active?'ui.pause':state.phase==='error'?'ui.aiRecoveryAction.retry':'ui.resume')}</button>}</footer>
 </div></div>
}
