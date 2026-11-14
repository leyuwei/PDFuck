import type { TextStyle } from '../types'
import { normalizeFontFamily } from './text-fonts'

const KEY = 'pdfuck.add-text-style.v1'
const DEFAULT: TextStyle = { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left', lineHeight: 1.25 }

export function addTextStyle(value: unknown): TextStyle {
  const style = value && typeof value === 'object' ? value as Partial<TextStyle> : {}
  return {
    font: typeof style.font === 'string' && style.font.trim() ? normalizeFontFamily(style.font) : DEFAULT.font,
    size: typeof style.size === 'number' && Number.isFinite(style.size) ? Math.max(6, Math.min(144, style.size)) : DEFAULT.size,
    color: typeof style.color === 'string' && /^#[0-9a-f]{6}$/i.test(style.color) ? style.color.toLowerCase() : DEFAULT.color,
    bold: style.bold === true, italic: style.italic === true,
    align: style.align === 'center' || style.align === 'right' ? style.align : 'left',
    lineHeight: [1, 1.25, 1.5, 2].includes(style.lineHeight!) ? style.lineHeight : DEFAULT.lineHeight
  }
}

export function loadAddTextStyle(): TextStyle {
  try { return addTextStyle(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return { ...DEFAULT } }
}

export function saveAddTextStyle(style: TextStyle): void {
  try { localStorage.setItem(KEY, JSON.stringify(addTextStyle(style))) } catch { /* A blocked preference store must not prevent adding text. */ }
}
