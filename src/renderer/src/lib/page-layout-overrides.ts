const KEY = 'pdfuck.page-layout-overrides.v1'

export interface PageLayoutOverride {
  /** Normalized x positions. An empty array explicitly forces one column. */
  columnBoundaries?: number[]
  /** Normalized top/bottom pairs for user-confirmed full-width visual blocks. */
  spanningRegions?: Array<[number, number]>
}

type Store = Record<string, Record<string, PageLayoutOverride>>

function numbers(values: unknown): number[] | undefined {
  if (!Array.isArray(values)) return undefined
  const result = [...new Set(values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0.02 && value <= 0.98).map((value) => Math.round(value * 10_000) / 10_000))].sort((left, right) => left - right)
  return result.length === values.length ? result : undefined
}

function regions(values: unknown): Array<[number, number]> {
  if (!Array.isArray(values)) return []
  return values.flatMap((value): Array<[number, number]> => Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? [[Math.round(Math.max(0.01, Math.min(value[0], value[1])) * 10_000) / 10_000, Math.round(Math.min(0.99, Math.max(value[0], value[1])) * 10_000) / 10_000]]
    : []).filter(([top, bottom]) => bottom - top >= 0.01).sort((left, right) => left[0] - right[0])
}

function normalized(value: unknown): PageLayoutOverride | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const candidate = value as PageLayoutOverride
  const columnBoundaries = candidate.columnBoundaries === undefined ? undefined : numbers(candidate.columnBoundaries)
  const spanningRegions = regions(candidate.spanningRegions)
  if (candidate.columnBoundaries !== undefined && columnBoundaries === undefined) return undefined
  return columnBoundaries !== undefined || spanningRegions.length ? { ...(columnBoundaries === undefined ? {} : { columnBoundaries }), ...(spanningRegions.length ? { spanningRegions } : {}) } : undefined
}

function loadStore(): Store {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}') as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Store : {}
  } catch { return {} }
}

export function loadPageLayoutOverride(documentKey: string, pageIndex: number): PageLayoutOverride | undefined {
  return normalized(loadStore()[documentKey]?.[pageIndex])
}

export function savePageLayoutOverride(documentKey: string, pageIndex: number, override?: PageLayoutOverride): void {
  try {
    const store = loadStore()
    const value = normalized(override)
    if (!value) {
      if (store[documentKey]) delete store[documentKey][pageIndex]
      if (store[documentKey] && !Object.keys(store[documentKey]).length) delete store[documentKey]
    } else store[documentKey] = { ...(store[documentKey] || {}), [pageIndex]: value }
    if (Object.keys(store).length) localStorage.setItem(KEY, JSON.stringify(store))
    else localStorage.removeItem(KEY)
  } catch { /* Keep selection usable when browser storage is disabled or full. */ }
}
