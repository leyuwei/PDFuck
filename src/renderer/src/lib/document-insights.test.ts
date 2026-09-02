import { describe, expect, it } from 'vitest'
import { citationLinks, fileDirectory, grammarIssues, isTemporaryDocumentPath, stablePathColor, visualHits } from './document-insights'

describe('document insights', () => {
  it('detects temporary folders and keeps tab identity by path', () => {
    expect(isTemporaryDocumentPath('/Users/a/tmp/report.pdf')).toBe(true)
    expect(isTemporaryDocumentPath('/Users/a/Research/report.pdf')).toBe(false)
    expect(fileDirectory('/Users/a/report.pdf')).toBe('/Users/a')
    expect(stablePathColor('/a/report.pdf')).not.toBe(stablePathColor('/b/report.pdf'))
  })

  it('finds caption keywords, image objects, and common spelling issues', () => {
    const visuals = visualHits([{ pageIndex: 0, text: 'Figure 1: system overview. Table 1: Results.', imageCount: 2 }])
    expect(visuals.map((hit) => hit.label)).toEqual(['Figure 1', 'Table 1'])
    expect(visualHits([{ pageIndex: 1, text: 'Fig. 2: architecture. Tab. 3: ablation.' }]).map((hit) => hit.label)).toEqual(['Fig. 2', 'Tab. 3'])
    expect(grammarIssues([{ pageIndex: 1, text: 'teh results recieve data' }])[0]).toEqual(expect.objectContaining({ term: 'teh', replacement: 'the' }))
  })

  it('gives suspected tables a precise text anchor', () => {
    const [hit] = visualHits([{ pageIndex: 3, text: 'Results Mean: 15.2 median: 12.8' }])
    expect(hit).toEqual(expect.objectContaining({ pageIndex: 3, label: "ui.possibleTable", anchor: 'Mean: 15' }))
  })

  it('links numbered citations to the references section', () => {
    const links = citationLinks([{ pageIndex: 0, text: 'Prior work [1] is useful.' }, { pageIndex: 1, text: 'References\n[1] Example Author. 2020.' }])
    expect(links[0]).toEqual(expect.objectContaining({ pageIndex: 0, citation: '1', reference: '[1] Example Author. 2020.' }))
  })

  it('links citations when PDF extraction letter-spaces the references heading', () => {
    const links = citationLinks([
      { pageIndex: 0, text: 'Open RAN improves sharing [1], [2].' },
      { pageIndex: 14, text: 'R EFERENCES [1] M. Polese, Open RAN. 2024. [2] B. Agarwal, 6G networks. 2025.' }
    ])
    expect(links).toHaveLength(2)
    expect(links.map((link) => link.citation)).toEqual(['1', '2'])
    expect(links[0].reference).toContain('[1]')
  })

  it('keeps parsing a numbered reference list across following pages', () => {
    const links = citationLinks([
      { pageIndex: 0, text: 'Prior work [1], [4], and [6] supports the result.' },
      { pageIndex: 11, text: 'R EFERENCES [1] First reference. [2] Second reference.' },
      { pageIndex: 12, text: '[3] Third reference. [4] Fourth reference. [5] Fifth reference. [6] Sixth reference.' }
    ])
    expect(links.map((link) => link.citation)).toEqual(['1', '4', '6'])
    expect(links[1].reference).toBe('[4] Fourth reference.')
    expect(links[2].reference).toBe('[6] Sixth reference.')
  })

  it('only reports high-confidence grammar findings', () => {
    expect(grammarIssues([{ pageIndex: 1, text: 'The result is tested and the input was received.' }])).toEqual([])
    const issues = grammarIssues([{ pageIndex: 1, text: 'It are tested. They was repeated repeated.' }])
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "ui.subjectVerbAgreement", term: 'are', replacement: 'is', anchor: 'It are' }),
      expect.objectContaining({ label: "ui.subjectVerbAgreement", term: 'was', replacement: 'were', anchor: 'They was' }),
      expect.objectContaining({ label: "ui.repeatedWord", term: 'repeated', anchor: 'repeated repeated' })
    ]))
  })

  it('ignores invoice identifiers and mixed-language form fragments', () => {
    expect(grammarIssues([{ pageIndex: 0, text: '91330108MA2KCE2W7D 3*-8+0+/+0<15/64*69531+/654 2022 05 26' }])).toEqual([])
    expect(grammarIssues([{ pageIndex: 0, text: '中央非税收入统一票据 electronic code 91330108MA2KCE2W7D' }])).toEqual([])
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

  it('expands bracketed citation ranges and Unicode dash ranges', () => {
    const links = citationLinks([
      { pageIndex: 0, text: 'Earlier work [1-3] and later work [2]–[3].' },
      { pageIndex: 1, text: 'REFERENCES [1] First. 2020. [2] Second. 2021. [3] Third. 2022.' }
    ])
    expect(links.map((link) => link.citation)).toEqual(['1', '2', '3', '2', '3'])
  })

  it('keeps every citation occurrence on the same page', () => {
    const links = citationLinks([
      { pageIndex: 0, text: 'First [1], repeated [1], and repeated again [1].' },
      { pageIndex: 1, text: 'REFERENCES [1] Example Author. 2020.' }
    ])
    expect(links).toHaveLength(3)
    expect(links.map((link) => link.anchorOccurrence)).toEqual([0, 1, 2])
  })
})
