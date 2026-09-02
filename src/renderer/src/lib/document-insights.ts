import type { PdfRect } from '../types'

export interface InsightHit {
  pageIndex: number
  label: string
  context: string
  detail?: string
  /** Text used by the viewer to locate the result precisely on the page. */
  anchor?: string
  anchorOccurrence?: number
  rects?: PdfRect[]
}

export interface CitationLink extends InsightHit {
  citation: string
  reference: string
}

export interface GrammarIssue extends InsightHit {
  term: string
  replacement?: string
}

export interface PageTextSnapshot {
  pageIndex: number
  text: string
  visualRects?: PdfRect[]
}

function normalizeInsightText(text: string): string {
  return text
    .replace(/\u00ad/g, '')
    .replace(/\s*[-\u2010\u2011]\s+(?=[A-Za-z])/g, '')
    .replace(/R\s*E\s*F\s*E\s*R\s*E\s*N\s*C\s*E\s*S/gi, 'REFERENCES')
    .replace(/B\s*I\s*B\s*L\s*I\s*O\s*G\s*R\s*A\s*P\s*H\s*Y/gi, 'BIBLIOGRAPHY')
    .replace(/\s+/g, ' ')
    .trim()
}

const TEMP_SEGMENT = /^(?:temp|tmp|wx|wechat|tencent|qq|feishu|dingding|钉钉|微信|腾讯)(?:[-_.].*)?$/i

export function isTemporaryDocumentPath(filePath?: string): boolean {
  if (!filePath) return false
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').some((segment) => TEMP_SEGMENT.test(segment))
}

export function fileDirectory(filePath?: string): string {
  if (!filePath) return ''
  const normalized = filePath.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(0, slash) : ''
}

export function stablePathColor(filePath?: string): string {
  const palette = ['#5575de', '#2c9b84', '#d4772f', '#8b5fc5', '#b64c67', '#288da6', '#6f7d3d']
  let hash = 0
  for (const character of filePath || '') hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

export function visualHits(pages: Array<PageTextSnapshot & { imageCount?: number }>): InsightHit[] {
  return pages.flatMap((page) => {
    const hits: InsightHit[] = []
    const text = page.text.replace(/\s+/g, ' ').trim()
    const figureMatches = [...text.matchAll(/\b(?:figure|fig\.?|image|plate)\s*\d+[a-z]?\b[^.!?。！？]{0,180}/gi), ...text.matchAll(/图\s*\d+[A-Za-z]?[^.!?。！？]{0,180}/gi)]
    const tableMatches = [...text.matchAll(/\b(?:table|tab\.?)\s*\d+[a-z]?\b[^.!?。！？]{0,180}/gi), ...text.matchAll(/表\s*\d+[A-Za-z]?[^.!?。！？]{0,180}/gi)]
    const seenCaptions = new Set<string>()
    for (const match of figureMatches) {
      const caption = match[0].trim()
      const key = caption.toLocaleLowerCase()
      if (seenCaptions.has(`figure:${key}`)) continue
      seenCaptions.add(`figure:${key}`)
      const marker = caption.match(/^(?:figure|fig\.?|image|plate|图)\s*\d+[a-z]?/i)?.[0] || 'ui.image'
      hits.push({ pageIndex: page.pageIndex, label: marker, context: caption, anchor: caption, rects: page.visualRects })
    }
    if ((page.imageCount || 0) > 0 && !figureMatches.length) {
      hits.push({ pageIndex: page.pageIndex, label: `图片 ${page.imageCount} 个`, context: '检测到页面图像对象', rects: page.visualRects })
    }
    for (const match of tableMatches) {
      const caption = match[0].trim()
      const key = caption.toLocaleLowerCase()
      if (seenCaptions.has(`table:${key}`)) continue
      seenCaptions.add(`table:${key}`)
      const marker = caption.match(/^(?:table|tab\.?|表)\s*\d+[a-z]?/i)?.[0] || 'ui.table'
      hits.push({ pageIndex: page.pageIndex, label: marker, context: caption, anchor: caption })
    }
    const tableSignal = text.match(/\|[^|]{1,}\|/) || text.match(/(?:^|\s)((?:n|mean|std\.?|median)\s*[:=]\s*[^.!?。！？]{0,80})/i)
    if (!tableMatches.length && tableSignal) {
      const anchor = (tableSignal[1] || tableSignal[0]).trim()
      hits.push({ pageIndex: page.pageIndex, label: "ui.possibleTable", context: `检测到表格列式文本或统计字段：${anchor}`, anchor })
    }
    return hits
  })
}

const CITATION_PATTERNS = [
  /\[\s*(\d{1,3}(?:\s*[-\u2013\u2014,]\s*\d{1,3})*)\s*\](?:\s*[-\u2013\u2014]\s*\[\s*(\d{1,3})\s*\])?/g,
  /\(([A-Z][A-Za-z'’-]{1,32}(?:\s+et\s+al\.)?(?:,\s*|\s+)(?:19|20)\d{2}[a-z]?)\)/g,
  /\b([A-Z][A-Za-z'’-]{1,32}\s+\((?:19|20)\d{2}[a-z]?\))\b/g
]

interface ReferenceEntry { number?: number; text: string }

function referenceHeadingIndex(text: string): number {
  const normalized = normalizeInsightText(text)
  const match = normalized.match(/(?:^|\s)(?:references|bibliography)(?=\s*(?:\[\d{1,3}\]|\d{1,3}[.)]|$))/i)
  if (match?.index !== undefined) return match.index + match[0].search(/(?:references|bibliography)/i)
  const chinese = normalized.search(/参考文献/i)
  return chinese
}

function referenceEntries(text: string): ReferenceEntry[] {
  // IEEE-like papers often have every reference on one PDF text line after
  // extraction. Split by the numbered marker instead of relying on newlines.
  const normalized = normalizeInsightText(text)
  const heading = referenceHeadingIndex(normalized)
  if (heading < 0) return []
  const body = normalized.slice(heading).replace(/^\s*(?:references|bibliography|参考文献)\s*/i, '')
  const numbered: ReferenceEntry[] = []
  const marker = /(?:^|\s)\[(\d{1,3})\]\s*/g
  let match: RegExpExecArray | null
  let previousEnd = 0
  let previousNumber: number | undefined
  while ((match = marker.exec(body))) {
    if (previousNumber !== undefined) {
      const value = body.slice(previousEnd, match.index).replace(/\s+/g, ' ').trim()
      if (value) numbered.push({ number: previousNumber, text: `[${previousNumber}] ${value}` })
    }
    previousNumber = Number(match[1]); previousEnd = marker.lastIndex
  }
  if (previousNumber !== undefined) {
    const value = body.slice(previousEnd).replace(/\s+/g, ' ').trim()
    if (value) numbered.push({ number: previousNumber, text: `[${previousNumber}] ${value}` })
  }
  if (numbered.length) return numbered
  return body.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => ({ text: line }))
}

export function citationLinks(pages: PageTextSnapshot[]): CitationLink[] {
  const normalizedPages = pages.map((page) => ({ ...page, text: normalizeInsightText(page.text) }))
  const referenceStart = normalizedPages.findIndex((page) => referenceHeadingIndex(page.text) >= 0)
  if (referenceStart < 0) return []
  const references = normalizedPages[referenceStart]
  // Reference lists routinely continue across several pages.  Parsing only
  // the page that contains the heading silently truncated Scheduling0826m at
  // [4], because [5]–[38] live on the following page.  Preserve the heading
  // page as the parser anchor, then append every remaining page so numbered
  // entries can span both page and column boundaries.
  const entries = referenceEntries(normalizedPages.slice(referenceStart).map((page) => page.text).join(' '))
  if (!entries.length) return []
  const links: CitationLink[] = []
  normalizedPages.filter((page) => page.pageIndex < references.pageIndex).forEach((page) => {
    const occurrences = new Map<string, number>()
    for (const pattern of CITATION_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(page.text))) {
        const citation = match[2] ? `${match[1]}-${match[2]}` : match[1]
        const values: string[] = []
        if (/^\d/.test(citation)) {
          citation.split(',').forEach((part) => {
            const range = part.trim().split(/\s*[-\u2013\u2014]\s*/).map(Number)
            if (range.length === 2 && range.every((value) => Number.isInteger(value)) && range[1] >= range[0] && range[1] - range[0] <= 100) {
              for (let value = range[0]; value <= range[1]; value += 1) values.push(String(value))
            } else if (part.trim()) values.push(part.trim())
          })
        } else values.push(citation)
        const anchor = match[0]
        const anchorKey = anchor.toLocaleLowerCase()
        const anchorOccurrence = occurrences.get(anchorKey) || 0
        occurrences.set(anchorKey, anchorOccurrence + 1)
        values.forEach((value) => {
          const number = /^\d+$/.test(value) ? Number(value) : undefined
          const entry = number !== undefined
            ? entries.find((candidate) => candidate.number === number)
            : entries.find((candidate) => candidate.text.toLowerCase().includes(value.split(/\s+/)[0].toLowerCase()))
          if (entry) links.push({ pageIndex: page.pageIndex, label: value, citation: value, reference: entry.text, anchor, anchorOccurrence, context: page.text.slice(Math.max(0, match!.index - 42), Math.min(page.text.length, match!.index + match![0].length + 70)) })
        })
      }
    }
  })
  return links
}

const ENGLISH_TYPO_REPLACEMENTS: Record<string, string> = {
  teh: 'the', recieve: 'receive', occured: 'occurred', seperate: 'separate', definately: 'definitely', enviroment: 'environment', adress: 'address', acheive: 'achieve'
}

export function grammarIssues(pages: PageTextSnapshot[]): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  pages.forEach((page) => {
    const text = normalizeInsightText(page.text)
    if (/^(?:references|bibliography|参考文献)\b/i.test(text)) return
    const englishLetters = (text.match(/[A-Za-z]/g) || []).length
    const cjkLetters = (text.match(/[\u3400-\u9fff]/g) || []).length
    // Do not run English grammar heuristics on invoices, identifiers, or
    // bilingual forms. Their extracted text often contains isolated Latin
    // glyphs and serial numbers that look like words to a regex.
    const digits = (text.match(/\d/g) || []).length
    const symbols = (text.match(/[+*/=<>|]/g) || []).length
    if ((cjkLetters > 0 && cjkLetters >= englishLetters * 0.5) || digits > englishLetters * 0.35 || symbols > 3 || (text.length > 80 && englishLetters / Math.max(1, text.length) < 0.18)) return
    const words = text.match(/[A-Za-z]{3,}/g) || []
    const occurrences = new Map<string, number>()
    const lowerText = text.toLocaleLowerCase()
    const searchOffsets = new Map<string, number>()
    words.forEach((word) => {
      const replacement = ENGLISH_TYPO_REPLACEMENTS[word.toLowerCase()]
      if (replacement) {
        const key = word.toLocaleLowerCase(), anchorOccurrence = occurrences.get(key) || 0
        occurrences.set(key, anchorOccurrence + 1)
        const offset = lowerText.indexOf(key, searchOffsets.get(key) || 0)
        searchOffsets.set(key, offset < 0 ? (searchOffsets.get(key) || 0) : offset + key.length)
        issues.push({ pageIndex: page.pageIndex, label: `拼写：${word}`, term: word, replacement, anchor: word, anchorOccurrence, context: text.slice(Math.max(0, offset - 45), offset + word.length + 65) })
      }
    })
    const duplicateOccurrences = new Map<string, number>()
    const duplicatePattern = /\b([A-Za-z]{2,})\s+\1\b/gi
    let duplicateMatch: RegExpExecArray | null
    while ((duplicateMatch = duplicatePattern.exec(text))) {
      const anchor = duplicateMatch[0]
      const key = anchor.toLocaleLowerCase(), anchorOccurrence = duplicateOccurrences.get(key) || 0
      duplicateOccurrences.set(key, anchorOccurrence + 1)
      issues.push({ pageIndex: page.pageIndex, label: "ui.repeatedWord", term: duplicateMatch[1], replacement: duplicateMatch[1], anchor, anchorOccurrence, context: text.slice(Math.max(0, duplicateMatch.index - 45), duplicateMatch.index + anchor.length + 65) })
    }
    const agreementRules = [
      { pattern: /\b(he|she|it|this|that)\s+(are|were)\b/gi, replacement: (verb: string) => verb === 'are' ? 'is' : 'was' },
      { pattern: /\b(these|those|they|we|you)\s+(is|was)\b/gi, replacement: (verb: string) => verb === 'is' ? 'are' : 'were' }
    ]
    agreementRules.forEach(({ pattern, replacement }) => {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text))) {
        const sentence = text.slice(Math.max(0, text.lastIndexOf('.', match.index) + 1), text.indexOf('.', match.index) < 0 ? text.length : text.indexOf('.', match.index))
        if ((sentence.match(/[A-Za-z]/g) || []).length < 8) continue
        const anchor = match[0]
        const verb = match[2]
        issues.push({ pageIndex: page.pageIndex, label: "ui.subjectVerbAgreement", term: verb, replacement: replacement(verb.toLocaleLowerCase()), anchor, anchorOccurrence: 0, context: text.slice(Math.max(0, match.index - 45), match.index + anchor.length + 65) })
      }
    })
  })
  return issues
}
