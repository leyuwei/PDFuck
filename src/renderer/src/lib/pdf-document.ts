import {
  PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFRef, PDFString,
  StandardFonts, rgb, type PDFFont, type PDFPage
} from 'pdf-lib'
import type { AnnotationKind, AnnotationRecord, AnnotationReply, AnnotationReplyStatus, PdfPoint, PdfRect, TextObjectRecord, TextStyle } from '../types'
import { rectUnion } from './geometry'
import {
  displayRectToPdfBounds, displayRectsToPdfQuads, pdfBoundsToDisplayRect, pdfQuadsToDisplayRects,
  type PageGeometry
} from './page-coordinates'
import { fontCategory, normalizeFontFamily } from './text-fonts'
import { DEFAULT_ANNOTATION_COLOR, normalizeHexColor } from './annotation-style'

const KIND_LABEL: Record<AnnotationKind, string> = {
  highlight: '文本高亮', note: '自由批注', replace: '文本替换', insert: '插入文字', delete: '文本删除', underline: '加下划线'
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

function pageGeometry(page: PDFPage): PageGeometry {
  const crop = page.getCropBox()
  return { ...crop, rotation: page.getRotation().angle }
}

function subtypeFor(kind: AnnotationKind): string {
  if (kind === 'note') return 'Text'
  if (kind === 'insert') return 'Caret'
  if (kind === 'underline') return 'Underline'
  if (kind === 'highlight') return 'Highlight'
  return 'StrikeOut'
}

function kindFor(dict: PDFDict, document: PDFDocument): AnnotationKind | null {
  const subtype = decodeObject(document, dict.get(PDFName.of('Subtype')))
  const subject = decodeObject(document, dict.get(PDFName.of('Subj'))).toLowerCase()
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

  get bytes(): Uint8Array { return Uint8Array.from(this.currentBytes) }
  get pageCount(): number { return this.document.getPageCount() }
  get canUndo(): boolean { return this.undoStack.length > 0 }
  get canRedo(): boolean { return this.redoStack.length > 0 }
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
    this.dirty = !sameBytes(this.currentBytes, this.savedBytes)
  }

  private async restoreHistory(bytes: Uint8Array<ArrayBufferLike>): Promise<void> {
    this.currentBytes = Uint8Array.from(bytes)
    this.document = await PDFDocument.load(this.currentBytes, { updateMetadata: false })
    this.dirty = !sameBytes(this.currentBytes, this.savedBytes)
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
    this.dirty = false
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
    pages.forEach((page) => this.document.removePage(page))
    await this.commit()
    // pdf-lib caches page wrappers; reload after structural edits so later page indices
    // always refer to the actual remaining pages.
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

  private async textAppearance(rect: PdfRect, text: string, style: TextStyle, rasterPng?: Uint8Array): Promise<PDFRef> {
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height)
    const [red, green, blue] = hexColor(style.color)
    let contents = ''
    let resources = this.document.context.obj({})
    if (rasterPng) {
      const image = await this.document.embedPng(rasterPng)
      resources = this.document.context.obj({ XObject: { Im0: image.ref } })
      contents = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`
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
      contents = `q ${operators.join('\n')} Q`
    }
    const stream = this.document.context.flateStream(contents, { Type: 'XObject', Subtype: 'Form', FormType: 1, BBox: [0, 0, width, height], Resources: resources })
    return this.document.context.register(stream)
  }

  async addText(pageIndex: number, rect: PdfRect, text: string, style: TextStyle, rasterPng?: Uint8Array): Promise<string> {
    const page = this.document.getPage(pageIndex)
    const id = `pdfuck-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const appearance = await this.textAppearance(rect, text, style, rasterPng)
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
    page.node.addAnnot(this.document.context.register(dictionary))
    await this.commit()
    return id
  }

  async replacePageText(pageIndex: number, rects: PdfRect[], text: string, style: TextStyle, rasterPng?: Uint8Array, replacementRect?: PdfRect, backgroundColor = '#ffffff'): Promise<string> {
    if (!rects.length) throw new Error('找不到要编辑的页面文字区域。')
    const page = this.document.getPage(pageIndex)
    const geometry = pageGeometry(page)
    const [backgroundRed, backgroundGreen, backgroundBlue] = hexColor(backgroundColor)
    for (const rect of rects) {
      const padded = { x: Math.max(0, rect.x - .35), y: Math.max(0, rect.y - .5), width: rect.width + .7, height: rect.height + 1 }
      const [left, bottom, right, top] = displayRectToPdfBounds(padded, geometry)
      page.drawRectangle({ x: left, y: bottom, width: Math.max(1, right - left), height: Math.max(1, top - bottom), color: rgb(backgroundRed, backgroundGreen, backgroundBlue), borderWidth: 0 })
    }
    return this.addText(pageIndex, replacementRect || rectUnion(rects), text, style, rasterPng)
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
      const quads = numberArray(this.document, entry.dict.get(PDFName.of('QuadPoints')))
      const rect = numberArray(this.document, entry.dict.get(PDFName.of('Rect')))
      const geometry = pageGeometry(entry.page)
      const storedColor = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckColor')))
      const color = normalizeHexColor(storedColor, rgbArrayToHex(numberArray(this.document, entry.dict.get(PDFName.of('C'))), DEFAULT_ANNOTATION_COLOR[kind]))
      const replyStatus = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckReplyStatus'))) as AnnotationReplyStatus
      const replyContent = decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckReply')))
      const reply = ['handled', 'thinking', 'declined', 'custom'].includes(replyStatus) && replyContent ? { status: replyStatus, content: replyContent } : undefined
      return [{
        id, pageIndex: entry.pageIndex, kind,
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
      return [{
        id,
        pageIndex: entry.pageIndex,
        rect: pdfBoundsToDisplayRect(numberArray(this.document, entry.dict.get(PDFName.of('Rect'))), pageGeometry(entry.page)),
        text: decodeObject(this.document, entry.dict.get(PDFName.of('Contents'))),
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
    const entry = this.annotationEntries().find((candidate) => decodeObject(this.document, candidate.dict.get(PDFName.of('Subtype'))) === 'FreeText' && decodeObject(this.document, candidate.dict.get(PDFName.of('NM'))) === id)
    if (!entry) throw new Error('找不到这段文字，它可能已经被删除。')
    return entry
  }

  async updateTextObject(id: string, text: string, style: TextStyle, rasterPng?: Uint8Array): Promise<void> {
    const { dict, page } = this.findTextObject(id)
    const rect = pdfBoundsToDisplayRect(numberArray(this.document, dict.get(PDFName.of('Rect'))), pageGeometry(page))
    const appearance = await this.textAppearance(rect, text, style, rasterPng)
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
    await this.commit()
  }

  async moveTextObject(id: string, deltaX: number, deltaY: number): Promise<void> {
    const { dict, page } = this.findTextObject(id)
    const geometry = pageGeometry(page)
    const rect = pdfBoundsToDisplayRect(numberArray(this.document, dict.get(PDFName.of('Rect'))), geometry)
    dict.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY }, geometry)))
    dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    await this.commit()
  }

  private findAnnotation(id: string): AnnotationEntry {
    const entry = this.annotationEntries().find((candidate) => {
      const current = decodeObject(this.document, candidate.dict.get(PDFName.of('NM'))) || `${candidate.pageIndex}:${candidate.ref?.toString() || candidate.index}`
      return current === id
    })
    if (!entry) throw new Error('找不到这条批注，它可能已经被删除。')
    return entry
  }

  async addAnnotation(pageIndex: number, kind: AnnotationKind, rects: PdfRect[], content = '', point?: PdfPoint, colorValue?: string): Promise<string> {
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
    dictionary.set(PDFName.of('T'), pdfString('PDFuck'))
    dictionary.set(PDFName.of('NM'), pdfString(id))
    dictionary.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    dictionary.set(PDFName.of('C'), this.document.context.obj(color))
    dictionary.set(PDFName.of('PDFuckColor'), pdfString(colorHex))
    dictionary.set(PDFName.of('CA'), PDFNumber.of(kind === 'highlight' ? 0.35 : 1))
    dictionary.set(PDFName.of('F'), PDFNumber.of(4))
    dictionary.set(PDFName.of('Subj'), pdfString(KIND_LABEL[kind]))
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
    const dict = this.findAnnotation(id).dict
    this.setAnnotationReply(dict, reply); dict.set(PDFName.of('M'), PDFString.fromDate(new Date()))
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
    const moved = { ...rect, x: rect.x + deltaX, y: rect.y + deltaY }
    dict.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(moved, geometry)))
    const quads = numberArray(this.document, dict.get(PDFName.of('QuadPoints')))
    if (quads.length) {
      const shifted = pdfQuadsToDisplayRects(quads, geometry).map((value) => ({ ...value, x: value.x + deltaX, y: value.y + deltaY }))
      dict.set(PDFName.of('QuadPoints'), this.document.context.obj(displayRectsToPdfQuads(shifted, geometry)))
    }
    await this.commit()
  }

  async deleteAnnotation(id: string): Promise<void> {
    const entry = this.findAnnotation(id)
    entry.page.node.Annots()?.remove(entry.index)
    await this.commit()
  }
}

export { KIND_LABEL }
