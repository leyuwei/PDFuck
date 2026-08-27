import type { PageNumberSettings, PdfRect } from '../types'

export const DEFAULT_PAGE_NUMBER_SETTINGS: PageNumberSettings = {
  template: '{page} / {total}',
  font: 'Helvetica',
  size: 10,
  color: '#536176',
  bold: false,
  italic: false,
  horizontal: 'center',
  vertical: 'bottom',
  edgeOffsetPercent: 3,
  sideMarginPercent: 6
}

export function formatPageNumber(template: string, page: number, total: number): string {
  return template.replaceAll('{page}', String(page)).replaceAll('{total}', String(total))
}

export function validatePageNumberTemplate(template: string): string | undefined {
  if (!template.trim()) return '页码模板不能为空。'
  if (!template.includes('{page}')) return '页码模板必须包含 {page}。'
  if (template.length > 120) return '页码模板不能超过 120 个字符。'
  if (/\r|\n/.test(template)) return '页码模板只能使用单行文字。'
  const unsupported = template.match(/\{[^{}]+\}/g)?.find((token) => token !== '{page}' && token !== '{total}')
  return unsupported ? '仅支持 {page} 和 {total} 两个占位符。' : undefined
}

/**
 * Position a page-number line from the visible page edges. Percentages make
 * the same settings adapt to portrait, landscape, cropped, and mixed-size PDFs.
 */
export function pageNumberRect(page: { width: number; height: number }, settings: PageNumberSettings): PdfRect {
  const sideMargin = page.width * Math.max(0, Math.min(30, settings.sideMarginPercent)) / 100
  const edgeOffset = page.height * Math.max(0, Math.min(30, settings.edgeOffsetPercent)) / 100
  const height = Math.min(page.height, Math.max(settings.size * 1.55, 12))
  return {
    x: sideMargin,
    y: settings.vertical === 'top' ? edgeOffset : Math.max(0, page.height - edgeOffset - height),
    width: Math.max(1, page.width - sideMargin * 2),
    height
  }
}
