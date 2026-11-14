import { describe, it, expect, vi } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
vi.mock('../../../../../src/renderer/src/lib/export', () => ({ exportPdfPages: vi.fn(async () => [{data: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64')),pageNumber:1}]) }))
import { rasterizeMacPrintJob } from '../../../../../src/renderer/src/lib/macos-print-raster'
import { exportPdfPages } from '../../../../../src/renderer/src/lib/export'
import { PdfDocumentModel } from '../../../../../src/renderer/src/lib/pdf-document'

describe('2.1.17 print and annotation persistence', () => {
  it('rebuilds CUPS jobs as image pages with original sheet dimensions and no source fonts', async () => {
    const source=await PDFDocument.create()
    source.addPage([595,842]).drawText('Synthetic invoice 123')
    source.addPage([842,595]).drawText('Landscape invoice')
    const output=await PDFDocument.load(await rasterizeMacPrintJob(await source.save()))
    expect(output.getPages().map(p=>p.getSize())).toEqual(source.getPages().map(p=>p.getSize()))
    for(const p of output.getPages()) expect(p.node.Resources()?.lookup(PDFName.of('Font'))?.toString()).toBe('<<\n>>')
    expect(vi.mocked(exportPdfPages).mock.calls.map(c=>c[4])).toEqual([[0],[1]])
    expect(vi.mocked(exportPdfPages).mock.calls.every(c=>c[2]===300)).toBe(true)
  })
  it('deletes a native annotation from serialized pages idempotently', async () => {
    const pdf=await PDFDocument.create();pdf.addPage([595,842])
    const model=await PdfDocumentModel.load(await pdf.save())
    const id=await model.addAnnotation(0,'highlight',[{x:40,y:50,width:100,height:12}],'Synthetic note')
    expect(await model.deleteAnnotation(id)).toBe(true)
    const saved=await PDFDocument.load(model.bytes)
    expect(saved.getPage(0).node.Annots()?.size()||0).toBe(0)
    expect(await model.deleteAnnotation(id)).toBe(false)
  })
})
