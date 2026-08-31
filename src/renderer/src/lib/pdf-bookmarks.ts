import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFRef, PDFString } from 'pdf-lib'
import type { PdfBookmark } from '../types'

const MAX_BOOKMARKS = 10_000
const MAX_BOOKMARK_DEPTH = 16
const BOOKMARK_ID = PDFName.of('PDFuckBookmarkId')

function resolved(document: PDFDocument, object?: PDFObject): PDFObject | undefined {
  if (!object) return undefined
  return object instanceof PDFRef ? document.context.lookup(object) : object
}

function dictionary(document: PDFDocument, object?: PDFObject): PDFDict | undefined {
  const value = resolved(document, object)
  return value instanceof PDFDict ? value : undefined
}

function array(document: PDFDocument, object?: PDFObject): PDFArray | undefined {
  const value = resolved(document, object)
  return value instanceof PDFArray ? value : undefined
}

function text(document: PDFDocument, object?: PDFObject): string {
  const value = resolved(document, object)
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText()
  if (value instanceof PDFName) return value.asString().replace(/^\//u, '')
  return ''
}

function number(document: PDFDocument, object?: PDFObject): number | undefined {
  const value = resolved(document, object)
  return value instanceof PDFNumber ? value.asNumber() : undefined
}

function namedDestinationFromTree(document: PDFDocument, object: PDFObject | undefined, name: string, seen = new Set<string>()): PDFObject | undefined {
  const key = object instanceof PDFRef ? object.toString() : ''
  if (key && seen.has(key)) return undefined
  if (key) seen.add(key)
  const tree = dictionary(document, object)
  if (!tree) return undefined
  const names = array(document, tree.get(PDFName.of('Names')))
  if (names) {
    const values = names.asArray()
    for (let index = 0; index + 1 < values.length; index += 2) if (text(document, values[index]) === name) return values[index + 1]
  }
  const kids = array(document, tree.get(PDFName.of('Kids')))
  if (kids) for (const child of kids.asArray()) {
    const found = namedDestinationFromTree(document, child, name, seen)
    if (found) return found
  }
  return undefined
}

function namedDestination(document: PDFDocument, name: string): PDFObject | undefined {
  const legacy = dictionary(document, document.catalog.get(PDFName.of('Dests')))
  const legacyValue = legacy?.get(PDFName.of(name))
  if (legacyValue) return legacyValue
  const names = dictionary(document, document.catalog.get(PDFName.of('Names')))
  return namedDestinationFromTree(document, names?.get(PDFName.of('Dests')), name)
}

function destinationArray(document: PDFDocument, object?: PDFObject): PDFArray | undefined {
  let value = resolved(document, object)
  if (value instanceof PDFName || value instanceof PDFString || value instanceof PDFHexString) value = resolved(document, namedDestination(document, text(document, value)))
  if (value instanceof PDFDict) value = resolved(document, value.get(PDFName.of('D')))
  return value instanceof PDFArray ? value : undefined
}

function bookmarkDestination(document: PDFDocument, item: PDFDict, pages: Map<string, number>): number | undefined {
  let destination = destinationArray(document, item.get(PDFName.of('Dest')))
  if (!destination) {
    const action = dictionary(document, item.get(PDFName.of('A')))
    if (text(document, action?.get(PDFName.of('S'))) === 'GoTo') destination = destinationArray(document, action?.get(PDFName.of('D')))
  }
  const page = destination?.get(0)
  if (page instanceof PDFRef) return pages.get(page.toString())
  const pageNumber = number(document, page)
  return pageNumber !== undefined && Number.isInteger(pageNumber) && pageNumber >= 0 && pageNumber < document.getPageCount() ? pageNumber : undefined
}

function bookmarkColor(document: PDFDocument, object?: PDFObject): string | undefined {
  const values = array(document, object)?.asArray().map((entry) => number(document, entry))
  if (!values || values.length < 3 || values.some((value) => value === undefined)) return undefined
  return `#${values.slice(0, 3).map((value) => Math.round(Math.max(0, Math.min(1, value!)) * 255).toString(16).padStart(2, '0')).join('')}`
}

function bookmarkKey(document: PDFDocument, object: PDFObject, item: PDFDict, path: string): string {
  return text(document, item.get(BOOKMARK_ID)) || (object instanceof PDFRef ? `outline-${object.objectNumber}-${object.generationNumber}` : `outline-${path}`)
}

export function readPdfBookmarks(document: PDFDocument): PdfBookmark[] {
  const root = dictionary(document, document.catalog.get(PDFName.of('Outlines')))
  if (!root) return []
  const pages = new Map(document.getPages().map((page, index) => [page.ref.toString(), index]))
  const seen = new Set<string>()
  let total = 0
  const siblings = (first: PDFObject | undefined, depth: number, path: string): PdfBookmark[] => {
    if (!first || depth > MAX_BOOKMARK_DEPTH || total >= MAX_BOOKMARKS) return []
    const result: PdfBookmark[] = []
    let current: PDFObject | undefined = first
    let sibling = 0
    while (current && total < MAX_BOOKMARKS) {
      const cycleKey = current instanceof PDFRef ? current.toString() : `${path}:${sibling}`
      if (seen.has(cycleKey)) break
      seen.add(cycleKey)
      const item = dictionary(document, current)
      if (!item) break
      const title = text(document, item.get(PDFName.of('Title'))).replace(/\s+/gu, ' ').trim()
      const style = number(document, item.get(PDFName.of('F'))) || 0
      const children = siblings(item.get(PDFName.of('First')), depth + 1, `${path}-${sibling}`)
      const color = bookmarkColor(document, item.get(PDFName.of('C')))
      if (title) {
        total += 1
        result.push({
          id: bookmarkKey(document, current, item, `${path}-${sibling}`), title,
          pageIndex: bookmarkDestination(document, item, pages),
          open: (number(document, item.get(PDFName.of('Count'))) || 0) >= 0,
          ...(style & 2 ? { bold: true } : {}), ...(style & 1 ? { italic: true } : {}),
          ...(color ? { color } : {}), children
        })
      } else result.push(...children)
      current = item.get(PDFName.of('Next'))
      sibling += 1
    }
    return result
  }
  return siblings(root.get(PDFName.of('First')), 0, 'root')
}

function colorValues(value?: string): number[] | undefined {
  const match = value?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu)
  return match ? match.slice(1).map((part) => Number.parseInt(part, 16) / 255) : undefined
}

function visibleDescendants(bookmark: PdfBookmark): number {
  return bookmark.children.reduce((sum, child) => sum + 1 + (child.open ? visibleDescendants(child) : 0), 0)
}

interface WrittenBranch { first?: PDFRef; last?: PDFRef; visible: number }

function writeBranch(document: PDFDocument, bookmarks: PdfBookmark[], parent: PDFRef): WrittenBranch {
  const entries = bookmarks.map((bookmark) => {
    const dict = document.context.obj({})
    return { bookmark, dict, ref: document.context.register(dict) }
  })
  entries.forEach((entry, index) => {
    const { bookmark, dict, ref } = entry
    dict.set(PDFName.of('Title'), PDFHexString.fromText(bookmark.title.trim()))
    dict.set(PDFName.of('Parent'), parent)
    dict.set(BOOKMARK_ID, PDFHexString.fromText(bookmark.id))
    if (index) dict.set(PDFName.of('Prev'), entries[index - 1].ref)
    if (index + 1 < entries.length) dict.set(PDFName.of('Next'), entries[index + 1].ref)
    if (bookmark.pageIndex !== undefined) {
      const page = document.getPage(bookmark.pageIndex)
      dict.set(PDFName.of('Dest'), document.context.obj([page.ref, PDFName.of('Fit')]))
    }
    const style = (bookmark.italic ? 1 : 0) | (bookmark.bold ? 2 : 0)
    if (style) dict.set(PDFName.of('F'), PDFNumber.of(style))
    const color = colorValues(bookmark.color)
    if (color) dict.set(PDFName.of('C'), document.context.obj(color))
    const childBranch = writeBranch(document, bookmark.children, ref)
    if (childBranch.first && childBranch.last) {
      dict.set(PDFName.of('First'), childBranch.first)
      dict.set(PDFName.of('Last'), childBranch.last)
      const count = visibleDescendants(bookmark)
      dict.set(PDFName.of('Count'), PDFNumber.of(bookmark.open ? count : -count))
    }
  })
  return { first: entries[0]?.ref, last: entries.at(-1)?.ref, visible: bookmarks.reduce((sum, item) => sum + 1 + (item.open ? visibleDescendants(item) : 0), 0) }
}

function validateBookmarks(document: PDFDocument, bookmarks: PdfBookmark[]): void {
  const ids = new Set<string>()
  let count = 0
  const visit = (items: PdfBookmark[], depth: number) => {
    if (depth > MAX_BOOKMARK_DEPTH) throw new Error('书签层级过深。')
    items.forEach((item) => {
      count += 1
      if (count > MAX_BOOKMARKS) throw new Error('书签数量过多。')
      if (!item.id || ids.has(item.id)) throw new Error('书签标识无效。')
      ids.add(item.id)
      if (!item.title.trim()) throw new Error('书签文字不能为空。')
      if (item.pageIndex !== undefined && (!Number.isInteger(item.pageIndex) || item.pageIndex < 0 || item.pageIndex >= document.getPageCount())) throw new Error('书签目标页无效。')
      visit(item.children, depth + 1)
    })
  }
  visit(bookmarks, 1)
}

export function replacePdfBookmarks(document: PDFDocument, bookmarks: PdfBookmark[]): void {
  validateBookmarks(document, bookmarks)
  document.catalog.delete(PDFName.of('Outlines'))
  if (!bookmarks.length) {
    if (text(document, document.catalog.get(PDFName.of('PageMode'))) === 'UseOutlines') document.catalog.set(PDFName.of('PageMode'), PDFName.of('UseNone'))
    return
  }
  const root = document.context.obj({ Type: 'Outlines' })
  const rootRef = document.context.register(root)
  const branch = writeBranch(document, bookmarks, rootRef)
  if (branch.first && branch.last) {
    root.set(PDFName.of('First'), branch.first)
    root.set(PDFName.of('Last'), branch.last)
    root.set(PDFName.of('Count'), PDFNumber.of(branch.visible))
  }
  document.catalog.set(PDFName.of('Outlines'), rootRef)
  document.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

export function appendPdfBookmarks(document: PDFDocument, bookmarks: PdfBookmark[]): void {
  validateBookmarks(document, bookmarks)
  if (!bookmarks.length) return
  const usedIds = new Set<string>()
  const collectIds = (items: PdfBookmark[]) => items.forEach((item) => { usedIds.add(item.id); collectIds(item.children) })
  collectIds(readPdfBookmarks(document))
  const uniqueIds = (items: PdfBookmark[]): PdfBookmark[] => items.map((item) => {
    const base = item.id
    let id = base, suffix = 2
    while (usedIds.has(id)) { id = `${base}-${suffix}`; suffix += 1 }
    usedIds.add(id)
    return { ...item, id, children: uniqueIds(item.children) }
  })
  const appended = uniqueIds(bookmarks)
  const outlineObject = document.catalog.get(PDFName.of('Outlines'))
  const outline = dictionary(document, outlineObject)
  if (!outline) { replacePdfBookmarks(document, appended); return }
  const outlineRef = outlineObject instanceof PDFRef ? outlineObject : document.context.register(outline)
  if (!(outlineObject instanceof PDFRef)) document.catalog.set(PDFName.of('Outlines'), outlineRef)
  const branch = writeBranch(document, appended, outlineRef)
  const previousLastObject = outline.get(PDFName.of('Last'))
  const previousLast = dictionary(document, previousLastObject)
  if (previousLast && previousLastObject instanceof PDFRef && branch.first) {
    previousLast.set(PDFName.of('Next'), branch.first)
    dictionary(document, branch.first)?.set(PDFName.of('Prev'), previousLastObject)
  } else if (branch.first) outline.set(PDFName.of('First'), branch.first)
  if (branch.last) outline.set(PDFName.of('Last'), branch.last)
  const previousCount = Math.abs(number(document, outline.get(PDFName.of('Count'))) || 0)
  outline.set(PDFName.of('Count'), PDFNumber.of(previousCount + branch.visible))
  document.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

/**
 * Re-target bookmarks after pages are removed or reordered. A bookmark whose
 * destination page was removed is discarded, while any surviving descendants
 * are promoted so useful navigation is not lost. Bookmarks without a local
 * page destination (for example URI actions) are kept unchanged.
 */
export function remapPdfBookmarks(bookmarks: PdfBookmark[], originalPageOrder: number[]): PdfBookmark[] {
  const newPageIndex = new Map(originalPageOrder.map((pageIndex, index) => [pageIndex, index]))
  const remap = (items: PdfBookmark[]): PdfBookmark[] => items.flatMap((item) => {
    const children = remap(item.children)
    if (item.pageIndex === undefined) return [{ ...item, children }]
    const pageIndex = newPageIndex.get(item.pageIndex)
    return pageIndex === undefined ? children : [{ ...item, pageIndex, children }]
  })
  return remap(bookmarks)
}

export function renamePdfBookmark(document: PDFDocument, id: string, title: string): boolean {
  const normalized = title.replace(/\s+/gu, ' ').trim()
  if (!normalized) throw new Error('书签文字不能为空。')
  const root = dictionary(document, document.catalog.get(PDFName.of('Outlines')))
  if (!root) return false
  const seen = new Set<string>()
  const find = (object?: PDFObject, path = 'root'): PDFDict | undefined => {
    let current = object
    let index = 0
    while (current) {
      const key = current instanceof PDFRef ? current.toString() : `${path}-${index}`
      if (seen.has(key)) return undefined
      seen.add(key)
      const item = dictionary(document, current)
      if (!item) return undefined
      if (bookmarkKey(document, current, item, `${path}-${index}`) === id) return item
      const child = find(item.get(PDFName.of('First')), `${path}-${index}`)
      if (child) return child
      current = item.get(PDFName.of('Next'))
      index += 1
    }
    return undefined
  }
  const item = find(root.get(PDFName.of('First')))
  if (!item) return false
  item.set(PDFName.of('Title'), PDFHexString.fromText(normalized))
  item.set(BOOKMARK_ID, PDFHexString.fromText(id))
  return true
}

/** Delete one bookmark while promoting its direct children into the deleted
 * item's position. Promotion avoids silently discarding useful navigation and
 * matches the page-removal behavior used elsewhere in the editor. */
export function deletePdfBookmark(document: PDFDocument, id: string): boolean {
  let found = false
  const remove = (items: PdfBookmark[]): PdfBookmark[] => items.flatMap((item) => {
    const children = remove(item.children)
    if (item.id !== id) return [{ ...item, children }]
    found = true
    return children
  })
  const next = remove(readPdfBookmarks(document))
  if (found) replacePdfBookmarks(document, next)
  return found
}
