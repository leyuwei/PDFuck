import { MAX_MARKDOWN_LENGTH } from '../../../shared/markdown'
import type { MarkdownSelection } from './markdown-history'

/** Tab inserts a literal tab; a selected block is indented one logical line at a time. */
export function indentSource(source: string, selection: MarkdownSelection, outdent = false) {
  const { start, end } = selection
  if (!outdent && !source.slice(start, end).includes('\n')) {
    const next = source.slice(0, start) + '\t' + source.slice(end)
    return next.length <= MAX_MARKDOWN_LENGTH ? { source: next, start: start + 1, end: start + 1 } : undefined
  }
  const first = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1
  // A selection ending at the next line's start does not include that line.
  const last = end > start && source[end - 1] === '\n' ? end - 1 : end
  const edits: { at: number; removed: number; inserted: string }[] = []
  for (let at = first; at <= last;) {
    const removed = outdent ? source.slice(at, at + 4).match(/^(?:\t| {1,4})/)?.[0].length || 0 : 0
    if (!outdent || removed) edits.push({ at, removed, inserted: outdent ? '' : '\t' })
    const newline = source.indexOf('\n', at)
    if (newline < 0) break
    at = newline + 1
  }
  if (!edits.length) return
  const offset = (position: number) => position + edits.reduce((delta, edit) => delta + (edit.at <= position ? edit.inserted.length - Math.min(edit.removed, position - edit.at) : 0), 0)
  const parts: string[] = []
  let cursor = 0
  for (const edit of edits) { parts.push(source.slice(cursor, edit.at), edit.inserted); cursor = edit.at + edit.removed }
  const next = parts.join('') + source.slice(cursor)
  return next.length <= MAX_MARKDOWN_LENGTH ? { source: next, start: offset(start), end: offset(end) } : undefined
}
