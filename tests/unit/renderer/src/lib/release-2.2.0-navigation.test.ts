import { expect, it, vi } from 'vitest'
import { bookmarkFocusRects } from '../../../../../src/renderer/src/lib/bookmark-focus'
import { revealFocusRect } from '../../../../../src/renderer/src/lib/focus-navigation'
import { parseZoomPercent } from '../../../../../src/renderer/src/lib/rendering'
import type { WordBox } from '../../../../../src/renderer/src/lib/text-layout'

it.each([
  { y: 18, height: 1600, expected: 0 },
  { y: 410, height: 1600, expected: 244 },
  { y: 755, height: 900, expected: 500 },
  { y: 350, height: 400, expected: 0 }
])('reveals a target at y=$y within the natural scroll range ($expected)', ({ y, height, expected }) => {
  const scrollTo = vi.fn()
  const viewport = { getBoundingClientRect: () => ({ left: 10, top: 40 }), clientWidth: 500, clientHeight: 400,
    clientLeft: 0, clientTop: 0, scrollHeight: height, scrollTop: 0, scrollLeft: 14, scrollTo } as unknown as HTMLElement
  const page = { getBoundingClientRect: () => ({ left: 30, top: 64 }) } as unknown as HTMLElement
  revealFocusRect(viewport, page, { x: 300, y, width: 90, height: 20 }, 1)
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: expected, left: 14, behavior: 'instant' })
})

const word = (text: string, x: number, y: number, width: number, order: number): WordBox => ({
  text, order, column: Number(x > 320), columnBoundaries: [320], lineBreakAfter: true,
  rect: { x, y, width, height: 14 }
})
const words = [
  word('III. CENTERED SECTION', 95, 385, 180, 0),
  word('End of the preceding paragraph', 335, 353, 220, 1),
  word('III. CENTERED SECTION', 414, 385, 180, 2),
  word('Opening line of the section', 335, 403, 210, 3)
]

it.each(['III. Centered Section', 'Ⅲ： Centered Section', '3. Centered Section'])('finds the actual heading for %s below the PDF destination coordinate', title => {
  const rects = bookmarkFocusRects(words, 800, .45, title, 335)
  expect(rects.length).toBeGreaterThan(0)
  expect(rects.every(rect => rect.y === 385 && rect.x >= 414)).toBe(true)
})

it('keeps an unmatched custom bookmark on its original coordinate line', () => {
  expect(bookmarkFocusRects(words, 800, .45, 'My reading note', 335)).toEqual([words[1].rect])
})

it.each([
  ['137.5%', 1.375], [' ١٣٧٫٥٪ ', 1.375], ['۱۲۵,۵', 1.255], ['１２５．５％', 1.255],
  ['10', .25], ['900', 4], ['', undefined], ['0', undefined], ['125oops', undefined], ['1e2', undefined]
])('parses the zoom percentage %j', (value, expected) => {
  expect(parseZoomPercent(value)).toBe(expected)
})
