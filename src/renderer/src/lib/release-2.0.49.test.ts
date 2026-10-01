import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { figureContentBounds } from './figure-region'
import { PdfDocumentModel } from './pdf-document'
import { defaultSettings, explainImage } from './ai-polish'
import { INTERFACE_LANGUAGES, translateMessage } from '../../../shared/i18n-catalogue'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4H8DlAAAFRQGaEXGl/wAAAABJRU5ErkJggg=='
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('2.0.49 figure workflows', () => {
  it('trims white borders while retaining pale lines and isolated labels at exact pixel edges', () => {
    const data = new Uint8ClampedArray(100 * 80 * 4).fill(255)
    const pixel = (x: number, y: number, color: number, alpha = 255) => data.set([color, color, color, alpha], (y * 100 + x) * 4)
    for (let y = 20; y < 60; y++) for (let x = 25; x < 75; x++) pixel(x, y, 0)
    pixel(10, 15, 247); pixel(90, 70, 40); pixel(0, 0, 0, 0)
    expect(figureContentBounds({ width: 100, height: 80, data }, { x: 30, y: 40, width: 200, height: 160 })).toEqual({ x: 50, y: 70, width: 162, height: 112 })
    expect(figureContentBounds({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) }, { x: 0, y: 0, width: 2, height: 2 })).toBeUndefined()
  })

  it('moves one image stamp across rotated/cropped pages, preserves metadata, and supports reopen/undo/redo', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([400, 500]); const target = pdf.addPage([600, 450])
    target.setCropBox(20, 30, 500, 350); target.setRotation(degrees(90))
    const model = await PdfDocumentModel.load(await pdf.save())
    const id = await model.addImage(0, Uint8Array.from(atob(png), c => c.charCodeAt(0)), 'png', { x: 20, y: 30, width: 80, height: 60 }, 15, 'scientific figure', 4 / 3, true)
    const moved = { x: 40, y: 50, width: 100, height: 75 }
    await model.updateImage(id, moved, 30, 4 / 3, false, 1)
    expect(model.images()).toHaveLength(1)
    expect(model.images()[0]).toMatchObject({ id, pageIndex: 1, rect: moved, rotation: 30, lockAspectRatio: false, name: 'scientific figure' })
    expect((await PdfDocumentModel.load(model.bytes)).images()[0]).toMatchObject({ id, pageIndex: 1, rect: moved })
    await model.undo(); expect(model.images()[0].pageIndex).toBe(0)
    await model.redo(); expect(model.images()[0].pageIndex).toBe(1)
    const before = model.bytes
    await expect(model.updateImage(id, moved, 30, 4 / 3, false, 99)).rejects.toThrow('ui.targetPageUnavailable')
    expect(model.bytes).toEqual(before)
    await model.deleteImage(id); expect(model.images()).toHaveLength(0)
  })

  for (const provider of ['custom', 'claude'] as const) it(`sends the selected PNG using ${provider} vision input and returns the result`, async () => {
    let payload: any
    vi.stubGlobal('window', { desktop: { aiRequest: vi.fn(async (request) => {
      payload = JSON.parse(request.body)
      return { status: 200, statusText: 'OK', body: JSON.stringify(provider === 'claude' ? { content: [{ type: 'text', text: 'Estimated trend' }] } : { choices: [{ message: { content: 'Estimated trend' }, finish_reason: 'stop' }] }) }
    }) } })
    expect(await explainImage({ ...defaultSettings, provider, apiKey: 'test-key', model: 'vision-fixture', thinking: 'disabled' }, 'Estimate coordinates', `data:image/png;base64,${png}`, 'fr')).toBe('Estimated trend')
    const content = payload.messages[0].content
    expect(content[0].type).toBe(provider === 'claude' ? 'image' : 'image_url')
    expect(JSON.stringify(content[0])).toContain(png)
    expect(content[1].text).toContain('estimates, not source data')
    expect(content[1].text).toContain('français')
  })

  it('rejects invalid image input before contacting a provider', async () => {
    await expect(explainImage(defaultSettings, 'Analyze', 'file:///private.png', 'en')).rejects.toThrow('ui.unableToEncodeDrawing')
  })

  it('provides the new controls and prompts in all ten languages', () => {
    for (const language of INTERFACE_LANGUAGES) for (const key of ['crop.smart', 'crop.empty', 'ui.explainImage', 'ui.explainImageSubtitle', 'ui.figureHint', 'ui.figureTrends', 'ui.figureCoordinates', 'ui.figureComparison', 'ui.figureFeatures', 'ui.targetPageUnavailable', 'ui.figureTrendsPrompt', 'ui.figureCoordinatesPrompt', 'ui.figureComparisonPrompt', 'ui.figureFeaturesPrompt'] as const) {
      const text = translateMessage(language, key)
      expect(text).not.toBe(key); expect(text.trim().length).toBeGreaterThan(0)
    }
  })
})
