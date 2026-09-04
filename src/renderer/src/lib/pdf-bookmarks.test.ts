import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { PdfBookmark } from '../types'
import { appendPdfBookmarks, deletePdfBookmark, readPdfBookmarks, remapPdfBookmarks, renamePdfBookmark, replacePdfBookmarks } from './pdf-bookmarks'
import { PdfDocumentModel } from './pdf-document'

function sampleBookmarks(): PdfBookmark[] {
  return [{
    id: 'intro', title: '引言', pageIndex: 0, open: true, bold: true, children: [
      { id: 'scope', title: '1.1 Scope', pageIndex: 1, open: true, italic: true, color: '#3157d5', children: [] }
    ]
  }, { id: 'conclusion', title: '结论', pageIndex: 2, open: true, children: [] }]
}

async function sourcePdf(): Promise<PDFDocument> {
  const document = await PDFDocument.create()
  document.addPage(); document.addPage(); document.addPage()
  return document
}

describe('PDF bookmark outlines', () => {
  it('writes a standards-compatible hierarchy and reads its destinations and styles', async () => {
    const document = await sourcePdf()
    replacePdfBookmarks(document, sampleBookmarks())
    const reopened = await PDFDocument.load(await document.save({ useObjectStreams: false }))
    expect(readPdfBookmarks(reopened)).toEqual(sampleBookmarks())
  })

  it('round-trips an exact vertical destination within a page', async () => {
    const document = await sourcePdf()
    const positioned: PdfBookmark[] = [{ id: 'middle', title: 'Middle', pageIndex: 1, position: .375, open: true, children: [] }]
    replacePdfBookmarks(document, positioned)
    const reopened = await PDFDocument.load(await document.save({ useObjectStreams: false }))
    expect(readPdfBookmarks(reopened)).toEqual(positioned)
  })

  it('appends roots without replacing existing bookmark objects', async () => {
    const document = await sourcePdf()
    replacePdfBookmarks(document, sampleBookmarks().slice(0, 1))
    appendPdfBookmarks(document, sampleBookmarks().slice(1))
    appendPdfBookmarks(document, sampleBookmarks().slice(1))
    const bookmarks = readPdfBookmarks(document)
    expect(bookmarks.map((item) => item.title)).toEqual(['引言', '结论', '结论'])
    expect(new Set(bookmarks.map((item) => item.id)).size).toBe(3)
  })

  it('renames one outline item in place and keeps its descendants', async () => {
    const document = await sourcePdf()
    replacePdfBookmarks(document, sampleBookmarks())
    expect(renamePdfBookmark(document, 'intro', 'Introduction')).toBe(true)
    const bookmarks = readPdfBookmarks(document)
    expect(bookmarks[0].title).toBe('Introduction')
    expect(bookmarks[0].children[0].title).toBe('1.1 Scope')
  })

  it('deletes exactly one outline item and promotes its children', async () => {
    const document = await sourcePdf()
    replacePdfBookmarks(document, sampleBookmarks())
    expect(deletePdfBookmark(document, 'intro')).toBe(true)
    expect(readPdfBookmarks(document)).toEqual([
      { id: 'scope', title: '1.1 Scope', pageIndex: 1, open: true, italic: true, color: '#3157d5', children: [] },
      sampleBookmarks()[1]
    ])
    expect(deletePdfBookmark(document, 'missing')).toBe(false)
  })

  it('re-targets retained pages and removes dead destinations while promoting surviving children', () => {
    const withPromotedChild: PdfBookmark[] = [{ id: 'removed-parent', title: 'Removed parent', pageIndex: 1, open: true, children: [{ id: 'kept-child', title: 'Kept child', pageIndex: 2, open: true, children: [] }] }]
    expect(remapPdfBookmarks(sampleBookmarks(), [2, 0])).toEqual([
      { ...sampleBookmarks()[0], pageIndex: 1, children: [] },
      { ...sampleBookmarks()[1], pageIndex: 0 }
    ])
    expect(remapPdfBookmarks(withPromotedChild, [2, 0])).toEqual([{ id: 'kept-child', title: 'Kept child', pageIndex: 0, open: true, children: [] }])
  })

  it('keeps bookmark targets correct when model pages are reordered or removed', async () => {
    const document = await sourcePdf()
    const model = await PdfDocumentModel.load(await document.save({ useObjectStreams: false }))
    await model.replaceBookmarks(sampleBookmarks())
    await model.arrangePages([2, 0])
    expect(model.bookmarks()).toEqual([
      { ...sampleBookmarks()[0], pageIndex: 1, children: [] },
      { ...sampleBookmarks()[1], pageIndex: 0 }
    ])
    await model.deletePage(0)
    expect(model.bookmarks()).toEqual([{ ...sampleBookmarks()[0], pageIndex: 0, children: [] }])
  })

  it('participates in model dirty state, undo, redo and deletion', async () => {
    const document = await sourcePdf()
    const model = await PdfDocumentModel.load(await document.save({ useObjectStreams: false }))
    await model.replaceBookmarks(sampleBookmarks())
    expect(model.dirty).toBe(true)
    expect(model.bookmarks()).toHaveLength(2)
    await model.renameBookmark('scope', '1.1 New scope')
    expect(model.bookmarks()[0].children[0].title).toBe('1.1 New scope')
    await model.undo()
    expect(model.bookmarks()[0].children[0].title).toBe('1.1 Scope')
    await model.redo()
    expect(model.bookmarks()[0].children[0].title).toBe('1.1 New scope')
    await model.deleteBookmark('intro')
    expect(model.bookmarks().map((item) => item.id)).toEqual(['scope', 'conclusion'])
    await model.undo()
    expect(model.bookmarks()[0].id).toBe('intro')
    await model.deleteAllBookmarks()
    expect(model.bookmarks()).toEqual([])
  })
})
