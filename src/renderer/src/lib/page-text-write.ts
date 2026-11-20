import { beginMarkedContent, concatTransformationMatrix, drawObject, endMarkedContent, popGraphicsState, pushGraphicsState, type PDFDocument, type PDFPage } from 'pdf-lib'
import type { PageTextRenderRequest, PageTextRenderResult } from '../../../shared/contracts'
import type { EditableTextRegion, PdfRect, TextStyle } from '../types'
import { editNativePageText } from './native-page-text'
import { displayRectToPdfBounds, inverseMatrix, multiplyMatrix, type Matrix } from './page-coordinates'
import { PAGE_TEXT_BLOCK_PREFIX, movePageTextBlock, pageTextBlockMetadata, pageTextBlocks, removePageTextBlock } from './page-text-blocks'

/** Keep exact small edits; typeset ordinary growth and formatting automatically. */
export async function writePageText(document: PDFDocument, page: PDFPage, viewport: Matrix, region: EditableTextRegion, text: string, style: TextStyle, preserve: boolean, render?: (request: PageTextRenderRequest) => Promise<PageTextRenderResult>, target?: PdfRect): Promise<{ changed: boolean; rect: PdfRect; fallbackUsed: boolean }> {
  if (target && preserve && text === region.text && (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(target[key] - region.rect[key]) < .01)) return { changed: false, rect: region.rect, fallbackUsed: false }
  if (!target && preserve) {
    try { return { changed: editNativePageText(document, page, viewport, region, text), rect: region.rect, fallbackUsed: false } }
    catch (error) { if (!render || !(error instanceof Error) || !['ui.nativeTextUnsupported', 'ui.nativeTextOverflow', 'ui.nativeTextMissingGlyph'].includes(error.message)) throw error }
  }
  if (!render) throw new Error('ui.nativeTextUnsupported')
  const geometry = { ...page.getCropBox(), rotation: page.getRotation().angle }
  const pageWidth = viewport[0] ? geometry.width : geometry.height
  const pageHeight = viewport[0] ? geometry.height : geometry.width
  const block = region.savedBlock ? pageTextBlocks(page, geometry).find(({ record }) => record.id === region.id) : undefined
  if (region.savedBlock && !block) throw new Error('ui.nativeTextStale')
  if (target && block && preserve && text === block.record.text && Math.abs(target.width - region.rect.width) < .01 && Math.abs(target.height - region.rect.height) < .01) {
    const rect = { ...region.rect, x: Math.max(0, Math.min(target.x, pageWidth - target.width)), y: Math.max(0, Math.min(target.y, pageHeight - target.height)) }
    const dx = rect.x - region.rect.x, dy = rect.y - region.rect.y
    const [a, b, c, d] = inverseMatrix(viewport)
    movePageTextBlock(page, block, displayRectToPdfBounds(rect, geometry), { x: a * dx + c * dy, y: b * dx + d * dy })
    return { changed: true, rect, fallbackUsed: false }
  }
  const removal: NonNullable<Parameters<typeof editNativePageText>[5]> = {}
  if (block) removePageTextBlock(page, block)
  else editNativePageText(document, page, viewport, region, '', removal)
  if (!text.trim()) return { changed: true, rect: region.rect, fallbackUsed: false }
  const firstLine = region.lines.find(line => line.sources?.length)
  const source = region.nativeFonts?.[firstLine?.sources?.[0]?.font || ''], native = removal.style
  const sameTypeface = style.font === region.style.font && style.sourceFont && style.bold === region.style.bold && style.italic === region.style.italic
  const ratio = region.style.size / (native?.size || region.style.size)
  const width = target ? Math.min(target.width, pageWidth) : Math.max(region.rect.width, region.layoutWidth || region.rect.width)
  const request: PageTextRenderRequest = {
    text, originalText: region.text, width, size: style.size, color: preserve ? native?.color || style.color : style.color, family: style.font,
    bold: style.bold, italic: style.italic, align: style.align,
    leading: style.size * (style.lineHeight || 1.25),
    baseline: (target ? Math.max(style.size * .78, (firstLine?.sources?.[0]?.y ?? region.rect.y) - (firstLine?.rect.y ?? region.rect.y)) : (firstLine?.sources?.[0]?.y || region.rect.y + region.style.size * .8) - region.rect.y) + (style.paragraphBefore || 0),
    bottom: style.paragraphAfter || 0,
    firstIndent: Math.min(width * .25, Math.max(0, (firstLine?.sources?.[0]?.x ?? region.rect.x) - region.rect.x)),
    spacing: style.letterSpacing === region.style.letterSpacing ? (native?.spacing || 0) * ratio : style.letterSpacing || 0,
    wordSpacing: (native?.wordSpacing || 0) * ratio,
    justified: region.justified && style.align === region.style.align,
    preserveLineBreaks: Boolean(target),
    kerning: removal.kerning ? Object.fromEntries(Object.entries(removal.kerning).map(([pair, value]) => [pair, value * style.size / (native?.size || style.size)])) : undefined,
    scale: style.horizontalScale === region.style.horizontalScale ? native?.scale || 1 : (style.horizontalScale || 100) / 100,
    source: sameTypeface && source?.program && source.fontChars && source.loadedName ? { name: source.name, loadedName: source.loadedName, postscriptName: source.postscriptName, program: source.program, unicode: source.unicode, fontChars: source.fontChars, widths: source.widths, matrix: source.matrix } : undefined,
  }
  const result = await render(request)
  const height = Math.max(target?.height ?? region.rect.height, result.height)
  if (target && height > pageHeight) throw new Error('ui.nativeTextOverflow')
  const rect = target
    ? { x: Math.max(0, Math.min(target.x, pageWidth - width)), y: Math.max(0, Math.min(target.y, pageHeight - height)), width, height }
    : { ...region.rect, width, height }
  const [embedded] = await document.embedPdf(result.pdf, [0])
  const transform = multiplyMatrix(inverseMatrix(viewport), [1, 0, 0, -1, rect.x, rect.y + embedded.height])
  const name = page.node.newXObject('PDFuckEditedText', embedded.ref)
  const operators = [pushGraphicsState(), concatTransformationMatrix(...transform), drawObject(name), popGraphicsState()]
  if (target) {
    const id = block?.record.id ?? PAGE_TEXT_BLOCK_PREFIX + crypto.randomUUID().replaceAll('-', '')
    const data = pageTextBlockMetadata({ id, bounds: displayRectToPdfBounds(rect, geometry), text,
      style: { ...style, color: request.color, sourceFont: undefined } }, name)
    const content = [beginMarkedContent(id), ...operators, endMarkedContent()].map(operator => operator.toString()).join('\n')
    page.node.addContentStream(document.context.register(document.context.flateStream(content + '\n', data)))
  } else page.pushOperators(...operators)
  return { changed: true, rect, fallbackUsed: result.fallbackUsed }
}
