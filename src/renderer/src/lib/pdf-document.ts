import {
  PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFRawStream, PDFRef, PDFString,
  StandardFonts, degrees, rgb, type PDFFont, type PDFPage
} from 'pdf-lib'
import type { AnnotationKind, AnnotationRecord, AnnotationReply, AnnotationReplyStatus, ImageObjectRecord, PageNumberRecord, PageNumberSettings, PdfBookmark, PdfPoint, PdfRect, TextObjectRecord, TextStyle } from '../types'
import { clampRectDelta, rectUnion } from './geometry'
import {
  applyMatrix, displayRectToPdfBounds, displayRectsToPdfQuads, inverseMatrix, pageViewportMatrix, pdfBoundsToDisplayRect, pdfQuadsToDisplayRects,
  type PageGeometry
} from './page-coordinates'
import { fontCategory, normalizeFontFamily } from './text-fonts'
import { DEFAULT_ANNOTATION_COLOR, normalizeHexColor } from './annotation-style'
import { rotatedImageBounds } from './image-geometry'
import { DEFAULT_PAGE_NUMBER_SETTINGS, formatPageNumber, pageNumberRect, validatePageNumberTemplate } from './page-numbers'
import type { PdfImportFile } from '../../../shared/contracts'
import { normalizeAnnotationAuthor } from './annotation-author'
import { appendPdfBookmarks, deletePdfBookmark, readPdfBookmarks, remapPdfBookmarks, renamePdfBookmark, replacePdfBookmarks } from './pdf-bookmarks'
import { translateMessage, type TranslationKey } from '../../../shared/i18n-catalogue'

const KIND_LABEL: Record<AnnotationKind, TranslationKey> = {
  highlight: "ui.highlightText", note: "ui.note", replace: "ui.replaceText", insert: "ui.insertText", delete: "ui.deleteText", underline: "ui.underlineText", ai_polish: "ui.aiPolish"
}

const MAX_HISTORY_ENTRIES = 40
const MAX_HISTORY_BYTES = 256 * 1024 * 1024

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function hexColor(value: string): [number, number, number] {
  const hex = value.replace('#', '').padEnd(6, '0')
  return [Number.parseInt(hex.slice(0, 2), 16) / 255, Number.parseInt(hex.slice(2, 4), 16) / 255, Number.parseInt(hex.slice(4, 6), 16) / 255]
}

function rgbArrayToHex(values: number[], fallback: string): string {
  if (values.length < 3) return fallback
  return `#${values.slice(0, 3).map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('')}`
}

function pdfString(value: string): PDFHexString { return PDFHexString.fromText(value) }

function decodeObject(document: PDFDocument, object?: PDFObject): string {
  if (!object) return ''
  const resolved = object instanceof PDFRef ? document.context.lookup(object) : object
  if (resolved instanceof PDFString || resolved instanceof PDFHexString) return resolved.decodeText()
  if (resolved instanceof PDFName) return resolved.asString().replace(/^\//, '')
  return ''
}

function numberArray(document: PDFDocument, object?: PDFObject): number[] {
  if (!object) return []
  const resolved = object instanceof PDFRef ? document.context.lookup(object) : object
  if (!(resolved instanceof PDFArray)) return []
  return resolved.asArray().map((entry) => {
    const value = entry instanceof PDFRef ? document.context.lookup(entry) : entry
    return value instanceof PDFNumber ? value.asNumber() : 0
  })
}

function numberValue(document: PDFDocument, object: PDFObject | undefined, fallback: number): number {
  if (!object) return fallback
  const resolved = object instanceof PDFRef ? document.context.lookup(object) : object
  return resolved instanceof PDFNumber ? resolved.asNumber() : fallback
}

function pageTextSourceKey(pageIndex: number, rects: PdfRect[]): string {
  const normalized = rects
    .map((rect) => [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100))
    .sort((left, right) => left[1] - right[1] || left[0] - right[0] || left[2] - right[2] || left[3] - right[3])
  return `${pageIndex}:${JSON.stringify(normalized)}`
}

function decodePageTextRects(document: PDFDocument, object?: PDFObject): PdfRect[] {
  try {
    const value = JSON.parse(decodeObject(document, object))
    if (!Array.isArray(value)) return []
    return value.flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length !== 4 || entry.some((number) => !Number.isFinite(number))) return []
      const [x, y, width, height] = entry as number[]
      return width > 0 && height > 0 ? [{ x, y, width, height }] : []
    })
  } catch { return [] }
}

function encodePageTextRects(rects: PdfRect[]): string {
  return JSON.stringify(rects.map(({ x, y, width, height }) => [x, y, width, height]))
}

function embeddedBytes(document: PDFDocument, object?: PDFObject): Uint8Array | undefined {
  if (!object) return undefined
  const stream = object instanceof PDFRef ? document.context.lookup(object) : object
  return stream instanceof PDFRawStream ? Uint8Array.from(stream.getContents()) : undefined
}

function pageGeometry(page: PDFPage): PageGeometry {
  const crop = page.getCropBox()
  return { ...crop, rotation: page.getRotation().angle }
}

function subtypeFor(kind: AnnotationKind): string {
  if (kind === 'ai_polish') return 'Text'
  if (kind === 'note') return 'Text'
  if (kind === 'insert') return 'Caret'
  if (kind === 'underline') return 'Underline'
  if (kind === 'highlight') return 'Highlight'
  return 'StrikeOut'
}

function kindFor(dict: PDFDict, document: PDFDocument): AnnotationKind | null {
  const subtype = decodeObject(document, dict.get(PDFName.of('Subtype')))
  const subject = decodeObject(document, dict.get(PDFName.of('Subj'))).toLowerCase()
  if (subject.includes('ai_polish') || subject.includes('智能润色')) return 'ai_polish'
  if (subtype === 'Highlight') return 'highlight'
  if (subtype === 'Text') return 'note'
  if (subtype === 'Caret') return 'insert'
  if (subtype === 'Underline') return 'underline'
  if (subtype === 'StrikeOut') return subject.includes('replace') || subject.includes('替换') ? 'replace' : 'delete'
  return null
}

interface AnnotationEntry { dict: PDFDict; ref?: PDFRef; index: number; page: PDFPage; pageIndex: number }

export class PdfDocumentModel {
  private document!: PDFDocument
  private currentBytes: Uint8Array<ArrayBufferLike> = new Uint8Array()
  private savedBytes: Uint8Array<ArrayBufferLike> = new Uint8Array()
  private undoStack: Uint8Array<ArrayBufferLike>[] = []
  private redoStack: Uint8Array<ArrayBufferLike>[] = []
  private externallyDirty = false
  private pageTextEditQueues = new Map<string, Promise<void>>()
  filePath?: string
  fileName = '未命名.pdf'
  dirty = false

  static async load(data: Uint8Array, path?: string, name?: string): Promise<PdfDocumentModel> {
    const model = new PdfDocumentModel()
    model.document = await PDFDocument.load(data, { updateMetadata: false })
    model.currentBytes = new Uint8Array(data)
    model.savedBytes = new Uint8Array(data)
    model.filePath = path
    model.fileName = name || path?.split(/[\\/]/).pop() || '未命名.pdf'
    return model
  }

  /** Start an untitled document for workflows, such as file merging, that add pages immediately. */
  static async create(name = '未命名.pdf'): Promise<PdfDocumentModel> {
    const document = await PDFDocument.create()
    return PdfDocumentModel.load(await document.save({ useObjectStreams: false, addDefaultPage: false }), undefined, name)
  }

  get bytes(): Uint8Array { return Uint8Array.from(this.currentBytes) }
  get pageCount(): number { return this.document.getPageCount() }
  get canUndo(): boolean { return this.undoStack.length > 0 }
  get canRedo(): boolean { return this.redoStack.length > 0 }
  bookmarks(): PdfBookmark[] { return readPdfBookmarks(this.document) }

  async replaceBookmarks(bookmarks: PdfBookmark[]): Promise<void> {
    replacePdfBookmarks(this.document, bookmarks)
    await this.commit()
  }

  async appendBookmarks(bookmarks: PdfBookmark[]): Promise<void> {
    appendPdfBookmarks(this.document, bookmarks)
    await this.commit()
  }

  async renameBookmark(id: string, title: string): Promise<void> {
    if (!renamePdfBookmark(this.document, id, title)) throw new Error('找不到这条书签，它可能已经被删除。')
    await this.commit()
  }

  async deleteBookmark(id: string): Promise<void> {
    if (!deletePdfBookmark(this.document, id)) throw new Error('找不到这条书签，它可能已经被删除。')
    await this.commit()
  }

  async deleteAllBookmarks(): Promise<void> {
    if (!this.bookmarks().length) return
    replacePdfBookmarks(this.document, [])
    await this.commit()
  }
  async pageSubset(pageIndices: number[]): Promise<Uint8Array> {
    const pages = [...new Set(pageIndices)]
    if (!pages.length) throw new Error('请至少选择一个页面。')
    if (pages.some((page) => page < 0 || page >= this.pageCount)) throw new Error('选择的页码超出了文档范围。')
    const subset = await PDFDocument.create()
    const copies = await subset.copyPages(this.document, pages)
    copies.forEach((page) => subset.addPage(page))
    return Uint8Array.from(await subset.save({ useObjectStreams: false, addDefaultPage: false }))
  }
  getPageSize(pageIndex: number): { width: number; height: number } {
    const page = this.document.getPage(pageIndex)
    const crop = page.getCropBox()
    return page.getRotation().angle % 180 === 0 ? { width: crop.width, height: crop.height } : { width: crop.height, height: crop.width }
  }

  private trimHistory(stack: Uint8Array<ArrayBufferLike>[]): void {
    while (stack.length > MAX_HISTORY_ENTRIES) stack.shift()
    let total = stack.reduce((sum, bytes) => sum + bytes.byteLength, 0)
    while (stack.length > 1 && total > MAX_HISTORY_BYTES) total -= stack.shift()!.byteLength
  }

  private async commit(): Promise<void> {
    const previous = Uint8Array.from(this.currentBytes)
    const next = Uint8Array.from(await this.document.save({ useObjectStreams: false, addDefaultPage: false }))
    if (!sameBytes(previous, next)) {
      this.undoStack.push(previous)
      this.trimHistory(this.undoStack)
      this.redoStack = []
    }
    this.currentBytes = next
    this.dirty = this.externallyDirty || !sameBytes(this.currentBytes, this.savedBytes)
  }

  private async restoreHistory(bytes: Uint8Array<ArrayBufferLike>): Promise<void> {
    this.currentBytes = Uint8Array.from(bytes)
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
    this.dirty = this.externallyDirty || !sameBytes(this.currentBytes, this.savedBytes)
  }

  async undo(): Promise<void> {
    const previous = this.undoStack.pop()
    if (!previous) return
    this.redoStack.push(Uint8Array.from(this.currentBytes)); this.trimHistory(this.redoStack)
    await this.restoreHistory(previous)
  }

  async redo(): Promise<void> {
    const next = this.redoStack.pop()
    if (!next) return
    this.undoStack.push(Uint8Array.from(this.currentBytes)); this.trimHistory(this.undoStack)
    await this.restoreHistory(next)
  }

  markSaved(path: string): void {
    this.filePath = path
    this.fileName = path.split(/[\\/]/).pop() || this.fileName
    this.savedBytes = Uint8Array.from(this.currentBytes)
    this.externallyDirty = false
    this.dirty = false
  }

  /**
   * A document moved to another window has already been serialized. Keep its
   * unsaved indicator until the next explicit save without manufacturing an
   * artificial undo entry in the destination window.
   */
  markUnsaved(): void {
    this.externallyDirty = true
    this.dirty = true
  }

  async cropPage(pageIndex: number, rect: PdfRect): Promise<void> {
    const page = this.document.getPage(pageIndex)
    const [left, bottom, right, top] = displayRectToPdfBounds(rect, pageGeometry(page))
    page.setCropBox(left, bottom, Math.max(1, right - left), Math.max(1, top - bottom))
    await this.commit()
  }

  async deletePage(pageIndex: number): Promise<void> {
    if (this.pageCount <= 1) throw new Error('不能删除文档中的最后一页。')
    await this.deletePages([pageIndex])
  }

  async deletePages(pageIndices: number[]): Promise<void> {
    const pages = [...new Set(pageIndices)].sort((a, b) => b - a)
    if (!pages.length) throw new Error('请至少选择一个要删除的页面。')
    if (pages.some((page) => page < 0 || page >= this.pageCount)) throw new Error('选择的页码超出了文档范围。')
    if (pages.length >= this.pageCount) throw new Error('不能删除文档中的全部页面。')
    const bookmarks = this.bookmarks()
    const removed = new Set(pages)
    const remainingPageOrder = this.document.getPageIndices().filter((page) => !removed.has(page))
    pages.forEach((page) => this.document.removePage(page))
    if (bookmarks.length) {
      // Refresh pdf-lib's cached page wrappers before resolving the new outline
      // destinations; otherwise a removed page reference can be written back.
      this.document = await PDFDocument.load(await this.document.save({ useObjectStreams: false }), { updateMetadata: false })
      replacePdfBookmarks(this.document, remapPdfBookmarks(bookmarks, remainingPageOrder))
    }
    await this.commit()
    // pdf-lib caches page wrappers; reload after structural edits so later page indices
    // always refer to the actual remaining pages.
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
  }

  /** Insert PDFs or raster image files at a single document position, preserving source order. */
  async importFiles(files: PdfImportFile[], insertionIndex = this.pageCount): Promise<void> {
    if (!files.length) throw new Error('请至少选择一个要导入的文件。')
    if (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > this.pageCount) throw new Error('插入位置无效。')
    let nextIndex = insertionIndex
    for (const file of files) {
      if (file.format === 'pdf') {
        const source = await PDFDocument.load(file.data, { updateMetadata: false })
        const pages = await this.document.copyPages(source, source.getPageIndices())
        pages.forEach((page) => { this.document.insertPage(nextIndex, page); nextIndex += 1 })
      } else {
        const image = file.format === 'png' ? await this.document.embedPng(file.data) : await this.document.embedJpg(file.data)
        const page = this.document.insertPage(nextIndex, [image.width, image.height])
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
        nextIndex += 1
      }
    }
    await this.commit()
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
  }

  private imageEntries(): AnnotationEntry[] {
    return this.annotationEntries().filter((entry) => decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckImage'))) === 'true')
  }

  private imageData(dict: PDFDict): Uint8Array {
    const object = dict.get(PDFName.of('PDFuckImageData'))
    const stream = object instanceof PDFRef ? this.document.context.lookup(object) : object
    if (!(stream instanceof PDFRawStream)) throw new Error('图片的可编辑数据已损坏。')
    return Uint8Array.from(stream.getContents())
  }

  private imageRecord(entry: AnnotationEntry): ImageObjectRecord {
    const dict = entry.dict
    const format = decodeObject(this.document, dict.get(PDFName.of('PDFuckImageFormat'))).toLowerCase() === 'jpg' ? 'jpg' : 'png'
    const rect: PdfRect = {
      x: numberValue(this.document, dict.get(PDFName.of('PDFuckImageX')), 0),
      y: numberValue(this.document, dict.get(PDFName.of('PDFuckImageY')), 0),
      width: numberValue(this.document, dict.get(PDFName.of('PDFuckImageWidth')), 1),
      height: numberValue(this.document, dict.get(PDFName.of('PDFuckImageHeight')), 1)
    }
    const id = decodeObject(this.document, dict.get(PDFName.of('NM'))) || `${entry.pageIndex}:${entry.ref?.toString() || entry.index}`
    const aspectRatio = numberValue(this.document, dict.get(PDFName.of('PDFuckImageAspectRatio')), rect.width / Math.max(1, rect.height))
    return {
      id,
      pageIndex: entry.pageIndex,
      name: decodeObject(this.document, dict.get(PDFName.of('PDFuckImageName'))) || 'image',
      data: this.imageData(dict),
      format,
      rect,
      aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : rect.width / Math.max(1, rect.height),
      lockAspectRatio: decodeObject(this.document, dict.get(PDFName.of('PDFuckImageLock'))) !== 'false',
      rotation: numberValue(this.document, dict.get(PDFName.of('PDFuckImageRotation')), 0)
    }
  }

  images(): ImageObjectRecord[] {
    return this.imageEntries().flatMap((entry) => {
      try { return [this.imageRecord(entry)] } catch { return [] }
    })
  }

  private findImage(id: string): AnnotationEntry {
    const entry = this.imageEntries().find((candidate) => {
      const current = decodeObject(this.document, candidate.dict.get(PDFName.of('NM'))) || `${candidate.pageIndex}:${candidate.ref?.toString() || candidate.index}`
      return current === id
    })
    if (!entry) throw new Error('找不到这张图片，它可能已经被删除。')
    return entry
  }

  private validImageRect(rect: PdfRect): void {
    if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) throw new Error('图片位置或尺寸无效。')
  }

  private async imageAppearance(page: PDFPage, data: Uint8Array, format: 'png' | 'jpg', rect: PdfRect, rotation: number): Promise<{ bounds: number[]; appearance: PDFRef }> {
    const image = format === 'png' ? await this.document.embedPng(data) : await this.document.embedJpg(data)
    const geometry = pageGeometry(page)
    const inverse = inverseMatrix(pageViewportMatrix(geometry))
    const screenAngle = ((rotation % 360) + 360) % 360 * Math.PI / 180
    const cosine = Math.cos(screenAngle), sine = Math.sin(screenAngle)
    const pdfXAxis = { x: inverse[0] * cosine + inverse[2] * sine, y: inverse[1] * cosine + inverse[3] * sine }
    const angle = Math.atan2(pdfXAxis.y, pdfXAxis.x)
    const a = Math.cos(angle) * rect.width, b = Math.sin(angle) * rect.width
    const c = -Math.sin(angle) * rect.height, d = Math.cos(angle) * rect.height
    const xs = [0, a, c, a + c], ys = [0, b, d, b + d]
    const localWidth = Math.max(...xs) - Math.min(...xs), localHeight = Math.max(...ys) - Math.min(...ys)
    const displayBounds = rotatedImageBounds(rect, rotation)
    const bounds = displayRectToPdfBounds(displayBounds, geometry)
    const appearance = this.document.context.flateStream(`q ${a} ${b} ${c} ${d} ${-Math.min(...xs)} ${-Math.min(...ys)} cm /Im0 Do Q`, {
      Type: 'XObject', Subtype: 'Form', FormType: 1, BBox: [0, 0, Math.max(1, localWidth), Math.max(1, localHeight)], Resources: { XObject: { Im0: image.ref } }
    })
    return { bounds, appearance: this.document.context.register(appearance) }
  }

  private async writeImageAnnotation(dict: PDFDict, page: PDFPage, data: Uint8Array, format: 'png' | 'jpg', name: string, rect: PdfRect, rotation: number, aspectRatio: number, lockAspectRatio: boolean): Promise<void> {
    const preview = await this.imageAppearance(page, data, format, rect, rotation)
    dict.set(PDFName.of('Type'), PDFName.of('Annot'))
    dict.set(PDFName.of('Subtype'), PDFName.of('Stamp'))
    dict.set(PDFName.of('Rect'), this.document.context.obj(preview.bounds))
    dict.set(PDFName.of('Contents'), pdfString(name))
    dict.set(PDFName.of('T'), pdfString('PDFuck'))
    dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    dict.set(PDFName.of('F'), PDFNumber.of(4))
    dict.set(PDFName.of('AP'), this.document.context.obj({ N: preview.appearance }))
    dict.set(PDFName.of('PDFuckImage'), PDFName.of('true'))
    dict.set(PDFName.of('PDFuckImageFormat'), PDFName.of(format))
    dict.set(PDFName.of('PDFuckImageName'), pdfString(name))
    dict.set(PDFName.of('PDFuckImageX'), PDFNumber.of(rect.x))
    dict.set(PDFName.of('PDFuckImageY'), PDFNumber.of(rect.y))
    dict.set(PDFName.of('PDFuckImageWidth'), PDFNumber.of(rect.width))
    dict.set(PDFName.of('PDFuckImageHeight'), PDFNumber.of(rect.height))
    dict.set(PDFName.of('PDFuckImageRotation'), PDFNumber.of(rotation))
    dict.set(PDFName.of('PDFuckImageAspectRatio'), PDFNumber.of(aspectRatio))
    dict.set(PDFName.of('PDFuckImageLock'), PDFName.of(lockAspectRatio ? 'true' : 'false'))
  }

  /** Add a portable Stamp annotation with source bytes and geometry metadata. */
  async addImage(pageIndex: number, data: Uint8Array, format: 'png' | 'jpg', rect: PdfRect, rotation = 0, name = 'image', aspectRatio = rect.width / Math.max(1, rect.height), lockAspectRatio = true): Promise<string> {
    if (!data.length) throw new Error('导入的图片没有可用内容。')
    if (pageIndex < 0 || pageIndex >= this.pageCount) throw new Error('要添加图片的页面不存在。')
    this.validImageRect(rect)
    const page = this.document.getPage(pageIndex)
    const dictionary = this.document.context.obj({})
    const id = `pdfuck-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    dictionary.set(PDFName.of('NM'), pdfString(id))
    dictionary.set(PDFName.of('PDFuckImageData'), this.document.context.register(this.document.context.stream(Uint8Array.from(data), { Type: 'EmbeddedFile' })))
    await this.writeImageAnnotation(dictionary, page, data, format, name, rect, rotation, aspectRatio, lockAspectRatio)
    page.node.addAnnot(this.document.context.register(dictionary))
    await this.commit()
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
    return id
  }

  async updateImage(id: string, rect: PdfRect, rotation: number, aspectRatio: number, lockAspectRatio: boolean): Promise<void> {
    this.validImageRect(rect)
    const entry = this.findImage(id), record = this.imageRecord(entry)
    await this.writeImageAnnotation(entry.dict, entry.page, record.data, record.format, record.name, rect, rotation, aspectRatio, lockAspectRatio)
    await this.commit()
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
  }

  async deleteImage(id: string): Promise<void> {
    const entry = this.findImage(id)
    entry.page.node.Annots()?.remove(entry.index)
    await this.commit()
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
  }

  /** Rebuild the page tree in the caller's explicit order. */
  async reorderPages(pageIndices: number[]): Promise<void> {
    if (pageIndices.length !== this.pageCount) throw new Error('页面排序无效。')
    await this.arrangePages(pageIndices)
  }

  /** Keep and arrange the supplied original page indices in a single undoable edit. */
  async arrangePages(pageIndices: number[], rotations: Record<number, number> = {}): Promise<void> {
    const rotationEntries = Object.entries(rotations).map(([page, rotation]) => [Number(page), rotation] as const)
    if (!pageIndices.length || new Set(pageIndices).size !== pageIndices.length || pageIndices.some((page) => page < 0 || page >= this.pageCount)) throw new Error('页面排序无效。')
    if (rotationEntries.some(([page, rotation]) => !Number.isInteger(page) || page < 0 || page >= this.pageCount || !Number.isFinite(rotation) || rotation % 90 !== 0)) throw new Error('页面旋转设置无效。')
    const rotationFor = (page: number) => ((rotations[page] || 0) % 360 + 360) % 360
    const hasRotations = pageIndices.some((page) => rotationFor(page) !== 0)
    if (!hasRotations && pageIndices.length === this.pageCount && pageIndices.every((page, index) => page === index)) return
    const bookmarks = this.bookmarks()
    const reordered = await PDFDocument.create()
    const pages = await reordered.copyPages(this.document, pageIndices)
    pages.forEach((page, index) => {
      const rotation = rotationFor(pageIndices[index])
      if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation) % 360))
      reordered.addPage(page)
    })
    if (bookmarks.length) replacePdfBookmarks(reordered, remapPdfBookmarks(bookmarks, pageIndices))
    this.document = reordered
    await this.commit()
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
  }

  private async standardFont(style: TextStyle): Promise<PDFFont> {
    const category = fontCategory(style.font)
    let font = StandardFonts.Helvetica
    if (category === 'serif') font = StandardFonts.TimesRoman
    if (category === 'mono') font = StandardFonts.Courier
    if (category === 'sans' && style.bold && style.italic) font = StandardFonts.HelveticaBoldOblique
    else if (category === 'sans' && style.bold) font = StandardFonts.HelveticaBold
    else if (category === 'sans' && style.italic) font = StandardFonts.HelveticaOblique
    else if (category === 'serif' && style.bold && style.italic) font = StandardFonts.TimesRomanBoldItalic
    else if (category === 'serif' && style.bold) font = StandardFonts.TimesRomanBold
    else if (category === 'serif' && style.italic) font = StandardFonts.TimesRomanItalic
    else if (category === 'mono' && style.bold && style.italic) font = StandardFonts.CourierBoldOblique
    else if (category === 'mono' && style.bold) font = StandardFonts.CourierBold
    else if (category === 'mono' && style.italic) font = StandardFonts.CourierOblique
    return this.document.embedFont(font)
  }

  private async textAppearance(rect: PdfRect, text: string, style: TextStyle, rasterPng?: Uint8Array, mask?: { rects: PdfRect[]; color: string }): Promise<PDFRef> {
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height)
    const [red, green, blue] = hexColor(style.color)
    let contents = ''
    let resources = this.document.context.obj({})
    if (mask?.rects.length) {
      const [maskRed, maskGreen, maskBlue] = hexColor(mask.color)
      const rectangles = mask.rects.flatMap((source) => {
        const left = Math.max(0, source.x - rect.x - .35)
        const right = Math.min(width, source.x + source.width - rect.x + .35)
        const top = Math.max(0, source.y - rect.y - .5)
        const bottom = Math.min(height, source.y + source.height - rect.y + .5)
        if (right <= left || bottom <= top) return []
        return [`${left} ${height - bottom} ${right - left} ${bottom - top} re f`]
      })
      if (rectangles.length) contents = `q ${maskRed} ${maskGreen} ${maskBlue} rg ${rectangles.join('\n')} Q\n`
    }
    if (rasterPng) {
      const image = await this.document.embedPng(rasterPng)
      resources = this.document.context.obj({ XObject: { Im0: image.ref } })
      contents += `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`
    } else {
      const font = await this.standardFont(style)
      resources = this.document.context.obj({ Font: { F0: font.ref } })
      const letterSpacing = style.letterSpacing || 0, horizontalScale = style.horizontalScale || 100
      const paragraphBefore = Math.max(0, style.paragraphBefore || 0), paragraphAfter = Math.max(0, style.paragraphAfter || 0)
      const measuredWidth = (value: string) => (font.widthOfTextAtSize(value, style.size) + Math.max(0, Array.from(value).length - 1) * letterSpacing) * horizontalScale / 100
      const lines: Array<{ value: string; top: number }> = []
      let top = 0
      for (const paragraph of text.replace(/\r/g, '').split('\n')) {
        top += paragraphBefore
        const words = paragraph.split(/(\s+)/)
        let line = ''
        const paragraphLines: string[] = []
        for (const word of words) {
          const candidate = line + word
          if (line && measuredWidth(candidate) > width) { paragraphLines.push(line.trimEnd()); line = word.trimStart() }
          else line = candidate
        }
        paragraphLines.push(line)
        for (const value of paragraphLines) { lines.push({ value, top }); top += style.size * (style.lineHeight || 1.25) }
        top += paragraphAfter
      }
      const operators = lines.filter((line) => line.top + style.size <= height).map(({ value, top: lineTop }) => {
        const lineWidth = measuredWidth(value)
        const offset = style.align === 'center' ? (width - lineWidth) / 2 : style.align === 'right' ? width - lineWidth : 0
        const y = Math.max(0, height - style.size - lineTop)
        return `BT /F0 ${style.size} Tf ${red} ${green} ${blue} rg ${letterSpacing} Tc ${horizontalScale} Tz 1 0 0 1 ${Math.max(0, offset)} ${y} Tm ${font.encodeText(value)} Tj ET`
      })
      contents += `q ${operators.join('\n')} Q`
    }
    const stream = this.document.context.flateStream(contents, { Type: 'XObject', Subtype: 'Form', FormType: 1, BBox: [0, 0, width, height], Resources: resources })
    return this.document.context.register(stream)
  }

  async addText(pageIndex: number, rect: PdfRect, text: string, style: TextStyle, rasterPng?: Uint8Array, replacement?: { sourceKey: string; sourceRects: PdfRect[]; backgroundColor: string }): Promise<string> {
    const page = this.document.getPage(pageIndex)
    const id = `pdfuck-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const appearance = await this.textAppearance(rect, text, style, rasterPng, replacement ? { rects: replacement.sourceRects, color: replacement.backgroundColor } : undefined)
    const [red, green, blue] = hexColor(style.color)
    const dictionary = this.document.context.obj({})
    dictionary.set(PDFName.of('Type'), PDFName.of('Annot'))
    dictionary.set(PDFName.of('Subtype'), PDFName.of('FreeText'))
    dictionary.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(rect, pageGeometry(page))))
    dictionary.set(PDFName.of('Contents'), pdfString(text))
    dictionary.set(PDFName.of('NM'), pdfString(id))
    dictionary.set(PDFName.of('T'), pdfString('PDFuck'))
    dictionary.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    dictionary.set(PDFName.of('F'), PDFNumber.of(4))
    dictionary.set(PDFName.of('Border'), this.document.context.obj([0, 0, 0]))
    dictionary.set(PDFName.of('AP'), this.document.context.obj({ N: appearance }))
    dictionary.set(PDFName.of('DA'), PDFString.of(`/Helv ${style.size} Tf ${red} ${green} ${blue} rg`))
    dictionary.set(PDFName.of('Q'), PDFNumber.of(style.align === 'center' ? 1 : style.align === 'right' ? 2 : 0))
    dictionary.set(PDFName.of('PDFuckText'), PDFName.of('true'))
    dictionary.set(PDFName.of('PDFuckFont'), pdfString(normalizeFontFamily(style.font)))
    dictionary.set(PDFName.of('PDFuckSize'), PDFNumber.of(style.size))
    dictionary.set(PDFName.of('PDFuckColor'), PDFString.of(style.color))
    dictionary.set(PDFName.of('PDFuckBold'), PDFName.of(style.bold ? 'true' : 'false'))
    dictionary.set(PDFName.of('PDFuckItalic'), PDFName.of(style.italic ? 'true' : 'false'))
    dictionary.set(PDFName.of('PDFuckAlign'), PDFName.of(style.align))
    dictionary.set(PDFName.of('PDFuckLineHeight'), PDFNumber.of(style.lineHeight || 1.25))
    dictionary.set(PDFName.of('PDFuckParagraphBefore'), PDFNumber.of(style.paragraphBefore || 0))
    dictionary.set(PDFName.of('PDFuckParagraphAfter'), PDFNumber.of(style.paragraphAfter || 0))
    dictionary.set(PDFName.of('PDFuckLetterSpacing'), PDFNumber.of(style.letterSpacing || 0))
    dictionary.set(PDFName.of('PDFuckHorizontalScale'), PDFNumber.of(style.horizontalScale || 100))
    if (rasterPng) dictionary.set(PDFName.of('PDFuckTextRasterData'), this.document.context.register(this.document.context.stream(Uint8Array.from(rasterPng), { Type: 'EmbeddedFile' })))
    if (replacement) {
      dictionary.set(PDFName.of('PDFuckPageTextSource'), pdfString(replacement.sourceKey))
      dictionary.set(PDFName.of('PDFuckPageTextRects'), pdfString(encodePageTextRects(replacement.sourceRects)))
      dictionary.set(PDFName.of('PDFuckPageTextBackground'), PDFString.of(replacement.backgroundColor))
    }
    page.node.addAnnot(this.document.context.register(dictionary))
    await this.commit()
    return id
  }

  private pageNumberEntries(): AnnotationEntry[] {
    return this.annotationEntries().filter((entry) => decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckPageNumber'))) === 'true')
  }

  pageNumbers(): PageNumberRecord[] {
    return this.pageNumberEntries().map((entry) => {
      const dict = entry.dict
      const horizontal = decodeObject(this.document, dict.get(PDFName.of('PDFuckPageNumberHorizontal')))
      const vertical = decodeObject(this.document, dict.get(PDFName.of('PDFuckPageNumberVertical')))
      const settings: PageNumberSettings = {
        template: decodeObject(this.document, dict.get(PDFName.of('PDFuckPageNumberTemplate'))) || DEFAULT_PAGE_NUMBER_SETTINGS.template,
        font: normalizeFontFamily(decodeObject(this.document, dict.get(PDFName.of('PDFuckFont'))) || DEFAULT_PAGE_NUMBER_SETTINGS.font),
        size: numberValue(this.document, dict.get(PDFName.of('PDFuckSize')), DEFAULT_PAGE_NUMBER_SETTINGS.size),
        color: decodeObject(this.document, dict.get(PDFName.of('PDFuckColor'))) || DEFAULT_PAGE_NUMBER_SETTINGS.color,
        bold: decodeObject(this.document, dict.get(PDFName.of('PDFuckBold'))) === 'true',
        italic: decodeObject(this.document, dict.get(PDFName.of('PDFuckItalic'))) === 'true',
        horizontal: horizontal === 'left' || horizontal === 'right' ? horizontal : 'center',
        vertical: vertical === 'top' ? 'top' : 'bottom',
        edgeOffsetPercent: numberValue(this.document, dict.get(PDFName.of('PDFuckPageNumberEdgeOffset')), DEFAULT_PAGE_NUMBER_SETTINGS.edgeOffsetPercent),
        sideMarginPercent: numberValue(this.document, dict.get(PDFName.of('PDFuckPageNumberSideMargin')), DEFAULT_PAGE_NUMBER_SETTINGS.sideMarginPercent)
      }
      return {
        id: decodeObject(this.document, dict.get(PDFName.of('NM'))) || `${entry.pageIndex}:${entry.index}`,
        pageIndex: entry.pageIndex,
        text: decodeObject(this.document, dict.get(PDFName.of('Contents'))),
        rect: pdfBoundsToDisplayRect(numberArray(this.document, dict.get(PDFName.of('Rect'))), pageGeometry(entry.page)),
        settings
      }
    })
  }

  private removePageNumberEntries(): number {
    const entries = this.pageNumberEntries()
    const byPage = new Map<PDFPage, number[]>()
    entries.forEach((entry) => byPage.set(entry.page, [...(byPage.get(entry.page) || []), entry.index]))
    byPage.forEach((indexes, page) => indexes.sort((left, right) => right - left).forEach((index) => page.node.Annots()?.remove(index)))
    return entries.length
  }

  /** Replace the document's PDFuck page-number set as one undoable operation. */
  async addPageNumbers(settings: PageNumberSettings, rasterize?: (text: string, rect: PdfRect, style: TextStyle) => Promise<Uint8Array | undefined>): Promise<void> {
    const validationError = validatePageNumberTemplate(settings.template)
    if (validationError) throw new Error(validationError)
    if (!this.pageCount) throw new Error('文档没有可添加页码的页面。')
    const normalized: PageNumberSettings = {
      ...settings,
      size: Math.max(6, Math.min(72, settings.size)),
      edgeOffsetPercent: Math.max(0, Math.min(30, settings.edgeOffsetPercent)),
      sideMarginPercent: Math.max(0, Math.min(30, settings.sideMarginPercent))
    }
    const total = this.pageCount
    try {
      this.removePageNumberEntries()
      for (let pageIndex = 0; pageIndex < total; pageIndex += 1) {
        const page = this.document.getPage(pageIndex)
        const rect = pageNumberRect(this.getPageSize(pageIndex), normalized)
        const text = formatPageNumber(normalized.template, pageIndex + 1, total)
        const style: TextStyle = { font: normalized.font, size: normalized.size, color: normalized.color, bold: normalized.bold, italic: normalized.italic, align: normalized.horizontal, lineHeight: 1.25 }
        const rasterPng = rasterize ? await rasterize(text, rect, style) : undefined
        const appearance = await this.textAppearance(rect, text, style, rasterPng)
        const [red, green, blue] = hexColor(style.color)
        const dictionary = this.document.context.obj({})
        const id = `pdfuck-page-number-${Date.now()}-${pageIndex}-${Math.random().toString(36).slice(2, 7)}`
        dictionary.set(PDFName.of('Type'), PDFName.of('Annot'))
        dictionary.set(PDFName.of('Subtype'), PDFName.of('FreeText'))
        dictionary.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(rect, pageGeometry(page))))
        dictionary.set(PDFName.of('Contents'), pdfString(text))
        dictionary.set(PDFName.of('NM'), pdfString(id))
        dictionary.set(PDFName.of('T'), pdfString('PDFuck'))
        dictionary.set(PDFName.of('Subj'), pdfString('PDFuck Page Number'))
        dictionary.set(PDFName.of('M'), PDFString.fromDate(new Date()))
        dictionary.set(PDFName.of('F'), PDFNumber.of(4))
        dictionary.set(PDFName.of('Border'), this.document.context.obj([0, 0, 0]))
        dictionary.set(PDFName.of('AP'), this.document.context.obj({ N: appearance }))
        dictionary.set(PDFName.of('DA'), PDFString.of(`/Helv ${style.size} Tf ${red} ${green} ${blue} rg`))
        dictionary.set(PDFName.of('Q'), PDFNumber.of(style.align === 'center' ? 1 : style.align === 'right' ? 2 : 0))
        dictionary.set(PDFName.of('PDFuckPageNumber'), PDFName.of('true'))
        dictionary.set(PDFName.of('PDFuckPageNumberTemplate'), pdfString(normalized.template))
        dictionary.set(PDFName.of('PDFuckPageNumberHorizontal'), PDFName.of(normalized.horizontal))
        dictionary.set(PDFName.of('PDFuckPageNumberVertical'), PDFName.of(normalized.vertical))
        dictionary.set(PDFName.of('PDFuckPageNumberEdgeOffset'), PDFNumber.of(normalized.edgeOffsetPercent))
        dictionary.set(PDFName.of('PDFuckPageNumberSideMargin'), PDFNumber.of(normalized.sideMarginPercent))
        dictionary.set(PDFName.of('PDFuckFont'), pdfString(normalizeFontFamily(style.font)))
        dictionary.set(PDFName.of('PDFuckSize'), PDFNumber.of(style.size))
        dictionary.set(PDFName.of('PDFuckColor'), PDFString.of(style.color))
        dictionary.set(PDFName.of('PDFuckBold'), PDFName.of(style.bold ? 'true' : 'false'))
        dictionary.set(PDFName.of('PDFuckItalic'), PDFName.of(style.italic ? 'true' : 'false'))
        page.node.addAnnot(this.document.context.register(dictionary))
      }
      await this.commit()
    } catch (error) {
      this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
      throw error
    }
  }

  async deletePageNumbers(): Promise<number> {
    const removed = this.removePageNumberEntries()
    if (removed) await this.commit()
    return removed
  }

  async replacePageText(pageIndex: number, rects: PdfRect[], text: string, style: TextStyle, rasterPng?: Uint8Array, replacementRect?: PdfRect, backgroundColor = '#ffffff'): Promise<string> {
    if (!rects.length) throw new Error('找不到要编辑的页面文字区域。')
    if (pageIndex < 0 || pageIndex >= this.pageCount) throw new Error('要编辑的页面不存在。')
    const sourceKey = pageTextSourceKey(pageIndex, rects)
    const previous = this.pageTextEditQueues.get(sourceKey) || Promise.resolve()
    const operation = previous.catch(() => undefined).then(async () => {
      const page = this.document.getPage(pageIndex)
      const rect = replacementRect || rectUnion(rects)
      const matches = this.annotationEntries().filter((entry) => entry.pageIndex === pageIndex && decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckPageTextSource'))) === sourceKey)
      if (!matches.length) return this.addText(pageIndex, rect, text, style, rasterPng, { sourceKey, sourceRects: rects, backgroundColor })

      const retained = matches[0]
      matches.slice(1).sort((left, right) => right.index - left.index).forEach((entry) => entry.page.node.Annots()?.remove(entry.index))
      const appearance = await this.textAppearance(rect, text, style, rasterPng, { rects, color: backgroundColor })
      const [red, green, blue] = hexColor(style.color)
      retained.dict.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(rect, pageGeometry(page))))
      retained.dict.set(PDFName.of('Contents'), pdfString(text))
      retained.dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
      retained.dict.set(PDFName.of('AP'), this.document.context.obj({ N: appearance }))
      retained.dict.set(PDFName.of('DA'), PDFString.of(`/Helv ${style.size} Tf ${red} ${green} ${blue} rg`))
      retained.dict.set(PDFName.of('Q'), PDFNumber.of(style.align === 'center' ? 1 : style.align === 'right' ? 2 : 0))
      retained.dict.set(PDFName.of('PDFuckFont'), pdfString(normalizeFontFamily(style.font)))
      retained.dict.set(PDFName.of('PDFuckSize'), PDFNumber.of(style.size))
      retained.dict.set(PDFName.of('PDFuckColor'), PDFString.of(style.color))
      retained.dict.set(PDFName.of('PDFuckBold'), PDFName.of(style.bold ? 'true' : 'false'))
      retained.dict.set(PDFName.of('PDFuckItalic'), PDFName.of(style.italic ? 'true' : 'false'))
      retained.dict.set(PDFName.of('PDFuckAlign'), PDFName.of(style.align))
      retained.dict.set(PDFName.of('PDFuckLineHeight'), PDFNumber.of(style.lineHeight || 1.25))
      retained.dict.set(PDFName.of('PDFuckParagraphBefore'), PDFNumber.of(style.paragraphBefore || 0))
      retained.dict.set(PDFName.of('PDFuckParagraphAfter'), PDFNumber.of(style.paragraphAfter || 0))
      retained.dict.set(PDFName.of('PDFuckLetterSpacing'), PDFNumber.of(style.letterSpacing || 0))
      retained.dict.set(PDFName.of('PDFuckHorizontalScale'), PDFNumber.of(style.horizontalScale || 100))
      if (rasterPng) retained.dict.set(PDFName.of('PDFuckTextRasterData'), this.document.context.register(this.document.context.stream(Uint8Array.from(rasterPng), { Type: 'EmbeddedFile' })))
      else retained.dict.delete(PDFName.of('PDFuckTextRasterData'))
      retained.dict.set(PDFName.of('PDFuckPageTextRects'), pdfString(encodePageTextRects(rects)))
      retained.dict.set(PDFName.of('PDFuckPageTextBackground'), PDFString.of(backgroundColor))
      await this.commit()
      return decodeObject(this.document, retained.dict.get(PDFName.of('NM')))
    })
    const settled = operation.then(() => undefined, () => undefined)
    this.pageTextEditQueues.set(sourceKey, settled)
    try { return await operation } finally { if (this.pageTextEditQueues.get(sourceKey) === settled) this.pageTextEditQueues.delete(sourceKey) }
  }

  private annotationEntries(): AnnotationEntry[] {
    const entries: AnnotationEntry[] = []
    this.document.getPages().forEach((page, pageIndex) => {
      const annots = page.node.Annots()
      annots?.asArray().forEach((object, index) => {
        const resolved = object instanceof PDFRef ? this.document.context.lookup(object) : object
        if (resolved instanceof PDFDict) entries.push({ dict: resolved, ref: object instanceof PDFRef ? object : undefined, index, page, pageIndex })
      })
    })
    return entries
  }

  annotations(): AnnotationRecord[] {
    return this.annotationEntries().flatMap((entry) => {
      const kind = kindFor(entry.dict, this.document)
      if (!kind) return []
      const id = decodeObject(this.document, entry.dict.get(PDFName.of('NM'))) || `${entry.pageIndex}:${entry.ref?.toString() || entry.index}`
      const groupId = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckGroup'))) || undefined
      const quads = numberArray(this.document, entry.dict.get(PDFName.of('QuadPoints')))
      const rect = numberArray(this.document, entry.dict.get(PDFName.of('Rect')))
      const geometry = pageGeometry(entry.page)
      const storedColor = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckColor')))
      const color = normalizeHexColor(storedColor, rgbArrayToHex(numberArray(this.document, entry.dict.get(PDFName.of('C'))), DEFAULT_ANNOTATION_COLOR[kind]))
      const replyStatus = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckReplyStatus'))) as AnnotationReplyStatus
      const replyContent = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckReply')))
      const reply = ['handled', 'thinking', 'declined', 'custom'].includes(replyStatus) && replyContent ? { status: replyStatus, content: replyContent } : undefined
      return [{
        id, groupId, pageIndex: entry.pageIndex, kind,
        author: decodeObject(this.document, entry.dict.get(PDFName.of('T'))) || 'PDFuck',
        content: decodeObject(this.document, entry.dict.get(PDFName.of('Contents'))),
        color,
        reply,
        rects: quads.length ? pdfQuadsToDisplayRects(quads, geometry) : [pdfBoundsToDisplayRect(rect, geometry)],
        createdAt: decodeObject(this.document, entry.dict.get(PDFName.of('M')))
      }]
    })
  }

  textObjects(): TextObjectRecord[] {
    return this.annotationEntries().flatMap((entry) => {
      if (decodeObject(this.document, entry.dict.get(PDFName.of('Subtype'))) !== 'FreeText') return []
      if (decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckText'))) !== 'true') return []
      const id = decodeObject(this.document, entry.dict.get(PDFName.of('NM'))) || `${entry.pageIndex}:${entry.ref?.toString() || entry.index}`
      const font = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckFont')))
      const align = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckAlign')))
      const sourceRects = decodePageTextRects(this.document, entry.dict.get(PDFName.of('PDFuckPageTextRects')))
      return [{
        id,
        pageIndex: entry.pageIndex,
        rect: pdfBoundsToDisplayRect(numberArray(this.document, entry.dict.get(PDFName.of('Rect'))), pageGeometry(entry.page)),
        text: decodeObject(this.document, entry.dict.get(PDFName.of('Contents'))),
        appearanceData: embeddedBytes(this.document, entry.dict.get(PDFName.of('PDFuckTextRasterData'))),
        sourceRects: sourceRects.length ? sourceRects : undefined,
        backgroundColor: sourceRects.length ? decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckPageTextBackground'))) || '#ffffff' : undefined,
        fixedToSource: sourceRects.length ? true : undefined,
        style: {
          font: normalizeFontFamily(font),
          size: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckSize')), 16),
          color: decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckColor'))) || '#182033',
          bold: decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckBold'))) === 'true',
          italic: decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckItalic'))) === 'true',
          align: align === 'center' || align === 'right' ? align : 'left',
          lineHeight: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckLineHeight')), 1.25) as TextStyle['lineHeight'],
          paragraphBefore: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckParagraphBefore')), 0),
          paragraphAfter: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckParagraphAfter')), 0),
          letterSpacing: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckLetterSpacing')), 0),
          horizontalScale: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckHorizontalScale')), 100)
        }
      }]
    })
  }

  private findTextObject(id: string): AnnotationEntry {
    const entry = this.annotationEntries().find((candidate) => decodeObject(this.document, candidate.dict.get(PDFName.of('Subtype'))) === 'FreeText' && decodeObject(this.document, candidate.dict.get(PDFName.of('PDFuckText'))) === 'true' && decodeObject(this.document, candidate.dict.get(PDFName.of('NM'))) === id)
    if (!entry) throw new Error('找不到这段文字，它可能已经被删除。')
    return entry
  }

  async updateTextObject(id: string, text: string, style: TextStyle, rasterPng?: Uint8Array): Promise<void> {
    const { dict, page } = this.findTextObject(id)
    const rect = pdfBoundsToDisplayRect(numberArray(this.document, dict.get(PDFName.of('Rect'))), pageGeometry(page))
    const sourceRects = decodePageTextRects(this.document, dict.get(PDFName.of('PDFuckPageTextRects')))
    const backgroundColor = decodeObject(this.document, dict.get(PDFName.of('PDFuckPageTextBackground'))) || '#ffffff'
    const appearance = await this.textAppearance(rect, text, style, rasterPng, sourceRects.length ? { rects: sourceRects, color: backgroundColor } : undefined)
    const [red, green, blue] = hexColor(style.color)
    dict.set(PDFName.of('Contents'), pdfString(text))
    dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    dict.set(PDFName.of('AP'), this.document.context.obj({ N: appearance }))
    dict.set(PDFName.of('DA'), PDFString.of(`/Helv ${style.size} Tf ${red} ${green} ${blue} rg`))
    dict.set(PDFName.of('Q'), PDFNumber.of(style.align === 'center' ? 1 : style.align === 'right' ? 2 : 0))
    dict.set(PDFName.of('PDFuckFont'), pdfString(normalizeFontFamily(style.font)))
    dict.set(PDFName.of('PDFuckSize'), PDFNumber.of(style.size))
    dict.set(PDFName.of('PDFuckColor'), PDFString.of(style.color))
    dict.set(PDFName.of('PDFuckBold'), PDFName.of(style.bold ? 'true' : 'false'))
    dict.set(PDFName.of('PDFuckItalic'), PDFName.of(style.italic ? 'true' : 'false'))
    dict.set(PDFName.of('PDFuckAlign'), PDFName.of(style.align))
    dict.set(PDFName.of('PDFuckLineHeight'), PDFNumber.of(style.lineHeight || 1.25))
    dict.set(PDFName.of('PDFuckParagraphBefore'), PDFNumber.of(style.paragraphBefore || 0))
    dict.set(PDFName.of('PDFuckParagraphAfter'), PDFNumber.of(style.paragraphAfter || 0))
    dict.set(PDFName.of('PDFuckLetterSpacing'), PDFNumber.of(style.letterSpacing || 0))
    dict.set(PDFName.of('PDFuckHorizontalScale'), PDFNumber.of(style.horizontalScale || 100))
    if (rasterPng) dict.set(PDFName.of('PDFuckTextRasterData'), this.document.context.register(this.document.context.stream(Uint8Array.from(rasterPng), { Type: 'EmbeddedFile' })))
    else dict.delete(PDFName.of('PDFuckTextRasterData'))
    await this.commit()
  }

  async moveTextObject(id: string, deltaX: number, deltaY: number): Promise<void> {
    const { dict, page } = this.findTextObject(id)
    if (decodePageTextRects(this.document, dict.get(PDFName.of('PDFuckPageTextRects'))).length) return
    const geometry = pageGeometry(page)
    const rect = pdfBoundsToDisplayRect(numberArray(this.document, dict.get(PDFName.of('Rect'))), geometry)
    dict.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY }, geometry)))
    dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    await this.commit()
  }

  async deleteTextObject(id: string): Promise<void> {
    const entry = this.findTextObject(id)
    entry.page.node.Annots()?.remove(entry.index)
    await this.commit()
  }

  private findAnnotationOptional(id: string): AnnotationEntry | undefined {
    return this.annotationEntries().find((candidate) => {
      const current = decodeObject(this.document, candidate.dict.get(PDFName.of('NM'))) || `${candidate.pageIndex}:${candidate.ref?.toString() || candidate.index}`
      return current === id
    })
  }

  private findAnnotation(id: string): AnnotationEntry {
    const entry = this.findAnnotationOptional(id)
    if (!entry) throw new Error('找不到这条批注，它可能已经被删除。')
    return entry
  }

  async addAnnotation(pageIndex: number, kind: AnnotationKind, rects: PdfRect[], content = '', point?: PdfPoint, colorValue?: string, groupId?: string, author?: string): Promise<string> {
    const page = this.document.getPage(pageIndex)
    const geometry = pageGeometry(page)
    const id = `pdfuck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let normalized = rects
    if (kind === 'note' && point) normalized = [{ x: point.x, y: point.y, width: 20, height: 20 }]
    if (kind === 'insert' && point) {
      const displayWidth = geometry.rotation % 180 ? geometry.height : geometry.width
      const displayHeight = geometry.rotation % 180 ? geometry.width : geometry.height
      normalized = [{ x: Math.max(0, Math.min(displayWidth - 14, point.x - 7)), y: Math.max(0, Math.min(displayHeight - 18, point.y)), width: 14, height: 18 }]
    }
    if (!normalized.length) throw new Error('请先选择文字或页面位置。')
    const bounds = rectUnion(normalized)
    const colorHex = normalizeHexColor(colorValue, DEFAULT_ANNOTATION_COLOR[kind])
    const color = hexColor(colorHex)
    const dictionary = this.document.context.obj({})
    dictionary.set(PDFName.of('Type'), PDFName.of('Annot'))
    dictionary.set(PDFName.of('Subtype'), PDFName.of(subtypeFor(kind)))
    dictionary.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(bounds, geometry)))
    dictionary.set(PDFName.of('Contents'), pdfString(content))
    dictionary.set(PDFName.of('T'), pdfString(normalizeAnnotationAuthor(author)))
    dictionary.set(PDFName.of('NM'), pdfString(id))
    if (groupId) dictionary.set(PDFName.of('PDFuckGroup'), pdfString(groupId))
    dictionary.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    dictionary.set(PDFName.of('C'), this.document.context.obj(color))
    dictionary.set(PDFName.of('PDFuckColor'), pdfString(colorHex))
    dictionary.set(PDFName.of('CA'), PDFNumber.of(kind === 'highlight' ? 0.35 : 1))
    dictionary.set(PDFName.of('F'), PDFNumber.of(4))
    dictionary.set(PDFName.of('Subj'), pdfString(translateMessage('zh', KIND_LABEL[kind])))
    if (!['note', 'insert'].includes(kind)) dictionary.set(PDFName.of('QuadPoints'), this.document.context.obj(displayRectsToPdfQuads(normalized, geometry)))
    if (kind === 'insert') dictionary.set(PDFName.of('Sy'), PDFName.of('P'))
    if (kind === 'insert') this.setAnnotationColor(dictionary, colorHex)
    page.node.addAnnot(this.document.context.register(dictionary))
    await this.commit()
    return id
  }

  async updateAnnotation(id: string, content: string): Promise<void> {
    const dict = this.findAnnotation(id).dict
    dict.set(PDFName.of('Contents'), pdfString(content))
    dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    await this.commit()
  }

  private setAnnotationColor(dict: PDFDict, color: string): void {
    const normalized = normalizeHexColor(color, '#173f7a')
    dict.set(PDFName.of('C'), this.document.context.obj(hexColor(normalized)))
    dict.set(PDFName.of('PDFuckColor'), pdfString(normalized))
    if (kindFor(dict, this.document) === 'insert') {
      const rect = numberArray(this.document, dict.get(PDFName.of('Rect')))
      const width = Math.max(8, Math.abs((rect[2] || 18) - (rect[0] || 0))), height = Math.max(8, Math.abs((rect[3] || 22) - (rect[1] || 0)))
      const [red, green, blue] = hexColor(normalized), center = width / 2, wing = Math.min(5, width * .34), base = Math.min(6, height * .34)
      const contents = `q ${red} ${green} ${blue} RG ${red} ${green} ${blue} rg 2.4 w 1 J ${center} 1 m ${center} ${height - base} l S ${center - wing} ${height - base} m ${center} ${height} l ${center + wing} ${height - base} l h f Q`
      const stream = this.document.context.flateStream(contents, { Type: 'XObject', Subtype: 'Form', FormType: 1, BBox: [0, 0, width, height], Resources: {} })
      dict.set(PDFName.of('AP'), this.document.context.obj({ N: this.document.context.register(stream) }))
    } else dict.delete(PDFName.of('AP'))
  }

  private setAnnotationReply(dict: PDFDict, reply?: AnnotationReply): void {
    if (reply?.content.trim()) {
      dict.set(PDFName.of('PDFuckReplyStatus'), PDFName.of(reply.status))
      dict.set(PDFName.of('PDFuckReply'), pdfString(reply.content.trim()))
    } else {
      dict.delete(PDFName.of('PDFuckReplyStatus'))
      dict.delete(PDFName.of('PDFuckReply'))
    }
  }

  async updateAnnotationColor(id: string, color: string): Promise<void> {
    const dict = this.findAnnotation(id).dict
    this.setAnnotationColor(dict, color); dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    await this.commit()
  }

  async updateAnnotationReply(id: string, reply?: AnnotationReply): Promise<void> {
    const entry = this.findAnnotation(id)
    const groupId = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckGroup')))
    const entries = groupId
      ? this.annotationEntries().filter((candidate) => decodeObject(this.document, candidate.dict.get(PDFName.of('PDFuckGroup'))) === groupId)
      : [entry]
    const modifiedAt = PDFString.fromDate(new Date())
    for (const candidate of entries) {
      this.setAnnotationReply(candidate.dict, reply)
      candidate.dict.set(PDFName.of('M'), modifiedAt)
    }
    await this.commit()
  }

  async updateAnnotationProperties(id: string, content: string, color: string, reply?: AnnotationReply): Promise<void> {
    const dict = this.findAnnotation(id).dict
    dict.set(PDFName.of('Contents'), pdfString(content))
    this.setAnnotationColor(dict, color); this.setAnnotationReply(dict, reply)
    dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    await this.commit()
  }

  async moveAnnotation(id: string, deltaX: number, deltaY: number): Promise<void> {
    const { dict, page } = this.findAnnotation(id)
    const geometry = pageGeometry(page)
    const rect = pdfBoundsToDisplayRect(numberArray(this.document, dict.get(PDFName.of('Rect'))), geometry)
    const quads = numberArray(this.document, dict.get(PDFName.of('QuadPoints')))
    const sourceRects = quads.length ? pdfQuadsToDisplayRects(quads, geometry) : [rect]
    const displayWidth = geometry.rotation % 180 ? geometry.height : geometry.width
    const displayHeight = geometry.rotation % 180 ? geometry.width : geometry.height
    const delta = clampRectDelta(sourceRects, { x: deltaX, y: deltaY }, displayWidth, displayHeight)
    const moved = { ...rect, x: rect.x + delta.x, y: rect.y + delta.y }
    dict.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(moved, geometry)))
    if (quads.length) {
      const shifted = sourceRects.map((value) => ({ ...value, x: value.x + delta.x, y: value.y + delta.y }))
      dict.set(PDFName.of('QuadPoints'), this.document.context.obj(displayRectsToPdfQuads(shifted, geometry)))
    }
    await this.commit()
  }

  async deleteAnnotation(id: string): Promise<boolean> {
    // Deletion is intentionally idempotent. UI events can arrive twice before
    // React has removed the row (for example, a very fast double click), and a
    // stale delete must never turn into a native error/focus interruption.
    const entry = this.findAnnotationOptional(id)
    if (!entry) return false
    const groupId = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckGroup')))
    const matches = groupId
      ? this.annotationEntries().filter((candidate) => decodeObject(this.document, candidate.dict.get(PDFName.of('PDFuckGroup'))) === groupId)
      : [entry]
    const byPage = new Map<PDFPage, number[]>()
    matches.forEach((candidate) => {
      const indexes = byPage.get(candidate.page) || []
      indexes.push(candidate.index)
      byPage.set(candidate.page, indexes)
    })
    byPage.forEach((indexes, page) => {
      indexes.sort((left, right) => right - left).forEach((index) => page.node.Annots()?.remove(index))
    })
    await this.commit()
    return true
  }
}

export { KIND_LABEL }
