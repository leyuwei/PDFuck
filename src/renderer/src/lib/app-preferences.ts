import { DEFAULT_ANNOTATION_AUTHOR, normalizeAnnotationAuthor } from './annotation-author'
import type { ModuleKey } from '../types'

export type AppTheme = 'light' | 'dark'
export type PageFitPreference = 'none' | 'width' | 'page'
export type SidebarKey = ModuleKey | 'annotationList'
export type SidebarPreferences = Partial<Record<SidebarKey, boolean>>
export const SIDEBAR_PREFERENCES_KEY = 'pdfuck.sidebar-preferences.v1'

export function loadSidebarPreferences(): SidebarPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(SIDEBAR_PREFERENCES_KEY) || '{}')
    const collapsed: SidebarPreferences = {}
    for (const key of ['view', 'edit', 'annotate', 'save', 'annotationList'] as const) {
      if (typeof stored?.[key] === 'boolean') collapsed[key] = stored[key]
    }
    return collapsed
  } catch { return {} }
}

export function saveSidebarPreferences(value: SidebarPreferences): void {
  try { localStorage.setItem(SIDEBAR_PREFERENCES_KEY, JSON.stringify(value)) } catch { /* Keep the current window usable if storage is unavailable. */ }
}

export interface AppPreferences {
  theme: AppTheme
  /** Omitted when the application uses its built-in theme colour. */
  accent?: string
  /** Apply the last explicitly selected page fitting mode to newly opened PDFs. */
  pageFit: PageFitPreference
  documentBackgrounds: Record<string, string>
  /** Stored in the standard PDF annotation author field for newly created annotations. */
  annotationAuthor: string
  /** Reveal compact, colour-coded author badges inside annotation content cells. */
  showAnnotationAuthors: boolean
}

const KEY = 'pdfuck.preferences.v1'
export const DEFAULT_ACCENT = '#5575de'
const fallback: AppPreferences = { theme: 'light', pageFit: 'none', documentBackgrounds: {}, annotationAuthor: DEFAULT_ANNOTATION_AUTHOR, showAnnotationAuthors: false }

function validColor(value: unknown): value is string { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) }

export function loadPreferences(): AppPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '') as Partial<AppPreferences> & { fitWidth?: boolean }
    // Older releases persisted the built-in blue as an explicit choice. Treat it
    // as the default so the new restore action accurately reflects its state.
    const accent = validColor(value.accent) && value.accent.toLowerCase() !== DEFAULT_ACCENT ? value.accent : undefined
    const pageFit: PageFitPreference = value.pageFit === 'width' || value.pageFit === 'page' ? value.pageFit : value.fitWidth === true ? 'width' : 'none'
    return { theme: value.theme === 'dark' ? 'dark' : 'light', accent, pageFit, documentBackgrounds: value.documentBackgrounds && typeof value.documentBackgrounds === 'object' ? value.documentBackgrounds : {}, annotationAuthor: normalizeAnnotationAuthor(value.annotationAuthor), showAnnotationAuthors: value.showAnnotationAuthors === true }
  } catch { return fallback }
}

export function savePreferences(value: AppPreferences): void { localStorage.setItem(KEY, JSON.stringify(value)) }

function colorChannels(color: string): number[] {
  return color.slice(1).match(/.{2}/g)?.map(part => Number.parseInt(part, 16) / 255) ?? []
}

function relativeLuminance(rgb: number[]): number {
  return rgb.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

export function contrastText(color: string, pureBlack = false): '#111827' | '#000000' | '#ffffff' {
  const rgb = colorChannels(color)
  if (rgb.length !== 3) return '#ffffff'
  const luminance = relativeLuminance(rgb)
  const whiteContrast = 1.05 / (luminance + .05)
  const darkContrast = (luminance + .05) / .05
  return darkContrast > whiteContrast ? pureBlack ? '#000000' : '#111827' : '#ffffff'
}

export function titlebarAccent(accent: string, theme: AppTheme): string {
  // Use the tool-group surface, slightly closer to the accent than the titlebar itself.
  const surface = relativeLuminance(colorChannels(theme === 'dark' ? '#202b3c' : '#f5f7fa'))
  const rgb = colorChannels(accent)
  const endpoint = theme === 'dark' ? 1 : 0
  for (let step = 0; step < 10; step++) {
    const candidate = rgb.map(channel => Math.round((channel + (endpoint - channel) * step / 10) * 255))
    const ink = relativeLuminance(candidate.map(channel => channel / 255))
    if ((Math.max(ink, surface) + .05) / (Math.min(ink, surface) + .05) >= 4.5) {
      return '#' + candidate.map(channel => channel.toString(16).padStart(2, '0')).join('')
    }
  }
  return theme === 'dark' ? '#ffffff' : '#000000'
}
