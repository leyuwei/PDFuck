import { expect, it } from 'vitest'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { textItemsToWordBoxes, textSelectionBetween } from '../../../../../src/renderer/src/lib/text-layout'

const text = (str: string, x: number, y: number, width: number, height = 12, dir: 'ltr' | 'rtl' = 'ltr'): TextItem =>
  ({ str, width, height, dir, fontName: 'f', hasEOL: true, transform: [height, 0, 0, height, x, 800 - y] })
const layout = (items: TextItem[], scale = 1, boundaries?: number[]) => textItemsToWordBoxes(items,
  { f: { fontFamily: 'sans-serif', ascent: .8, descent: -.2, vertical: false } }, [scale, 0, 0, -scale, 0, 800 * scale],
  {}, boundaries === undefined ? undefined : { columnBoundaries: boundaries.map(x => x * scale) })

const fields = [
  ['en', 'Report information', 'Initial submission'],
  ['zh', '报告登记编号', '本年度提交的报告样例'],
  ['ja', '報告書の情報', '最初の提出資料'],
  ['ko', '보고서등록정보', '보고서의최초제출자료'],
  ['de', 'Dokumentdaten', 'Erste Fassung des Dokuments'],
  ['fr', 'Données du document', 'Première version du document'],
  ['es', 'Datos del informe', 'Versión inicial de la propuesta'],
  ['pt', 'Dados do relatório', 'Primeira edição do relatório'],
  ['ru', 'Сведения отчёта', 'Первоначальная версия отчёта'],
  ['ar', 'معلومات التقرير', 'النسخة الأولى من التقرير']
] as const

it.each(fields)('keeps aligned field rows inside one reading flow (%s)', (language, label, value) => {
  const rtl = language === 'ar'
  const dir = rtl ? 'rtl' : 'ltr'
  const rows = Array.from({length: 4}, (_, i) => [
    text(label, rtl ? 340 : 45, 220 + i * 33, 89 + i, 12, dir),
    text(value, rtl ? 63 : 164, 220 + i * 33, 240, 13, dir)
  ]).flat()
  const items = [text(value,45,142,430,25,dir), text(value,45,168,414,25,dir), ...rows]
  for (const scale of [.7,1,1.45]) {
    const words = layout(items, scale)
    expect(words[0].columnBoundaries).toEqual([])
    expect(words.every(word => word.column === 0)).toBe(true)
  }
})

it('keeps a long template with spaced rows and short keys in one reading flow', () => {
  const rows = Array.from({length: 8}, (_, i) => [
    text('Submission metadata',45,160+i*37,99),
    text('Independent value for the record',162,160+i*37,235)
  ]).flat()
  expect(layout(rows)[0].columnBoundaries).toEqual([])
})

it('selects fields in their displayed row order', () => {
  const rows = Array.from({length: 4}, (_, i) => [
    text('Field label '+(i+1),40,220+i*36,129),
    text('Value for record '+(i+1),190,220+i*36,190)
  ]).flat()
  const words = layout(rows)
  const selected = textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:words.length-1,offset:1},'reading')!
  expect(selected.text.replace(/\s+/gu,' ')).toBe('Field label 1 Value for record 1 Field label 2 Value for record 2 Field label 3 Value for record 3 Field label 4 Value for record 4')
  expect(layout(rows,1,[180])[0].columnBoundaries).toEqual([180])
})

it.each([
  { rows:3, leading:18, left:92, right:254, stagger:3, gutter:12 },
  { rows:7, leading:29, left:145, right:245, stagger:0, gutter:18 },
  { rows:9, leading:15, left:185, right:170, stagger:0, gutter:7 }
])('retains valid disparate columns with $rows rows and $leading point leading', ({rows,leading,left,right,stagger,gutter}) => {
  const rightX = 45 + left + gutter
  const items = Array.from({length:rows}, (_,i)=>[
    text('A complete line of readable text',45,290+i*leading,left),
    text('Independent words of another body paragraph',rightX,290+i*leading+stagger,right)
  ]).flat()
  const shape = [text('Full-width headline above the body',45,234,440,19), ...items]
  for (const scale of [.7,1,1.45]) {
    const boundaries = layout(shape,scale)[0].columnBoundaries!
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0]/scale).toBeGreaterThan(45+left)
    expect(boundaries[0]/scale).toBeLessThan(rightX)
  }
})
