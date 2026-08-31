import { describe, expect, it } from 'vitest'
import { bookmarkTreeFromCandidates, DEFAULT_BOOKMARK_RULES, recognizeBookmarkCandidates, type BookmarkTextLine } from './bookmark-recognition'

const line = (text: string, pageIndex: number, top: number, fontSize = 11): BookmarkTextLine => ({ text, pageIndex, top, fontSize, left: 50, width: 240, pageWidth: 600, pageHeight: 800 })

describe('bookmark recognition', () => {
  it('recognizes multilingual numbering, chapter labels and common headings', () => {
    const found = recognizeBookmarkCandidates([
      line('摘要', 0, 80, 18), line('1. Introduction', 1, 90, 17), line('1.1 Related work', 2, 100, 15),
      line('二、研究方法', 3, 110, 16), line('第叁章 实验', 4, 120, 17), line('Глава 4 Результаты', 5, 130, 17),
      line('Capítulo V Conclusión', 6, 140, 17), line('参考文献', 7, 150, 17)
    ], { rules: ['decimal', 'localized', 'chapters', 'headings'], maxDepth: 3, customKeywords: '' })
    expect(found.map((item) => item.title)).toEqual(['摘要', '1. Introduction', '1.1 Related work', '二、研究方法', '第叁章 实验', 'Глава 4 Результаты', 'Capítulo V Conclusión', '参考文献'])
    expect(found.find((item) => item.title.startsWith('1.1'))?.level).toBe(2)
  })

  it('honors maximum depth and custom headings', () => {
    const found = recognizeBookmarkCandidates([
      line('1 First', 0, 60), line('1.1 Second', 0, 90), line('1.1.1 Third', 0, 120), line('Data Availability', 1, 80)
    ], { rules: ['decimal'], maxDepth: 2, customKeywords: 'Data Availability' })
    expect(found.map((item) => item.title)).toEqual(['1 First', '1.1 Second', 'Data Availability'])
  })

  it('uses typography conservatively and ignores body sentences and page edges', () => {
    const found = recognizeBookmarkCandidates([
      line('Running header', 0, 5, 18), line('A concise unnumbered heading', 0, 100, 18), line('This is a complete body sentence.', 0, 150, 18),
      line('ordinary body text', 0, 180, 10), line('more ordinary body text', 0, 195, 10), line('a third body line', 0, 210, 10), line('a fourth body line', 0, 225, 10), line('12, 34, 56', 0, 250, 20)
    ], { rules: ['typography'], maxDepth: 3, customKeywords: '' })
    expect(found.map((item) => item.title)).toEqual(['A concise unnumbered heading'])
  })

  it('keeps typography opt-in and treats only uppercase Roman section markers as numbering', () => {
    expect(DEFAULT_BOOKMARK_RULES).not.toContain('typography')
    const found = recognizeBookmarkCandidates([
      line('i.e., pji in (12) is identical across all i. When one device,', 0, 70),
      line('1) The workflow begins with registration, where users and devices enroll.', 0, 85),
      line('iv. this lowercase prose is not a section title', 0, 90),
      line('IV. P ERFORMANCE A NALYSIS OF R ANDOM ACCESS WITH ROGUE N ODES', 0, 120, 12),
      line('A. Analysis under Static Game Scenario', 0, 150, 11),
      line('C. Long-run Performance Analysis', 0, 180, 11)
    ], { rules: ['decimal'], maxDepth: 3, customKeywords: '' })
    expect(found.map(({ title, level }) => [title, level])).toEqual([
      ['IV. PERFORMANCE ANALYSIS OF RANDOM ACCESS WITH ROGUE NODES', 1],
      ['A. Analysis under Static Game Scenario', 2],
      ['C. Long-run Performance Analysis', 2]
    ])
  })

  it('recognizes the academic outline used by m91474 without copying abstract prose', () => {
    const found = recognizeBookmarkCandidates([
      line('Abstract—The sixth-generation (6G) wireless network will bring major advances in ubiquitous connectivity.', 0, 80, 9),
      line('I. I NTRODUCTION', 0, 220, 12),
      line('II. B LOCKCHAIN -E NHANCED R ANDOM ACCESS', 1, 85, 12),
      line('III. ROGUE ’ S D ILEMMA', 1, 280, 12),
      line('IV. P ERFORMANCE A NALYSIS OF R ANDOM ACCESS WITH ROGUE N ODES', 2, 390, 12),
      line('i.e., pji in (12) is identical across all i. When one device,', 4, 230, 9),
      line('V. N UMERICAL R ESULTS', 4, 500, 12),
      line('VI. C ONCLUSION', 6, 530, 12),
      line('R EFERENCES', 6, 690, 12)
    ], { rules: DEFAULT_BOOKMARK_RULES, maxDepth: 3, customKeywords: '' })
    expect(found.filter((item) => item.level === 1).map((item) => item.title)).toEqual([
      'Abstract', 'I. INTRODUCTION', 'II. BLOCKCHAIN-ENHANCED RANDOM ACCESS', "III. ROGUE’S DILEMMA",
      'IV. PERFORMANCE ANALYSIS OF RANDOM ACCESS WITH ROGUE NODES', 'V. NUMERICAL RESULTS', 'VI. CONCLUSION', 'REFERENCES'
    ])
  })

  it('recognizes all nine Roman sections and unnumbered academic headings used by Scheduling0826m', () => {
    const found = recognizeBookmarkCandidates([
      line('Abstract—Blockchain-based proportional fair scheduling (BC-PFS) improves collaboration.', 0, 80, 9),
      ...[
        'I. I NTRODUCTION', 'II. O-RAN M ODEL', 'III. B LOCKCHAIN - BASED P ROPORTIONAL FAIR S CHEDULING',
        'IV. D ELAYED S CHEDULING M ODEL', 'V. CONSENSUS FAILURE', 'VI. S CHEDULING D ELAY VERSUS C ONSENSUS FAILURE',
        'VII. P OOLING E FFECT WITH DELAY', 'VIII. S IMULATION', 'IX. C ONCLUSION'
      ].map((text, index) => line(text, index + 1, 120, 12)),
      line('R EFERENCES', 12, 650, 12),
      line('iv. the performance gap remains bounded.', 8, 300, 9)
    ], { rules: DEFAULT_BOOKMARK_RULES, maxDepth: 3, customKeywords: '' })
    expect(found.filter((item) => item.level === 1)).toHaveLength(11)
    expect(found.map((item) => item.title)).toContain('III. BLOCKCHAIN-BASED PROPORTIONAL FAIR SCHEDULING')
    expect(found.map((item) => item.title)).toContain('IX. CONCLUSION')
    expect(found.at(-1)?.title).toBe('REFERENCES')
  })

  it('builds a nested outline from normalized candidate levels', () => {
    const candidates = recognizeBookmarkCandidates([
      line('1 Root', 0, 80), line('1.1 Child', 0, 100), line('1.1.1 Grandchild', 0, 120), line('2 Root', 1, 80)
    ], { rules: ['decimal'], maxDepth: 3, customKeywords: '' })
    const tree = bookmarkTreeFromCandidates(candidates)
    expect(tree).toHaveLength(2)
    expect(tree[0].children[0].children[0].title).toBe('1.1.1 Grandchild')
  })
})
