import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { convertPdfToEps, findPdfToCairo } from './eps-export'

// This integration check deliberately fails when the release machine lacks Poppler.
describe('vector EPS conversion', () => {
  it('rejects raster input and writes real PostScript text and paths from a PDF', async () => {
    const command = findPdfToCairo('resources')
    expect(command, 'Install Poppler (pdftocairo) on the release machine').toBeTruthy()
    await expect(convertPdfToEps(command!, new Uint8Array([137, 80, 78, 71]))).rejects.toThrow('ui.epsConversionFailed')
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([240, 180])
    page.drawText('Vector EPS 2.0.17', { x: 20, y: 100, size: 16, font: await pdf.embedFont(StandardFonts.Helvetica) })
    page.drawLine({ start: { x: 10, y: 10 }, end: { x: 220, y: 160 }, thickness: 1 })
    const eps = Buffer.from(await convertPdfToEps(command!, await pdf.save())).toString()
    expect(eps).toContain('EPSF-3.0')
    expect(eps).toContain('%%BoundingBox:')
    expect(eps).toMatch(/\/FontType/)
    expect(eps).not.toContain('Fallback Image')
    expect(eps).not.toContain('colorimage')
    await expect(convertPdfToEps('/nonexistent/pdfuck-pdftocairo', await pdf.save())).rejects.toThrow('ui.epsConversionFailed')
  })
})
