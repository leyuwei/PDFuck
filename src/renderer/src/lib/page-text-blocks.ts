import { PDFArray, PDFDict, PDFHexString, PDFName, PDFRawStream, concatTransformationMatrix, decodePDFRawStream, type PDFPage } from 'pdf-lib'
import type { PdfPoint, TextObjectRecord, TextStyle } from '../types'
import { pdfBoundsToDisplayRect, type PageGeometry } from './page-coordinates'

export const PAGE_TEXT_BLOCK_PREFIX = 'PDFuckTextBlock'
const metadataKey = PDFName.of('PDFuckPageTextBlock')
const xobjectKey = PDFName.of('PDFuckPageTextXObject')

interface BlockMetadata {
  id: string
  bounds: number[]
  text: string
  style: TextStyle
}

export function pageTextBlockMetadata(metadata: BlockMetadata, name: PDFName) {
  return { [metadataKey.decodeText()]: PDFHexString.fromText(JSON.stringify(metadata)), [xobjectKey.decodeText()]: name }
}

export function pageTextBlocks(page: PDFPage, geometry: PageGeometry) {
  const contents = page.node.Contents()
  const entries = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.Contents)]
  return entries.flatMap((entry, index) => {
    const stream = page.doc.context.lookup(entry)
    if (!(stream instanceof PDFRawStream)) return []
    const value = stream.dict.get(metadataKey), xobject = stream.dict.get(xobjectKey)
    if (!(value instanceof PDFHexString) || !(xobject instanceof PDFName)) return []
    try {
      const { id, bounds, text, style } = JSON.parse(value.decodeText()) as BlockMetadata
      if (!/^PDFuckTextBlock[a-f0-9]{32}$/.test(id) || !Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) ||
          typeof text !== 'string' || text.length > 50000 || typeof style?.font !== 'string' || !Number.isFinite(style.size) || style.size <= 0 ||
          !/^#[a-f\d]{6}$/i.test(style.color) || !['left', 'center', 'right'].includes(style.align)) return []
      const record: TextObjectRecord = { id, pageIndex: 0, pageTextBlock: true, text, style, rect: pdfBoundsToDisplayRect(bounds, geometry) }
      return [{ record, index, xobject, stream }]
    } catch { return [] }
  })
}

export function movePageTextBlock(page: PDFPage, block: ReturnType<typeof pageTextBlocks>[number], bounds: number[], delta: PdfPoint) {
  const context = page.doc.context
  const original = new TextDecoder().decode(decodePDFRawStream(block.stream).decode())
  const translate = concatTransformationMatrix(1, 0, 0, 1, delta.x, delta.y)
  const metadata = pageTextBlockMetadata({ id: block.record.id, text: block.record.text, style: block.record.style, bounds }, block.xobject)
  const replacement = context.register(context.flateStream(`q\n${translate}\n${original}\nQ\n`, metadata))
  const contents = page.node.Contents()
  const entries = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.Contents)!]
  entries[block.index] = replacement
  page.node.set(PDFName.Contents, context.obj(entries))
}

export function removePageTextBlock(page: PDFPage, block: ReturnType<typeof pageTextBlocks>[number]) {
  const contents = page.node.Contents()
  if (contents instanceof PDFArray) page.node.set(PDFName.Contents, page.doc.context.obj(contents.asArray().filter((_, index) => index !== block.index)))
  else page.node.delete(PDFName.Contents)
  const context = page.doc.context
  const resources = page.node.Resources()?.clone(context) || context.obj({})
  const xobjects = resources.lookupMaybe(PDFName.XObject, PDFDict)?.clone(context)
  xobjects?.delete(block.xobject)
  if (xobjects) resources.set(PDFName.XObject, xobjects)
  page.node.set(PDFName.Resources, resources)
}

