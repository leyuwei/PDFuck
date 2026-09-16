import { useEffect, useState } from 'react'
import type { UpdateCheckResult } from '../../../shared/contracts'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { ScrollWindow } from './ScrollWindow'
import './ocr-dialog.css'

export function AboutDialog({ version, onClose }: { version: string; onClose(): void }) {
  useInterfaceLanguage()
  const floating = useFloatingWindow(true)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<UpdateCheckResult>()
  const [linkError, setLinkError] = useState(false)
  useEffect(() => {
    let active = true
    setResult(undefined)
    window.desktop.checkForUpdates().then(value => { if (active) setResult(value) })
      .catch(() => { if (active) setResult({ status: 'unavailable', currentVersion: version }) })
    return () => { active = false }
  }, [attempt, version])
  return <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDown={event => event.stopPropagation()} onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <ScrollWindow ref={floating.ref} style={floating.style} className="modal ocr-dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header {...floating.dragHandlers}><h2 id="about-title">{ui('about.title')} PDFuck</h2><button autoFocus type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button></header>
      <p>{ui('about.description')}</p>
      <p>{t('update.current', { version })}</p>
      <p className="ocr-description">{ui('about.credits')}</p>
      <p role="status" aria-live="polite">{!result ? ui('about.checking') : result.status === 'unavailable' ? ui('about.unavailable') : result.status === 'current' ? ui('about.current') : t('update.availableTitle', { version: result.latestVersion || '' })}</p>
      <div className="modal-actions"><button type="button" disabled={!result} onClick={() => { setResult(undefined); setAttempt(value => value + 1) }}>{ui('about.check')}</button><a href="https://github.com/leyuwei/PDFuck/releases" onClick={event => { event.preventDefault(); setLinkError(false); void window.desktop.openReleasePage('https://github.com/leyuwei/PDFuck/releases').catch(() => setLinkError(true)) }}>{ui('about.releases')}</a></div>
      {linkError && <p role="alert">{ui('ui.invalidUpdateLink')}</p>}
    </ScrollWindow>
  </div>
}
