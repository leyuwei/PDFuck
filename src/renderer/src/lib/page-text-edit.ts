import type { PdfRect, TextStyle } from '../types'

function estimatedLineWidth(value: string, size: number): number {
  return Array.from(value).reduce((width, character) => width + (/[^\x00-\xff]/.test(character) ? size : character === ' ' ? size * .33 : size * .58), 0)
}

export function replacementTextRect(selected: PdfRect, text: string, style: TextStyle, page: { width: number; height: number }): PdfRect {
  const lines = text.replace(/\r/g, '').split('\n')
  const desiredWidth = Math.max(selected.width, ...lines.map((line) => estimatedLineWidth(line, style.size) + style.size * .35))
  const desiredHeight = Math.max(selected.height, lines.length * style.size * 1.25)
  return {
    x: selected.x,
    y: selected.y,
    width: Math.max(1, Math.min(desiredWidth, page.width - selected.x)),
    height: Math.max(1, Math.min(desiredHeight, page.height - selected.y))
  }
}
