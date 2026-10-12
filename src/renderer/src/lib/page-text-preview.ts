import { PDFDocument } from 'pdf-lib'
import type { EditableTextRegion, TextStyle } from '../types'
import { writePageText } from './page-text-write'
import { getDocument, PDFJS_CMAP_URL, PDFJS_STANDARD_FONTS_URL } from './pdfjs'
import { pageViewportMatrix } from './page-coordinates'

/** Cache one isolated page per editor, so typing never rewrites the full PDF. */
export async function nativeTextPreviewPage(data: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const source = await PDFDocument.load(data, { updateMetadata: false }), preview = await PDFDocument.create()
  const [page] = await preview.copyPages(source, [pageIndex])
  preview.addPage(page)
  return preview.save()
}

/** Use the same native byte edit and PDF renderer for the draft and saved page. */
export async function nativeTextPreview(data: Uint8Array, region: EditableTextRegion, text: string, scale: number, style = region.style, preserve = true): Promise<{ source: string; rect: EditableTextRegion['rect']; fallbackUsed: boolean }> {
  const edited = await PDFDocument.load(data, { updateMetadata: false })
  const target = edited.getPage(0)
  const result = await writePageText(edited, target, pageViewportMatrix({ ...target.getCropBox(), rotation: target.getRotation().angle }), region, text, style as TextStyle, preserve, request => window.desktop.renderPageText(request))
  const previewTask = getDocument({ data: await edited.save(), cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDFJS_STANDARD_FONTS_URL, useWasm: false })
  try {
    const pdf = await previewTask.promise, page = await pdf.getPage(1)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(result.rect.width * scale)); canvas.height = Math.max(1, Math.ceil(result.rect.height * scale))
    const viewport = page.getViewport({ scale, offsetX: -result.rect.x * scale, offsetY: -result.rect.y * scale })
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
    return { source: canvas.toDataURL('image/png'), rect: result.rect, fallbackUsed: result.fallbackUsed }
  } finally { await previewTask.destroy() }
}
