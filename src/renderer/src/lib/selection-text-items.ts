import type { TextItem } from 'pdfjs-dist/types/src/display/api'

const compact = (text: string) => text.normalize('NFKC').replace(/\s/gu, '')

/** Filter the selection layer only; rendering and editable PDF objects keep their original data. */
export function selectionTextItems(items: TextItem[], operators: { fnArray: number[]; argsArray: any[] }, ops: Record<string, number>): TextItem[] {
  let alpha = 1, font = '', marked = false
  const states: Array<{ alpha: number; font: string; marked: boolean }> = [], marks: boolean[] = []
  const tapes = new Map<string, { text: string; flags: number[]; cursor: number }>()
  operators.fnArray.forEach((op, index) => {
    const args = operators.argsArray[index]
    if (op === ops.save || op === ops.paintFormXObjectBegin || op === ops.beginGroup) states.push({ alpha, font, marked })
    else if (op === ops.restore || op === ops.paintFormXObjectEnd || op === ops.endGroup) {
      const state = states.pop()
      if (state) ({ alpha, font, marked } = state)
    } else if (op === ops.setGState) {
      for (const [key, value] of args[0]) {
        if (key === 'ca') alpha = value
        else if (key === 'Font') font = value[0]
      }
    } else if (op === ops.setFont) font = args[0]
    else if (op === ops.beginMarkedContent || op === ops.beginMarkedContentProps) {
      marks.push(marked)
      marked ||= /watermark/i.test(JSON.stringify(args))
    } else if (op === ops.endMarkedContent) marked = marks.pop() ?? false
    else if (op === ops.showText || op === ops.showSpacedText) {
      const text = compact((args[0] || []).map((glyph: { unicode?: string } | number) => typeof glyph === 'object' ? glyph.unicode || '' : '').join(''))
      const tape = tapes.get(font) || { text: '', flags: [], cursor: 0 }
      tape.text += text
      for (let i=0;i<text.length;i++) tape.flags.push(marked ? 2 : alpha > 0 && alpha <= .35 ? 1 : 0)
      tapes.set(font, tape)
    }
  })
  const flags = items.map(item => {
    const text = compact(item.str), tape = tapes.get(item.fontName)
    if (!text || !tape) return 0
    const start = tape.text.indexOf(text, tape.cursor)
    if (start < 0) return 0
    tape.cursor = start + text.length
    return tape.flags.slice(start, tape.cursor).reduce((minimum, flag) => Math.min(minimum, flag), 2)
  })
  const heights = items.filter((_, index) => !flags[index]).map(item => Math.hypot(item.transform[2], item.transform[3])).filter(height => height > 0).sort((a,b) => a-b)
  const em = heights[Math.floor(heights.length / 2)] || 10
  const bounds = (item: TextItem) => {
    const [a,b,c,d,x,y] = item.transform, length = Math.hypot(a,b) || 1
    const xs = [x, x+a/length*item.width, x+c, x+a/length*item.width+c]
    const ys = [y, y+b/length*item.width, y+d, y+b/length*item.width+d]
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  }
  return items.filter((item, index) => {
    if (flags[index] === 2) return false
    const angle = Math.atan2(item.transform[1], item.transform[0]), diagonal = Math.abs(Math.sin(angle * 2)) > .25
    const repeated = items.filter(other => compact(other.str) === compact(item.str)).length >= 2
    const oversized = Math.hypot(item.transform[2],item.transform[3]) >= em * 2 && compact(item.str).length >= 6
    if (!flags[index] && !(oversized || diagonal && repeated)) return true
    const rect = bounds(item)
    // Faint footnotes and ordinary rotated/vertical labels remain selectable unless they overlay body text.
    return !items.some((other, otherIndex) => {
      if (otherIndex === index || flags[otherIndex] || !other.str.trim() || Math.abs(other.transform[1]) > .01) return false
      const next = bounds(other)
      return Math.min(rect.right,next.right) > Math.max(rect.left,next.left) && Math.min(rect.bottom,next.bottom) > Math.max(rect.top,next.top)
    })
  })
}
