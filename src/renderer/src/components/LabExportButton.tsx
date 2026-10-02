import { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiMarkdown } from './AiMarkdown'
import { ui, translateUiText } from '../lib/i18n'
import { interfaceFontSizes, savedInterfaceSize } from '../lib/interface-size'

export interface LabReportSource { text: string; image?: string; pdf?: Uint8Array }
export function labReportHtml(title: string, content: string, source: LabReportSource) {
  return renderToStaticMarkup(<main dir="auto"><h1>{title}</h1><section><h2>{ui('ui.sourceText')}</h2><pre className="source-text" dir="auto">{source.text}</pre>{source.image && <img src={source.image} alt={ui('ui.explainImage')} />}</section><section className="report-response"><h2>{ui('ui.liveResponse')}</h2><AiMarkdown content={content} /></section><section className="report-raw"><h2>{ui('ui.markdownSource')}</h2><pre dir="auto">{content}</pre></section></main>)
}

export function LabExportButton({ title, content, source }: { title: string; content: string; source: LabReportSource }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const exportReport = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await window.desktop.exportLabReport({ name: title, html: labReportHtml(title, content, source), markdown: content, sourceText: source.text, fontSizes: interfaceFontSizes(savedInterfaceSize()), sourcePdf: source.pdf }) }
    catch (cause) { setError(translateUiText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  return <span className="lab-export-control"><button type="button" disabled={busy || !content.trim()} onClick={() => void exportReport()}>{ui(busy ? 'ui.generating' : 'ui.exportPdfReport')}</button>{error && <span className="ai-polish-error" role="alert">{error}</span>}</span>
}
