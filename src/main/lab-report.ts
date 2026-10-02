import { BrowserWindow } from 'electron'
import { PDFDocument } from 'pdf-lib'
import type { LabReportRequest } from '../shared/contracts'

/** Print in an isolated, script-free browser so long reports retain selectable multilingual text. */
export async function createLabReport(request: LabReportRequest): Promise<Uint8Array> {
  if (!request || typeof request.html !== 'string' || !request.html.trim() || request.html.length > 50_000_000 || typeof request.name !== 'string' || request.name.length > 500) throw new Error('ui.annotationRequestInvalid')
  if ([request.markdown, request.sourceText].some(value => typeof value !== 'string' || value.length > 50_000_000)) throw new Error('ui.annotationRequestInvalid')
  const { small, body, title } = request.fontSizes || {}
  if (![small, body, title].every(size => Number.isFinite(size) && size >= 8 && size <= 32)) throw new Error('ui.annotationRequestInvalid')
  if (request.sourcePdf && (!(request.sourcePdf instanceof Uint8Array) || request.sourcePdf.length > 512 * 1024 * 1024)) throw new Error('ui.annotationRequestInvalid')
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, partition: `lab-report-${crypto.randomUUID()}` } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  try {
    const html = `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'"><style>
      :root { --ui-font-small: ${small}px; --ui-font-body: ${body}px; --ui-font-title: ${title}px }
      @page { size: A4; margin: 16mm }
      body { font: var(--ui-font-body)/1.65 'Segoe UI', 'Microsoft YaHei', sans-serif; color: #20283a; overflow-wrap: anywhere }
      h1 { font-size: var(--ui-font-title) } h2,h3,h4,h5,h6 { font-size: var(--ui-font-body); break-after: avoid }
      section { margin-block: 18px } .report-raw { break-before: page }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; font: var(--ui-font-small)/1.6 Consolas,'Microsoft YaHei',monospace }
      .source-text { font: inherit } img { display: block; max-width: 100%; max-height: 240mm; object-fit: contain }
      table { width: 100%; border-collapse: collapse; font-size: var(--ui-font-small); table-layout: fixed }
      th,td { padding: 6px; border: 1px solid #d9e0eb; text-align: start; vertical-align: top }
      tr, img { break-inside: avoid } blockquote { border-inline-start: 3px solid #5575de; padding-inline-start: 12px; margin-inline: 0 }
      a { color: #3157b5 } code { background: #f0f3f8 } .ai-markdown { white-space: normal }
    </style></head><body>${request.html}</body></html>`
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const bytes = await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, generateTaggedPDF: true })
    const report = await PDFDocument.load(bytes)
    // Attach UTF-8 originals as well: shaped RTL glyphs in printed PDFs may copy differently between readers.
    await report.attach(new TextEncoder().encode(request.markdown), 'response.md', { mimeType: 'text/markdown' })
    await report.attach(new TextEncoder().encode(request.sourceText), 'source.txt', { mimeType: 'text/plain' })
    if (request.sourcePdf) {
      const source = await PDFDocument.load(request.sourcePdf)
      for (const page of await report.copyPages(source, source.getPageIndices())) report.addPage(page)
    }
    return report.save()
  } finally { window.destroy() }
}
