import type { AddAnnotationRequest, AnnotationKind, PdfPoint, PdfRect } from '../types'
import type { PageTextSelection } from './page-text-selection'
import { textSelectionForQuery, type WordBox } from './text-layout'

export const AUTOMATIC_ANNOTATION_SCHEMA_VERSION = 1
export const MAX_AUTOMATIC_ANNOTATION_BLOCKS_PER_PAGE = 80
export const MAX_AUTOMATIC_ANNOTATION_BLOCK_CHARS = 3_500
export const MAX_AUTOMATIC_ANNOTATION_PAGE_CHARS = 28_000
export const MAX_AUTOMATIC_ANNOTATION_FINDINGS = 32
export const MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS = 2_400
export const MAX_AUTOMATIC_ANNOTATION_QUOTE_CHARS = 600
export const MAX_AUTOMATIC_ANNOTATION_REPLACEMENT_CHARS = 1_600
export const MAX_AUTOMATIC_ANNOTATION_RESPONSE_CHARS = 120_000

export type AutomaticAnnotationDetail = 'revision' | 'brief' | 'detailed'
export type AutomaticAnnotationIntensity = 'lenient' | 'balanced' | 'strict'
export type AutomaticAnnotationAction = 'highlight' | 'replace' | 'delete' | 'underline' | 'insert' | 'note'
export type AutomaticAnnotationInsertSide = 'before' | 'after'

export interface AutomaticAnnotationSourcePage {
  pageIndex: number
  words: WordBox[]
}

/** Text sent to the model plus the exact source words used to resolve its quotes. */
export interface AutomaticAnnotationBlock {
  id: string
  pageIndex: number
  text: string
  words: WordBox[]
  /** Present for selection-scoped runs and never serialized into the model prompt. */
  selectionRects?: PdfRect[]
}

export interface AutomaticAnnotationPage {
  pageIndex: number
  blocks: AutomaticAnnotationBlock[]
  truncated: boolean
}

export interface AutomaticAnnotationFinding {
  action: AutomaticAnnotationAction
  blockId: string
  quote: string
  /** Zero-based occurrence within the named block. */
  occurrence: number
  insertSide: AutomaticAnnotationInsertSide | null
  replacementText: string | null
  reason: string
}

export interface AutomaticAnnotationModelResponse {
  version: typeof AUTOMATIC_ANNOTATION_SCHEMA_VERSION
  contextSummary: string
  findings: AutomaticAnnotationFinding[]
}

export interface AutomaticAnnotationDraft extends AddAnnotationRequest {
  action: AutomaticAnnotationAction
  blockId: string
  quote: string
  occurrence: number
}

export type AutomaticAnnotationDraftIssue = 'unknown-block' | 'quote-not-found' | 'outside-selection'

export interface RejectedAutomaticAnnotationFinding {
  finding: AutomaticAnnotationFinding
  issue: AutomaticAnnotationDraftIssue
}

export interface AutomaticAnnotationDraftResult {
  drafts: AutomaticAnnotationDraft[]
  rejected: RejectedAutomaticAnnotationFinding[]
}

const CONTINUOUS_SCRIPT = /[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Thai}\p{Script_Extensions=Lao}\p{Script_Extensions=Khmer}\p{Script_Extensions=Myanmar}]/u
const COMBINING_MARK = /\p{Mark}/u
const OPENING_PUNCTUATION = /[(\[{“‘《〈「『【〔（［｛]/u
const CLOSING_PUNCTUATION = /[)\]}”’》〉」』】〕）］｝,.;:!?，。；：！？、،؛؟]/u
const TRAILING_HYPHEN = /[-\u2010-\u2014]$/u
const RIGHT_TO_LEFT_SCRIPT = /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Hebrew}]/u
const ACTIONS = new Set<AutomaticAnnotationAction>(['highlight', 'replace', 'delete', 'underline', 'insert', 'note'])
const ROOT_KEYS = ['contextSummary', 'findings', 'version']
const FINDING_KEYS = ['action', 'blockId', 'insertSide', 'occurrence', 'quote', 'reason', 'replacementText']

function codePointLength(value: string): number { return Array.from(value).length }

function median(values: number[]): number {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.floor(ordered.length / 2)]
}

function validWord(word: WordBox): boolean {
  return Boolean(word.text) && [word.rect.x, word.rect.y, word.rect.width, word.rect.height].every(Number.isFinite) && word.rect.width > 0 && word.rect.height > 0
}

function wordBoundaries(word: WordBox): number[] {
  const count = Math.max(1, codePointLength(word.text))
  if (word.boundaries?.length === count + 1 && word.boundaries.every(Number.isFinite)) return word.boundaries
  return Array.from({ length: count + 1 }, (_, index) => word.rect.width * index / count)
}

function sliceWord(word: WordBox, start: number, end: number, lineBreakAfter: boolean): WordBox {
  const characters = Array.from(word.text)
  const boundaries = wordBoundaries(word)
  const left = boundaries[start]
  const right = boundaries[end]
  return {
    ...word,
    text: characters.slice(start, end).join(''),
    rect: { ...word.rect, x: word.rect.x + left, width: right - left },
    boundaries: boundaries.slice(start, end + 1).map((boundary) => boundary - left),
    lineBreakAfter
  }
}

/**
 * Crop reconstructed text at character boundaries to a page-local selection.
 * A character is included only when its visual centre is inside a selection
 * rectangle, so unselected columns never become hidden model context.
 */
export function clipWordsToPageSelection(words: WordBox[], selection: PageTextSelection): WordBox[] {
  const rects = selection.rects.filter((rect) => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0)
  if (!rects.length) return []
  return words.flatMap((word) => {
    if (!validWord(word)) return []
    const characters = Array.from(word.text)
    const boundaries = wordBoundaries(word)
    const selected = characters.map((_character, index) => {
      const x = word.rect.x + (boundaries[index] + boundaries[index + 1]) / 2
      const y = word.rect.y + word.rect.height / 2
      return rects.some((rect) => x >= rect.x - 0.25 && x <= rect.x + rect.width + 0.25 && y >= rect.y - 0.25 && y <= rect.y + rect.height + 0.25)
    })
    const ranges: Array<[number, number]> = []
    for (let index = 0; index < selected.length;) {
      if (!selected[index]) { index += 1; continue }
      const start = index
      while (index < selected.length && selected[index]) index += 1
      ranges.push([start, index])
    }
    return ranges.map(([start, end], index) => sliceWord(word, start, end, Boolean(word.lineBreakAfter && index === ranges.length - 1)))
  })
}

function noInsertedSpace(left: string, right: string): boolean {
  return CONTINUOUS_SCRIPT.test(left) || CONTINUOUS_SCRIPT.test(right) || COMBINING_MARK.test(right)
    || OPENING_PUNCTUATION.test(left) || CLOSING_PUNCTUATION.test(right) || TRAILING_HYPHEN.test(left)
}

/** Preserve every non-whitespace source character so model quotes remain resolvable. */
function blockText(words: WordBox[]): string {
  let value = ''
  for (const word of words) {
    const text = word.text.replace(/[\t\r\n\u00a0 ]+/gu, ' ').trim()
    if (!text) continue
    if (value) {
      const left = Array.from(value).at(-1) || ''
      const right = Array.from(text)[0] || ''
      if (!noInsertedSpace(left, right)) value += ' '
    }
    value += text
  }
  return value
}

function sameLogicalFlow(left: WordBox, right: WordBox, medianHeight: number): boolean {
  if (left.column !== right.column) return false
  const verticalStep = right.rect.y - left.rect.y
  if (verticalStep > medianHeight * 1.75 || verticalStep < -medianHeight * 0.45) return false
  if (!left.lineBreakAfter) return true
  return verticalStep >= -medianHeight * 0.45 && verticalStep <= medianHeight * 1.75
}

function logicalWordGroups(words: WordBox[]): WordBox[][] {
  const medianHeight = Math.max(1, median(words.map((word) => word.rect.height)))
  const visualBlocks = new Map<number, WordBox[]>()
  for (const word of words) {
    if (word.visualBlock === undefined) continue
    const block = visualBlocks.get(word.visualBlock) || []
    block.push(word)
    visualBlocks.set(word.visualBlock, block)
  }
  const emittedVisualBlocks = new Set<number>()
  const groups: WordBox[][] = []
  let ordinary: WordBox[] = []
  const flushOrdinary = () => { if (ordinary.length) groups.push(ordinary); ordinary = [] }
  for (const word of words) {
    if (word.visualBlock !== undefined) {
      flushOrdinary()
      if (emittedVisualBlocks.has(word.visualBlock)) continue
      emittedVisualBlocks.add(word.visualBlock)
      groups.push([...(visualBlocks.get(word.visualBlock) || [])].sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x))
      continue
    }
    const previous = ordinary.at(-1)
    if (previous && !sameLogicalFlow(previous, word, medianHeight)) flushOrdinary()
    ordinary.push(word)
  }
  flushOrdinary()
  return groups
}

function chunkGroup(words: WordBox[]): WordBox[][] {
  const chunks: WordBox[][] = []
  let current: WordBox[] = []
  let currentCharacters = 0
  let lastCharacter = ''
  for (const word of words) {
    const text = blockText([word])
    const firstCharacter = Array.from(text)[0] || ''
    const separatorCharacters = current.length && !noInsertedSpace(lastCharacter, firstCharacter) ? 1 : 0
    const addedCharacters = separatorCharacters + codePointLength(text)
    if (current.length && currentCharacters + addedCharacters > MAX_AUTOMATIC_ANNOTATION_BLOCK_CHARS) {
      chunks.push(current)
      current = []
      currentCharacters = 0
      lastCharacter = ''
    }
    // A pathological single PDF token is omitted rather than partially sent:
    // any partial token could no longer be resolved safely to the source.
    if (codePointLength(word.text) > MAX_AUTOMATIC_ANNOTATION_BLOCK_CHARS) continue
    if (!text) continue
    const separator = current.length && !noInsertedSpace(lastCharacter, firstCharacter) ? 1 : 0
    current.push(word)
    currentCharacters += separator + codePointLength(text)
    lastCharacter = Array.from(text).at(-1) || ''
  }
  if (current.length) chunks.push(current)
  return chunks
}

export function buildAutomaticAnnotationPage(pageIndex: number, sourceWords: WordBox[], selection?: PageTextSelection): AutomaticAnnotationPage {
  const segment = selection?.segments?.find((candidate) => candidate.pageIndex === pageIndex)
  const localSelection = selection?.segments?.length
    ? segment ? { pageIndex, text: segment.text, rects: segment.rects } : undefined
    : selection?.pageIndex === pageIndex ? selection : undefined
  if (selection && !localSelection) return { pageIndex, blocks: [], truncated: false }
  const words = (localSelection ? clipWordsToPageSelection(sourceWords, localSelection) : sourceWords.filter(validWord))
  const groups = logicalWordGroups(words).flatMap(chunkGroup)
  const blocks: AutomaticAnnotationBlock[] = []
  let pageCharacters = 0
  let truncated = groups.length > MAX_AUTOMATIC_ANNOTATION_BLOCKS_PER_PAGE
    || words.some((word) => codePointLength(word.text) > MAX_AUTOMATIC_ANNOTATION_BLOCK_CHARS)
  for (const group of groups) {
    const text = blockText(group)
    const characters = codePointLength(text)
    if (!text) continue
    if (blocks.length >= MAX_AUTOMATIC_ANNOTATION_BLOCKS_PER_PAGE || pageCharacters + characters > MAX_AUTOMATIC_ANNOTATION_PAGE_CHARS) {
      truncated = true
      break
    }
    blocks.push({
      id: `p${pageIndex + 1}-b${blocks.length + 1}`,
      pageIndex,
      text,
      words: group,
      selectionRects: localSelection?.rects.map((rect) => ({ ...rect }))
    })
    pageCharacters += characters
  }
  return { pageIndex, blocks, truncated }
}

export function buildAutomaticAnnotationPages(pages: AutomaticAnnotationSourcePage[], selection?: PageTextSelection): AutomaticAnnotationPage[] {
  const selectedPages = selection?.segments?.length
    ? new Set(selection.segments.map((segment) => segment.pageIndex))
    : selection ? new Set([selection.pageIndex]) : undefined
  return pages
    .filter((page) => !selectedPages || selectedPages.has(page.pageIndex))
    .map((page) => buildAutomaticAnnotationPage(page.pageIndex, page.words, selection))
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort()
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
}

function invalidResponse(_detail: string): never { throw new Error('ui.automaticAnnotationResponseInvalid') }

function limitedString(value: unknown, label: string, maximum: number, allowEmpty = false): string {
  if (typeof value !== 'string') invalidResponse(`${label} 必须是字符串。`)
  const normalized = value.trim()
  if (!allowEmpty && !normalized) invalidResponse(`${label} 不能为空。`)
  if (codePointLength(normalized) > maximum) invalidResponse(`${label} 超过长度限制。`)
  return normalized
}

function jsonPayload(raw: string): unknown {
  const trimmed = raw.trim()
  if (codePointLength(trimmed) > MAX_AUTOMATIC_ANNOTATION_RESPONSE_CHARS) invalidResponse('JSON 超过长度限制。')
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  const value = fenced?.[1] ?? trimmed
  try { return JSON.parse(value) as unknown } catch { return invalidResponse('无法解析 JSON。') }
}

/** Parse and validate the model result against its exact, versioned schema. */
export function parseAutomaticAnnotationResponse(raw: string, blocks: AutomaticAnnotationBlock[], detail: AutomaticAnnotationDetail): AutomaticAnnotationModelResponse {
  const payload = jsonPayload(raw)
  if (!plainObject(payload) || !exactKeys(payload, ROOT_KEYS)) invalidResponse('根对象字段不符合 schema。')
  if (payload.version !== AUTOMATIC_ANNOTATION_SCHEMA_VERSION) invalidResponse('schema 版本不受支持。')
  const contextSummary = limitedString(payload.contextSummary, 'contextSummary', MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS, true)
  if (!Array.isArray(payload.findings)) invalidResponse('findings 必须是数组。')
  if (payload.findings.length > MAX_AUTOMATIC_ANNOTATION_FINDINGS) invalidResponse('findings 数量超过限制。')
  const blockMap = new Map(blocks.map((block) => [block.id, block]))
  const findings = payload.findings.map((candidate, index): AutomaticAnnotationFinding => {
    const label = `findings[${index}]`
    if (!plainObject(candidate) || !exactKeys(candidate, FINDING_KEYS)) invalidResponse(`${label} 字段不符合 schema。`)
    if (typeof candidate.action !== 'string' || !ACTIONS.has(candidate.action as AutomaticAnnotationAction)) invalidResponse(`${label}.action 不受支持。`)
    const action = candidate.action as AutomaticAnnotationAction
    if (detail === 'revision' && action !== 'replace' && action !== 'delete' && action !== 'insert') invalidResponse(`${label}.action 在仅修订模式中必须可直接应用。`)
    const blockId = limitedString(candidate.blockId, `${label}.blockId`, 80)
    const block = blockMap.get(blockId)
    if (!block) invalidResponse(`${label}.blockId 不在本页白名单中。`)
    const quote = limitedString(candidate.quote, `${label}.quote`, MAX_AUTOMATIC_ANNOTATION_QUOTE_CHARS)
    if (!Number.isInteger(candidate.occurrence) || (candidate.occurrence as number) < 0 || (candidate.occurrence as number) > 99) invalidResponse(`${label}.occurrence 必须是 0 到 99 的整数。`)
    const occurrence = candidate.occurrence as number
    if (!textSelectionForQuery(block.words, quote, { occurrence, caseSensitive: true, ignoreWhitespace: true })) invalidResponse(`${label}.quote 不是指定块中的精确原文。`)
    const insertSide = candidate.insertSide
    if (action === 'insert') {
      if (insertSide !== 'before' && insertSide !== 'after') invalidResponse(`${label}.insertSide 必须指定 before 或 after。`)
    } else if (insertSide !== null) invalidResponse(`${label}.insertSide 仅可用于 insert。`)
    const replacementText = candidate.replacementText
    if (action === 'replace' || action === 'insert') {
      limitedString(replacementText, `${label}.replacementText`, MAX_AUTOMATIC_ANNOTATION_REPLACEMENT_CHARS)
    } else if (replacementText !== null) invalidResponse(`${label}.replacementText 仅可用于 replace 或 insert。`)
    const reasonLimit = detail === 'brief' ? 240 : detail === 'detailed' ? 1_200 : 0
    const reason = limitedString(candidate.reason, `${label}.reason`, reasonLimit, detail === 'revision')
    if (detail === 'revision' && reason) invalidResponse(`${label}.reason 在仅修订模式中必须为空。`)
    return {
      action,
      blockId,
      quote,
      occurrence,
      insertSide: insertSide as AutomaticAnnotationInsertSide | null,
      replacementText: replacementText === null ? null : (replacementText as string).trim(),
      reason
    }
  })
  const identities = new Set<string>()
  for (const finding of findings) {
    const identity = `${finding.action}\u0000${finding.blockId}\u0000${finding.occurrence}\u0000${finding.quote}`
    if (identities.has(identity)) invalidResponse('findings 包含重复项。')
    identities.add(identity)
  }
  return { version: AUTOMATIC_ANNOTATION_SCHEMA_VERSION, contextSummary, findings }
}

function containsRect(container: PdfRect, value: PdfRect, tolerance = 0.75): boolean {
  return value.x >= container.x - tolerance && value.y >= container.y - tolerance
    && value.x + value.width <= container.x + container.width + tolerance
    && value.y + value.height <= container.y + container.height + tolerance
}

function selectionRects(selection: PageTextSelection | undefined, pageIndex: number): PdfRect[] | undefined {
  if (!selection) return undefined
  const segment = selection.segments?.find((candidate) => candidate.pageIndex === pageIndex)
  if (selection.segments?.length) return segment?.rects || []
  return selection.pageIndex === pageIndex ? selection.rects : []
}

function insertionPoint(rects: PdfRect[], side: AutomaticAnnotationInsertSide, quote: string): PdfPoint {
  const rect = side === 'before' ? rects[0] : rects.at(-1)!
  const rightToLeft = RIGHT_TO_LEFT_SCRIPT.test(quote)
  const useRightEdge = side === 'before' ? rightToLeft : !rightToLeft
  return { x: useRightEdge ? rect.x + rect.width : rect.x, y: rect.y + rect.height }
}

function annotationKind(action: AutomaticAnnotationAction): AnnotationKind {
  return action === 'delete' ? 'delete' : action
}

/** Resolve only exact model quotes and produce one atomic addAnnotations batch. */
export function draftAutomaticAnnotations(response: AutomaticAnnotationModelResponse, blocks: AutomaticAnnotationBlock[], selection?: PageTextSelection): AutomaticAnnotationDraftResult {
  const blockMap = new Map(blocks.map((block) => [block.id, block]))
  const drafts: AutomaticAnnotationDraft[] = []
  const rejected: RejectedAutomaticAnnotationFinding[] = []
  for (const finding of response.findings) {
    const block = blockMap.get(finding.blockId)
    if (!block) { rejected.push({ finding, issue: 'unknown-block' }); continue }
    const target = textSelectionForQuery(block.words, finding.quote, { occurrence: finding.occurrence, caseSensitive: true, ignoreWhitespace: true })
    if (!target) { rejected.push({ finding, issue: 'quote-not-found' }); continue }
    const scope = selectionRects(selection, block.pageIndex) ?? block.selectionRects
    if (scope && (!scope.length || target.rects.some((rect) => !scope.some((candidate) => containsRect(candidate, rect))))) {
      rejected.push({ finding, issue: 'outside-selection' })
      continue
    }
    // For a free note the explanation is the note itself. Storing it again in
    // PDFuckReason would make the annotation panel render duplicate prose.
    const reason = finding.action === 'note' ? undefined : finding.reason || undefined
    drafts.push({
      pageIndex: block.pageIndex,
      kind: annotationKind(finding.action),
      rects: target.rects.map((rect) => ({ ...rect })),
      content: finding.action === 'note' ? finding.reason : finding.replacementText || '',
      point: finding.action === 'insert' ? insertionPoint(target.rects, finding.insertSide!, finding.quote)
        : finding.action === 'note' ? { x: target.rects[0].x, y: target.rects[0].y } : undefined,
      reason,
      action: finding.action,
      blockId: finding.blockId,
      quote: finding.quote,
      occurrence: finding.occurrence
    })
  }
  return { drafts, rejected }
}
