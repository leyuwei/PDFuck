import type { AnnotationKind, PdfRect } from '../types'
import { normalizeCopiedText } from './clipboard-text'
import type { WordBox } from './text-layout'

export const MIN_AUTOMATIC_CONTEXT_LEVEL = 1
export const MAX_AUTOMATIC_CONTEXT_LEVEL = 5
export const DEFAULT_AUTOMATIC_CONTEXT_LEVEL = 3

export interface AnnotationContextAnchor {
  pageIndex: number
  rects: PdfRect[]
}

export interface AutomaticAnnotationContextRequest {
  kind: AnnotationKind
  anchors: AnnotationContextAnchor[]
}

export interface AutomaticAnnotationContext {
  text: string
  pageIndexes: number[]
}

export type AutomaticAnnotationContextIssue = 'no-text' | 'detached-note'

export interface AutomaticAnnotationContextResult {
  context?: AutomaticAnnotationContext
  issue?: AutomaticAnnotationContextIssue
}

export interface AutomaticPageContextResult {
  text?: string
  issue?: AutomaticAnnotationContextIssue
}

const CONTEXT_WORD_TARGETS = [32, 64, 110, 180, 260] as const

export function normalizeAutomaticContextLevel(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUTOMATIC_CONTEXT_LEVEL
  return Math.max(MIN_AUTOMATIC_CONTEXT_LEVEL, Math.min(MAX_AUTOMATIC_CONTEXT_LEVEL, Math.round(value)))
}

export function automaticContextWordTarget(level: number): number {
  return CONTEXT_WORD_TARGETS[normalizeAutomaticContextLevel(level) - 1]
}

function overlapArea(left: PdfRect, right: PdfRect): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x))
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y))
  return width * height
}

function rectDistance(left: PdfRect, right: PdfRect): number {
  const x = Math.max(left.x - right.x - right.width, right.x - left.x - left.width, 0)
  const y = Math.max(left.y - right.y - right.height, right.y - left.y - left.height, 0)
  return Math.hypot(x, y)
}

function median(values: number[]): number {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.floor(ordered.length / 2)]
}

function contextText(words: WordBox[]): string {
  let value = ''
  words.forEach((word, index) => {
    if (index) value += words[index - 1].lineBreakAfter ? '\n' : ' '
    value += word.text
  })
  return normalizeCopiedText(value)
}

/**
 * Select surrounding text in the same reconstructed reading flow as an
 * annotation. Free-position notes deliberately require a nearby text run;
 * a note in a margin or figure never jumps to an unrelated paragraph.
 */
export function automaticPageContext(words: WordBox[], rects: PdfRect[], kind: AnnotationKind, level: number): AutomaticPageContextResult {
  if (!words.length || !rects.length) return { issue: 'no-text' }
  const medianHeight = Math.max(1, median(words.map((word) => word.rect.height).filter((height) => height > 0)))
  let anchorIndexes = words.flatMap((word, index) => rects.some((rect) => overlapArea(word.rect, rect) > 0) ? [index] : [])
  if (!anchorIndexes.length) {
    const nearest = words
      .map((word, index) => ({ index, distance: Math.min(...rects.map((rect) => rectDistance(word.rect, rect))) }))
      .sort((left, right) => left.distance - right.distance)[0]
    const maximumDistance = kind === 'note' ? Math.max(18, medianHeight * 2.4) : Math.max(28, medianHeight * 4)
    if (!nearest || nearest.distance > maximumDistance) return { issue: kind === 'note' ? 'detached-note' : 'no-text' }
    anchorIndexes = [nearest.index]
  }

  const anchorWords = anchorIndexes.map((index) => words[index])
  // Prefer the page column as the expansion boundary so higher slider levels
  // can include adjacent paragraphs. A visual block is the safer fallback for
  // captions, tables, and other content that has no reliable column.
  const commonColumn = anchorWords[0]?.column !== undefined && anchorWords.every((word) => word.column === anchorWords[0].column)
    ? anchorWords[0].column
    : undefined
  const commonVisualBlock = commonColumn === undefined && anchorWords[0]?.visualBlock !== undefined && anchorWords.every((word) => word.visualBlock === anchorWords[0].visualBlock)
    ? anchorWords[0].visualBlock
    : undefined
  const eligibleIndexes = words.flatMap((word, index) => {
    if (commonColumn !== undefined) return word.column === commonColumn ? [index] : []
    if (commonVisualBlock !== undefined) return word.visualBlock === commonVisualBlock ? [index] : []
    return [index]
  })
  const anchorPositions = anchorIndexes.map((index) => eligibleIndexes.indexOf(index)).filter((index) => index >= 0)
  if (!anchorPositions.length) return { issue: 'no-text' }
  let start = Math.min(...anchorPositions)
  let end = Math.max(...anchorPositions)
  const target = automaticContextWordTarget(level)
  while (end - start + 1 < target && (start > 0 || end < eligibleIndexes.length - 1)) {
    if (start > 0) start -= 1
    if (end - start + 1 >= target) break
    if (end < eligibleIndexes.length - 1) end += 1
  }
  const selected = eligibleIndexes.slice(start, end + 1).map((index) => words[index])
  const text = contextText(selected)
  return text ? { text } : { issue: 'no-text' }
}
