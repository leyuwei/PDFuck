import { describe, expect, it } from 'vitest'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { protectCropBounds } from './crop-geometry'
import { PdfDocumentModel } from './pdf-document'
import { INTERFACE_LANGUAGES, translateMessage } from '../../../shared/i18n-catalogue'

describe('2.0.50 protected crop margin', () => {
  const content = { x: 60, y: 80, width: 240, height: 170 }
  const page = { width: 400, height: 350 }

  it('keeps zero-margin edges and converts millimetres to points on all sides', () => {
    expect(protectCropBounds(content, 0, page)).toEqual(content)
    const padding = 2 * 72 / 25.4, rect = protectCropBounds(content, 2, page)
    expect(rect.x).toBeCloseTo(60 - padding)
    expect(rect.y).toBeCloseTo(80 - padding)
    expect(rect.width).toBeCloseTo(240 + 2 * padding)
    expect(rect.height).toBeCloseTo(170 + 2 * padding)
  })

  it('limits each side to page edges without shifting or losing content', () => {
    const nearEdge = { x: 1, y: 2, width: 398, height: 346 }
    expect(protectCropBounds(nearEdge, 3, page)).toEqual({ x: 0, y: 0, ...page })
    const rect = protectCropBounds({ x: 1, y: 100, width: 200, height: 249 }, 2, page)
    expect(rect.x).toBe(0); expect(rect.y).toBeCloseTo(100 - 2 * 72 / 25.4)
    expect(rect.width).toBeCloseTo(201 + 2 * 72 / 25.4)
    expect(rect.y + rect.height).toBe(350)
  })

  it('treats invalid and negative margins as zero and clamps oversized margins', () => {
    for (const value of [-1, NaN, Infinity]) expect(protectCropBounds(content, value, page)).toEqual(content)
    expect(protectCropBounds(content, 1000, page)).toEqual({ x: 0, y: 0, ...page })
  })

  it('recalculates from the detected content so repeated and decreasing margins do not accumulate', () => {
    const initial = { ...content }, first = protectCropBounds(content, 5, page)
    expect(protectCropBounds(content, 5, page)).toEqual(first)
    expect(protectCropBounds(content, 1, page).width).toBeLessThan(first.width)
    expect(protectCropBounds(content, 0, page)).toEqual(initial)
    expect(content).toEqual(initial)
  })

  it('persists a protected CropBox on a rotated page, preserves vector content, and supports undo/redo', async () => {
    const pdf = await PDFDocument.create(), source = pdf.addPage([500, 400])
    source.setCropBox(20, 30, 450, 350); source.setRotation(degrees(90))
    source.drawLine({ start: { x: 100, y: 100 }, end: { x: 300, y: 200 }, color: rgb(0, 0, 1) })
    const original = source.getCropBox(), model = await PdfDocumentModel.load(await pdf.save())
    const rect = protectCropBounds({ x: 50, y: 80, width: 200, height: 240 }, 1.5, { width: 350, height: 450 })
    await model.cropPage(0, rect)
    const saved = (await PDFDocument.load(model.bytes)).getPage(0)
    expect(saved.getCropBox().width).toBeCloseTo(rect.height)
    expect(saved.getCropBox().height).toBeCloseTo(rect.width)
    expect(saved.getRotation().angle).toBe(90)
    expect(saved.node.Contents()?.toString()).toBe(source.node.Contents()?.toString())
    await model.undo()
    expect((await PDFDocument.load(model.bytes)).getPage(0).getCropBox()).toEqual(original)
    await model.redo()
    expect((await PDFDocument.load(model.bytes)).getPage(0).getCropBox()).toEqual(saved.getCropBox())
  })

  it('provides margin, hint and unit copy in every interface language', () => {
    for (const language of INTERFACE_LANGUAGES) for (const key of ['crop.margin', 'crop.marginHint', 'crop.marginUnit'] as const) {
      expect(translateMessage(language, key)).not.toBe(key)
      expect(translateMessage(language, key).trim().length).toBeGreaterThan(0)
    }
  })
})
