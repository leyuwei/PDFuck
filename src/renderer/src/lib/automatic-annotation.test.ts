import { describe, expect, it } from 'vitest'
import type { PageTextSelection } from './page-text-selection'
import type { WordBox } from './text-layout'
import {
  AUTOMATIC_ANNOTATION_SCHEMA_VERSION,
  MAX_AUTOMATIC_ANNOTATION_BLOCKS_PER_PAGE,
  MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS,
  buildAutomaticAnnotationPage,
  buildAutomaticAnnotationPages,
  clipWordsToPageSelection,
  draftAutomaticAnnotations,
  parseAutomaticAnnotationResponse,
  type AutomaticAnnotationBlock,
  type AutomaticAnnotationFinding,
  type AutomaticAnnotationModelResponse
} from './automatic-annotation'

function word(text: string, x: number, y: number, metadata: Partial<WordBox> = {}): WordBox {
  const width = Array.from(text).length * 10
  return { text, order: 0, rect: { x, y, width, height: 10 }, boundaries: Array.from({ length: Array.from(text).length + 1 }, (_, index) => index * 10), ...metadata }
}

function block(words: WordBox[], id = 'p1-b1'): AutomaticAnnotationBlock {
  return { id, pageIndex: 0, text: words.map((item) => item.text).join(' '), words }
}

function finding(value: Partial<AutomaticAnnotationFinding> = {}): AutomaticAnnotationFinding {
  return {
    action: 'highlight', blockId: 'p1-b1', quote: 'target', occurrence: 0,
    insertSide: null, replacementText: null, reason: 'Needs attention.', ...value
  }
}

describe('automatic annotation page blocks', () => {
  it('keeps detected columns separate while gathering a non-contiguous spanning visual block', () => {
    const words = [
      word('Fig.', 10, 10, { order: 0, column: 0, visualBlock: 7 }),
      word('left', 10, 30, { order: 1, column: 0, lineBreakAfter: true }),
      word('body.', 10, 42, { order: 2, column: 0, lineBreakAfter: true }),
      word('caption', 80, 10, { order: 3, column: 1, visualBlock: 7 }),
      word('right', 180, 30, { order: 4, column: 1, lineBreakAfter: true }),
      word('body.', 180, 42, { order: 5, column: 1, lineBreakAfter: true })
    ]
    const page = buildAutomaticAnnotationPage(0, words)
    expect(page.blocks.map((item) => item.text)).toEqual(['Fig. caption', 'left body.', 'right body.'])
    expect(page.blocks[1].words.every((item) => item.column === 0)).toBe(true)
    expect(page.blocks[2].words.every((item) => item.column === 1)).toBe(true)
  })

  it('joins soft wraps naturally without inventing spaces in continuous scripts or deleting source hyphens', () => {
    const page = buildAutomaticAnnotationPage(0, [
      word('Natural', 10, 10, { column: 0, lineBreakAfter: true }),
      word('writing.', 10, 22, { column: 0, lineBreakAfter: true }),
      word('中文', 10, 34, { column: 0, lineBreakAfter: true }),
      word('文档。', 10, 46, { column: 0, lineBreakAfter: true }),
      word('multi-', 10, 58, { column: 0, lineBreakAfter: true }),
      word('column', 10, 70, { column: 0 })
    ])
    expect(page.blocks).toHaveLength(1)
    expect(page.blocks[0].text).toBe('Natural writing.中文文档。multi-column')
  })

  it('strictly crops a current selection at character boundaries and excludes every other page', () => {
    const selectedWord = word('alphabet', 0, 0, { column: 0 })
    const otherColumn = word('outside', 100, 0, { column: 1 })
    const selection: PageTextSelection = { pageIndex: 0, text: 'pha', rects: [{ x: 20, y: 0, width: 30, height: 10 }] }
    expect(clipWordsToPageSelection([selectedWord, otherColumn], selection)).toEqual([
      expect.objectContaining({ text: 'pha', rect: { x: 20, y: 0, width: 30, height: 10 }, boundaries: [0, 10, 20, 30] })
    ])
    const pages = buildAutomaticAnnotationPages([
      { pageIndex: 0, words: [selectedWord, otherColumn] },
      { pageIndex: 1, words: [word('another', 0, 0)] }
    ], selection)
    expect(pages).toHaveLength(1)
    expect(pages[0].blocks.map((item) => item.text)).toEqual(['pha'])
    expect(pages[0].blocks[0].selectionRects).toEqual(selection.rects)
  })

  it('crops every explicit segment of a cross-page selection independently', () => {
    const selection: PageTextSelection = {
      pageIndex: 0,
      text: 'left\nright',
      rects: [{ x: 0, y: 0, width: 40, height: 10 }, { x: 100, y: 0, width: 50, height: 10 }],
      segments: [
        { pageIndex: 0, text: 'left', rects: [{ x: 0, y: 0, width: 40, height: 10 }] },
        { pageIndex: 1, text: 'right', rects: [{ x: 100, y: 0, width: 50, height: 10 }] }
      ]
    }
    const pages = buildAutomaticAnnotationPages([
      { pageIndex: 0, words: [word('left', 0, 0), word('outside', 100, 0)] },
      { pageIndex: 1, words: [word('outside', 0, 0), word('right', 100, 0)] },
      { pageIndex: 2, words: [word('ignored', 0, 0)] }
    ], selection)
    expect(pages.map((page) => page.blocks.map((item) => item.text))).toEqual([['left'], ['right']])
    expect(pages[1].blocks[0].selectionRects).toEqual(selection.segments![1].rects)
  })

  it('bounds pathological pages without truncating a normal source token', () => {
    const words = Array.from({ length: MAX_AUTOMATIC_ANNOTATION_BLOCKS_PER_PAGE + 5 }, (_, index) =>
      word(`line${index}`, 0, index * 30, { column: 0, lineBreakAfter: true }))
    const page = buildAutomaticAnnotationPage(0, words)
    expect(page.blocks).toHaveLength(MAX_AUTOMATIC_ANNOTATION_BLOCKS_PER_PAGE)
    expect(page.truncated).toBe(true)
  })
})

describe('automatic annotation response schema', () => {
  const words = [
    word('highlight', 0, 0), word('replace', 100, 0), word('delete', 180, 0),
    word('underline', 250, 0), word('insert', 350, 0), word('note', 420, 0)
  ]
  const target = block(words)
  const candidate = {
    version: 1,
    contextSummary: 'The page defines its central claim.',
    findings: [
      { action: 'highlight', blockId: target.id, quote: 'highlight', occurrence: 0, insertSide: null, replacementText: null, reason: 'Key claim.' },
      { action: 'replace', blockId: target.id, quote: 'replace', occurrence: 0, insertSide: null, replacementText: 'revised', reason: 'Grammar.' },
      { action: 'delete', blockId: target.id, quote: 'delete', occurrence: 0, insertSide: null, replacementText: null, reason: 'Redundant.' },
      { action: 'underline', blockId: target.id, quote: 'underline', occurrence: 0, insertSide: null, replacementText: null, reason: 'Inconsistent.' },
      { action: 'insert', blockId: target.id, quote: 'insert', occurrence: 0, insertSide: 'after', replacementText: ' missing text', reason: 'Transition.' },
      { action: 'note', blockId: target.id, quote: 'note', occurrence: 0, insertSide: null, replacementText: null, reason: 'Check this logic.' }
    ]
  }

  it('accepts all six actions and an exact fenced JSON transport wrapper', () => {
    const parsed = parseAutomaticAnnotationResponse(`\`\`\`json\n${JSON.stringify(candidate)}\n\`\`\``, [target], 'brief')
    expect(parsed.version).toBe(AUTOMATIC_ANNOTATION_SCHEMA_VERSION)
    expect(parsed.findings.map((item) => item.action)).toEqual(['highlight', 'replace', 'delete', 'underline', 'insert', 'note'])
  })

  it('rejects schema drift, non-whitelisted blocks, and non-verbatim quotes', () => {
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, extra: true }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, version: 2 }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[0], blockId: 'p2-b9' }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[0], quote: 'almost highlight' }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[0], surprise: true }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
  })

  it('enforces action-specific fields and each explanation mode', () => {
    const revision = { ...candidate, findings: [{ ...candidate.findings[1], reason: '' }] }
    expect(parseAutomaticAnnotationResponse(JSON.stringify(revision), [target], 'revision').findings[0].reason).toBe('')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[1], reason: '' }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[1], reason: 'x'.repeat(241) }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[5], reason: '' }] }), [target], 'revision')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[0], replacementText: 'not allowed' }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [{ ...candidate.findings[4], insertSide: null }] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
  })

  it('limits rolling context and duplicate findings', () => {
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, contextSummary: 'x'.repeat(MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS + 1) }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
    expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ ...candidate, findings: [candidate.findings[0], candidate.findings[0]] }), [target], 'brief')).toThrow('ui.automaticAnnotationResponseInvalid')
  })
})

describe('automatic annotation draft resolution', () => {
  const words = [word('target', 0, 0), word('target', 80, 0)]
  const target = block(words)

  it('resolves the requested occurrence exactly and maps fields to an atomic annotation request', () => {
    const response: AutomaticAnnotationModelResponse = {
      version: 1, contextSummary: '', findings: [
        finding({ action: 'replace', occurrence: 1, replacementText: 'revision', reason: 'Fix the repeated term.' }),
        finding({ action: 'insert', occurrence: 0, insertSide: 'before', replacementText: 'new ', reason: 'Add a transition.' }),
        finding({ action: 'note', occurrence: 0, reason: 'Check the surrounding logic.' })
      ]
    }
    const result = draftAutomaticAnnotations(response, [target])
    expect(result.rejected).toEqual([])
    expect(result.drafts[0]).toEqual(expect.objectContaining({ pageIndex: 0, kind: 'replace', content: 'revision', reason: 'Fix the repeated term.', rects: [{ x: 80, y: 0, width: 60, height: 10 }] }))
    expect(result.drafts[1]).toEqual(expect.objectContaining({ kind: 'insert', content: 'new ', point: { x: 0, y: 10 } }))
    expect(result.drafts[2]).toEqual(expect.objectContaining({ kind: 'note', content: 'Check the surrounding logic.', reason: undefined }))
  })

  it('performs a second selection-boundary check and never falls back to fuzzy text', () => {
    const selection: PageTextSelection = { pageIndex: 0, text: 'target', rects: [{ x: 0, y: 0, width: 60, height: 10 }] }
    const response: AutomaticAnnotationModelResponse = {
      version: 1, contextSummary: '', findings: [
        finding({ occurrence: 1 }),
        finding({ quote: 'targat' })
      ]
    }
    const result = draftAutomaticAnnotations(response, [target], selection)
    expect(result.drafts).toEqual([])
    expect(result.rejected.map((item) => item.issue)).toEqual(['outside-selection', 'quote-not-found'])
  })

  it('places a logical after-insertion on the left edge of right-to-left text', () => {
    const rtl = block([word('مرحبا', 100, 0)], 'p1-b2')
    const response: AutomaticAnnotationModelResponse = {
      version: 1, contextSummary: '', findings: [finding({ action: 'insert', blockId: rtl.id, quote: 'مرحبا', insertSide: 'after', replacementText: ' بكم' })]
    }
    expect(draftAutomaticAnnotations(response, [rtl]).drafts[0].point).toEqual({ x: 100, y: 10 })
  })
})
