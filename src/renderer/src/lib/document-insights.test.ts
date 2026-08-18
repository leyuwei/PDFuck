import { describe, expect, it } from 'vitest'
import { citationLinks, fileDirectory, grammarIssues, isTemporaryDocumentPath, stablePathColor, visualHits } from './document-insights'

describe('document insights', () => {
  it('detects temporary folders and keeps tab identity by path', () => {
    expect(isTemporaryDocumentPath('/Users/a/tmp/report.pdf')).toBe(true)
    expect(isTemporaryDocumentPath('/Users/a/Research/report.pdf')).toBe(false)
    expect(fileDirectory('/Users/a/report.pdf')).toBe('/Users/a')
    expect(stablePathColor('/a/report.pdf')).not.toBe(stablePathColor('/b/report.pdf'))
  })

  it('finds image/table pages and common spelling issues', () => {
    expect(visualHits([{ pageIndex: 0, text: 'Table 1\nA  B\n1  2', imageCount: 2 }])).toHaveLength(2)
    expect(grammarIssues([{ pageIndex: 1, text: 'teh results recieve data' }])[0]).toEqual(expect.objectContaining({ term: 'teh', replacement: 'the' }))
  })

  it('links numbered citations to the references section', () => {
    const links = citationLinks([{ pageIndex: 0, text: 'Prior work [1] is useful.' }, { pageIndex: 1, text: 'References\n[1] Example Author. 2020.' }])
    expect(links[0]).toEqual(expect.objectContaining({ pageIndex: 0, citation: '1', reference: '[1] Example Author. 2020.' }))
  })

  it('parses inline IEEE references when PDF text extraction has no line breaks', () => {
    const links = citationLinks([
      { pageIndex: 0, text: 'The method follows prior work [15], [16].' },
      { pageIndex: 14, text: 'REFERENCES [15] P. K. Taksande, P. Chaporkar, and A. Karandikar, Proportional fairness. 2020. [16] X. Tan, C. Yin, and L. Ma, Scheduling. 2021.' }
    ])
    expect(links).toHaveLength(2)
    expect(links[0].reference).toContain('[15]')
    expect(links[1].reference).toContain('[16]')
    expect(links[0].anchor).toBe('[15]')
  })
})
