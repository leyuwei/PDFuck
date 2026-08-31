import { describe, expect, it } from 'vitest'
import { automaticContextWordTarget, automaticPageContext } from './automatic-annotation-context'
import type { WordBox } from './text-layout'

function words(count: number, column = 0): WordBox[] {
  return Array.from({ length: count }, (_value, index) => ({
    text: `word${index}`,
    order: index,
    column,
    rect: { x: 40 + index % 10 * 42, y: 60 + Math.floor(index / 10) * 16, width: 36, height: 11 }
  }))
}

describe('automatic annotation context', () => {
  it('expands a text annotation according to the selected context level', () => {
    const pageWords = words(300)
    const anchor = pageWords[150].rect
    const compact = automaticPageContext(pageWords, [anchor], 'highlight', 1).text!
    const full = automaticPageContext(pageWords, [anchor], 'highlight', 5).text!
    expect(compact.split(' ')).toHaveLength(automaticContextWordTarget(1))
    expect(full.split(' ')).toHaveLength(automaticContextWordTarget(5))
    expect(full).toContain('word150')
  })

  it('does not leak from an annotation into a neighbouring column', () => {
    const left = words(80, 0)
    const right = words(80, 1).map((word, index) => ({ ...word, text: `right${index}`, order: index + 80, rect: { ...word.rect, x: word.rect.x + 500 } }))
    const pageWords = [...left, ...right]
    const result = automaticPageContext(pageWords, [left[40].rect], 'underline', 5).text!
    expect(result).toContain('word40')
    expect(result).not.toContain('right')
  })

  it('lets a larger amount include adjacent paragraphs in the same column', () => {
    const pageWords = words(300).map((word, index) => ({ ...word, visualBlock: Math.floor(index / 50) }))
    const compact = automaticPageContext(pageWords, [pageWords[125].rect], 'highlight', 1).text!
    const expanded = automaticPageContext(pageWords, [pageWords[125].rect], 'highlight', 5).text!
    expect(compact.split(' ')).toHaveLength(automaticContextWordTarget(1))
    expect(expanded.split(' ')).toHaveLength(automaticContextWordTarget(5))
    expect(expanded).toContain('word50')
    expect(expanded).toContain('word249')
  })

  it('only accepts a free-position note when it is close to recognizable text', () => {
    const pageWords = words(40)
    expect(automaticPageContext(pageWords, [{ x: 42, y: 62, width: 4, height: 4 }], 'note', 3).text).toContain('word0')
    expect(automaticPageContext(pageWords, [{ x: 900, y: 900, width: 4, height: 4 }], 'note', 3)).toEqual({ issue: 'detached-note' })
  })
})
