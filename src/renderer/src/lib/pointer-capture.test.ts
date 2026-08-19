import { describe, expect, it } from 'vitest'
import { pageToolUsesPointerCapture } from './pointer-capture'

describe('pageToolUsesPointerCapture', () => {
  it('does not retain the page pointer when an annotation dialog opens immediately', () => {
    expect(pageToolUsesPointerCapture('note')).toBe(false)
    expect(pageToolUsesPointerCapture('insert')).toBe(false)
  })

  it('retains the pointer for selection and area drag tools', () => {
    expect(pageToolUsesPointerCapture('none')).toBe(true)
    expect(pageToolUsesPointerCapture('highlight')).toBe(true)
    expect(pageToolUsesPointerCapture('crop')).toBe(true)
    expect(pageToolUsesPointerCapture('add_text')).toBe(true)
  })
})
