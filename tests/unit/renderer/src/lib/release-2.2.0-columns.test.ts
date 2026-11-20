import { describe, expect, it } from 'vitest'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { PageGraphic } from '../../../../../src/renderer/src/lib/page-visuals'
import { textItemsToWordBoxes, textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'

const height = 780
const item = (str: string, x: number, y: number, width: number, size = 10, dir: 'rtl' | 'ltr' = 'ltr'): TextItem =>
  ({ str, width, height: size, dir, fontName: 'f', hasEOL: true, transform: [size,0,0,size,x,height-y] })
const line = (x: number, y: number, width: number, height = 0): PageGraphic =>
  ({ rect: { x,y,width,height }, parts: 1, image: false })
const outline = (x: number, y: number, width: number, height: number): PageGraphic => ({
  ...line(x,y,width,height), parts: 4,
  rules: [line(x,y,width),line(x,y+height,width),line(x,y,0,height),line(x+width,y,0,height)].map(edge => edge.rect)
})
const layout = (items: TextItem[], graphics: PageGraphic[] = [], columnBoundaries?: number[]): WordBox[] =>
  textItemsToWordBoxes(items, { f: { fontFamily: 'serif', ascent: .8, descent: -.2, vertical: false } },
    [1,0,0,-1,0,height], {}, columnBoundaries === undefined ? undefined : { columnBoundaries }, graphics)
const bounds = (words: WordBox[]) => words[0]?.columnBoundaries ?? []

const languages = [
  ['zh','多个步骤共同组成清晰完整的示例正文段落'],
  ['en','Example text with ordinary words in a complete body paragraph'],
  ['ja','検証のための一連の手順を日本語の正文で説明します'],
  ['ru','Обычный последовательный абзац для проверки колонок'],
  ['es','Este párrafo tiene varias palabras para probar la separación'],
  ['fr','Ce paragraphe comporte des mots pour vérifier cette disposition'],
  ['de','Ein langer Beispielabsatz für die Prüfung der Seitenspalten'],
  ['pt','O texto usa diversas palavras para verificar a leitura do corpo'],
  ['ko','본문은열사이간격측정에사용하는여러문장을포함합니다'],
  ['ar','الفقرة تحتوي على كلمات متواصلة لاختبار مسار قراءة العمود']
] as const

describe('local ruled regions and independent body gutters', () => {
  it.each(languages)('detects the tight body gutter below a framed chart with aligned running rules (%s)', (language,str) => {
    const dir = language === 'ar' ? 'rtl' : 'ltr'
    const body = Array.from({ length: 22 }, (_,i) => [
      item(str, 42, 337+i*16, 218, 10, dir), item(str, 268, 337+i*16, 218, 10, dir)
    ]).flat()
    const figureLabels = Array.from({ length: 12 }, (_,i) => [
      item(str,65,51+i*17,83,8,dir), item(str,172,51+i*17,101,8,dir), item(str,323,51+i*17,97,8,dir)
    ]).flat()
    const footnote = Array.from({length:5}, (_,i) => item(str,515,617+i*16,78,7,dir))
    const graphics = [outline(42,30,444,253), line(42,20,444), line(42,735,444)]
    const words = layout([...body,...figureLabels,...footnote,item('Figure 1. caption',42,308,425)],graphics)
    expect(bounds(words)).toHaveLength(1)
    expect(bounds(words)[0]).toBeGreaterThan(260)
    expect(bounds(words)[0]).toBeLessThan(268)
    const columns = words.filter(w => w.baselineY! >= 337 && w.baselineY! <= 650 && w.rect.x < 486)
    expect(columns.every(word => word.column === (word.rect.x < 264 ? 0 : 1))).toBe(true)
  })

  it('keeps a graphic built from four separate strokes detached from running rules', () => {
    const frame = outline(40,32,440,255)
    const graphic = frame.rules!.map(edge => line(edge.x,edge.y,edge.width,edge.height))
    const body = Array.from({length:14},(_,i) => [
      item('Left continued body paragraph',40,322+i*16,207),
      item('Right continued body paragraph',255,322+i*16,225)
    ]).flat()
    const result = layout(body,[...graphic,line(40,20,440),line(40,729,440)])
    expect(bounds(result)).toEqual([251])
  })

  it('preserves two readable columns inside a decorative frame and supports explicit overrides', () => {
    const body = Array.from({length:18},(_,i) => [
      item('Left column with a full paragraph',40,85+i*16,220),
      item('Right column with a full paragraph',268,85+i*16,220)
    ]).flat()
    const frame = [outline(28,42,482,485)]
    expect(bounds(layout(body,frame))).toEqual([264])
    expect(bounds(layout(body,frame,[280]))).toEqual([280])
    expect(bounds(layout(body,frame,[]))).toEqual([])
  })

  it('retains three real reading columns of the same typography', () => {
    const body = Array.from({length:16},(_,i) => [40,214,388].map((x,col) =>
      item(['First ordinary prose sentence','Second ordinary prose sentence','Third ordinary prose sentence'][col],x,85+i*16,166))).flat()
    const words = layout(body)
    expect(bounds(words)).toEqual([210,384])
    expect(new Set(words.map(w => w.column)).size).toBe(3)
    const bodyColumn = words.map((w,index) => ({w,index})).filter(({w}) => w.column === 1)
    const first = { wordIndex: bodyColumn[0].index, offset: 0 }
    const last = { wordIndex: bodyColumn.at(-1)!.index, offset: bodyColumn.at(-1)!.w.text.length }
    const selection = textSelectionBetween(words,first,last)!
    expect(selection.text).toContain('Second ordinary prose sentence')
    expect(selection.text).not.toMatch(/First|Third/)
    expect(textSelectionBetween(words,last,first)).toEqual(selection)
  })

  it.each([false,true])('keeps table cell gaps out of automatic text boundaries (closed %s)', closed => {
    const table = Array.from({length:7},(_,i) => [
      item('Long entry in a table cell',47,84+i*24,183),
      item('Another entry in table cell',251,84+i*24,187)
    ]).flat()
    const rules = closed ? [outline(40,55,412,199),line(40,65,412),line(240,55,0,199)]
      : [line(40,55,412),line(40,72,412),line(40,254,412)]
    expect(bounds(layout(table,rules))).toEqual([])
  })
})
