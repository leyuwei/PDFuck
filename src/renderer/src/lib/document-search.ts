export interface SearchOptions { caseSensitive: boolean; fuzzy: boolean; regex: boolean }
export interface TextSearchMatch { start: number; end: number; match: string; occurrence: number }

/** UTF-16 offsets stay aligned with native textarea selections, including emoji. */
export function findTextMatches(text: string, query: string, options: SearchOptions, limit = 201): TextSearchMatch[] {
  if (!query.trim()) return []
  const compact = options.fuzzy && !options.regex
  const offsets: number[] = []
  const source = compact ? text.split('').filter((char, index) => { if (/\s/u.test(char)) return false; offsets.push(index); return true }).join('') : text
  const needle = compact ? query.trim().replace(/\s+/gu, '') : query.trim()
  const pattern = new RegExp(options.regex ? query : needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options.caseSensitive ? 'g' : 'gi')
  const results: TextSearchMatch[] = [], occurrences = new Map<string, number>()
  let match: RegExpExecArray | null
  while (results.length < limit && (match = pattern.exec(source))) {
    if (!match[0]) { pattern.lastIndex += 1; continue }
    const start = compact ? offsets[match.index] : match.index
    const end = compact ? offsets[match.index + match[0].length - 1] + 1 : match.index + match[0].length
    const key = options.caseSensitive ? match[0] : match[0].toLowerCase()
    const occurrence = occurrences.get(key) || 0
    occurrences.set(key, occurrence + 1)
    results.push({ start, end, match: text.slice(start, end), occurrence })
  }
  return results
}
