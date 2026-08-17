export type FontCategory = 'sans' | 'serif' | 'mono'

export interface FontOption {
  value: string
  label: string
  category: FontCategory
}

export const FONT_OPTIONS: FontOption[] = [
  { value: 'Arial', label: 'Arial', category: 'sans' },
  { value: 'Helvetica', label: 'Helvetica', category: 'sans' },
  { value: 'Calibri', label: 'Calibri', category: 'sans' },
  { value: 'Segoe UI', label: 'Segoe UI', category: 'sans' },
  { value: 'Microsoft YaHei', label: '微软雅黑', category: 'sans' },
  { value: 'SimHei', label: '黑体', category: 'sans' },
  { value: 'Times New Roman', label: 'Times New Roman', category: 'serif' },
  { value: 'Georgia', label: 'Georgia', category: 'serif' },
  { value: 'Cambria', label: 'Cambria', category: 'serif' },
  { value: 'SimSun', label: '宋体', category: 'serif' },
  { value: 'KaiTi', label: '楷体', category: 'serif' },
  { value: 'FangSong', label: '仿宋', category: 'serif' },
  { value: 'Courier New', label: 'Courier New', category: 'mono' },
  { value: 'Consolas', label: 'Consolas', category: 'mono' }
]

function cleanFontName(value: string): string {
  return value
    .replace(/^[A-Z]{6}\+/, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/[-_,]+/g, ' ')
    .replace(/\b(bold|italic|oblique|regular|roman|medium|semibold|demi|black|heavy)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function fontCategory(value: string): FontCategory {
  const font = value.toLowerCase()
  if (/courier|mono|consolas|menlo/.test(font)) return 'mono'
  if (/times|serif|song|simsun|ming|kai|fangsong|georgia|cambria/.test(font)) return 'serif'
  return 'sans'
}

export function normalizeFontFamily(...candidates: Array<string | undefined>): string {
  const joined = candidates.filter(Boolean).join(' ')
  const font = joined.toLowerCase().replace(/\s+/g, '')
  if (/microsoftyahei|msyh|yahei/.test(font)) return 'Microsoft YaHei'
  if (/simsun|nsimsun|songti|song|sung|mingliu|ming/.test(font)) return 'SimSun'
  if (/simhei|heiti|hei/.test(font)) return 'SimHei'
  if (/fangsong|fang/.test(font)) return 'FangSong'
  if (/kaiti|kaiti|kai/.test(font)) return 'KaiTi'
  if (/timesnewroman|times|nimbusrom|newcentury/.test(font)) return 'Times New Roman'
  if (/couriernew|courier|nimbusmon/.test(font)) return 'Courier New'
  if (/consolas/.test(font)) return 'Consolas'
  if (/calibri|carlito/.test(font)) return 'Calibri'
  if (/cambria/.test(font)) return 'Cambria'
  if (/georgia/.test(font)) return 'Georgia'
  if (/segoeui|segoe/.test(font)) return 'Segoe UI'
  if (/helvetica|nimbussan/.test(font)) return 'Helvetica'
  if (/arial|liberationsans/.test(font)) return 'Arial'
  if (font === 'serif') return 'Times New Roman'
  if (font === 'monospace' || font === 'mono') return 'Courier New'
  if (font === 'sansserif' || font === 'sans') return 'Arial'
  const cleaned = cleanFontName(candidates.find((candidate) => candidate && !/^(sans-serif|serif|monospace)$/i.test(candidate)) || '')
  return cleaned || 'Arial'
}

export function fontCssFamily(value: string): string {
  const normalized = normalizeFontFamily(value)
  const category = fontCategory(normalized)
  const fallback = category === 'serif' ? 'serif' : category === 'mono' ? 'monospace' : 'sans-serif'
  if (normalized === 'Helvetica') return '"Helvetica", Arial, sans-serif'
  if (normalized === 'Microsoft YaHei') return '"Microsoft YaHei", "Segoe UI", sans-serif'
  if (normalized === 'SimSun') return 'SimSun, "Songti SC", serif'
  return `"${normalized.replace(/"/g, '')}", ${fallback}`
}

export function fontOptionsFor(value: string): FontOption[] {
  const normalized = normalizeFontFamily(value)
  if (FONT_OPTIONS.some((option) => option.value === normalized)) return FONT_OPTIONS
  return [{ value: normalized, label: `${normalized}（原文字体）`, category: fontCategory(normalized) }, ...FONT_OPTIONS]
}

export function usesStandardPdfFont(value: string): boolean {
  const normalized = normalizeFontFamily(value)
  return normalized === 'Arial' || normalized === 'Helvetica' || normalized === 'Times New Roman' || normalized === 'Courier New'
}
