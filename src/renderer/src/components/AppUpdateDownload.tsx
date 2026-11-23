import { useEffect, useState } from 'react'
import type { AppUpdateState } from '../../../shared/app-update'
import { messages, type TranslationKey } from '../../../shared/i18n-catalogue'
import { ui, useInterfaceLanguage } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { DownloadDock } from './DownloadDock'
import './resource-download.css'

export function AppUpdateDownload() {
  useInterfaceLanguage()
  const [state, setState] = useState<AppUpdateState>()
  const [minimized, setMinimized] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<TranslationKey>()
  const floating = useFloatingWindow(state?.version && !minimized && !state.installing, false, { storageKey: 'pdfuck.update-download-window.v1' })
  useEffect(() => {
    let active = true, seen = false
    const off = window.desktop.onUpdateState(next => { seen = true; setState(next) })
    void window.desktop.updateState().then(next => { if (active && !seen) setState(next) }).catch(() => {})
    return () => { active = false; off() }
  }, [])
  useEffect(() => { setMinimized(false); setError(undefined) }, [state?.version])
  if (!state || state.installing) return null

  const ready = state.phase === 'ready'
  const active = ['queued', 'downloading', 'verifying'].includes(state.phase)
  const percent = Math.min(100, state.total ? state.downloaded * 100 / state.total : 0)
  const stateError = state.error && (Object.hasOwn(messages, state.error) ? state.error as TranslationKey : 'updates.unavailable')
  const errorKey = state.phase === 'error' ? stateError : error ?? stateError
  async function run(action: () => Promise<void>, failure: TranslationKey) {
    setBusy(true)
    setError(undefined)
    try { await action() }
    catch { setError(failure) }
    finally { setBusy(false) }
  }
  const downloadAction = (action: 'start' | 'pause' | 'cancel') => run(() => window.desktop.updateAction(action), 'updates.unavailable')
  function dismiss() {
    if (ready) setMinimized(true)
    else void downloadAction('cancel')
  }

  if (minimized) return <DownloadDock label={ui('updates.title')} percent={percent} onRestore={() => setMinimized(false)} />
  return <div className="modal-backdrop resource-backdrop update-download-backdrop" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !busy) dismiss() }}>
    <div ref={floating.ref} style={floating.style} className="modal resource-download-dialog" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
      <header {...floating.dragHandlers}>
        <div className="update-download-heading"><h2 id="app-update-title">{ui('updates.title')}</h2><span>{state.version}</span></div>
        {!ready && <button type="button" className="download-minimize" aria-label={ui('ui.minimizeWindow')} onClick={() => setMinimized(true)}>−</button>}
        <button type="button" autoFocus disabled={busy} aria-label={ui('ui.close')} onClick={dismiss}>×</button>
      </header>
      <div className="resource-download-body">
        <p role="status">{ui(ready ? 'updates.ready' : 'updates.description')}</p>
        <div className="resource-progress-card">
          <progress aria-labelledby="app-update-title" max={100} value={percent} />
          <div className="resource-transfer"><bdi>{Math.round(percent)}%</bdi><bdi>{(state.downloaded / 1048576).toFixed(1)} / {(state.total / 1048576).toFixed(1)} MiB</bdi></div>
          <small dir="auto">{state.name}</small>
        </div>
        {state.phase === 'paused' && <p>{ui('ui.pause')}</p>}
        {errorKey && <p className="resource-download-error" role="alert">{ui(errorKey)}</p>}
      </div>
      <footer className="modal-actions">{ready ? <>
        <button type="button" disabled={busy} onClick={() => void run(() => window.desktop.openUpdateFolder(), 'updates.folderUnavailable')}>{ui('ui.openFolder')}</button>
        <button type="button" disabled={busy} className="primary" onClick={() => void run(() => window.desktop.installUpdate(), 'updates.installUnavailable')}>{ui('updates.install')}</button>
      </> : <>
        <button type="button" disabled={busy} onClick={dismiss}>{ui('ui.cancel')}</button>
        <button type="button" className="primary" disabled={busy || state.phase === 'verifying'} onClick={() => void downloadAction(active ? 'pause' : 'start')}>{ui(active ? 'ui.pause' : state.phase === 'error' ? 'ui.aiRecoveryAction.retry' : 'ui.resume')}</button>
      </>}</footer>
    </div>
  </div>
}
