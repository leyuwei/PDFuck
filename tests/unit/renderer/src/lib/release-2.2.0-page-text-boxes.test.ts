import { PDFDocument, PDFName } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { pageTextBlockMetadata, pageTextBlocks, PAGE_TEXT_BLOCK_PREFIX, removePageTextBlock } from '../../../../../src/renderer/src/lib/page-text-blocks'
import { pageTextCaretOffsetAt } from '../../../../../src/renderer/src/lib/page-text-edit'
import { displayRectToPdfBounds } from '../../../../../src/renderer/src/lib/page-coordinates'
import { textItemsToEditableRegions } from '../../../../../src/renderer/src/lib/text-layout'
import type { EditableTextRegion, TextStyle } from '../../../../../src/renderer/src/types'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

const style: TextStyle = { font: 'Arial', size: 10, color: '#102030', bold: false, italic: false, align: 'left' }
const item = (str: string, x: number, y: number, width: number, fontName = 'body', hasEOL = false): TextItem =>
  ({ str, dir: 'ltr', width, height: 10, transform: [10, 0, 0, 10, x, y], fontName, hasEOL })
const styles = {
  body: { fontFamily: 'sans-serif', ascent: .8, descent: -.2, vertical: false },
  fallback: { fontFamily: 'monospace', ascent: .78, descent: -.22, vertical: false }
}
const extract = (items: TextItem[]) => textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 300])

describe('editable page text box boundaries', () => {
  it('absorbs adjacent fallback punctuation at a slightly shifted baseline', () => {
    const result = extract([
      item('Example', 24, 250, 45, 'body', true),
      item('.', 69.2, 249.5, 2.5, 'fallback', true),
      item('Another line', 24, 235, 66, 'body', true)
    ])
    expect(result.map(box => box.text)).toEqual(['Example.\nAnother line'])
    expect(result[0].sourceRects).toHaveLength(3)
  })

  it('keeps an adjacent column and distinct baselines separate', () => {
    const result = extract([
      item('Left cell', 24, 250, 45, 'body', true),
      item('Right cell', 83, 249.5, 51, 'body', true),
      item('Next row', 24, 239, 44, 'body', true),
      item('Next value', 83, 239, 55, 'body', true)
    ])
    expect(new Set(result.map(box => box.text))).toEqual(new Set(['Left cell\nNext row', 'Right cell\nNext value']))
  })

  it('preserves a caret on the second visible line after a blank line', () => {
    const first = { x: 0, y: 0, width: 20, height: 10 }
    const next = { x: 0, y: 25, width: 30, height: 10 }
    const box: EditableTextRegion = {
      id: 'saved', savedBlock: true, text: 'One\n\nTwo', style,
      rect: { ...first, width: 30, height: 35 }, sourceRects: [first, next],
      lines: [{ text: 'One', rect: first }, { text: 'Two', rect: next }]
    }
    expect(pageTextCaretOffsetAt(box, { x: 0, y: 29 })).toBe(5)
    expect(pageTextCaretOffsetAt(box, { x: 30, y: 29 })).toBe(8)
  })

  it('keeps UTF-16 text and geometry in one document stream and removes only that stream', async () => {
    const pdf = await PDFDocument.create(), page = pdf.addPage([240, 300])
    const geometry = { x: 0, y: 0, width: 240, height: 300, rotation: 90 }
    const rect = { x: 35, y: 42, width: 120, height: 50 }
    const native = pdf.context.register(pdf.context.flateStream('q Q'))
    page.node.addContentStream(native)
    const id = PAGE_TEXT_BLOCK_PREFIX + 'a'.repeat(32)
    const xobject = PDFName.of('PDFuckEditedTextTest')
    const text = '段落\n\n第二行 – Teкст'
    page.node.addContentStream(pdf.context.register(pdf.context.flateStream('q Q', pageTextBlockMetadata({
      id, bounds: displayRectToPdfBounds(rect, geometry), text, style
    }, xobject))))
    const loaded = await PDFDocument.load(await pdf.save())
    const target = loaded.getPage(0)
    const [block] = pageTextBlocks(target, geometry)
    expect(block.record).toMatchObject({ text, rect, id, pageTextBlock: true })
    removePageTextBlock(target, block)
    expect(pageTextBlocks(target, geometry)).toHaveLength(0)
    expect(target.node.Contents()?.toString()).toContain(native.toString())
  })
})
