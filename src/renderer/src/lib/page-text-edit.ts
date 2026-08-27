import type { EditableTextRegion, PdfPoint, PdfRect, TextObjectRecord, TextStyle } from '../types'

function estimatedCharacterWidth(character: string, size: number): number {
  if (/[^\x00-\xff]/.test(character)) return size
  if (character === ' ') return size * .33
  if (/[ilI.,'`!|:;]/.test(character)) return size * .28
  if (/[mwMW@%&]/.test(character)) return size * .86
  return size * .56
}

function estimatedLineWidth(value: string, size: number): number {
  return Array.from(value).reduce((width, character) => width + estimatedCharacterWidth(character, size), 0)
}

export function replacementTextRect(selected: PdfRect, text: string, style: TextStyle, page: { width: number; height: number }): PdfRect {
  const lines = text.replace(/\r/g, '').split('\n')
  const desiredWidth = Math.max(selected.width, ...lines.map((line) => (estimatedLineWidth(line, style.size) + Math.max(0, Array.from(line).length - 1) * (style.letterSpacing || 0)) * (style.horizontalScale || 100) / 100))
  const lineHeight = style.size * (style.lineHeight || 1.25)
  const paragraphSpacing = lines.length * (Math.max(0, style.paragraphBefore || 0) + Math.max(0, style.paragraphAfter || 0))
  const desiredHeight = Math.max(selected.height, style.size + Math.max(0, lines.length - 1) * lineHeight + paragraphSpacing)
  const anchor = style.align === 'right' ? selected.x + selected.width : style.align === 'center' ? selected.x + selected.width / 2 : selected.x
  const availableWidth = style.align === 'right' ? anchor : style.align === 'center' ? Math.max(1, Math.min(anchor, page.width - anchor) * 2) : page.width - anchor
  const width = Math.max(1, Math.min(desiredWidth, availableWidth))
  const x = style.align === 'right' ? anchor - width : style.align === 'center' ? anchor - width / 2 : anchor
  return {
    x,
    y: selected.y,
    width,
    height: Math.max(1, Math.min(desiredHeight, page.height - selected.y))
  }
}

/** Place the textarea caret near the source glyph that the user clicked. */
export function pageTextCaretOffsetAt(region: EditableTextRegion, point: PdfPoint): number {
  const lines = region.lines.length ? region.lines : [{ text: region.text, rect: region.rect }]
  const lineIndex = lines.reduce((best, line, index) => {
    const distance = Math.max(line.rect.y - point.y, 0, point.y - line.rect.y - line.rect.height)
    const bestLine = lines[best]
    const bestDistance = Math.max(bestLine.rect.y - point.y, 0, point.y - bestLine.rect.y - bestLine.rect.height)
    return distance < bestDistance ? index : best
  }, 0)
  const line = lines[lineIndex]
  const characters = Array.from(line.text)
  const natural = characters.map((character) => estimatedCharacterWidth(character, region.style.size))
  const naturalWidth = natural.reduce((sum, width) => sum + width, 0)
  const scale = naturalWidth > 0 ? line.rect.width / naturalWidth : 1
  const target = Math.max(0, Math.min(line.rect.width, point.x - line.rect.x))
  let width = 0, characterOffset = 0
  for (const [index, advance] of natural.entries()) {
    if (target < width + advance * scale / 2) break
    width += advance * scale
    characterOffset = index + 1
  }
  const preceding = lines.slice(0, lineIndex).map((value) => value.text).join('\n')
  return preceding.length + (lineIndex ? 1 : 0) + characters.slice(0, characterOffset).join('').length
}

export function pageTextRegionHasReplacement(region: EditableTextRegion, objects: TextObjectRecord[]): boolean {
  const centerInside = (point: PdfPoint, rect: PdfRect, padding = .75) => point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding
  return objects.some((object) => {
    if (object.sourceRects?.length) {
      return region.sourceRects.some((source) => {
        const center = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
        return object.sourceRects!.some((replacement) => centerInside(center, replacement))
      })
    }
    const center = { x: region.rect.x + region.rect.width / 2, y: region.rect.y + region.rect.height / 2 }
    return centerInside(center, object.rect, 1)
  })
}
