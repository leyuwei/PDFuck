import { describe, expect, it } from 'vitest'
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import { fitTextAdvances, insertionPointAt, moveTextPosition, textCaretAtPoint, textItemsToEditableRegions, textItemsToWordBoxes, textSelectionBetween, textSelectionForQuery } from './text-layout'

describe('PDF text layout', () => {
  it('places selection above the PDF baseline using font ascent', () => {
    const item = { str: 'Hello world', width: 66, height: 12, transform: [12, 0, 0, 12, 40, 700], fontName: 'f1' } as TextItem
    const styles = { f1: { ascent: 0.75, descent: -0.25, vertical: false, fontFamily: 'serif' } as TextStyle }
    const words = textItemsToWordBoxes([item], styles, [1, 0, 0, -1, 0, 792])
    expect(words[0].rect.y).toBeCloseTo(83)
    expect(words[0].rect.height).toBeCloseTo(12)
    expect(words[0].rect.y + words[0].rect.height).toBeCloseTo(95)
  })

  it('normalizes subset-font metrics that use a scaled coordinate system', () => {
    const item = { str: '项目支撑国家数据基础设施建设工程', width: 180, height: 10.8, transform: [10.8, 0, 0, 10.8, 81, 308], fontName: 'subset' } as TextItem
    const styles = { subset: { ascent: 0.107421875, descent: -0.017578125, vertical: false, fontFamily: 'sans-serif' } as TextStyle }
    const words = textItemsToWordBoxes([item], styles, [1, 0, 0, -1, 0, 842])
    const baseline = 534
    expect(baseline - words[0].rect.y).toBeGreaterThan(10.8 * 0.8)
    expect(words[0].rect.y + words[0].rect.height - baseline).toBeLessThan(10.8 * 0.2)
  })

  it('creates editable text regions with inherited size, font family and emphasis', () => {
    const item = { str: 'Editable title', width: 126, height: 18, transform: [18, 0, 0, 18, 40, 700], fontName: 'fTitle', hasEOL: true } as TextItem
    const styles = { fTitle: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Times New Roman' } as TextStyle }
    const regions = textItemsToEditableRegions([item], styles, [1, 0, 0, -1, 0, 792], { fTitle: { name: 'Times-BoldItalic', loadedName: 'g_d0_f1', bold: true, italic: true } })
    expect(regions).toEqual([expect.objectContaining({ text: 'Editable title', lines: [{ text: 'Editable title', rect: expect.objectContaining({ x: 40, y: 77.6, width: 126, height: 18 }) }], rect: expect.objectContaining({ x: 40, y: 77.6, width: 126, height: 18 }), style: expect.objectContaining({ font: 'Times New Roman', sourceFont: 'g_d0_f1', size: 18, bold: true, italic: true, lineHeight: 1 }) })])
  })

  it('merges nearby line fragments into paragraph-sized regions without joining columns', () => {
    const item = (str: string, x: number, baseline: number, width: number, fontName = 'body') => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName, hasEOL: true }) as TextItem
    const items = [
      item('A nearby', 40, 700, 58),
      item('paragraph line', 40, 684, 88),
      item('continues here.', 40, 668, 82),
      item('A second paragraph.', 40, 635, 112),
      item('Right column one', 320, 700, 94),
      item('Right column two', 320, 684, 94)
    ]
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const regions = textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 792], { body: { name: 'Helvetica' } })
    expect(regions.map((region) => region.text)).toEqual([
      'A nearby\nparagraph line\ncontinues here.',
      'Right column one\nRight column two',
      'A second paragraph.'
    ])
    expect(regions[0].sourceRects).toHaveLength(3)
    expect(regions[1].rect.x).toBe(320)
  })

  it('keeps staggered neighboring columns in separate editable regions', () => {
    const item = (str: string, x: number, baseline: number, width: number) => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName: 'body', hasEOL: true }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const regions = textItemsToEditableRegions([
      item('Left column line one', 40, 700, 190), item('Right column line one', 245, 698, 190),
      item('Left column line two', 40, 684, 190), item('Right column line two', 245, 682, 190)
    ], styles, [1, 0, 0, -1, 0, 792])
    expect(regions.map((region) => region.text)).toEqual(['Left column line one\nLeft column line two', 'Right column line one\nRight column line two'])
  })

  it('joins adjacent fragments on the same visual line with a natural space', () => {
    const items = [
      { str: 'Hello', width: 30, height: 12, transform: [12, 0, 0, 12, 40, 700], fontName: 'body' },
      { str: 'world', width: 32, height: 12, transform: [12, 0, 0, 12, 74, 700], fontName: 'body', hasEOL: true }
    ] as TextItem[]
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const regions = textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 792])
    expect(regions).toHaveLength(1)
    expect(regions[0].text).toBe('Hello world')
    expect(regions[0].sourceRects).toHaveLength(2)
  })

  it('snaps a click to the nearest character boundary instead of selecting the word', () => {
    const caret = textCaretAtPoint([{ text: 'word', order: 0, rect: { x: 10, y: 20, width: 40, height: 12 } }], { x: 27, y: 25 })
    expect(caret).toEqual({ wordIndex: 0, offset: 2, x: 30, y: 20, height: 12 })
  })

  it('uses the closest word edge when clicking between words', () => {
    const caret = textCaretAtPoint([
      { text: 'one', order: 0, rect: { x: 10, y: 20, width: 30, height: 12 } },
      { text: 'two', order: 1, rect: { x: 50, y: 20, width: 30, height: 12 } }
    ], { x: 43, y: 25 })
    expect(caret?.x).toBe(40)
  })

  it('places an insertion marker below the line at the nearest character boundary', () => {
    const point = insertionPointAt([{ text: 'word', order: 0, rect: { x: 10, y: 20, width: 40, height: 12 } }], { x: 27, y: 25 })
    expect(point).toEqual({ x: 30, y: 32 })
  })

  it('uses measured proportional character boundaries for English text', () => {
    const word = { text: 'ill', order: 0, rect: { x: 10, y: 20, width: 24, height: 12 }, boundaries: [0, 4, 10, 24] }
    expect(textCaretAtPoint([word], { x: 16, y: 25 })).toEqual({ wordIndex: 0, offset: 1, x: 14, y: 20, height: 12 })
    expect(textSelectionBetween([word], { wordIndex: 0, offset: 1 }, { wordIndex: 0, offset: 2 })).toEqual({ text: 'l', rects: [{ x: 14, y: 20, width: 6, height: 12 }] })
  })

  it('orders formula text objects by their visual line and x position', () => {
    const item = (str: string, x: number, baseline: number, width: number, fontName = 'body') => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Times New Roman' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('x', 128, 684, 8, 'math'), item('line two', 40, 668, 55), item('line one', 40, 700, 55), item('=', 112, 684, 8, 'math'), item('y', 96, 684, 8, 'math')
    ], { ...styles, math: { ...styles.body, fontFamily: 'Times New Roman' } }, [1, 0, 0, -1, 0, 792])
    expect(words.map((word) => word.text).join(' ')).toBe('line one y = x line two')
  })

  it('keeps stacked formula glyphs in one continuous selection', () => {
    const item = (str: string, x: number, baseline: number, width: number, size = 10, fontName = 'math') => ({ str, width, height: size, transform: [size, 0, 0, size, x, baseline], fontName }) as TextItem
    const styles = { math: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Times New Roman' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('i', 120, 692, 4, 7), item('∞', 120, 698, 8, 7), item('μ', 108, 700, 7), item('˜', 108, 700, 5), item('(', 128, 700, 4), item('τ', 132, 700, 5)
    ], styles, [1, 0, 0, -1, 0, 792])
    const selection = textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: words.length - 1, offset: words.at(-1)!.text.length })
    expect(selection?.text.replace(/ /g, '')).toBe('μ˜∞i(τ')
    expect(selection?.rects.length).toBeGreaterThan(0)
  })

  it('reads two visual columns top-to-bottom instead of interleaving rows', () => {
    const item = (str: string, x: number, baseline: number, width: number) => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName: 'body' }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('R1', 230, 700, 24), item('L1', 40, 700, 24), item('R2', 230, 684, 24), item('L2', 40, 684, 24), item('R3', 230, 668, 24), item('L3', 40, 668, 24)
    ], styles, [1, 0, 0, -1, 0, 792])
    expect(words.map((word) => word.text)).toEqual(['L1', 'L2', 'L3', 'R1', 'R2', 'R3'])
  })

  it('detects three visual columns from page gutters without a column limit', () => {
    const item = (str: string, x: number, baseline: number, width: number) => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName: 'body' }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('A1', 40, 700, 24), item('B1', 220, 700, 24), item('C1', 400, 700, 24),
      item('A2', 40, 684, 24), item('B2', 220, 684, 24), item('C2', 400, 684, 24),
      item('A3', 40, 668, 24), item('B3', 220, 668, 24), item('C3', 400, 668, 24)
    ], styles, [1, 0, 0, -1, 0, 792])
    expect([...new Set(words.map((word) => word.column))]).toEqual([0, 1, 2])
    expect(words.map((word) => word.text)).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'])
  })

  it('detects columns whose gutter is narrower than 15 points', () => {
    const item = (str: string, x: number, baseline: number) => ({ str, width: 24, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName: 'body' }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('L1', 40, 700), item('R1', 70, 700), item('L2', 40, 684), item('R2', 70, 684), item('L3', 40, 668), item('R3', 70, 668)
    ], styles, [1, 0, 0, -1, 0, 792])
    expect([...new Set(words.map((word) => word.column))]).toEqual([0, 1])
    expect(words.map((word) => word.text)).toEqual(['L1', 'L2', 'L3', 'R1', 'R2', 'R3'])
  })

  it('uses an explicit page boundary correction and allows forcing one column', () => {
    const item = (str: string, x: number, baseline: number) => ({ str, width: 24, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName: 'body' }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const items = [item('L1', 40, 700), item('R1', 230, 700), item('L2', 40, 684), item('R2', 230, 684)]
    const corrected = textItemsToWordBoxes(items, styles, [1, 0, 0, -1, 0, 792], {}, { columnBoundaries: [150] })
    const singleColumn = textItemsToWordBoxes(items, styles, [1, 0, 0, -1, 0, 792], {}, { columnBoundaries: [] })
    expect([...new Set(corrected.map((word) => word.column))]).toEqual([0, 1])
    expect([...new Set(singleColumn.map((word) => word.column))]).toEqual([0])
  })

  it('marks a corrected horizontal band as one cross-column visual block', () => {
    const item = (str: string, x: number, baseline: number) => ({ str, width: 30, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName: 'body' }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('left', 40, 700), item('right', 230, 700), item('formula-left', 100, 650), item('formula-right', 190, 650), item('below-left', 40, 600), item('below-right', 230, 600)
    ], styles, [1, 0, 0, -1, 0, 792], {}, { columnBoundaries: [150], spanningRegions: [{ top: 130, bottom: 155 }] })
    const formula = words.filter((word) => word.text.startsWith('formula'))
    expect(formula).toHaveLength(2)
    expect(formula[0].visualBlock).toBe(formula[1].visualBlock)
    expect(words.find((word) => word.text === 'left')?.visualBlock).toBeUndefined()
    expect(words.find((word) => word.text === 'below-left')?.visualBlock).toBeUndefined()
  })

  it('keeps formula fragments attached to the visual run column', () => {
    const item = (str: string, x: number, baseline: number, width: number, fontName = 'body') => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName }) as TextItem
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Times New Roman' } as TextStyle }
    const words = textItemsToWordBoxes([
      item('left paragraph text', 40, 700, 180), item('=', 220, 700, 8, 'math'), item('right paragraph text', 300, 700, 180), item('x', 300, 700, 8, 'math'),
      item('left second line', 40, 684, 160), item('right second line', 300, 684, 160), item('left third line', 40, 668, 160), item('right third line', 300, 668, 160)
    ], { ...styles, math: { ...styles.body, fontFamily: 'Times New Roman' } }, [1, 0, 0, -1, 0, 792])
    const left = words.filter((word) => word.rect.x < 260)
    const right = words.filter((word) => word.rect.x >= 260)
    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    expect(new Set(left.map((word) => word.column)).size).toBe(1)
    expect(new Set(right.map((word) => word.column)).size).toBe(1)
    expect(left[0].column).not.toBe(right[0].column)
  })

  it('assigns justified line expansion to spaces instead of stretching glyphs', () => {
    expect(fitTextAdvances([5, 5, 2, 5, 5], 24, 'ab cd')).toEqual([5, 5, 4, 5, 5])
  })

  it('moves the caret one character at a time and crosses word boundaries', () => {
    const words = [
      { text: 'one', order: 0, rect: { x: 10, y: 20, width: 30, height: 12 } },
      { text: 'two', order: 1, rect: { x: 50, y: 20, width: 30, height: 12 } }
    ]
    expect(moveTextPosition(words, { wordIndex: 0, offset: 1 }, 1)).toEqual({ wordIndex: 0, offset: 2 })
    expect(moveTextPosition(words, { wordIndex: 0, offset: 3 }, 1)).toEqual({ wordIndex: 1, offset: 0 })
    expect(moveTextPosition(words, { wordIndex: 1, offset: 0 }, -1)).toEqual({ wordIndex: 0, offset: 3 })
  })

  it('creates tight partial-word rectangles in forward and reverse selections', () => {
    const words = [
      { text: 'alpha', order: 0, rect: { x: 10, y: 20, width: 50, height: 12 } },
      { text: 'beta', order: 1, rect: { x: 70, y: 20, width: 40, height: 12 } }
    ]
    const forward = textSelectionBetween(words, { wordIndex: 0, offset: 2 }, { wordIndex: 1, offset: 2 })
    const reverse = textSelectionBetween(words, { wordIndex: 1, offset: 2 }, { wordIndex: 0, offset: 2 })
    expect(forward).toEqual({ text: 'pha be', rects: [{ x: 30, y: 20, width: 60, height: 12 }] })
    expect(reverse).toEqual(forward)
  })

  it('keeps a selection split at a wide two-column gutter', () => {
    const words = [
      { text: 'left', order: 0, rect: { x: 10, y: 20, width: 32, height: 12 } },
      { text: 'right', order: 1, rect: { x: 180, y: 20, width: 40, height: 12 } }
    ]
    expect(textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 1, offset: 5 })?.rects).toEqual([
      { x: 10, y: 20, width: 32, height: 12 },
      { x: 180, y: 20, width: 40, height: 12 }
    ])
  })

  it('never unions neighboring columns even when their gutter is narrow', () => {
    const words = [
      { text: 'left', order: 0, column: 0, rect: { x: 10, y: 20, width: 32, height: 12 } },
      { text: 'right', order: 1, column: 1, rect: { x: 54, y: 20, width: 40, height: 12 } }
    ]
    expect(textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 1, offset: 5 })?.rects).toEqual([
      { x: 10, y: 20, width: 32, height: 12 },
      { x: 54, y: 20, width: 40, height: 12 }
    ])
  })

  it('selects only the tail of the first column and head of the second column', () => {
    const words = [
      { text: 'L1', order: 0, column: 0, rect: { x: 10, y: 10, width: 20, height: 12 } },
      { text: 'L2', order: 1, column: 0, rect: { x: 10, y: 30, width: 20, height: 12 } },
      { text: 'L3', order: 2, column: 0, rect: { x: 10, y: 50, width: 20, height: 12 } },
      { text: 'R1', order: 3, column: 1, rect: { x: 60, y: 10, width: 20, height: 12 } },
      { text: 'R2', order: 4, column: 1, rect: { x: 60, y: 30, width: 20, height: 12 } },
      { text: 'R3', order: 5, column: 1, rect: { x: 60, y: 50, width: 20, height: 12 } }
    ]
    const selection = textSelectionBetween(words, { wordIndex: 1, offset: 0 }, { wordIndex: 4, offset: 2 })
    expect(selection?.text).toBe('L2 L3 R1 R2')
    expect(selection?.text).not.toContain('L1')
    expect(selection?.text).not.toContain('R3')
    expect(selection?.rects.every((rect) => rect.x + rect.width <= 30 || rect.x >= 60)).toBe(true)
  })

  it('does not include another column when both drag endpoints are in one column', () => {
    const words = [
      { text: 'left', order: 0, column: 0, rect: { x: 10, y: 20, width: 32, height: 12 } },
      { text: 'right', order: 1, column: 1, rect: { x: 180, y: 20, width: 40, height: 12 } },
      { text: 'left-two', order: 2, column: 0, rect: { x: 10, y: 40, width: 60, height: 12 } },
      { text: 'right-two', order: 3, column: 1, rect: { x: 180, y: 40, width: 68, height: 12 } }
    ]
    expect(textSelectionBetween(words, { wordIndex: 1, offset: 0 }, { wordIndex: 3, offset: 9 })).toEqual({
      text: 'right right-two',
      rects: [
        { x: 180, y: 20, width: 40, height: 12 },
        { x: 180, y: 40, width: 68, height: 12 }
      ]
    })
  })

  it('keeps a paragraph selection inside its source text flow when graph labels interrupt the PDF order', () => {
    const rightRun = { x: 312, y: 20, width: 251, height: 10 }
    const words = [
      { text: 'PFS', order: 0, column: 0, textRun: 0, textRunRect: rightRun, rect: { x: 330, y: 20, width: 18, height: 10 } },
      { text: '1.8', order: 1, column: 0, textRun: 1, textRunRect: { x: 68, y: 31, width: 12, height: 8 }, rect: { x: 68, y: 31, width: 12, height: 8 } },
      { text: 'continues', order: 2, column: 0, textRun: 2, textRunRect: { x: 312, y: 40, width: 251, height: 10 }, rect: { x: 312, y: 40, width: 42, height: 10 } },
      { text: 'legend', order: 3, column: 0, textRun: 3, textRunRect: { x: 180, y: 51, width: 30, height: 8 }, rect: { x: 180, y: 51, width: 30, height: 8 } },
      { text: 'framework.', order: 4, column: 0, textRun: 4, textRunRect: { x: 312, y: 60, width: 46, height: 10 }, rect: { x: 312, y: 60, width: 46, height: 10 } }
    ]
    const selection = textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 4, offset: 10 })
    expect(selection?.text).toBe('PFS continues framework.')
    expect(selection?.text).not.toMatch(/1\.8|legend/u)
    expect(selection?.rects.every((rect) => rect.x >= 312)).toBe(true)
  })

  it('retains formula fragments inside a text flow while excluding a neighboring chart column', () => {
    const words = [
      { text: 'conditions', order: 0, column: 0, textRun: 0, textRunRect: { x: 49, y: 20, width: 251, height: 10 }, rect: { x: 49, y: 20, width: 44, height: 10 } },
      { text: '120', order: 1, column: 1, textRun: 1, textRunRect: { x: 340, y: 30, width: 12, height: 8 }, rect: { x: 340, y: 30, width: 12, height: 8 } },
      { text: 'ξ', order: 2, column: 1, textRun: 2, textRunRect: { x: 214, y: 34, width: 5, height: 7 }, rect: { x: 214, y: 34, width: 5, height: 7 } },
      { text: 'network.', order: 3, column: 0, textRun: 3, textRunRect: { x: 49, y: 48, width: 167, height: 10 }, rect: { x: 182, y: 48, width: 34, height: 10 } }
    ]
    const selection = textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 3, offset: 8 })
    expect(selection?.text).toBe('conditions ξ network.')
    expect(selection?.text).not.toContain('120')
    expect(selection?.rects.every((rect) => rect.x + rect.width <= 300)).toBe(true)
  })

  it('keeps a completed line free of a list marker emitted out of PDF stream order', () => {
    const words = [
      { text: 'as', order: 0, column: 0, rect: { x: 10, y: 20, width: 12, height: 10 } },
      // This is the actual ordering pattern seen in Scheduling0821m.pdf:
      // the next-line bullet occurs before the rest of the current line.
      { text: '•', order: 1, column: 0, rect: { x: 18, y: 35, width: 5, height: 7 } },
      { text: 'follows:', order: 2, column: 0, rect: { x: 26, y: 20, width: 40, height: 10 } }
    ]
    expect(textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 2, offset: 8 })).toEqual({
      text: 'as follows:',
      rects: [{ x: 10, y: 20, width: 56, height: 10 }]
    })
  })

  it('does not leak a next-line formula fragment into a same-line selection', () => {
    const words = [
      { text: 'constraint', order: 0, column: 0, rect: { x: 10, y: 20, width: 48, height: 10 } },
      { text: '=', order: 1, column: 0, rect: { x: 42, y: 33, width: 7, height: 7 } },
      { text: 'holds.', order: 2, column: 0, rect: { x: 62, y: 20, width: 34, height: 10 } }
    ]
    expect(textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 2, offset: 6 })).toEqual({
      text: 'constraint holds.',
      rects: [{ x: 10, y: 20, width: 86, height: 10 }]
    })
  })

  it('selects a two-line cross-column caption without absorbing body text', () => {
    const words = [
      { text: 'Fig.', order: 0, column: 0, columnAmbiguous: true, rect: { x: 10, y: 100, width: 24, height: 12 } },
      { text: '3.', order: 1, column: 0, columnAmbiguous: true, rect: { x: 38, y: 100, width: 14, height: 12 } },
      { text: 'Cross-column', order: 2, column: 0, columnAmbiguous: true, rect: { x: 56, y: 100, width: 76, height: 12 } },
      { text: 'caption.', order: 3, column: 1, columnAmbiguous: true, rect: { x: 136, y: 100, width: 52, height: 12 } },
      { text: 'Second', order: 4, column: 0, columnAmbiguous: true, rect: { x: 10, y: 110, width: 42, height: 12 } },
      { text: 'caption', order: 5, column: 0, columnAmbiguous: true, rect: { x: 56, y: 110, width: 48, height: 12 } },
      { text: 'line.', order: 6, column: 1, columnAmbiguous: true, rect: { x: 108, y: 110, width: 30, height: 12 } },
      { text: 'Body', order: 7, column: 0, rect: { x: 10, y: 130, width: 28, height: 12 } },
      { text: 'text.', order: 8, column: 0, rect: { x: 42, y: 130, width: 30, height: 12 } }
    ]
    const selection = textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 6, offset: 5 })
    expect(selection?.text).toBe('Fig. 3. Cross-column caption. Second caption line.')
    expect(selection?.text).not.toContain('Body')
    expect(selection?.rects).toEqual([
      { x: 10, y: 100, width: 122, height: 12 },
      { x: 136, y: 100, width: 52, height: 12 },
      { x: 10, y: 110, width: 94, height: 12 },
      { x: 108, y: 110, width: 30, height: 12 }
    ])
  })

  it('selects a multi-line visual block when only some fragments cross the gutter', () => {
    const words = [
      { text: 'Table', order: 0, column: 0, columnAmbiguous: true, visualBlock: 4, rect: { x: 10, y: 100, width: 30, height: 12 } },
      { text: '1.', order: 1, column: 0, columnAmbiguous: true, visualBlock: 4, rect: { x: 45, y: 100, width: 14, height: 12 } },
      { text: 'wide', order: 2, column: 0, visualBlock: 4, rect: { x: 65, y: 100, width: 28, height: 12 } },
      { text: 'table', order: 3, column: 1, visualBlock: 4, rect: { x: 98, y: 100, width: 30, height: 12 } },
      { text: 'caption', order: 4, column: 0, visualBlock: 4, rect: { x: 10, y: 114, width: 42, height: 12 } },
      { text: 'continues.', order: 5, column: 1, visualBlock: 4, rect: { x: 56, y: 114, width: 54, height: 12 } },
      { text: 'Body', order: 6, column: 0, rect: { x: 10, y: 136, width: 28, height: 12 } }
    ]
    const selection = textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 5, offset: 10 })
    expect(selection?.text).toBe('Table 1. wide table caption continues.')
    expect(selection?.text).not.toContain('Body')
    expect(selection?.rects).toEqual([
      { x: 10, y: 100, width: 83, height: 12 },
      { x: 98, y: 100, width: 30, height: 12 },
      { x: 10, y: 114, width: 42, height: 12 },
      { x: 56, y: 114, width: 54, height: 12 }
    ])
  })

  it('starts a caption at its marker even when an image label shares the block', () => {
    const words = [
      { text: '0.8', order: 0, visualBlock: 6, rect: { x: 10, y: 99, width: 20, height: 8 } },
      { text: 'Fig.', order: 1, visualBlock: 6, rect: { x: 40, y: 100, width: 24, height: 12 } },
      { text: '2.', order: 2, visualBlock: 6, rect: { x: 68, y: 100, width: 14, height: 12 } },
      { text: 'caption.', order: 3, visualBlock: 6, rect: { x: 88, y: 100, width: 52, height: 12 } }
    ]
    const selection = textSelectionBetween(words, { wordIndex: 1, offset: 0 }, { wordIndex: 3, offset: 8 })
    expect(selection?.text).toBe('Fig. 2. caption.')
    expect(selection?.text).not.toContain('0.8')
  })

  it('maps a search result to the exact matching character rectangles', () => {
    const words = [
      { text: 'Alpha', order: 0, rect: { x: 10, y: 20, width: 50, height: 12 } },
      { text: 'beta', order: 1, rect: { x: 70, y: 20, width: 40, height: 12 } },
      { text: 'alpha', order: 2, rect: { x: 120, y: 20, width: 50, height: 12 } }
    ]
    expect(textSelectionForQuery(words, 'pha be')?.rects).toEqual([{ x: 30, y: 20, width: 60, height: 12 }])
    expect(textSelectionForQuery(words, 'alpha', { occurrence: 1 })?.rects).toEqual([{ x: 120, y: 20, width: 50, height: 12 }])
    expect(textSelectionForQuery(words, 'alpha', { caseSensitive: true })?.rects).toEqual([{ x: 120, y: 20, width: 50, height: 12 }])
  })

  it('keeps fuzzy search highlighting aligned when whitespace is ignored', () => {
    const words = [
      { text: 'Alpha', order: 0, rect: { x: 10, y: 20, width: 50, height: 12 } },
      { text: 'beta', order: 1, rect: { x: 70, y: 20, width: 40, height: 12 } }
    ]
    expect(textSelectionForQuery(words, 'alphabeta', { ignoreWhitespace: true })?.rects).toEqual([{ x: 10, y: 20, width: 100, height: 12 }])
  })
})
