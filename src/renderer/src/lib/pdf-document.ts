import {
  PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFRef, PDFString,
  StandardFonts, type PDFFont, type PDFPage
} from 'pdf-lib'
import type { AnnotationKind, AnnotationRecord, PdfPoint, PdfRect, TextObjectRecord, TextStyle } from '../types'
import { rectUnion } from './geometry'
import {
  displayRectToPdfBounds, displayRectsToPdfQuads, pdfBoundsToDisplayRect, pdfQuadsToDisplayRects,
  type PageGeometry
} from './page-coordinates'

const KIND_LABEL: Record<AnnotationKind, string> = {
  highlight: '高亮', note: '便笺', replace: '替换', insert: '插入文字', delete: '删除线', underline: '下划线'
}

function hexColor(value: string): [number, number, number] {
  const hex = value.replace('#', '').padEnd(6, '0')
  return [Number.parseInt(hex.slice(0, 2), 16) / 255, Number.parseInt(hex.slice(2, 4), 16) / 255, Number.parseInt(hex.slice(4, 6), 16) / 255]
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
  filePath?: string
  fileName = '未命名.pdf'
  dirty = false

  static async load(data: Uint8Array, path?: string, name?: string): Promise<PdfDocumentModel> {
    const model = new PdfDocumentModel()
    model.document = await PDFDocument.load(data, { updateMetadata: false })
    model.currentBytes = new Uint8Array(data)
    model.filePath = path
    model.fileName = name || path?.split(/[\\/]/).pop() || '未命名.pdf'
    return model
  }

  get bytes(): Uint8Array { return Uint8Array.from(this.currentBytes) }
  get pageCount(): number { return this.document.getPageCount() }
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

  private async commit(): Promise<void> {
    this.currentBytes = Uint8Array.from(await this.document.save({ useObjectStreams: false, addDefaultPage: false }))
    this.dirty = true
  }

  markSaved(path: string): void {
    this.filePath = path
    this.fileName = path.split(/[\\/]/).pop() || this.fileName
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
    let font = StandardFonts.Helvetica
    if (style.font === 'serif') font = StandardFonts.TimesRoman
    if (style.font === 'mono') font = StandardFonts.Courier
    if (style.font === 'sans' && style.bold && style.italic) font = StandardFonts.HelveticaBoldOblique
    else if (style.font === 'sans' && style.bold) font = StandardFonts.HelveticaBold
    else if (style.font === 'sans' && style.italic) font = StandardFonts.HelveticaOblique
    else if (style.font === 'serif' && style.bold && style.italic) font = StandardFonts.TimesRomanBoldItalic
    else if (style.font === 'serif' && style.bold) font = StandardFonts.TimesRomanBold
    else if (style.font === 'serif' && style.italic) font = StandardFonts.TimesRomanItalic
    else if (style.font === 'mono' && style.bold && style.italic) font = StandardFonts.CourierBoldOblique
    else if (style.font === 'mono' && style.bold) font = StandardFonts.CourierBold
    else if (style.font === 'mono' && style.italic) font = StandardFonts.CourierOblique
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
      const words = text.replace(/\r/g, '').split(/(\n|\s+)/)
      const lines: string[] = []
      let line = ''
      for (const word of words) {
        if (word === '\n') { lines.push(line.trimEnd()); line = ''; continue }
        const candidate = line + word
        if (line && font.widthOfTextAtSize(candidate, style.size) > width) { lines.push(line.trimEnd()); line = word.trimStart() }
        else line = candidate
      }
      if (line || !lines.length) lines.push(line)
      const lineHeight = style.size * 1.25
      const operators = lines.slice(0, Math.max(1, Math.floor(height / lineHeight))).map((value, index) => {
        const lineWidth = font.widthOfTextAtSize(value, style.size)
        const offset = style.align === 'center' ? (width - lineWidth) / 2 : style.align === 'right' ? width - lineWidth : 0
        const y = Math.max(0, height - style.size - index * lineHeight)
        return `BT /F0 ${style.size} Tf ${red} ${green} ${blue} rg 1 0 0 1 ${Math.max(0, offset)} ${y} Tm ${font.encodeText(value)} Tj ET`
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
    dictionary.set(PDFName.of('PDFuckFont'), PDFName.of(style.font))
    dictionary.set(PDFName.of('PDFuckSize'), PDFNumber.of(style.size))
    dictionary.set(PDFName.of('PDFuckColor'), PDFString.of(style.color))
    dictionary.set(PDFName.of('PDFuckBold'), PDFName.of(style.bold ? 'true' : 'false'))
    dictionary.set(PDFName.of('PDFuckItalic'), PDFName.of(style.italic ? 'true' : 'false'))
    dictionary.set(PDFName.of('PDFuckAlign'), PDFName.of(style.align))
    page.node.addAnnot(this.document.context.register(dictionary))
    await this.commit()
    return id
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
      return [{
        id, pageIndex: entry.pageIndex, kind,
        author: decodeObject(this.document, entry.dict.get(PDFName.of('T'))) || 'PDFuck',
        content: decodeObject(this.document, entry.dict.get(PDFName.of('Contents'))),
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
          font: font === 'serif' || font === 'mono' ? font : 'sans',
          size: numberValue(this.document, entry.dict.get(PDFName.of('PDFuckSize')), 16),
          color: decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckColor'))) || '#182033',
          bold: decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckBold'))) === 'true',
          italic: decodeObject(this.document, entry.dict.get(PDFName.of('PDFuckItalic'))) === 'true',
          align: align === 'center' || align === 'right' ? align : 'left'
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
    dict.set(PDFName.of('PDFuckFont'), PDFName.of(style.font))
    dict.set(PDFName.of('PDFuckSize'), PDFNumber.of(style.size))
    dict.set(PDFName.of('PDFuckColor'), PDFString.of(style.color))
    dict.set(PDFName.of('PDFuckBold'), PDFName.of(style.bold ? 'true' : 'false'))
    dict.set(PDFName.of('PDFuckItalic'), PDFName.of(style.italic ? 'true' : 'false'))
    dict.set(PDFName.of('PDFuckAlign'), PDFName.of(style.align))
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

  async addAnnotation(pageIndex: number, kind: AnnotationKind, rects: PdfRect[], content = '', point?: PdfPoint): Promise<string> {
    const page = this.document.getPage(pageIndex)
    const geometry = pageGeometry(page)
    const id = `pdfuck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let normalized = rects
    if (kind === 'note' && point) normalized = [{ x: point.x, y: point.y, width: 20, height: 20 }]
    if (kind === 'insert' && point) normalized = [{ x: point.x - 4, y: point.y - 4, width: 8, height: 8 }]
    if (!normalized.length) throw new Error('请先选择文字或页面位置。')
    const bounds = rectUnion(normalized)
    const color = kind === 'highlight' ? [1, 0.82, 0.16] : kind === 'note' ? [1, 0.72, 0.1] : [0.16, 0.48, 0.95]
    const dictionary = this.document.context.obj({})
    dictionary.set(PDFName.of('Type'), PDFName.of('Annot'))
    dictionary.set(PDFName.of('Subtype'), PDFName.of(subtypeFor(kind)))
    dictionary.set(PDFName.of('Rect'), this.document.context.obj(displayRectToPdfBounds(bounds, geometry)))
    dictionary.set(PDFName.of('Contents'), pdfString(content))
    dictionary.set(PDFName.of('T'), pdfString('PDFuck'))
    dictionary.set(PDFName.of('NM'), pdfString(id))
    dictionary.set(PDFName.of('M'), PDFString.fromDate(new Date()))
    dictionary.set(PDFName.of('C'), this.document.context.obj(color))
    dictionary.set(PDFName.of('CA'), PDFNumber.of(kind === 'highlight' ? 0.35 : 1))
    dictionary.set(PDFName.of('F'), PDFNumber.of(4))
    dictionary.set(PDFName.of('Subj'), pdfString(KIND_LABEL[kind]))
    if (!['note', 'insert'].includes(kind)) dictionary.set(PDFName.of('QuadPoints'), this.document.context.obj(displayRectsToPdfQuads(normalized, geometry)))
    if (kind === 'insert') dictionary.set(PDFName.of('Sy'), PDFName.of('P'))
    page.node.addAnnot(this.document.context.register(dictionary))
    await this.commit()
    return id
  }

  async updateAnnotation(id: string, content: string): Promise<void> {
    this.findAnnotation(id).dict.set(PDFName.of('Contents'), pdfString(content))
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
