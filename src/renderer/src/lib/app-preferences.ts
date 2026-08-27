export type AppTheme = 'light' | 'dark'
export type PageFitPreference = 'none' | 'width' | 'page'

export interface AppPreferences {
  theme: AppTheme
  /** Omitted when the application uses its built-in theme colour. */
  accent?: string
  /** Apply the last explicitly selected page fitting mode to newly opened PDFs. */
  pageFit: PageFitPreference
  documentBackgrounds: Record<string, string>
}

const KEY = 'pdfuck.preferences.v1'
export const DEFAULT_ACCENT = '#5575de'
const fallback: AppPreferences = { theme: 'light', pageFit: 'none', documentBackgrounds: {} }

function validColor(value: unknown): value is string { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) }

export function loadPreferences(): AppPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '') as Partial<AppPreferences> & { fitWidth?: boolean }
    // Older releases persisted the built-in blue as an explicit choice. Treat it
    // as the default so the new restore action accurately reflects its state.
    const accent = validColor(value.accent) && value.accent.toLowerCase() !== DEFAULT_ACCENT ? value.accent : undefined
    const pageFit: PageFitPreference = value.pageFit === 'width' || value.pageFit === 'page' ? value.pageFit : value.fitWidth === true ? 'width' : 'none'
    return { theme: value.theme === 'dark' ? 'dark' : 'light', accent, pageFit, documentBackgrounds: value.documentBackgrounds && typeof value.documentBackgrounds === 'object' ? value.documentBackgrounds : {} }
  } catch { return fallback }
}

export function savePreferences(value: AppPreferences): void { localStorage.setItem(KEY, JSON.stringify(value)) }

export function contrastText(color: string): '#111827' | '#ffffff' {
  const rgb = color.slice(1).match(/.{2}/g)?.map((part) => Number.parseInt(part, 16) / 255)
  if (!rgb || rgb.length !== 3) return '#ffffff'
  const luminance = rgb.map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
  const whiteContrast = 1.05 / (luminance + .05)
  const darkContrast = (luminance + .05) / .05
  return darkContrast > whiteContrast ? '#111827' : '#ffffff'
}
