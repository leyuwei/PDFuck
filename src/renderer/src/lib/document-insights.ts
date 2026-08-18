export interface InsightHit {
  pageIndex: number
  label: string
  context: string
  detail?: string
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
    if ((page.imageCount || 0) > 0) hits.push({ pageIndex: page.pageIndex, label: `图片 ${page.imageCount} 个`, context: '检测到页面图像对象' })
    const lines = page.text.split(/\n+/).filter(Boolean)
    const tabularLines = lines.filter((line) => (line.match(/\s{2,}|\t|\|/g) || []).length >= 2)
    if (tabularLines.length >= 2 || /\btable\b|表\s*\d+/i.test(page.text)) hits.push({ pageIndex: page.pageIndex, label: '疑似表格', context: tabularLines.slice(0, 2).join(' · ') || '检测到表格标题或列式文本' })
    return hits
  })
}

const CITATION_PATTERNS = [
  /\[(\d{1,3}(?:\s*[-,]\s*\d{1,3})*)\]/g,
  /\(([A-Z][A-Za-z'’-]{1,32}(?:\s+et\s+al\.)?(?:,\s*|\s+)(?:19|20)\d{2}[a-z]?)\)/g,
  /\b([A-Z][A-Za-z'’-]{1,32}\s+\((?:19|20)\d{2}[a-z]?\))\b/g
]

export function citationLinks(pages: PageTextSnapshot[]): CitationLink[] {
  const references = pages.find((page) => /\b(?:references|bibliography)\b|参考文献/i.test(page.text))
  if (!references) return []
  const referenceLines = references.text.split(/\n+/).filter((line) => line.trim() && !/^\s*(?:references|bibliography|参考文献)\s*$/i.test(line))
  const links: CitationLink[] = []
  pages.filter((page) => page.pageIndex <= references.pageIndex).forEach((page) => {
    for (const pattern of CITATION_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(page.text))) {
        const citation = match[1]
        const number = /^\d+$/.test(citation) ? Number(citation) : undefined
        const reference = number && referenceLines[number - 1] ? referenceLines[number - 1] : referenceLines.find((line) => line.toLowerCase().includes(citation.split(/\s+/)[0].toLowerCase()))
        if (reference) links.push({ pageIndex: page.pageIndex, label: citation, citation, reference, context: page.text.slice(Math.max(0, match.index - 42), Math.min(page.text.length, match.index + match[0].length + 70)) })
      }
    }
  })
  return links.filter((link, index, all) => all.findIndex((candidate) => candidate.pageIndex === link.pageIndex && candidate.citation === link.citation && candidate.reference === link.reference) === index)
}

const ENGLISH_TYPO_REPLACEMENTS: Record<string, string> = {
  teh: 'the', recieve: 'receive', occured: 'occurred', seperate: 'separate', definately: 'definitely', enviroment: 'environment', adress: 'address', acheive: 'achieve'
}

export function grammarIssues(pages: PageTextSnapshot[]): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  pages.forEach((page) => {
    const words = page.text.match(/[A-Za-z]{3,}/g) || []
    words.forEach((word) => {
      const replacement = ENGLISH_TYPO_REPLACEMENTS[word.toLowerCase()]
      if (replacement) issues.push({ pageIndex: page.pageIndex, label: `拼写：${word}`, term: word, replacement, context: page.text.slice(Math.max(0, page.text.indexOf(word) - 45), page.text.indexOf(word) + word.length + 65) })
    })
    if (/\s{2,}/.test(page.text)) issues.push({ pageIndex: page.pageIndex, label: '多余空格', term: '  ', context: '检测到连续空格；不会标记跨行连字符或跨页断词' })
    if (/\b(?:is|are|was|were)\s+\w+ed\b/i.test(page.text)) issues.push({ pageIndex: page.pageIndex, label: '可能的语法问题', term: 'be + past tense', context: '请确认被动语态或时态是否符合语境' })
  })
  return issues
}
