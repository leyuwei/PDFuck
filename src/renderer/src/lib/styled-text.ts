import type { PdfRect, TextStyle } from '../types'
import { fontCssFamily, usesStandardPdfFont } from './text-fonts'
import { ui } from './i18n'

export function styledTextRaster(text: string, rect: PdfRect, value: {style: TextStyle}, forceRaster = false): Promise<Uint8Array | undefined> {
  if (!forceRaster && !value.style.sourceFont && !/[^\x00-\xff]/.test(text) && usesStandardPdfFont(value.style.font)) return Promise.resolve(undefined)
  const scale = 3
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(8, Math.ceil(rect.width * scale)); canvas.height = Math.max(8, Math.ceil(rect.height * scale))
  const context = canvas.getContext('2d')!
  context.scale(scale, scale); context.fillStyle = value.style.color
  const sourceFont = value.style.sourceFont?.replace(/["']/g, '')
  const family = sourceFont ? `"${sourceFont}", ${fontCssFamily(value.style.font)}` : fontCssFamily(value.style.font)
  context.font = `${value.style.italic ? 'italic ' : ''}${value.style.bold ? '700 ' : ''}${value.style.size}px ${family}`
  context.textBaseline = 'alphabetic'; context.textAlign = value.style.align; context.letterSpacing = `${value.style.letterSpacing || 0}px`
  const anchor = value.style.align === 'left' ? 0 : value.style.align === 'center' ? rect.width / 2 : rect.width
  const horizontalScale = (value.style.horizontalScale || 100) / 100
  const measure = (textValue: string) => context.measureText(textValue).width * horizontalScale
  const lines: Array<{ text: string; top: number }> = []
  let top = 0
  for (const paragraph of text.split('\n')) {
    top += Math.max(0, value.style.paragraphBefore || 0)
    let line = ''
    for (const char of paragraph) {
      if (line && measure(line + char) > rect.width) { lines.push({ text: line, top }); top += value.style.size * (value.style.lineHeight || 1.25); line = char } else line += char
    }
    lines.push({ text: line, top }); top += value.style.size * (value.style.lineHeight || 1.25) + Math.max(0, value.style.paragraphAfter || 0)
  }
  const metrics=lines.map(line=>context.measureText(line.text)),padding=1
  const ascent=Math.max(value.style.size*.8,...metrics.map(m=>m.actualBoundingBoxAscent))+padding
  lines.filter((line) => line.top + value.style.size <= rect.height).forEach((line) => {
    context.save(); context.translate(anchor, line.top + ascent); context.scale(horizontalScale, 1); context.fillText(line.text, 0, 0); context.restore()
  })
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error(ui("ui.textImageEncodingFailed"))), 'image/png'))
}

