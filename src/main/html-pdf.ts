import { BrowserWindow } from 'electron'

/** Shared, isolated Chromium typesetting for reports and Markdown documents. */
export async function printHtmlPdf(content: string, css: string): Promise<Uint8Array> {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, partition: `html-pdf-${crypto.randomUUID()}` } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const html = `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'"><style>${css}</style></head><body>${content}</body></html>`
    return await Promise.race([
      (async () => { await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); return new Uint8Array(await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, generateTaggedPDF: true })) })(),
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('md.error')), 50_000) })
    ])
  } finally { clearTimeout(timeout); if (!window.isDestroyed()) window.destroy() }
}
