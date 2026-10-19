/// <reference types="node" />
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { beforeAll, afterAll, expect, it } from 'vitest'
import { getDocument, normalizeUnicode } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { nativeTextFont } from '../../../../../src/renderer/src/lib/native-page-text'
import { textItemsToWordBoxes, textSelectionBetween, type PdfFontDetails } from '../../../../../src/renderer/src/lib/text-layout'
import type { Matrix } from '../../../../../src/renderer/src/lib/page-coordinates'

const task = getDocument({ data: new Uint8Array(readFileSync('tests/fixtures/test_multi_col.pdf')), fontExtraProperties: true })
let pdf: Awaited<typeof task.promise>
beforeAll(async () => { pdf = await task.promise })
afterAll(async () => { await task.destroy() })

const styles = { f: { fontFamily: 'serif', ascent: .8, descent: -.2, vertical: false } }
const matrix: Matrix = [1, 0, 0, -1, 0, 800]
const item = (str: string, x: number, y: number, width = 120, size = 10, rtl = false): TextItem => ({ str, dir: rtl ? 'rtl' : 'ltr', width, height: size, transform: [size, 0, 0, size, x, 800 - y], fontName: 'f', hasEOL: true })
const boxes = (items: TextItem[], scale = 1, override?: Parameters<typeof textItemsToWordBoxes>[4]) => textItemsToWordBoxes(items, styles, matrix.map(v => v * scale) as Matrix, {}, override)
function columns(count = 2, stagger = 9, text = 'body', rtl = false) {
  return Array.from({ length: 20 }, (_, row) => Array.from({ length: count }, (_, col) => item(`${text}${col}_${row}`, 40 + col * 132, 100 + row * 24 + col * stagger, row % 4 ? 120 : 80, 10, rtl))).flat()
}

it.each([1, 2])('detects exactly the real gutter on supplied page %i at five scales, with native PDF font metrics', async number => {
  const page = await pdf.getPage(number), content = await page.getTextContent(); await page.getOperatorList()
  const items = content.items.filter((i): i is TextItem => 'str' in i), fonts: Record<string, PdfFontDetails> = {}
  for (const name of new Set(items.map(i => i.fontName))) { const font = page.commonObjs.get(name); fonts[name] = { name: font.name, native: nativeTextFont(font, normalizeUnicode) } }
  for (const scale of [.5, .75, 1, 2.16, 3]) {
    const words = textItemsToWordBoxes(items, content.styles, page.getViewport({ scale }).transform as Matrix, fonts)
    const boundaries = words[0].columnBoundaries!
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0] / scale).toBeCloseTo(306.002, 2)
    expect(words.every(w => w.columnBoundaries === boundaries)).toBe(true)
    // Formula-number gaps in page 2 must not become a third column.
    expect(new Set(words.map(w => w.column))).toEqual(new Set([0, 1]))
    const body = words.filter(w => w.rect.x < 301 * scale && w.rect.y > (number === 1 ? 195 : 146) * scale && w.rect.y < (number === 1 ? 230 : 178) * scale)
    expect(body.length).toBeGreaterThan(20)
    const a = { wordIndex: words.indexOf(body[0]), offset: 0 }, b = { wordIndex: words.indexOf(body.at(-1)!), offset: Array.from(body.at(-1)!.text).length }
    const selection = textSelectionBetween(words, a, b)!
    expect(selection.text).toContain(number === 1 ? 'sampling ratio' : 'The first inequality')
    expect(selection.text).not.toMatch(/Proof|client’s payoff|where the second/)
    expect(selection.rects.every(r => r.x + r.width < 301 * scale)).toBe(true)
    expect(textSelectionBetween(words, b, a)).toEqual(selection)
  }
})

it.each([2, 3, 4])('detects %i independent columns with no shared baselines and ragged line endings', count => {
  const words = boxes(columns(count))
  expect(words[0].columnBoundaries).toEqual(Array.from({ length: count - 1 }, (_, c) => 166 + c * 132))
  for (let col = 0; col < count; col++) {
    const own = words.filter(w => w.text.startsWith(`body${col}_`))
    expect(own).toHaveLength(20); expect(own.every(w => w.column === col && !w.columnAmbiguous)).toBe(true)
    expect(own.map(w => w.text)).toEqual(Array.from({ length: 20 }, (_, row) => `body${col}_${row}`))
  }
})

it('keeps a narrow gutter through dense superscripts, fractions, short formulas and spanning text', () => {
  const items = columns(3, 7)
  for (let row = 0; row < 20; row++) for (let col = 0; col < 3; col++) {
    items.push(item('script', 60 + col * 132, 105 + row * 24 + col * 7, 4, 6))
    items.push(item('fraction', 92 + col * 132, 112 + row * 24 + col * 7, 14, 7))
  }
  items.push(item('Spanning title', 40, 45, 384), item('Spanning equation', 40, 650, 384))
  expect(boxes(items)[0].columnBoundaries).toEqual([166, 298])
})

it.each([['中文正文', false], ['English', false], ['قراءة', true]])('keeps detection independent of %s script and direction', (text, rtl) => {
  for (const scale of [.75, 1, 2.16]) {
    const words = boxes(columns(2, 9, text as string, rtl as boolean), scale)
    expect(words[0].columnBoundaries).toHaveLength(1)
    expect(words[0].columnBoundaries![0] / scale).toBeCloseTo(166, 5)
    expect(words.filter(w => w.text.startsWith(`${text}0_`)).every(w => w.column === 0)).toBe(true)
  }
})

it('rejects ordinary single-column word spacing and repeated matrix/equation gaps crossed by body text', () => {
  const prose = Array.from({ length: 30 }, (_, row) => Array.from({ length: 8 }, (_, col) => item('word', 40 + col * 28 + row % 3 * 3, 100 + row * 16, 23))).flat()
  const equations = Array.from({ length: 7 }, (_, row) => [item('a', 80, 620 + row * 18, 20), item('b', 220, 620 + row * 18, 20), item('(1)', 300, 620 + row * 18, 15)]).flat()
  expect(boxes(prose)[0].columnBoundaries).toEqual([])
  expect(boxes([...prose, ...equations])[0].columnBoundaries).toEqual([])
})

it('honors explicit boundaries and a deliberate single-column override after automatic detection', () => {
  const items = columns()
  expect(boxes(items, 1, { columnBoundaries: [] })[0].columnBoundaries).toEqual([])
  expect(boxes(items, 1, { columnBoundaries: [165, 165, NaN] })[0].columnBoundaries).toEqual([165])
  const spanning = boxes(items, 1, { spanningRegions: [{ top: 95, bottom: 120 }] }).filter(w => w.rect.y >= 95 && w.rect.y < 120)
  expect(new Set(spanning.map(w => w.visualBlock)).size).toBe(1)
})

it('keeps all relocated cases and reusable inputs under tests without changing gitignore', () => {
  const mapping: Record<string, string> = JSON.parse(readFileSync('tests/migration-map.json', 'utf8'))
  for (const [old, current] of Object.entries(mapping)) { expect(existsSync(old), old).toBe(false); expect(existsSync(current), current).toBe(true) }
  const walk = (p: string): string[] => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)])
  expect(walk('src').filter(p => /\.test\.[tj]sx?$/.test(p))).toEqual([])
  expect(readdirSync('scripts').filter(p => /smoke|audit|check|test/.test(p))).toEqual([])
  expect(readFileSync('.gitignore', 'utf8').replace(/\r\n/g, '\n')).toBe(execFileSync('git', ['show', 'HEAD:.gitignore'], { encoding: 'utf8' }).replace(/\r\n/g, '\n'))
  expect(createHash('sha256').update(readFileSync('tests/fixtures/test_multi_col.pdf')).digest('hex')).toBe('50b3dec6d28328c7986a8985fdefb0836ee2b6cb08850dcfa168ad784c268a81')
  for (const name of ['package.json', 'package-lock.json']) expect(JSON.parse(readFileSync(name, 'utf8')).version).toBe('2.1.10')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  for (const command of Object.values(pkg.scripts) as string[]) for (const match of command.matchAll(/(?:node |electron |\-File )([^ &]+\.(?:cjs|ps1))/g)) expect(existsSync(resolve(match[1])), match[1]).toBe(true)
})
