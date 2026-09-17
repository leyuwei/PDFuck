import { describe, expect, it } from 'vitest'
import { validExternalLink } from './external-links'

describe('external PDF links', () => {
  it('allows ordinary web and mail links', () => {
    expect(validExternalLink('https://example.com/paper?q=pdf#section')).toBe(true)
    expect(validExternalLink('http://example.org')).toBe(true)
    expect(validExternalLink('mailto:author@example.com?subject=Paper')).toBe(true)
  })

  it('rejects local, executable, malformed and oversized targets', () => {
    expect(validExternalLink('file:///C:/secret.txt')).toBe(false)
    expect(validExternalLink('javascript:alert(1)')).toBe(false)
    expect(validExternalLink('data:text/html,hello')).toBe(false)
    expect(validExternalLink('not a url')).toBe(false)
    expect(validExternalLink(`https://example.com/${'x'.repeat(5000)}`)).toBe(false)
  })
})
