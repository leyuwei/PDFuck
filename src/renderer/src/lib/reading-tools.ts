export type ReadingTool = 'citation' | 'visual' | 'abbreviation'
export type ReadingTools = Record<ReadingTool, boolean>
export const READING_TOOLS_OFF: ReadingTools = { citation: false, visual: false, abbreviation: false }
const KEY = 'pdfuck.reading-tools.v1'
export function loadReadingTools(): Record<string, ReadingTools> {
  try {
    const store = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (!store || typeof store !== 'object' || Array.isArray(store)) return {}
    return Object.fromEntries(Object.entries(store).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([key, value]) => {
      const v = value as Partial<ReadingTools>
      return [key, { citation: v.citation === true, visual: v.visual === true, abbreviation: v.abbreviation === true }]
    }))
  } catch { return {} }
}
export function saveReadingTools(store: Record<string, ReadingTools>): void {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* Reading remains available when storage is full or disabled. */ }
}
