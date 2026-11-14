import type { PdfRect } from '../types'
import type { PageVisual } from './page-visuals'

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
  kind?: 'abbreviation'
  citation: string
  reference: string
}

export interface GrammarIssue extends InsightHit {
  message?: string
  ruleId?: string
  term: string
  replacement?: string
}

export interface PageTextSnapshot {
  pageIndex: number
  text: string
  visualRects?: PdfRect[]
  visuals?: PageVisual[]
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

const TEMP_PATH_HINT = /wechat|tmp|temp|qq|msg|chat|tencent|slack|feishu|dingding|linshi|deprecate|archi|wx|钉钉|微信|腾讯/i

export function isTemporaryDocumentPath(filePath?: string): boolean {
  if (!filePath) return false
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').slice(0, -1).some((segment) => TEMP_PATH_HINT.test(segment))
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
  return pages.flatMap(page => (page.visuals || []).map(visual => ({
    pageIndex: page.pageIndex, label: visual.label, context: visual.caption || visual.label,
    rects: [{...visual.rect}]
  })))
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

export function abbreviationLinks(pages: PageTextSnapshot[]): CitationLink[] {
  const definitions: Array<{short:string;full:string;page:number;offset:number}> = []
  const shortForm = (value:string) => [...value].filter(c=>/\p{L}/u.test(c)).length >= 2 && value.length <= 24
    && /^[\p{L}\p{N}.+&/-]+$/u.test(value) && (/\p{Lu}/u.test(value) || /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value))
  for(const page of pages) {
    const text=page.text.replace(/\s+/gu,' ')
    for(const match of text.matchAll(/[（(]([^()（）]{2,180})[)）]/gu)) {
      const inside=match[1].trim(),prefix=text.slice(Math.max(0,match.index!-250),match.index).trim()
      const previous=prefix.match(/([\p{L}\p{N}.+&/-]+)$/u)?.[1]
      if(previous && shortForm(previous) && inside.length>previous.length && /[\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Hangul}]/u.test(inside)) {
        definitions.push({short:previous,full:inside,page:page.pageIndex,offset:match.index!});continue
      }
      for(const short of inside.split(/[,，;；]/u).map(v=>v.trim())) {
        if(!shortForm(short))continue
        const letters=[...short].filter(c=>/\p{L}/u.test(c))
        const candidate=prefix.split(/\s+/u).slice(-(letters.length+5)).join(' ')
        let cursor=candidate.length-1,first=-1
        for(let i=letters.length-1;i>=0;i--) {
          while(cursor>=0 && (candidate[cursor].toLocaleLowerCase()!==letters[i].toLocaleLowerCase() || i===0 && cursor>0 && /\p{L}/u.test(candidate[cursor-1])))cursor--
          if(cursor<0){first=-1;break}first=cursor--
        }
        let full=first>=0?candidate.slice(first).trim():''
        if(!full) {
          const phrase=prefix.split(/[。；;：:，,!?！？]/u).at(-1)!.trim()
          if(phrase.length<=120 && phrase.split(/\s+/u).length<=12)full=phrase
        }
        if(full.length>short.length)definitions.push({short,full,page:page.pageIndex,offset:match.index!})
      }
    }
  }
  const hits:CitationLink[]=[]
  for(const short of new Set(definitions.map(d=>d.short)))for(const page of pages) {
    const escaped=short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    const regex=new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,'gu')
    const candidates=definitions.filter(d=>d.short===short)
    for(const match of page.text.matchAll(regex)) {
      const preceding=candidates.filter(d=>d.page<page.pageIndex || d.page===page.pageIndex&&d.offset<=match.index!+short.length+3)
      const definition=preceding.at(-1)||candidates[0]
      const occurrence=page.text.slice(0,match.index).toLocaleLowerCase().split(short.toLocaleLowerCase()).length-1
      hits.push({kind:'abbreviation',pageIndex:page.pageIndex,label:short,context:definition.full,citation:short,reference:definition.full,anchor:short,anchorOccurrence:occurrence})
    }
  }
  return hits
}
