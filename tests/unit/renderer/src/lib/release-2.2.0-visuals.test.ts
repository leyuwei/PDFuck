import { describe, expect, it } from 'vitest'
import { captionLabel } from '../../../../../src/renderer/src/lib/caption-label'
import { detectPageVisuals, isolateVisualWords, pageGraphics, type PageGraphic } from '../../../../../src/renderer/src/lib/page-visuals'
import { textCaretAtPoint, textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'

const size = { width: 600, height: 800 }
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
const word = (text: string, x: number, y: number, width: number, extra: Partial<WordBox> = {}): WordBox =>
  ({ text, rect: rect(x, y, width, 10), baselineY: y + 8, order: y * 1000 + x, column: 0, ...extra })
const graphic = (x: number, y: number, width: number, height: number, extra: Partial<PageGraphic> = {}): PageGraphic =>
  ({ rect: rect(x, y, width, height), image: false, parts: 8, ...extra })
const end = (w: WordBox[], wordIndex: number) => ({ wordIndex, offset: Array.from(w[wordIndex].text).length })

describe('2.2.0 visual evidence and separate selection', () => {
  it.each([true, false])('removes a prose backdrop before it can absorb a real framed figure (fill-only %s)', fillOnly => {
    const words = [word('Figure 1. Local results', 43, 177, 150), word('Axis', 77, 95, 22), word('Right column prose', 450, 96, 104, { column: 1 })]
    for (let i = 0; i < 35; i++) words.push(word('Ordinary body paragraph with a stable visual row.', 41, 218 + 13 * i, 193))
    const graphics = [graphic(39, 27, 399, 715, fillOnly ? { fillOnly: true } : {}), graphic(39, 27, 382, 148)]
    const visuals = detectPageVisuals(words, graphics, size)
    expect(visuals.map(v => v.label)).toEqual(['Figure 1'])
    expect(visuals[0].rect).toEqual(rect(39, 27, 382, 160))
    expect(isolateVisualWords(words, visuals).map(w => w.visualRegion)).toEqual([0, 0, undefined, ...Array(35).fill(undefined)])
  })

  it('does not report an isolated prose reference on a filled layout background', () => {
    const words = [word('Fig. 1c. A reference within this paragraph', 41, 60, 193)]
    for (let i = 0; i < 36; i++) words.push(word('本段为正文，下面继续说明相关流程。', 41, 90 + 15 * i, 193))
    expect(detectPageVisuals(words, [graphic(38, 30, 225, 700, { fillOnly: true })], size)).toEqual([])
  })

  it('retains a tall figure with separated diagram labels and a genuine caption', () => {
    const words = [word('Figure 7. Long process diagram', 41, 570, 240)]
    for (let i = 0; i < 8; i++) {
      words.push(word('Input source', 45, 59 + i * 53, 48), word('External diagram label', 260, 59 + i * 53, 95))
    }
    const visuals = detectPageVisuals(words, [graphic(38, 30, 360, 530, { fillOnly: true })], size)
    expect(visuals).toHaveLength(1)
    expect(visuals[0].rect).toEqual(rect(38, 30, 360, 550))
  })

  it('rejoins title fragments across a narrow gutter without pulling the neighboring body or gaps into the figure', () => {
    const words = [
      word('Axis', 79, 110, 32),
      word('Figure 5. Comparing the', 40, 172, 156, { visualBlock: 5 }),
      word('three measured series', 200, 172, 133, { column: 1, visualBlock: 5 }),
      word('and the baseline fit.', 40, 185, 122, { visualBlock: 5 }),
      word('sidebar stays in the main flow', 413, 172, 145, { column: 2, visualBlock: 5 }),
      word('Text beside the slim figure', 43, 115, 23, { visualBlock: 5 }),
      word('Other body prose stays below.', 40, 223, 193)
    ]
    const visuals = detectPageVisuals(words, [graphic(70, 81, 280, 85)], size)
    expect(visuals[0].caption).toBe('Figure 5. Comparing the three measured series and the baseline fit.')
    const tagged = isolateVisualWords(words, visuals)
    expect(tagged.map(w => w.visualRegion)).toEqual([0, 0, 0, 0, undefined, undefined, undefined])
    const a = { wordIndex: 1, offset: 0 }, b = end(tagged, 3)
    expect(textSelectionBetween(tagged, a, b)?.text).toBe(visuals[0].caption)
    expect(textSelectionBetween(tagged, b, a)?.text).toBe(visuals[0].caption)
  })

  it('keeps a body drag focused on body words as it crosses cells or figure labels', () => {
    const words = [word('Body above', 24, 40, 65), word('Axis', 100, 99, 26, { visualRegion: 0 }),
      word('Table cell', 110, 122, 55, { tableCell: 0, visualRegion: 1, tableCellRect: rect(100, 117, 80, 24) }),
      word('Body below', 24, 168, 68)]
    for (const anchor of [0, 3]) for (const y of [103, 127]) {
      const caret = textCaretAtPoint(words, { x: 120, y }, { wordIndex: anchor, offset: 0 })
      expect([0, 3]).toContain(caret?.wordIndex)
    }
    expect(textCaretAtPoint(words, { x: 115, y: 127 })?.wordIndex).toBe(2)
    const a = { wordIndex: 0, offset: 0 }, b = end(words, 3)
    expect(textSelectionBetween(words, a, b)?.text).toBe('Body above Body below')
    expect(textSelectionBetween(words, b, a)?.text).toBe('Body above Body below')
  })

  it('keeps a normal-sized paragraph below the table outside the note range', () => {
    const words = [word('Table 1. Measurements', 40, 43, 180), word('Ordinary body text starts here.', 40, 162, 223),
      word('and continues normally.', 40, 176, 175)]
    const visuals = detectPageVisuals(words, [graphic(40, 60, 260, 99)], size)
    expect(visuals[0].kind).toBe('table')
    expect(isolateVisualWords(words, visuals).map(w => w.visualRegion)).toEqual([0, undefined, undefined])
  })

  it('ignores transparent fills, strokes and images while honoring a transparent clipping path', () => {
    const ops = { save: 1, restore: 2, setGState: 3, constructPath: 4, fill: 5, stroke: 6, fillStroke: 7, clip: 8, endPath: 9, paintImageXObject: 10 }
    const result = pageGraphics({
      fnArray: [1, 3, 4, 4, 10, 8, 4, 3, 4, 2, 4],
      argsArray: [[], [['CA',0],['ca',0]], [5,[],[0,0,500,500]], [6,[],[0,0,500,500]], [], [], [9,[],[40,60,120,170]], [['CA',1]], [7,[],[0,0,500,500]], [], [5,[],[210,240,250,280]]]
    }, [1,0,0,1,0,0], ops)
    expect(result.map(g => g.rect)).toEqual([rect(40, 60, 80, 110), rect(210, 240, 40, 40)])
    expect(result[0].fillOnly).toBeUndefined()
    expect(result[1].fillOnly).toBe(true)
  })
})

describe('localized figure and table captions', () => {
  it.each([
    ['图 １', '表 ２'], ['Figure 1', 'Table 2'], ['図 1', '表 2'], ['Рис. 1', 'Таблица 2'],
    ['Figura 1', 'Tabla 2'], ['Figure 1', 'Tableau 2'], ['Abb. 1', 'Tabelle 2'],
    ['Figura 1', 'Tabela 2'], ['그림 1', '표 2'], ['الشكل ١', 'الجدول ٢']
  ])('recognizes figure %s and table %s independently of UI language', (figure, table) => {
    for (const [marker, kind] of [[figure, 'figure'], [table, 'table']] as const) {
      const caption = word(marker, 45, kind === 'table' ? 59 : 175, 115)
      const [visual] = detectPageVisuals([caption], [graphic(40, 80, 200, 90)], size)
      expect(visual.kind).toBe(kind)
      expect(visual.label.replace(/\s/gu, '')).toBe(marker.replace(/\s/gu, ''))
      expect(isolateVisualWords([caption], [visual])[0].visualRegion).toBe(0)
    }
  })

  it('recognizes split Arabic labels and keeps the logical reading direction', () => {
    const title = [word('الشكل', 166, 173, 35, { rtl: true }), word('١', 155, 173, 8), word('رسم تجريبي', 83, 173, 68, { rtl: true })]
    const [visual] = detectPageVisuals(title, [graphic(40, 80, 200, 90)], size)
    expect(visual.caption).toBe('الشكل ١ رسم تجريبي')
  })

  it.each(['Figure 7 shows the data', 'Tabla 2 muestra los resultados', 'Abb. 1 zeigt die Daten', '図 2に示す', 'الجدول ٣ يوضح القياس'])('rejects the inline reference %s', text => {
    expect(captionLabel(text)).toBeUndefined()
  })
})
