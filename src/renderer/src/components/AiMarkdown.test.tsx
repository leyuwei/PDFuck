// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AiMarkdown } from './AiMarkdown'

describe('AiMarkdown', () => {
  let container: HTMLDivElement

  beforeEach(() => { container = document.createElement('div'); document.body.append(container) })
  afterEach(() => container.remove())

  it('renders headings, GFM lists, tables, task items, and code', async () => {
    const root = createRoot(container)
    const content = '# Review\n\n- issue one\n- [x] checked\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n`code`'
    await act(async () => root.render(<AiMarkdown content={content} />))
    expect(container.querySelector('h1')?.textContent).toBe('Review')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector<HTMLInputElement>('li input[type="checkbox"]')?.checked).toBe(true)
    expect(container.querySelector('table')?.textContent).toContain('2')
    expect(container.querySelector('code')?.textContent).toBe('code')
    await act(async () => root.unmount())
  })

  it('does not execute or render raw HTML returned by a model', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<AiMarkdown content={'Before <script>window.pwned = true</script> <b>unsafe</b> After'} />))
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('Before')
    expect(container.textContent).toContain('After')
    await act(async () => root.unmount())
  })
})
