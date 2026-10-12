import { concatTransformationMatrix, drawObject, popGraphicsState, pushGraphicsState, type PDFDocument, type PDFPage } from 'pdf-lib'
import type { PageTextRenderRequest, PageTextRenderResult } from '../../../shared/contracts'
import type { EditableTextRegion, PdfRect, TextStyle } from '../types'
import { editNativePageText } from './native-page-text'
import { inverseMatrix, multiplyMatrix, type Matrix } from './page-coordinates'

/** Keep exact small edits; typeset ordinary growth and formatting automatically. */
export async function writePageText(document: PDFDocument, page: PDFPage, viewport: Matrix, region: EditableTextRegion, text: string, style: TextStyle, preserve: boolean, render?: (request: PageTextRenderRequest) => Promise<PageTextRenderResult>): Promise<{ changed: boolean; rect: PdfRect; fallbackUsed: boolean }> {
  if (preserve) {
    try { return { changed: editNativePageText(document, page, viewport, region, text), rect: region.rect, fallbackUsed: false } }
    catch (error) { if (!render || !(error instanceof Error) || !['ui.nativeTextUnsupported', 'ui.nativeTextOverflow', 'ui.nativeTextMissingGlyph'].includes(error.message)) throw error }
  }
  if (!render) throw new Error('ui.nativeTextUnsupported')
  const removal: NonNullable<Parameters<typeof editNativePageText>[5]> = {}
  editNativePageText(document, page, viewport, region, '', removal)
  if (!text.trim()) return { changed: true, rect: region.rect, fallbackUsed: false }
  const source = region.nativeFonts?.[region.lines[0].sources?.[0]?.font || ''], native = removal.style
  const sameTypeface = style.font === region.style.font && style.sourceFont && style.bold === region.style.bold && style.italic === region.style.italic
  const ratio = region.style.size / (native?.size || region.style.size)
  const width = Math.max(region.rect.width, region.layoutWidth || region.rect.width)
  const request: PageTextRenderRequest = {
    text, originalText: region.text, width, size: style.size, color: preserve ? native?.color || style.color : style.color, family: style.font,
    bold: style.bold, italic: style.italic, align: style.align,
    leading: style.size * (style.lineHeight || 1.25),
    baseline: (region.lines[0].sources?.[0]?.y || region.rect.y + region.style.size * .8) - region.rect.y + (style.paragraphBefore || 0),
    bottom: style.paragraphAfter || 0,
    firstIndent: Math.max(0, (region.lines[0].sources?.[0]?.x || region.rect.x) - region.rect.x),
    spacing: style.letterSpacing === region.style.letterSpacing ? (native?.spacing || 0) * ratio : style.letterSpacing || 0,
    wordSpacing: (native?.wordSpacing || 0) * ratio,
    justified: region.justified && style.align === region.style.align,
    kerning: removal.kerning ? Object.fromEntries(Object.entries(removal.kerning).map(([pair, value]) => [pair, value * style.size / (native?.size || style.size)])) : undefined,
    scale: style.horizontalScale === region.style.horizontalScale ? native?.scale || 1 : (style.horizontalScale || 100) / 100,
    source: sameTypeface && source?.program && source.fontChars && source.loadedName ? { name: source.name, loadedName: source.loadedName, postscriptName: source.postscriptName, program: source.program, unicode: source.unicode, fontChars: source.fontChars, widths: source.widths, matrix: source.matrix } : undefined,
  }
  const result = await render(request)
  const [embedded] = await document.embedPdf(result.pdf, [0])
  const transform = multiplyMatrix(inverseMatrix(viewport), [1, 0, 0, -1, region.rect.x, region.rect.y + embedded.height])
  const name = page.node.newXObject('PDFuckEditedText', embedded.ref)
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...transform), drawObject(name), popGraphicsState())
  return { changed: true, rect: { ...region.rect, width, height: Math.max(region.rect.height, result.height) }, fallbackUsed: result.fallbackUsed }
}
