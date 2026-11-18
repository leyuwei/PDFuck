import type { PdfRect } from '../types'
import { textSelectionForQuery, type WordBox } from './text-layout'

function axisDistance(value: number, start: number, end: number): number {
  return Math.max(start - value, value - end, 0)
}

export function bookmarkFocusRects(words: WordBox[], height: number, position: number | undefined, title: string, x?: number): PdfRect[] {
  const y = position === undefined ? undefined : position * height
  const boundaries = words[0]?.columnBoundaries ?? []
  const columnAt = (left: number) => boundaries.filter(boundary => left >= boundary).length
  const sameColumn = (rect: PdfRect) => x === undefined || columnAt(x) === columnAt(rect.x + rect.width / 2) ||
    (rect.x <= x && x <= rect.x + rect.width)
  const distance = (rect: PdfRect) =>
    (y === undefined ? 0 : axisDistance(y, rect.y, rect.y + rect.height)) +
    (x === undefined ? 0 : axisDistance(x, rect.x, rect.x + rect.width))

  if (title.trim()) {
    const matchScore = ({ rect }: WordBox) => sameColumn(rect)
      ? (y === undefined ? 0 : axisDistance(y, rect.y, rect.y + rect.height)) +
        (x === undefined ? 0 : axisDistance(x, rect.x, rect.x + rect.width) / 4)
      : Infinity
    const options = {
      ignoreWhitespace: true,
      matchScore,
      normalizeCharacter: (char: string) => char.normalize('NFKC').replace(/[\p{P}\p{Cf}]/gu, '')
    }
    const normalized = title.normalize('NFKC')
    const unnumbered = normalized.replace(/^\s*(?:[IVXLCDM]+|\p{Nd}+(?:\.\p{Nd}+)*)[.、:)\s]+/iu, '')
    const heading = textSelectionForQuery(words, normalized, options) ??
      (unnumbered !== normalized ? textSelectionForQuery(words, unnumbered, options) : undefined)
    if (heading?.rects.length) return heading.rects
  }
  if (y === undefined && x === undefined) return []

  const candidates = words.filter(word => sameColumn(word.rect))
  const first = candidates.reduce<WordBox | undefined>((best, word) => !best || distance(word.rect) < distance(best.rect) ? word : best, undefined)
  if (!first || (y !== undefined && axisDistance(y, first.rect.y, first.rect.y + first.rect.height) > Math.max(26, first.rect.height * 2))) return []
  if (x !== undefined && axisDistance(x, first.rect.x, first.rect.x + first.rect.width) > Math.max(60, first.rect.height * 4)) return []
  const baseline = (word: WordBox) => word.baselineY ?? word.rect.y + word.rect.height
  const row = candidates.filter(word => Math.abs(baseline(word) - baseline(first)) < Math.max(2, first.rect.height * .4))
    .sort((a, b) => a.rect.x - b.rect.x)
  const runs: WordBox[][] = []
  for (const word of row) {
    const run = runs.at(-1), previous = run?.at(-1)
    if (previous && previous.column === word.column &&
      word.rect.x - previous.rect.x - previous.rect.width <= Math.max(previous.rect.height, word.rect.height) * 2) run!.push(word)
    else runs.push([word])
  }
  // A vertical-only destination cannot identify one of two parallel text runs.
  if (x === undefined && runs.length > 1) return []
  return runs.find(run => run.includes(first))?.map(word => word.rect) ?? []
}
