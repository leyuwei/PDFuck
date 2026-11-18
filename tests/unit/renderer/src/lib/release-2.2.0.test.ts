import { PDFDocument, PDFName, PDFString, degrees } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { bookmarkFocusRects } from '../../../../../src/renderer/src/lib/bookmark-focus'
import { readPdfBookmarks, replacePdfBookmarks } from '../../../../../src/renderer/src/lib/pdf-bookmarks'
import { pdfJsDestination } from '../../../../../src/renderer/src/lib/pdfjs-links'
import { PdfDocumentModel } from '../../../../../src/renderer/src/lib/pdf-document'
import { revealFocusRect } from '../../../../../src/renderer/src/lib/focus-navigation'
import type { WordBox } from '../../../../../src/renderer/src/lib/text-layout'

const word = (text: string, x: number, y: number, order: number, column = Number(x >= 300)): WordBox => ({
  text, order, column, columnBoundaries: [300], rect: { x, y, width: 65, height: 12 }, lineBreakAfter: true
})

describe('bookmark destinations', () => {
  const words = [
    word('Repeated', 55, 160, 0),
    word('Other text', 55, 360, 1),
    word('Repeated', 345, 160, 2),
    word('Repeated', 345, 360, 3)
  ]
  it('uses both axes to locate a repeated title', () => {
    expect(bookmarkFocusRects(words, 800, .45, 'Repeated', 345)).toEqual([words[3].rect])
    expect(bookmarkFocusRects(words, 800, .2, 'Repeated', 345)).toEqual([words[2].rect])
  })
  it('locates only the requested column when a bookmark has been renamed', () => {
    expect(bookmarkFocusRects(words, 800, .2, 'Custom label', 344)).toEqual([words[2].rect])
    expect(bookmarkFocusRects(words, 800, .2, 'Custom label')).toEqual([])
  })
  it('finds a heading in a legacy destination that only stores a vertical offset', () => {
    expect(bookmarkFocusRects(words, 800, .45, 'Repeated')).toEqual([words[3].rect])
  })
  it.each([0, 90, 180, 270])('round-trips rotated and cropped destinations at %i°', async (rotation) => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([600, 800])
    page.setCropBox(20, 50, 500, 700)
    page.setRotation(degrees(rotation))
    const outline = pdf.context.obj({})
    const parent = pdf.context.register(outline)
    const ref = pdf.context.register(pdf.context.obj({
      Title: PDFString.of('Right column'), Parent: parent, Dest: [page.ref, 'XYZ', 370, 610, null]
    }))
    outline.set(PDFName.of('First'), ref)
    outline.set(PDFName.of('Last'), ref)
    pdf.catalog.set(PDFName.of('Outlines'), parent)

    const [bookmark] = readPdfBookmarks(pdf)
    const positions = {
      0: [.7, .2], 90: [.8, .7], 180: [.3, .8], 270: [.2, .3]
    }[rotation]!
    expect(bookmark.horizontalPosition).toBeCloseTo(positions[0])
    expect(bookmark.position).toBeCloseTo(positions[1])
    replacePdfBookmarks(pdf, [{ ...bookmark, title: 'Renamed' }])
    const [reopened] = readPdfBookmarks(await PDFDocument.load(await pdf.save()))
    expect(reopened.horizontalPosition).toBeCloseTo(positions[0])
    expect(reopened.position).toBeCloseTo(positions[1])
  })
  it('keeps an outline destination on the same content after rotating and reordering pages', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([600, 800])
    pdf.addPage([600, 800])
    replacePdfBookmarks(pdf, [{ id: 'section', title: 'Section', pageIndex: 0, position: .25, horizontalPosition: .75, open: true, children: [] }])
    const model = await PdfDocumentModel.load(await pdf.save())
    await model.arrangePages([1, 0], { 0: 90 })
    expect(model.bookmarks()[0]).toMatchObject({ pageIndex: 1, position: .75, horizontalPosition: .75 })
  })
  it('uses PDF.js display coordinates for a read-only destination', async () => {
    const source = {
      getPageIndex: async () => 0,
      getDestination: async () => [0, { name: 'FitR' }, 370, 580, 490, 610],
      getPage: async () => ({
        view: [20, 50, 520, 750],
        getViewport: () => ({ width: 700, height: 500, transform: [0, 1, 1, 0, -50, -20] })
      })
    }
    await expect(pdfJsDestination(source, 'chapter')).resolves.toEqual({ pageIndex: 0, horizontalPosition: .8, position: .7 })
  })
})

it('centers even an already-visible target while preserving horizontal scroll', () => {
  const scrollTo = vi.fn()
  const viewport = { getBoundingClientRect: () => ({ left: 20, top: 10 }), clientWidth: 500, clientHeight: 400,
    clientLeft: 0, clientTop: 0, scrollHeight: 1400, scrollTop: 300, scrollLeft: 12, scrollTo } as unknown as HTMLElement
  const page = { getBoundingClientRect: () => ({ left: 45, top: -50 }) } as unknown as HTMLElement
  revealFocusRect(viewport, page, { x: 60, y: 70, width: 100, height: 20 }, 2)
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 200, left: 12, behavior: 'instant' })
})

async function annotatedModel() {
  const pdf = await PDFDocument.create()
  for (const [pageIndex, page] of [pdf.addPage(), pdf.addPage()].entries()) {
    const annotations = [
      { Subtype: 'Text', Rect: [10, 10, 30, 30], NM: PDFString.of(`part-${pageIndex}`), PDFuckGroup: PDFString.of('group') },
      { Subtype: 'Text', Rect: [20, 40, 40, 60], Contents: PDFString.of(`legacy-${pageIndex}`) },
      { Subtype: 'Link', Rect: [20, 70, 40, 80], NM: PDFString.of(`link-${pageIndex}`) }
    ]
    for (const annotation of annotations) {
      const dictionary = pdf.context.obj({ Type: 'Annot', ...annotation })
      if (annotation.Contents && !pageIndex) page.node.Annots()!.push(dictionary)
      else page.node.addAnnot(pdf.context.register(dictionary))
    }
  }
  return PdfDocumentModel.load(await pdf.save())
}

it('deletes grouped and legacy annotations with one serialization and one undo', async () => {
  const model = await annotatedModel()
  const save = vi.spyOn(PDFDocument.prototype, 'save')
  try {
    const legacy = model.annotations().find(annotation => annotation.content === 'legacy-0')!
    expect(legacy.pdfAnnotationId).toBeUndefined()
    await expect(model.deleteAnnotations(['part-0', 'part-1', legacy.id, legacy.id, 'link-0', 'stale'])).resolves.toBe(2)
    expect(save).toHaveBeenCalledTimes(1)
    expect(model.annotations().map(annotation => annotation.content)).toEqual(['legacy-1'])
    const reopened = await PDFDocument.load(model.bytes)
    expect(reopened.getPages().map(page => page.node.Annots()?.size())).toEqual([1, 2])
    await expect(model.deleteAnnotations(['part-0', 'stale'])).resolves.toBe(0)
    expect(save).toHaveBeenCalledTimes(1)
    await model.undo()
    expect(model.annotations()).toHaveLength(4)
    expect(model.canUndo).toBe(false)
    await model.redo()
    expect(model.annotations()).toHaveLength(1)
  } finally { save.mockRestore() }
})

it('restores all annotation entries if batch serialization fails', async () => {
  const model = await annotatedModel()
  const save = vi.spyOn(PDFDocument.prototype, 'save').mockRejectedValueOnce(new Error('write failed'))
  try {
    const before = model.annotations()
    const bytes = model.bytes
    await expect(model.deleteAnnotations(before.map(({ id }) => id))).rejects.toThrow('write failed')
    expect(model.annotations()).toEqual(before)
    expect(model.bytes).toEqual(bytes)
    expect(model.canUndo).toBe(false)
    await expect(model.deleteAnnotation('part-1')).resolves.toBe(true)
    expect(model.annotations()).toHaveLength(2)
  } finally { save.mockRestore() }
})
