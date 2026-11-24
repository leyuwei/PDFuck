import { PDF_EDIT_SLICE_MAX_BYTES, type PdfRangeSource } from '../../../shared/contracts'

export function nativePagePreferred(source: PdfRangeSource | undefined, pages: number): boolean {
  return Boolean(source && window.desktop.platform === 'win32' && source.length / Math.max(1, pages) >= PDF_EDIT_SLICE_MAX_BYTES)
}

export async function paintNativePdfPage(source: PdfRangeSource, page: number, canvas: HTMLCanvasElement): Promise<void> {
  const data = await window.desktop.renderLargePdfPage(source.id, page, canvas.width, canvas.height)
  const raster = await createImageBitmap(new Blob([Uint8Array.from(data)], { type: 'image/png' }))
  try {
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('pdf.pageRenderFailed')
    context.drawImage(raster, 0, 0)
  } finally { raster.close() }
}
