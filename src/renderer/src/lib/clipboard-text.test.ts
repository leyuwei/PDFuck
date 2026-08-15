import { describe, expect, it } from 'vitest'
import { normalizeCopiedText } from './clipboard-text'

describe('normalizeCopiedText', () => {
  it('removes PDF line endings while keeping word boundaries', () => {
    expect(normalizeCopiedText('PDF copy\r\noften has\nline breaks.')).toBe('PDF copy often has line breaks.')
  })

  it('joins wrapped CJK lines without adding artificial spaces', () => {
    expect(normalizeCopiedText('这是第一行\n这是第二行。')).toBe('这是第一行这是第二行。')
  })

  it('repairs simple English line-break hyphenation', () => {
    expect(normalizeCopiedText('high-perfor-\nmance PDF')).toBe('high-performance PDF')
  })
})
