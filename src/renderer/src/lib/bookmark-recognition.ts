import type { PdfBookmark } from '../types'
import type { WordBox } from './text-layout'

export type BookmarkRuleId = 'decimal' | 'localized' | 'chapters' | 'headings' | 'typography'

export interface BookmarkRecognitionOptions {
  rules: BookmarkRuleId[]
  maxDepth: number
  customKeywords: string
}

export interface BookmarkTextLine {
  pageIndex: number
  text: string
  top: number
  left: number
  width: number
  fontSize: number
  pageWidth: number
  pageHeight: number
  column?: number
}

export interface RecognizedBookmark {
  id: string
  title: string
  pageIndex: number
  level: number
  top: number
  fontSize: number
  rule: BookmarkRuleId | 'custom'
}

/** Typography is deliberately opt-in: explicit numbering and heading words are
 * substantially safer defaults for dense, multi-column academic documents. */
export const DEFAULT_BOOKMARK_RULES: BookmarkRuleId[] = ['decimal', 'localized', 'chapters', 'headings']

function normalizedLineText(parts: string[]): string {
  return parts.join(' ').replace(/\s+/gu, ' ').replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, '$1').replace(/\s+([、。，．：:；;）)\]】])/gu, '$1').trim()
}

/** Convert PDF.js word geometry into visual lines without relying on DOM rendering. */
export function bookmarkLinesFromWords(pageIndex: number, words: WordBox[], pageWidth: number, pageHeight: number): BookmarkTextLine[] {
  interface Line { words: WordBox[]; baseline: number; column?: number; closed: boolean }
  const lines: Line[] = []
  for (const word of [...words].sort((left, right) => left.order - right.order)) {
    const baseline = word.baselineY ?? word.rect.y + word.rect.height
    const previous = lines.at(-1)
    const tolerance = Math.max(2.5, Math.min(previous?.words.at(-1)?.rect.height || word.rect.height, word.rect.height) * .58)
    const sameLine = previous && !previous.closed && Math.abs(previous.baseline - baseline) <= tolerance && (previous.column === undefined || word.column === undefined || previous.column === word.column)
    if (sameLine) {
      previous.words.push(word)
      previous.closed ||= Boolean(word.lineBreakAfter)
    } else lines.push({ words: [word], baseline, column: word.column, closed: Boolean(word.lineBreakAfter) })
  }
  return lines.flatMap((line) => {
    const ordered = [...line.words].sort((left, right) => left.rect.x - right.rect.x || left.order - right.order)
    const text = normalizedLineText(ordered.map((word) => word.text))
    if (!text) return []
    const left = Math.min(...ordered.map((word) => word.rect.x)), top = Math.min(...ordered.map((word) => word.rect.y))
    const right = Math.max(...ordered.map((word) => word.rect.x + word.rect.width))
    const heights = ordered.map((word) => word.rect.height).sort((a, b) => a - b)
    return [{ pageIndex, text, top, left, width: right - left, fontSize: heights[Math.floor(heights.length / 2)] || 0, pageWidth, pageHeight, column: line.column }]
  })
}

const NUMBER = String.raw`[0-9٠-٩۰-۹०-९]+`
const EAST_ASIAN_NUMBER = String.raw`[〇零一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+`

interface RuleMatch { level: number; rule: BookmarkRuleId; title?: string }

/** pdfTeX small caps are commonly extracted as `I NTRODUCTION` and
 * `B LOCKCHAIN -E NHANCED`. Normalize only an uppercase initial followed by
 * an uppercase run, so ordinary prose spacing is left untouched. */
export function normalizeAcademicHeading(text: string): string {
  const value = text.replace(/\s+/gu, ' ').trim().replace(/\b([A-Z])\s+([A-Z]{2,})\b/gu, '$1$2')
  return value
    .replace(/\s*([-‐‑‒–—])\s*/gu, '$1')
    .replace(/\s*([’'])\s*/gu, '$1')
    .replace(/\s+([、。，．：:；;）)\]】])/gu, '$1')
    .trim()
}

function strictRomanMarker(text: string): RegExpMatchArray | null {
  const match = text.match(/^\s*([IVXLCDM]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)[.．、:)）]\s+(.+)$/u)
  if (!match) return null
  if (/^[IVXLCDM]+$/u.test(match[1]) && !/^M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/u.test(match[1])) return null
  return match
}

function numberedHeadingRemainder(value: string): boolean {
  const text = value.trim()
  if (!headingLike(text) || Array.from(text).length > 160) return false
  if (!/^[\p{L}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return false
  if (/[,:;，；。.!?！？]$/u.test(text) || (text.match(/[,，;；]/gu)?.length || 0) > 1) return false
  const firstLetter = text.match(/[\p{L}]/u)?.[0]
  return !firstLetter || firstLetter.toLocaleUpperCase() === firstLetter
}

function explicitRule(text: string, rules: Set<BookmarkRuleId>): RuleMatch | undefined {
  if (rules.has('decimal')) {
    const decimal = text.match(new RegExp(String.raw`^\s*(${NUMBER}(?:[.．]${NUMBER}){0,5})(?:[.．、:：)）]\s*|\s+)(.+)$`, 'u'))
    if (decimal && numberedHeadingRemainder(decimal[2])) {
      const level = decimal[1].split(/[.．]/u).length
      const singleLevelLooksLikeListProse = level === 1 && (/[，,]/u.test(decimal[2]) || decimal[2].trim().split(/\s+/u).length > 12)
      if (!singleLevelLooksLikeListProse) return { level, rule: 'decimal' }
    }
    // IEEE-style A.–H. subsection markers take precedence over the letters C
    // and D being technically valid (but implausible here) Roman numerals.
    const alpha = text.match(/^\s*[A-H][.．、:)）]\s+(.+)$/u)
    if (alpha && numberedHeadingRemainder(alpha[1])) return { level: 2, rule: 'decimal' }
    const roman = strictRomanMarker(text)
    if (roman && numberedHeadingRemainder(roman[2])) return { level: 1, rule: 'decimal' }
    const parenthesized = text.match(/^\s*[（(](?:[a-z]|[ivxlcdm]+)[)）][.．、:]?\s+(.+)$/iu)
    if (parenthesized && numberedHeadingRemainder(parenthesized[1])) return { level: 2, rule: 'decimal' }
  }
  if (rules.has('localized')) {
    if (new RegExp(String.raw`^\s*${EAST_ASIAN_NUMBER}[、．.]\s*`, 'u').test(text)) return { level: 1, rule: 'localized' }
    if (new RegExp(String.raw`^\s*[（(]${EAST_ASIAN_NUMBER}[)）]\s*`, 'u').test(text)) return { level: 2, rule: 'localized' }
    if (/^\s*(?:제\s*[0-9일이삼사오육칠팔구십]+\s*[장절]|บทที่\s*[0-9๐-๙]+)/iu.test(text)) return { level: 1, rule: 'localized' }
  }
  if (rules.has('chapters')) {
    if (new RegExp(String.raw`^\s*第\s*(?:${NUMBER}|${EAST_ASIAN_NUMBER})\s*[篇部卷章]`, 'u').test(text)) return { level: 1, rule: 'chapters' }
    if (new RegExp(String.raw`^\s*第\s*(?:${NUMBER}|${EAST_ASIAN_NUMBER})\s*节`, 'u').test(text)) return { level: 2, rule: 'chapters' }
    if (new RegExp(String.raw`^\s*第\s*(?:${NUMBER}|${EAST_ASIAN_NUMBER})\s*条`, 'u').test(text)) return { level: 3, rule: 'chapters' }
    const labelled = (pattern: RegExp, level: number): RuleMatch | undefined => {
      const match = text.match(pattern)
      if (!match) return undefined
      const remainder = match[1]?.trim() || ''
      return !remainder || numberedHeadingRemainder(remainder) ? { level, rule: 'chapters' } : undefined
    }
    const part = labelled(/^\s*(?:part|book|volume|篇|部|卷|часть|parte|livre|buch|teil|tomo)\s+(?:[0-9ivxlcdm]+|[一二三四五六七八九十]+)(?:[.．:：—–-]\s*|\s+)?(.*)$/iu, 1)
    if (part) return part
    const chapter = labelled(/^\s*(?:chapter|chapitre|kapitel|cap[ií]tulo|capitolo|глава|rozdzia[łl]|hoofdstuk|باب|فصل|अध्याय)\s+(?:[0-9ivxlcdm]+|[一二三四五六七八九十]+)(?:[.．:：—–-]\s*|\s+)?(.*)$/iu, 1)
    if (chapter) return chapter
    const section = labelled(/^\s*(?:section|secci[oó]n|se[cç][aã]o|sezione|abschnitt|раздел|секция|節)\s+(?:[0-9ivxlcdm]+(?:[.．][0-9]+)*)(?:[.．:：—–-]\s*|\s+)?(.*)$/iu, 2)
    if (section) return section
    const subsection = labelled(/^\s*(?:subsection|subsecci[oó]n|sous-section|unterabschnitt|подраздел)\s+(?:[0-9]+(?:[.．][0-9]+)*)(?:[.．:：—–-]\s*|\s+)?(.*)$/iu, 3)
    if (subsection) return subsection
    if (/^\s*(?:appendix|annex|ap[eé]ndice|annexe|anhang|приложение|附录|付録)\s*(?:[a-z0-9一二三四五六七八九十])?/iu.test(text)) return { level: 1, rule: 'chapters' }
  }
  if (rules.has('headings')) {
    const headings = /^(摘要|内容摘要|目录|前言|序言|序章|引言|绪论|研究背景|相关工作|方法|研究方法|材料与方法|实验|结果|讨论|结论|总结|展望|局限性|参考文献|参考资料|附录|致谢|术语表|索引|はじめに|序論|概要|要旨|方法|結果|考察|結論|まとめ|参考文献|謝辞|목차|서론|초록|방법|결과|논의|결론|참고문헌|abstract|executive summary|contents|table of contents|preface|foreword|prologue|introduction|background|related work|literature review|methodology|methods?|materials and methods|experiments?|results?|discussion|conclusions?|summary|future work|limitations?|references|bibliography|acknowledg(?:e)?ments?|glossary|index|введение|аннотация|содержание|предисловие|методы|результаты|обсуждение|заключение|выводы|литература|библиография|приложение|introducci[oó]n|resumen|contenido|prefacio|antecedentes|m[eé]todos?|resultados?|discusi[oó]n|conclusiones?|referencias|bibliograf[ií]a|agradecimientos?|introdu[cç][aã]o|resumo|conte[uú]do|m[eé]todos?|resultados?|discuss[aã]o|conclus[aã]o|refer[eê]ncias|introduzione|sommario|metodi|risultati|discussione|conclusioni|riferimenti|introduction|r[eé]sum[eé]|sommaire|m[eé]thodes?|r[eé]sultats?|discussion|conclusion|r[eé]f[eé]rences|einleitung|zusammenfassung|inhalt|methoden|ergebnisse|diskussion|schlussfolgerung|literatur|مقدمة|ملخص|المحتويات|المنهجية|النتائج|المناقشة|الخاتمة|المراجع)(?:\s*[:：—–-].*)?$/iu
    const heading = text.trim().match(headings)
    if (heading) return { level: 1, rule: 'headings', title: heading[1] }
  }
  return undefined
}

function customRule(text: string, customKeywords: string): boolean {
  const normalized = text.trim().toLocaleLowerCase()
  return customKeywords.split(/\r?\n|[,，;]/u).map((value) => value.trim().toLocaleLowerCase()).filter(Boolean)
    .some((keyword) => normalized === keyword || normalized.startsWith(`${keyword}:`) || normalized.startsWith(`${keyword}：`) || normalized.startsWith(`${keyword} `))
}

function headingLike(text: string): boolean {
  const value = text.trim()
  if (Array.from(value).length < 2 || Array.from(value).length > 100) return false
  if (/https?:\/\/|www\.|@/iu.test(value) || /^[\d\s.,:;()\-–—]+$/u.test(value)) return false
  if (/[。.!?！？；;，,]$/u.test(value)) return false
  const punctuation = value.match(/[，,；;。.!?！？]/gu)?.length || 0
  return punctuation <= 1
}

function typographyLevel(fontSize: number, sizes: number[], maxDepth: number): number {
  const distinct = [...new Set(sizes.map((value) => Math.round(value * 2) / 2))].sort((a, b) => b - a)
  const closest = distinct.reduce((best, value, index) => Math.abs(value - fontSize) < Math.abs(distinct[best] - fontSize) ? index : best, 0)
  return Math.min(maxDepth, closest + 1)
}

function lineColumn(line: BookmarkTextLine): number {
  return line.column ?? 0
}

function academicUppercaseLine(text: string): boolean {
  const letters = Array.from(text).filter((character) => /[\p{L}]/u.test(character))
  if (!letters.length || letters.length > 80) return false
  const uppercase = letters.filter((character) => character.toLocaleUpperCase() === character).length
  return uppercase / letters.length >= .86
}

function orderedRecognitionLines(lines: BookmarkTextLine[]): BookmarkTextLine[] {
  const ordered = [...lines].sort((left, right) => left.pageIndex - right.pageIndex || lineColumn(left) - lineColumn(right) || left.top - right.top || left.left - right.left)
  const consumed = new Set<BookmarkTextLine>()
  return ordered.flatMap((line) => {
    if (consumed.has(line)) return []
    const title = normalizeAcademicHeading(line.text)
    if (!strictRomanMarker(title)) return [{ ...line, text: title }]
    const center = line.left + line.width / 2
    const continuation = ordered.find((candidate) => candidate !== line && !consumed.has(candidate)
      && candidate.pageIndex === line.pageIndex && lineColumn(candidate) === lineColumn(line) && candidate.top > line.top
      && candidate.top - line.top <= Math.max(28, line.fontSize * 2.8)
      && Math.abs(candidate.fontSize - line.fontSize) <= Math.max(2.5, line.fontSize * .25)
      && Math.abs(candidate.left + candidate.width / 2 - center) <= Math.max(45, line.width * .22)
      && !explicitRule(normalizeAcademicHeading(candidate.text), new Set(['decimal']))
      && academicUppercaseLine(normalizeAcademicHeading(candidate.text)))
    if (!continuation) return [{ ...line, text: title }]
    consumed.add(continuation)
    return [{ ...line, text: `${title} ${normalizeAcademicHeading(continuation.text)}`, width: Math.max(line.width, continuation.width) }]
  })
}

export function recognizeBookmarkCandidates(lines: BookmarkTextLine[], options: BookmarkRecognitionOptions): RecognizedBookmark[] {
  const maxDepth = Math.max(1, Math.min(6, Math.round(options.maxDepth)))
  const rules = new Set(options.rules)
  const ordinarySizes = lines.map((line) => line.fontSize).filter((size) => Number.isFinite(size) && size > 3 && size < 80).sort((a, b) => a - b)
  const median = ordinarySizes[Math.floor(Math.max(0, ordinarySizes.length - 1) / 2)] || 10
  const prominent = lines.filter((line) => line.fontSize >= median * 1.32 && headingLike(line.text)).map((line) => line.fontSize)
  const result: RecognizedBookmark[] = []
  const duplicates = new Set<string>()
  for (const line of orderedRecognitionLines(lines)) {
    const title = line.text
    if (!title || line.top < line.pageHeight * .025 || line.top > line.pageHeight * .965 || line.width > line.pageWidth * .96) continue
    let match = explicitRule(title, rules)
    const custom = customRule(title, options.customKeywords)
    if (!match && custom) match = { level: 1, rule: 'headings' }
    if (!match && rules.has('typography') && line.fontSize >= median * 1.32 && headingLike(title)) match = { level: typographyLevel(line.fontSize, prominent, maxDepth), rule: 'typography' }
    if (!match || match.level > maxDepth) continue
    const recognizedTitle = match.title || title
    const duplicate = `${line.pageIndex}:${recognizedTitle.toLocaleLowerCase()}`
    if (duplicates.has(duplicate)) continue
    duplicates.add(duplicate)
    const level = result.length ? Math.min(match.level, result.at(-1)!.level + 1) : 1
    result.push({ id: `recognized-${line.pageIndex}-${Math.round(line.top * 10)}-${result.length}`, title: recognizedTitle, pageIndex: line.pageIndex, level, top: line.top, fontSize: line.fontSize, rule: custom ? 'custom' : match.rule })
    if (result.length >= 2000) break
  }
  return result
}

export function bookmarkTreeFromCandidates(candidates: RecognizedBookmark[]): PdfBookmark[] {
  const roots: PdfBookmark[] = []
  const stack: Array<{ level: number; bookmark: PdfBookmark }> = []
  candidates.forEach((candidate) => {
    const bookmark: PdfBookmark = { id: candidate.id, title: candidate.title, pageIndex: candidate.pageIndex, open: candidate.level < 3, children: [] }
    while (stack.length && stack.at(-1)!.level >= candidate.level) stack.pop()
    if (stack.length) stack.at(-1)!.bookmark.children.push(bookmark)
    else roots.push(bookmark)
    stack.push({ level: candidate.level, bookmark })
  })
  return roots
}

/** Remove one preview item and promote its contiguous descendants by one
 * level, leaving later sibling branches unchanged. */
export function removeRecognizedCandidate(candidates: RecognizedBookmark[], id: string): RecognizedBookmark[] {
  const index = candidates.findIndex((candidate) => candidate.id === id)
  if (index < 0) return candidates
  const removedLevel = candidates[index].level
  let insideRemovedBranch = true
  return candidates.flatMap((candidate, candidateIndex) => {
    if (candidateIndex === index) return []
    if (candidateIndex < index) return [candidate]
    if (candidate.level <= removedLevel) insideRemovedBranch = false
    return [{ ...candidate, level: insideRemovedBranch ? Math.max(1, candidate.level - 1) : candidate.level }]
  })
}

export function countBookmarks(bookmarks: PdfBookmark[]): number {
  return bookmarks.reduce((sum, item) => sum + 1 + countBookmarks(item.children), 0)
}
