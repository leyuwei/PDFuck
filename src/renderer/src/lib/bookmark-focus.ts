import type { PdfRect } from '../types'
import { textSelectionForQuery, type WordBox } from './text-layout'

export function bookmarkFocusRects(words: WordBox[], height: number, position: number | undefined, title: string): PdfRect[] {
  const y = Math.max(0,Math.min(.98,position || 0))*height
  if (title.trim()) {
    const heading = textSelectionForQuery(words, title, { caseSensitive: false, ignoreWhitespace: true, occurrence: 0 })
    if (heading?.rects.length && (position === undefined || Math.abs(heading.rects[0].y-y) <= Math.max(24,heading.rects[0].height*2))) return heading.rects
  }
  const candidates = words.filter(w => w.rect.y+w.rect.height >= y).sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)
  const first = candidates[0]
  return first ? candidates.filter(w => Math.abs((w.baselineY??w.rect.y)-(first.baselineY??first.rect.y))<first.rect.height*.4).map(w=>w.rect) : []
}
