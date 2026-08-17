import { describe, expect, it } from 'vitest'
import type { AnnotationRecord } from '../types'
import { annotationSummary, annotationSummaryStatus } from './annotation-summary'

function annotation(id: string, status?: 'handled' | 'thinking' | 'declined' | 'custom'): AnnotationRecord {
  return { id, pageIndex: 0, kind: 'highlight', author: 'PDFuck', content: id, color: '#ffffff', rects: [], ...(status ? { reply: { status, content: status } } : {}) }
}

describe('annotation summary', () => {
  it('counts the four visible workflow states', () => {
    expect(annotationSummary([
      annotation('open'), annotation('done', 'handled'), annotation('later', 'thinking'), annotation('skip', 'declined'), annotation('custom', 'custom')
    ])).toEqual({ unreplied: 1, handled: 2, thinking: 1, declined: 1 })
  })

  it('treats a custom reply as handled rather than leaving it out of the summary', () => {
    expect(annotationSummaryStatus(annotation('custom', 'custom'))).toBe('handled')
  })
})
