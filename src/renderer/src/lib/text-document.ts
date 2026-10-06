import { MAX_MARKDOWN_LENGTH } from '../../../shared/markdown'
import type { AutomaticAnnotationBlock, AutomaticAnnotationFinding, AutomaticAnnotationPage } from './automatic-annotation'
import { findTextMatches } from './document-search'

export interface SourceTarget { source: string; start: number; end: number }
export function sourceQuoteMatch(text: string, quote: string, occurrence: number) { return findTextMatches(text, quote, { caseSensitive: true, fuzzy: true, regex: false }, occurrence + 1)[occurrence] }
export function countTextWords(source: string, language = 'zh'): number {
  const continuous = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu
  const characters = source.match(continuous)?.length || 0
  let words = 0
  for (const segment of new Intl.Segmenter(language, { granularity: 'word' }).segment(source.replace(continuous, ' '))) if (segment.isWordLike) words++
  return characters + words
}
export function applySourceResult(source: string, target: SourceTarget, content: string, append = false): { source: string; start: number; end: number } {
  if (source !== target.source || target.start < 0 || target.end < target.start || target.end > source.length) throw new Error('text.sourceChanged')
  const start = append ? source.length : target.start, end = append ? source.length : target.end
  const value = append ? `${source.endsWith('\n\n') ? '' : source.endsWith('\n') ? '\n' : '\n\n'}${content}\n` : content
  const next = source.slice(0, start) + value + source.slice(end)
  if (next.length > MAX_MARKDOWN_LENGTH) throw new Error('md.invalid')
  return { source: next, start, end: start + value.length }
}
export function sourceAnnotationPages(source: string, range?: Pick<SourceTarget, 'start' | 'end'>): AutomaticAnnotationPage[] {
  const pages: AutomaticAnnotationPage[] = []
  let blockCount = 0
  const end = range?.end ?? source.length
  for (let start = range?.start ?? 0; start < end;) {
    let stop = Math.min(end, start + 3000)
    if (stop < end && /[\uD800-\uDBFF]/.test(source[stop - 1])) stop--
    const line = source.lastIndexOf('\n', stop - 1)
    if (stop < end && line > start + 1500) stop = line + 1
    const pageIndex = Math.floor(blockCount / 8)
    const page = pages[pageIndex] ||= { pageIndex, blocks: [], truncated: false }
    if (source.slice(start, stop).trim()) { page.blocks.push({ id: `source:${start}:${stop}`, pageIndex, text: source.slice(start, stop), words: [] }); blockCount++ }
    start = stop
  }
  return pages.filter(page => page.blocks.length)
}
export function applySourceFindings(source: string, findings: AutomaticAnnotationFinding[], blocks: AutomaticAnnotationBlock[]): { source: string; editDelta: number } {
  const changes: Array<{ start: number; end: number; value: string }> = [], notes: string[] = []
  for (const finding of findings) {
    const block = blocks.find(block => block.id === finding.blockId)
    if (!block) throw new Error('text.sourceChanged')
    let offset = Number(block.id.split(':')[1])
    if (source.slice(offset, offset + block.text.length) !== block.text) {
      // Prior AI edits can shift later blocks; accept only one exact, unchanged block.
      offset = source.indexOf(block.text)
      if (offset < 0 || source.indexOf(block.text, offset + 1) >= 0) throw new Error('text.sourceChanged')
    }
    const quote = sourceQuoteMatch(block.text, finding.quote, finding.occurrence)
    if (!quote) throw new Error('text.sourceChanged')
    const start = offset + quote.start, end = offset + quote.end
    if (finding.action === 'replace' || finding.action === 'delete') changes.push({ start, end, value: finding.action === 'delete' ? '' : finding.replacementText || '' })
    else if (finding.action === 'insert') { const at = finding.insertSide === 'before' ? start : end; changes.push({ start: at, end: at, value: finding.replacementText || '' }) }
    else notes.push(`${finding.quote}\n${finding.reason}`)
  }
  changes.sort((a, b) => b.start - a.start)
  for (let i = 1; i < changes.length; i++) if (changes[i].end > changes[i - 1].start || changes[i].start === changes[i - 1].start) throw new Error('text.overlappingChanges')
  let next = source
  for (const change of changes) next = next.slice(0, change.start) + change.value + next.slice(change.end)
  if (notes.length) next += `\n\n${notes.join('\n\n')}\n`
  if (next.length > MAX_MARKDOWN_LENGTH) throw new Error('md.invalid')
  return { source: next, editDelta: changes.reduce((sum, change) => sum + change.value.length - (change.end - change.start), 0) }
}
