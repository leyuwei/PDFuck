import { describe, expect, it } from 'vitest'
import { replacementTextRect } from './page-text-edit'

const style = { font: 'sans', size: 12, color: '#182033', bold: false, italic: false, align: 'left' } as const

describe('replacementTextRect', () => {
  it('expands a short selection for longer replacement text', () => {
    const rect = replacementTextRect({ x: 20, y: 30, width: 25, height: 14 }, 'A much longer replacement', style, { width: 300, height: 500 })
    expect(rect.width).toBeGreaterThan(120)
    expect(rect.height).toBeGreaterThanOrEqual(15)
  })

  it('keeps the replacement inside the visible page', () => {
    expect(replacementTextRect({ x: 260, y: 480, width: 30, height: 15 }, 'long replacement', style, { width: 300, height: 500 })).toEqual({ x: 260, y: 480, width: 40, height: 15 })
  })
})
