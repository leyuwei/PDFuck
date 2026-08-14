export interface PageSelectionResult {
  pages: number[]
  invalid: string[]
}

export function allPageIndices(pageCount: number): number[] {
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index)
}

export function parsePageSelection(input: string, pageCount: number): PageSelectionResult {
  const normalized = input
    .trim()
    .replace(/[—–－~～]/g, '-')
    .replace(/\s*-\s*/g, '-')
  if (!normalized) return { pages: [], invalid: [] }

  const pages = new Set<number>()
  const invalid: string[] = []
  const tokens = normalized.split(/[,，;；\s]+/).filter(Boolean)
  for (const token of tokens) {
    const single = /^(\d+)$/.exec(token)
    const range = /^(\d+)-(\d+)$/.exec(token)
    if (single) {
      const page = Number(single[1])
      if (page >= 1 && page <= pageCount) pages.add(page - 1)
      else invalid.push(token)
      continue
    }
    if (range) {
      const start = Number(range[1]), end = Number(range[2])
      if (start < 1 || end < start || end > pageCount) { invalid.push(token); continue }
      for (let page = start; page <= end; page += 1) pages.add(page - 1)
      continue
    }
    invalid.push(token)
  }
  return { pages: [...pages].sort((a, b) => a - b), invalid }
}

export function compactPageSelection(pages: number[]): string {
  const values = [...new Set(pages)].filter((page) => page >= 0).sort((a, b) => a - b).map((page) => page + 1)
  const parts: string[] = []
  for (let index = 0; index < values.length;) {
    const start = values[index]
    let end = start
    while (index + 1 < values.length && values[index + 1] === end + 1) { index += 1; end = values[index] }
    parts.push(start === end ? `${start}` : `${start}-${end}`)
    index += 1
  }
  return parts.join(', ')
}
