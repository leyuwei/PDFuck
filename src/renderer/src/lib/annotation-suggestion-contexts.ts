export const ANNOTATION_CONTEXT_STORAGE_PREFIX = 'pdfuck.lab.annotation-contexts.v1'

export interface AnnotationSuggestionContext {
  key: string
  text: string
  pageIndexes: number[]
}

interface StoredContexts {
  version: 1
  documentKey: string
  contexts: AnnotationSuggestionContext[]
}

function hashDocumentKey(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${(hash >>> 0).toString(16)}-${value.length}`
}

export function annotationContextStorageKey(documentKey: string): string {
  return `${ANNOTATION_CONTEXT_STORAGE_PREFIX}.${hashDocumentKey(documentKey)}`
}

function validContext(value: unknown): value is AnnotationSuggestionContext {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<AnnotationSuggestionContext>
  return typeof context.key === 'string' && typeof context.text === 'string' && context.text.trim().length > 0
    && Array.isArray(context.pageIndexes) && context.pageIndexes.length > 0
    && context.pageIndexes.every((page) => Number.isInteger(page) && page >= 0)
}

export function loadAnnotationSuggestionContexts(documentKey?: string): AnnotationSuggestionContext[] {
  if (!documentKey) return []
  try {
    const raw = localStorage.getItem(annotationContextStorageKey(documentKey))
    if (!raw) return []
    const stored = JSON.parse(raw) as Partial<StoredContexts>
    if (stored.version !== 1 || stored.documentKey !== documentKey || !Array.isArray(stored.contexts)) return []
    return stored.contexts.filter(validContext).map((context) => ({ ...context, pageIndexes: [...new Set(context.pageIndexes)] }))
  } catch { return [] }
}

export function saveAnnotationSuggestionContexts(documentKey: string | undefined, contexts: AnnotationSuggestionContext[]): void {
  if (!documentKey) return
  const stored: StoredContexts = { version: 1, documentKey, contexts: contexts.filter(validContext) }
  localStorage.setItem(annotationContextStorageKey(documentKey), JSON.stringify(stored))
}

export function clearAnnotationSuggestionContexts(documentKey?: string): void {
  if (documentKey) localStorage.removeItem(annotationContextStorageKey(documentKey))
}

export function hasAnnotationSuggestionContextStore(documentKey?: string): boolean {
  return Boolean(documentKey && localStorage.getItem(annotationContextStorageKey(documentKey)))
}

export function selectionContextKey(selection: { text: string; pageIndex: number; rects: Array<{ x: number; y: number; width: number; height: number }>; segments?: Array<{ pageIndex: number; rects: Array<{ x: number; y: number; width: number; height: number }> }> }): string {
  const segments = selection.segments?.length ? selection.segments : [{ pageIndex: selection.pageIndex, rects: selection.rects }]
  const geometry = segments.map((segment) => `${segment.pageIndex}:${segment.rects.map((rect) => [rect.x, rect.y, rect.width, rect.height].map((number) => Math.round(number * 100) / 100).join(',')).join(';')}`).join('|')
  return `${selection.text.trim().replace(/\s+/g, ' ')}::${geometry}`
}
