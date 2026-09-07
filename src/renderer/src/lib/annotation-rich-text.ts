export interface TextMark { start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: boolean }
export const markNames = ['bold', 'italic', 'underline', 'highlight'] as const

/** Offsets use JavaScript/DOM UTF-16 positions. Never trust stored PDF markup. */
export function normalizeMarks(text: string, value: unknown): TextMark[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 10000).flatMap((mark) => {
    if (!mark || !Number.isInteger(mark.start) || !Number.isInteger(mark.end)) return []
    const start = Math.max(0, Math.min(text.length, mark.start)), end = Math.max(start, Math.min(text.length, mark.end))
    const flags = Object.fromEntries(markNames.filter((key) => mark[key] === true).map((key) => [key, true]))
    return end > start && Object.keys(flags).length ? [{ start, end, ...flags }] : []
  })
}

export function readMarks(text: string, json: string): TextMark[] {
  try { return normalizeMarks(text, JSON.parse(json)) } catch { return [] }
}

export function richSegments(text: string, marks: TextMark[] = []) {
  const valid = normalizeMarks(text, marks)
  const boundaries = [...new Set([0, text.length, ...valid.flatMap((mark) => [mark.start, mark.end])])].sort((a, b) => a - b)
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    return { text: text.slice(start, end), ...Object.fromEntries(markNames.map((key) => [key, valid.some((mark) => mark.start <= start && mark.end >= end && mark[key])])) } as { text: string } & Record<typeof markNames[number], boolean>
  })
}

export function richTextHtml(text: string, marks: TextMark[] = []): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
  return richSegments(text, marks).map((part) => {
    const style = [part.bold && 'font-weight:bold', part.italic && 'font-style:italic', part.underline && 'text-decoration:underline', part.highlight && 'background-color:#fff29a'].filter(Boolean).join(';')
    return `<span${style ? ` style="${style}"` : ''}>${escape(part.text).replace(/\n/g, '<br/>')}</span>`
  }).join('')
}
