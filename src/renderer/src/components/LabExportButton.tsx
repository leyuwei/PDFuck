import { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiMarkdown } from './AiMarkdown'
import { ui, translateUiText } from '../lib/i18n'
import { interfaceFontSizes, savedInterfaceSize } from '../lib/interface-size'

export function labReportHtml(title: string, content: string) {
  return renderToStaticMarkup(<main dir="auto"><h1>{title}</h1><section className="report-response"><h2>{ui('report.aiResponse')}</h2><AiMarkdown content={content} /></section></main>)
}

export function LabExportButton({ title, content }: { title: string; content: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const exportReport = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await window.desktop.exportLabReport({ name: title, html: labReportHtml(title, content), markdown: content, fontSizes: interfaceFontSizes(savedInterfaceSize()) }) }
    catch (cause) { setError(translateUiText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  return <span className="lab-export-control"><button type="button" disabled={busy || !content.trim()} onClick={() => void exportReport()}>{ui(busy ? 'ui.generating' : 'ui.exportPdfReport')}</button>{error && <span className="ai-polish-error" role="alert">{error}</span>}</span>
}
