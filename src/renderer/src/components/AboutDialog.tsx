import { useEffect, useState } from 'react'
import type { UpdateCheckResult } from '../../../shared/contracts'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { ScrollWindow } from './ScrollWindow'
import './ocr-dialog.css'
import { ReleaseNotes } from './ReleaseNotes'

export function AboutDialog({ version, onClose, onGuide }: { version: string; onClose(): void; onGuide?(): void }) {
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
      {onGuide && <button type="button" className="about-guide-entry" onClick={onGuide}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5v15"/></svg><span><b>{ui('guide.guide')}</b><small>{ui('tour.about')}</small></span><span aria-hidden="true">→</span></button>}
      <p className="ocr-description">{ui('about.credits')}</p>
      <p role="status" aria-live="polite">{!result ? ui('about.checking') : result.status === 'unavailable' ? ui('about.unavailable') : result.status === 'current' ? ui('about.current') : t('update.availableTitle', { version: result.latestVersion || '' })}</p>
      {result && result.status !== 'unavailable' && <ReleaseNotes content={result.releaseNotes} version={result.latestVersion} />}
      <div className="modal-actions"><button type="button" disabled={!result} onClick={() => { setResult(undefined); setAttempt(value => value + 1) }}>{ui('about.check')}</button><a href="https://github.com/leyuwei/PDFuck/releases" onClick={event => { event.preventDefault(); setLinkError(false); void window.desktop.openReleasePage('https://github.com/leyuwei/PDFuck/releases').catch(() => setLinkError(true)) }}>{ui('about.releases')}</a></div>
      {linkError && <p role="alert">{ui('ui.invalidUpdateLink')}</p>}
    </ScrollWindow>
  </div>
}
