export const DEFAULT_ANNOTATION_AUTHOR = 'PDFuck'
export const MAX_ANNOTATION_AUTHOR_LENGTH = 60

const AUTHOR_COLORS = [
  { background: '#e8edff', border: '#a9b9ee', text: '#3655a8' },
  { background: '#e3f6f0', border: '#9bcdbd', text: '#24705c' },
  { background: '#fff0dc', border: '#e3bd82', text: '#8b5b13' },
  { background: '#f7e8f8', border: '#d5a8d9', text: '#814787' },
  { background: '#e7f2fb', border: '#a2c8e4', text: '#326887' },
  { background: '#fde9eb', border: '#e1a7ad', text: '#98434c' },
  { background: '#edf4df', border: '#b9ce8d', text: '#5c742e' },
  { background: '#eeeafb', border: '#bab0df', text: '#5e5198' }
] as const

export function normalizeAnnotationAuthor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_ANNOTATION_AUTHOR
  const normalized = [...value.trim().replace(/\s+/gu, ' ')].slice(0, MAX_ANNOTATION_AUTHOR_LENGTH).join('')
  return normalized || DEFAULT_ANNOTATION_AUTHOR
}

export function annotationAuthorColors(author: string): typeof AUTHOR_COLORS[number] {
  const value = normalizeAnnotationAuthor(author)
  let hash = 2166136261
  for (const character of value) { hash ^= character.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) }
  return AUTHOR_COLORS[(hash >>> 0) % AUTHOR_COLORS.length]
}

// Imported PDFs may contain author names longer than the local name-entry limit.
export function annotationAuthorKey(author: string): string { return author.trim().replace(/\s+/gu, ' ') || DEFAULT_ANNOTATION_AUTHOR }

export type AnnotationAuthorColors = { background: string; border: string; text: string }

/** Resolve hash collisions within the document, independent of annotation order. */
export function annotationAuthorPalette(authors: string[]): Map<string, AnnotationAuthorColors> {
  const result = new Map<string, AnnotationAuthorColors>()
  const used = new Set<string>()
  for (const author of [...new Set(authors.map(annotationAuthorKey))].sort()) {
    const preferred = annotationAuthorColors(author)
    const start = AUTHOR_COLORS.indexOf(preferred)
    const color: AnnotationAuthorColors = Array.from({ length: AUTHOR_COLORS.length }, (_, index) => AUTHOR_COLORS[(start + index) % AUTHOR_COLORS.length]).find((item) => !used.has(item.text)) || (() => {
      const hue = (result.size * 137.508) % 360
      return { background: `hsl(${hue} 65% 94%)`, border: `hsl(${hue} 45% 72%)`, text: `hsl(${hue} 52% 34%)` }
    })()
    used.add(color.text); result.set(author, color)
  }
  return result
}
