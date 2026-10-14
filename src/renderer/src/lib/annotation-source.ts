import type { AnnotationKind, PdfRect } from '../types'
import { automaticPageContext } from './automatic-annotation-context'
import { caretForTextPosition, selectionWordText, type WordBox } from './text-layout'
import { normalizeTextSpacing } from '../../../shared/text-spacing'

export interface AnnotationSourcePassage {
  pageIndex: number
  pieces: Array<{ text: string; selected: boolean }>
  nearby?: boolean
}

/** Use anchor geometry so identical phrases elsewhere cannot replace the source. */
export function annotationSourceForPage(words: WordBox[], rects: PdfRect[], kind: AnnotationKind, pageIndex: number): AnnotationSourcePassage {
  const tokens = words.flatMap((word, wordIndex) => Array.from(selectionWordText(word)).map((text, offset) => {
    const start = caretForTextPosition(words, { wordIndex, offset })!
    const end = caretForTextPosition(words, { wordIndex, offset: offset + 1 })!
    const center = (start.x + end.x) / 2
    const selected = rects.some(rect => center >= rect.x - .01 && center <= rect.x + rect.width + .01
      && Math.min(word.rect.y + word.rect.height, rect.y + rect.height) - Math.max(word.rect.y, rect.y) >= word.rect.height * .5)
    return { text, selected, wordIndex, center, y: word.rect.y + word.rect.height / 2 }
  }))
  let hits = tokens.flatMap((token, index) => token.selected ? [index] : [])
  const nearby = kind === 'note' || kind === 'insert'
  if (nearby) {
    if (!automaticPageContext(words, rects, 'note', 1).text) return { pageIndex, pieces: [] }
    let closest = -1, distance = Infinity
    tokens.forEach((token, index) => {
      // Use the character center rather than the whole (possibly long CJK) run.
      const dx = token.center, dy = token.y
      const gap = Math.min(...rects.map(rect => Math.hypot(Math.max(rect.x - dx, dx - rect.x - rect.width, 0), Math.max(rect.y - dy, dy - rect.y - rect.height, 0))))
      if (gap < distance) { closest = index; distance = gap }
    })
    hits = closest >= 0 ? [closest] : []
  }
  if (!hits.length) return { pageIndex, pieces: [] }
  const first = hits[0], last = hits.at(-1)!
  const anchorWords = hits.map(index => words[tokens[index].wordIndex])
  const column = anchorWords[0].column, block = anchorWords[0].visualBlock
  const sameFlow = (index: number) => {
    const word = words[tokens[index].wordIndex]
    return column !== undefined ? word.column === column : block !== undefined ? word.visualBlock === block : true
  }
  let from = first, to = last
  while (from > 0 && first - from < 48 && sameFlow(from - 1)) from--
  while (to + 1 < tokens.length && to - last < 48 && sameFlow(to + 1)) to++
  const pieces: AnnotationSourcePassage['pieces'] = []
  const append = (text: string, selected: boolean) => {
    if (pieces.at(-1)?.selected === selected) pieces.at(-1)!.text += text
    else pieces.push({ text, selected })
  }
  if (from > 0 && sameFlow(from - 1)) append('…', false)
  for (let index = from; index <= to; index++) {
    const token = tokens[index], previous = tokens[index - 1]
    if (index > from && previous.wordIndex !== token.wordIndex && !/\s/u.test(previous.text) && !/\s/u.test(token.text)) {
      const cjkPunctuation = /[，。；：！？、）》」』】]/u.test(previous.text) && /[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(token.text)
      const separator = words[previous.wordIndex].lineBreakAfter ? '\n'
        : !cjkPunctuation && normalizeTextSpacing(`${previous.text} ${token.text}`).includes(' ') ? ' ' : ''
      append(separator, !nearby && previous.selected && token.selected)
    }
    append(token.text, !nearby && token.selected)
  }
  if (to + 1 < tokens.length && sameFlow(to + 1)) append('…', false)
  return { pageIndex, pieces, ...(nearby ? { nearby: true } : {}) }
}
