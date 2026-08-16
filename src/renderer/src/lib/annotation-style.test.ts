import { describe, expect, it } from 'vitest'
import { DEFAULT_ANNOTATION_COLOR, DEEP_BLUE, normalizeHexColor, quickReply } from './annotation-style'

describe('annotation styles and replies', () => {
  it('uses deep blue for replacement and insertion marks', () => {
    expect(DEFAULT_ANNOTATION_COLOR.replace).toBe(DEEP_BLUE)
    expect(DEFAULT_ANNOTATION_COLOR.insert).toBe(DEEP_BLUE)
    expect(DEFAULT_ANNOTATION_COLOR.delete).not.toBe(DEEP_BLUE)
  })

  it('creates the three quick replies with persistent status values', () => {
    expect(quickReply('handled')).toEqual({ status: 'handled', content: '已处理' })
    expect(quickReply('thinking')).toEqual({ status: 'thinking', content: '想一想' })
    expect(quickReply('declined')).toEqual({ status: 'declined', content: '不做了' })
  })

  it('normalizes valid colors and rejects malformed metadata', () => {
    expect(normalizeHexColor('#ABCDEF', '#000000')).toBe('#abcdef')
    expect(normalizeHexColor('blue', '#173f7a')).toBe('#173f7a')
  })
})
