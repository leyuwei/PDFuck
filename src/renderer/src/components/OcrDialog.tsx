import { useEffect, useRef, useState } from 'react'
import { OCR_LANGUAGES, type OcrLanguage } from '../../../shared/ocr'
import { allPageIndices, compactPageSelection, parsePageSelection } from '../lib/page-selection'
import { useFloatingWindow } from '../lib/floating-window'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import type { OcrOptions, OcrProgress } from '../lib/ocr'
import { ScrollWindow } from './ScrollWindow'
import { EditIcon } from './EditIcon'
import './ocr-dialog.css'

export function OcrDialog({ pageCount, currentPage, onClose, onRecognize }: {
  pageCount: number; currentPage: number; onClose(): void
  onRecognize(options: OcrOptions, signal: AbortSignal, progress: (value: OcrProgress) => void): Promise<number>
}) {
  const locale = useInterfaceLanguage()
  const defaults: Record<typeof locale, OcrLanguage> = { zh: 'chi_sim', en: 'eng', ja: 'jpn', ru: 'rus', es: 'spa', fr: 'fra', de: 'deu', pt: 'por', ko: 'kor', ar: 'ara' }
  const [language, setLanguage] = useState<OcrLanguage>(defaults[locale])
  const [range, setRange] = useState(() => compactPageSelection(allPageIndices(pageCount)))
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState<OcrProgress>()
  const [result, setResult] = useState<number>(), [error, setError] = useState('')
  const controller = useRef<AbortController | undefined>(undefined), floating = useFloatingWindow(true)
  const parsed = parsePageSelection(range, pageCount), valid = parsed.pages.length > 0 && !parsed.invalid.length
  useEffect(() => {
    const detach = window.desktop.onWindowRequestClose(() => controller.current?.abort())
    return () => { detach(); controller.current?.abort() }
  }, [])
  const close = () => { controller.current?.abort(); onClose() }
  const recognize = async () => {
    if (!valid || controller.current) return
    const active = new AbortController(); controller.current = active
    setBusy(true); setError(''); setResult(undefined); setProgress(undefined)
    try { const count = await onRecognize({ pages: parsed.pages, language }, active.signal, setProgress); if (!active.signal.aborted) setResult(count) }
    catch (reason) {
      if (!active.signal.aborted) setError(String(reason).includes('ocr.timeout') ? ui('ocr.timeout') : ui('ocr.failed'))
    } finally { if (controller.current === active) { controller.current = undefined; setBusy(false) } }
  }
  return <div className="modal-backdrop ocr-backdrop" onKeyDown={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) close() }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
    <ScrollWindow ref={floating.ref} style={floating.style} className="modal ocr-dialog" role="dialog" aria-modal="true" aria-labelledby="ocr-title">
      <header {...floating.dragHandlers}><EditIcon kind="ocr" /><h2 id="ocr-title">{ui('ocr.title')}</h2><button type="button" aria-label={ui('ui.close')} onClick={close}>×</button></header>
      <p className="ocr-description">{ui('ocr.description')}</p>
      <fieldset disabled={busy}>
        <label className="ocr-field"><span>{ui('ui.pageRange')}</span><input autoFocus dir="ltr" value={range} aria-invalid={!valid} placeholder={ui('ui.forExample135810')} onChange={event => { setRange(event.target.value); setResult(undefined) }} /><small>{parsed.invalid.length ? t('page.rangeInvalid', { value: parsed.invalid.join(', ') }) : t('page.selected', { count: parsed.pages.length })}</small></label>
        <div className="page-selection-shortcuts"><button type="button" onClick={() => setRange(compactPageSelection(allPageIndices(pageCount)))}>{ui('ui.all')}</button><button type="button" onClick={() => setRange(String(currentPage + 1))}>{ui('ui.currentPage')}</button></div>
        <label className="ocr-field"><span>{ui('ocr.language')}</span><select value={language} onChange={event => { setLanguage(event.target.value as OcrLanguage); setResult(undefined) }}>{Object.entries(OCR_LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>{ui('ocr.languageHint')}</small></label>
      </fieldset>
      <div className="ocr-status" role="status" aria-live="polite">{busy && <><p>{progress ? t('ocr.progress', { page: progress.page, completed: progress.completed, total: progress.total }) : ui('ocr.preparing')}</p><progress aria-label={ui('ocr.title')} max={progress?.total || 1} value={progress ? progress.completed + progress.fraction : 0} /></>}{result !== undefined && <p>{result ? t('ocr.done', { count: result }) : ui('ocr.empty')}</p>}</div>
      {error && <p className="ocr-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" onClick={close}>{ui(busy ? 'ui.cancel' : 'ui.close')}</button><button type="button" className="primary" disabled={busy || !valid} onClick={() => void recognize()}>{ui('ocr.start')}</button></div>
    </ScrollWindow>
  </div>
}
