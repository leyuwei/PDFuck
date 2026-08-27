import { describe, expect, it } from 'vitest'
import type { EditableTextRegion, TextObjectRecord } from '../types'
import { pageTextCaretOffsetAt, pageTextRegionHasReplacement, replacementTextRect } from './page-text-edit'

const style = { font: 'sans', size: 12, color: '#182033', bold: false, italic: false, align: 'left' } as const

describe('replacementTextRect', () => {
  it('expands a short selection for longer replacement text', () => {
    const rect = replacementTextRect({ x: 20, y: 30, width: 25, height: 14 }, 'A much longer replacement', style, { width: 300, height: 500 })
    expect(rect.width).toBeGreaterThan(120)
    expect(rect.height).toBe(14)
    expect(rect.x).toBe(20)
  })

  it('keeps the replacement inside the visible page', () => {
    expect(replacementTextRect({ x: 260, y: 480, width: 30, height: 15 }, 'long replacement', style, { width: 300, height: 500 })).toEqual({ x: 260, y: 480, width: 40, height: 15 })
  })

  it('includes paragraph spacing, character spacing and width scaling in the replacement box', () => {
    const formatted = replacementTextRect({ x: 20, y: 30, width: 30, height: 12 }, 'Wide\nText', { ...style, lineHeight: 1.5, paragraphBefore: 3, paragraphAfter: 4, letterSpacing: 2, horizontalScale: 140 }, { width: 400, height: 500 })
    expect(formatted.width).toBeGreaterThan(40)
    expect(formatted.height).toBe(44)
  })

  it('preserves the source box exactly when the text still fits', () => {
    expect(replacementTextRect({ x: 40, y: 70, width: 126, height: 18 }, 'Editable title', { ...style, size: 18 }, { width: 600, height: 800 })).toEqual({ x: 40, y: 70, width: 126, height: 18 })
  })

  it('expands around the original alignment anchor', () => {
    const selected = { x: 120, y: 60, width: 40, height: 14 }
    const centered = replacementTextRect(selected, 'A centered replacement', { ...style, align: 'center' }, { width: 400, height: 300 })
    const right = replacementTextRect(selected, 'A right aligned replacement', { ...style, align: 'right' }, { width: 400, height: 300 })
    expect(centered.x + centered.width / 2).toBeCloseTo(140)
    expect(right.x + right.width).toBeCloseTo(160)
  })

  it('places the caret on the clicked line and character boundary', () => {
    const region: EditableTextRegion = {
      id: 'source', text: 'First\nSecond', rect: { x: 20, y: 30, width: 90, height: 30 },
      sourceRects: [{ x: 20, y: 30, width: 50, height: 12 }, { x: 20, y: 48, width: 90, height: 12 }],
      lines: [{ text: 'First', rect: { x: 20, y: 30, width: 50, height: 12 } }, { text: 'Second', rect: { x: 20, y: 48, width: 90, height: 12 } }],
      style
    }
    expect(pageTextCaretOffsetAt(region, { x: 20, y: 52 })).toBe(6)
    expect(pageTextCaretOffsetAt(region, { x: 110, y: 52 })).toBe(12)
  })

  it('matches replacements by their source glyph boxes instead of expanded output geometry', () => {
    const region: EditableTextRegion = { id: 'source', text: 'Original', rect: { x: 20, y: 30, width: 60, height: 12 }, sourceRects: [{ x: 20, y: 30, width: 60, height: 12 }], lines: [{ text: 'Original', rect: { x: 20, y: 30, width: 60, height: 12 } }], style }
    const replacement = { id: 'replacement', pageIndex: 0, rect: { x: 20, y: 30, width: 180, height: 16 }, sourceRects: region.sourceRects, fixedToSource: true, text: 'Much longer replacement', style } satisfies TextObjectRecord
    expect(pageTextRegionHasReplacement(region, [replacement])).toBe(true)
    expect(pageTextRegionHasReplacement({ ...region, rect: { ...region.rect, y: 80 }, sourceRects: [{ ...region.sourceRects[0], y: 80 }] }, [replacement])).toBe(false)
  })
})
