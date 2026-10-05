export interface MarkdownSelection { start: number; end: number }
export interface MarkdownEdit { before: MarkdownSelection; after: MarkdownSelection; typing?: boolean }
interface Snapshot { source: string; selection: MarkdownSelection }
export interface MarkdownHistory { past: Snapshot[]; current: Snapshot; future: Snapshot[]; typing: boolean; time: number }

export function recordMarkdownEdit(history: MarkdownHistory | undefined, source: string, next: string, edit: MarkdownEdit, time = Date.now()): MarkdownHistory {
  const before = { source, selection: edit.before }
  const grouped = history?.typing && edit.typing && time - history.time < 800 && history.current.source === source && history.current.selection.start === edit.before.start && history.current.selection.end === edit.before.end
  const past = grouped ? [...history.past] : [...history?.past || [], before]
  // ponytail: 100 snapshots / 8M characters; use text patches if larger history is needed.
  let characters = past.reduce((sum, entry) => sum + entry.source.length, 0)
  while (past.length > 1 && (past.length > 100 || characters > 8_000_000)) characters -= past.shift()!.source.length
  return { past, current: { source: next, selection: edit.after }, future: [], typing: Boolean(edit.typing), time }
}

export function stepMarkdownHistory(history: MarkdownHistory, direction: 'undo' | 'redo'): MarkdownHistory | undefined {
  const stack = direction === 'undo' ? history.past : history.future
  if (!stack.length) return
  return direction === 'undo'
    ? { ...history, past: stack.slice(0, -1), current: stack[stack.length - 1], future: [...history.future, history.current], typing: false }
    : { ...history, future: stack.slice(0, -1), current: stack[stack.length - 1], past: [...history.past, history.current], typing: false }
}
