import { PDFDocument } from 'pdf-lib'
import { exportPdfPages } from './export'

/** CUPS receives image-only pages so invoice fonts, masks and transparency never reach printer firmware. */
export async function rasterizeMacPrintJob(data: Uint8Array): Promise<Uint8Array> {
  const source = await PDFDocument.load(data)
  const output = await PDFDocument.create()
  for (let index = 0; index < source.getPageCount(); index++) {
    const [raster] = await exportPdfPages(data, 'png', 300, undefined, [index])
    const image = await output.embedPng(raster.data)
    const { width, height } = source.getPage(index).getSize()
    output.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  }
  return output.save({ useObjectStreams: false })
}
