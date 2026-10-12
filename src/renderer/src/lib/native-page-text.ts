import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFObject, PDFObjectParser, PDFRawStream, PDFRef, PDFString, decodePDFRawStream, type PDFDocument, type PDFPage } from 'pdf-lib'
import ByteStream from 'pdf-lib/cjs/core/parser/ByteStream'
import type { EditableTextRegion, NativeTextFont } from '../types'
import { applyMatrix, multiplyMatrix, type Matrix } from './page-coordinates'
import { readUnicodeCmap } from '../../../shared/pdf-cmap'

interface FontData {
  name: string; composite?: boolean; vertical?: boolean; fontMatrix?: number[]; defaultWidth?: number
  data?: Uint8Array; loadedName?: string; isType3Font?: boolean; black?: boolean
  toUnicode?: { _map?: Array<string | undefined>; firstChar?: number; lastChar?: number }
  toFontChar?: number[]; widths?: Record<number, number>
  cMap?: { codespaceRanges?: number[][]; _map?: Record<number, number> }
}

function programName(data?: Uint8Array): string | undefined {
  if (!data) return undefined
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    for (let index = 0; index < view.getUint16(4); index++) {
      const table = 12 + index * 16
      if (String.fromCharCode(...data.slice(table, table + 4)) !== 'name') continue
      const offset = view.getUint32(table + 8), strings = offset + view.getUint16(offset + 4)
      for (let item = 0; item < view.getUint16(offset + 2); item++) {
        const record = offset + 6 + item * 12
        if (view.getUint16(record + 6) !== 6) continue
        const bytes = data.slice(strings + view.getUint16(record + 10), strings + view.getUint16(record + 10) + view.getUint16(record + 8))
        return view.getUint16(record) === 0 || view.getUint16(record) === 3 ? String.fromCharCode(...Array.from({ length: bytes.length / 2 }, (_, n) => bytes[n * 2] * 256 + bytes[n * 2 + 1])) : new TextDecoder().decode(bytes)
      }
    }
  } catch { /* Some PDF fonts have no usable sfnt name table. */ }
  return undefined
}

export function nativeTextFont(font: FontData, normalizeText: (text: string) => string): NativeTextFont | undefined {
  const map = font.toUnicode?._map
  if (!map || !font.name) return undefined
  const unicode: Record<number, string> = {}, widths: Record<number, number> = {}
  for (const [key, value] of Object.entries(map)) {
    const code = Number(key)
    if (!value || font.toFontChar && font.toFontChar[code] === undefined) continue
    unicode[code] = normalizeText(value)
    widths[code] = font.widths?.[font.cMap?._map?.[code] ?? code] ?? font.defaultWidth ?? 0
  }
  return { name: font.name, unicode, widths, codeLengths: font.cMap?.codespaceRanges || (font.composite ? [[], [0, 65535]] : [[0, 255]]), matrix: font.fontMatrix?.[0] ?? .001, vertical: Boolean(font.vertical), program: font.data, fontChars: font.toFontChar, loadedName: font.loadedName, postscriptName: programName(font.data), type3: Boolean(font.isType3Font) }
}

interface Command { name: string; args: PDFObject[]; start: number; end: number }
class ContentParser extends PDFObjectParser {
  commands(): Command[] {
    const result: Command[] = []
    let args: PDFObject[] = [], start = 0
    while (!this.bytes.done()) {
      this.skipWhitespaceAndComments()
      if (this.bytes.done()) break
      if (!args.length) start = this.bytes.offset()
      const byte = this.bytes.peek()
      if ([40, 47, 60, 91].includes(byte) || byte >= 48 && byte <= 57 || [43, 45, 46].includes(byte)) {
        args.push(this.parseObject()); continue
      }
      let name = ''
      while (!this.bytes.done() && !/[\s\0()[\]<>/%]/u.test(String.fromCharCode(this.bytes.peek()))) name += String.fromCharCode(this.bytes.next())
      if (!name) throw new Error('ui.nativeTextUnsupported')
      // Inline image data is opaque, including bytes that resemble text operators.
      if (name === 'ID') {
        const remaining = this.bytes.slice(this.bytes.offset(), this.bytes.offset() + 1_000_000_000)
        let end = -1
        for (let i = 1; i + 3 < remaining.length; i++) {
          if ([0, 9, 10, 12, 13, 32].includes(remaining[i - 1]) && remaining[i] === 69 && remaining[i + 1] === 73 && [0, 9, 10, 12, 13, 32].includes(remaining[i + 2])) { end = i + 2; break }
        }
        if (end < 0) throw new Error('ui.nativeTextUnsupported')
        this.bytes.moveTo(this.bytes.offset() + end)
      }
      result.push({ name, args, start, end: this.bytes.offset() }); args = []
    }
    if (args.length) throw new Error('ui.nativeTextUnsupported')
    return result
  }
}

const identity = (): Matrix => [1, 0, 0, 1, 0, 0]
const numeric = (object?: PDFObject): number => object instanceof PDFNumber ? object.asNumber() : 0
const fontName = (object?: PDFObject): string => object instanceof PDFName ? object.decodeText() : ''
const clean = (text: string): string => text.replace(/\s/gu, '')
const number = (value: number): string => Number(value.toFixed(10)).toString()
const hex = (code: number, length: number): string => code.toString(16).padStart(length * 2, '0')

interface State {
  ctm: Matrix; tm: Matrix; x: number; y: number; lineX: number; lineY: number
  font?: NativeTextFont; size: number; spacing: number; wordSpacing: number; scale: number; leading: number; rise: number; mode: number; color: string
}
interface Glyph {
  font: NativeTextFont; code: number; length: number; text: string; x: number; y: number; advance: number
  state: State; command: Command; invocation: Invocation; replacement?: string
}
interface Invocation {
  stream: PDFRawStream; data: Uint8Array; resources: PDFDict; commands: Command[]; glyphs: Map<Command, Array<Glyph | number>>
  children: Array<{ command: Command; name: string; invocation: Invocation }>
}

/** Edit native text bytes without changing fonts, layout, or unrelated content. */
export function editNativePageText(document: PDFDocument, page: PDFPage, viewport: Matrix, region: EditableTextRegion, text: string, removal?: { style?: { size: number; spacing: number; wordSpacing: number; scale: number; color: string }; kerning?: Record<string, number> }): boolean {
  if (!removal && text === region.text) return false
  if (!region.nativeFonts || region.lines.some((line) => !line.sources?.length)) throw new Error('ui.nativeTextUnsupported')
  const newLines = removal ? region.lines.map(() => '') : text.replace(/\r/g, '').split('\n')
  if (newLines.length !== region.lines.length) throw new Error('ui.nativeTextOverflow')
  const context = document.context, canonical = new Map<string, NativeTextFont>()
  const nativeFonts = Object.fromEntries(Object.entries(region.nativeFonts).map(([key, font]) => {
    const signature = JSON.stringify([font.name, font.unicode, font.widths, font.codeLengths, font.matrix, font.vertical, font.type3]), existing = canonical.get(signature)
    if (!existing) canonical.set(signature, font)
    return [key, existing || font]
  }))
  const fonts = [...canonical.values()], glyphs: Glyph[] = []
  const initial: State = { ctm: identity(), tm: identity(), x: 0, y: 0, lineX: 0, lineY: 0, size: 0, spacing: 0, wordSpacing: 0, scale: 1, leading: 0, rise: 0, mode: 0, color: '#000000' }
  const resolve = (object?: PDFObject): PDFObject | undefined => object instanceof PDFRef ? context.lookup(object) : object
  const resolveDict = (object?: PDFObject): PDFDict | undefined => { const value = resolve(object); return value instanceof PDFDict ? value : undefined }
  const resolvedFonts = new Map<PDFDict, NativeTextFont | undefined>()
  const resolveFont = (dictionary?: PDFDict): NativeTextFont | undefined => {
    if (!dictionary) return undefined
    if (resolvedFonts.has(dictionary)) return resolvedFonts.get(dictionary)
    const descendants = resolve(dictionary.get(PDFName.of('DescendantFonts')))
    const descendant = descendants instanceof PDFArray ? resolveDict(descendants.get(0)) : undefined
    const descriptor = resolveDict((descendant || dictionary).get(PDFName.of('FontDescriptor')))
    const names = [fontName(dictionary.get(PDFName.of('BaseFont'))), fontName(descriptor?.get(PDFName.of('FontName'))), fontName(dictionary.get(PDFName.of('Name')))]
    const named = fonts.filter(font => names.includes(font.name)), matches = named.length ? named : fonts
    const cmap = resolve(dictionary.get(PDFName.of('ToUnicode')))
    const table = named.length !== 1 && cmap instanceof PDFRawStream ? readUnicodeCmap(new TextDecoder().decode(decodePDFRawStream(cmap).decode())) : undefined
    const consistent = table?.size ? matches.filter(font => [...table].every(([code, value]) => font.unicode[code]?.normalize('NFKC') === value.normalize('NFKC'))) : matches
    const exact = table?.size ? consistent.filter(font => Object.keys(font.unicode).length === table.size) : consistent
    const font = exact.length === 1 ? exact[0] : consistent.length === 1 ? consistent[0] : undefined
    resolvedFonts.set(dictionary, font); return font
  }
  const nextLine = (state: State) => { state.x = state.lineX; state.y = state.lineY -= state.leading }
  const show = (command: Command, invocation: Invocation, state: State) => {
    if (!state.font) return
    const values = command.args.at(-1) instanceof PDFArray ? (command.args.at(-1) as PDFArray).asArray() : [command.args.at(-1)]
    const parts: Array<Glyph | number> = []
    for (const value of values) {
      if (value instanceof PDFNumber) { const adjustment = value.asNumber(); state.x -= adjustment * state.size / 1000 * state.scale; parts.push(adjustment); continue }
      if (!(value instanceof PDFString || value instanceof PDFHexString)) throw new Error('ui.nativeTextUnsupported')
      const bytes = value.asBytes()
      for (let offset = 0; offset < bytes.length;) {
        let code = 0, length = 0
        for (let count = 1; count <= 4 && offset + count <= bytes.length; count++) {
          code = code * 256 + bytes[offset + count - 1]
          const ranges = state.font.codeLengths[count - 1] || []
          if (ranges.some((low, index) => index % 2 === 0 && code >= low && code <= ranges[index + 1])) { length = count; break }
        }
        if (!length) throw new Error('ui.nativeTextUnsupported')
        const point = applyMatrix(multiplyMatrix(viewport, multiplyMatrix(state.ctm, state.tm)), { x: state.x, y: state.y + state.rise })
        const advance = (state.font.widths[code] ?? 0) * state.size * state.font.matrix + state.spacing + (code === 32 && length === 1 ? state.wordSpacing : 0)
        const glyph: Glyph = { font: state.font, code, length, text: state.font.unicode[code] || '', ...point, advance, state: { ...state }, command, invocation }
        parts.push(glyph); glyphs.push(glyph); state.x += advance * state.scale; offset += length
      }
    }
    invocation.glyphs.set(command, parts)
  }
  const walk = (stream: PDFRawStream, resources: PDFDict, state: State, ancestors = new Set<PDFRawStream>(), stack: State[] = []): Invocation => {
    if (ancestors.has(stream)) throw new Error('ui.nativeTextUnsupported')
    const data = decodePDFRawStream(stream).decode()
    const invocation: Invocation = { stream, data, resources, commands: new ContentParser(ByteStream.of(data), context).commands(), glyphs: new Map(), children: [] }
    for (const command of invocation.commands) {
      const args = command.args.map(numeric)
      switch (command.name) {
        case 'q': stack.push({ ...state }); break
        case 'Q': { const previous = stack.pop(); if (previous) Object.assign(state, previous); break }
        case 'cm': state.ctm = multiplyMatrix(state.ctm, args as Matrix); break
        case 'BT': state.tm = identity(); state.x = state.y = state.lineX = state.lineY = 0; break
        case 'Tf': {
          const dictionary = resolveDict(resolveDict(resources.get(PDFName.of('Font')))?.get(command.args[0] as PDFName))
          state.font = resolveFont(dictionary); state.size = args[1]; break
        }
        case 'Tc': state.spacing = args[0]; break
        case 'Tw': state.wordSpacing = args[0]; break
        case 'Tz': state.scale = args[0] / 100; break
        case 'TL': state.leading = args[0]; break
        case 'Ts': state.rise = args[0]; break
        case 'Tr': state.mode = args[0]; break
        case 'rg': state.color = '#' + args.slice(0, 3).map(value => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join(''); break
        case 'g': state.color = '#' + Math.round(Math.max(0, Math.min(1, args[0])) * 255).toString(16).padStart(2, '0').repeat(3); break
        case 'k': state.color = '#' + args.slice(0, 3).map(value => Math.round((1 - Math.min(1, value)) * (1 - Math.min(1, args[3])) * 255).toString(16).padStart(2, '0')).join(''); break
        case 'Tm': state.tm = args as Matrix; state.x = state.y = state.lineX = state.lineY = 0; break
        case 'TD': state.leading = -args[1]; state.x = state.lineX += args[0]; state.y = state.lineY += args[1]; break
        case 'Td': state.x = state.lineX += args[0]; state.y = state.lineY += args[1]; break
        case 'T*': nextLine(state); break
        case '"': state.wordSpacing = args[0]; state.spacing = args[1]; nextLine(state); show(command, invocation, state); break
        case "'": nextLine(state); show(command, invocation, state); break
        case 'Tj': case 'TJ': show(command, invocation, state); break
        case 'Do': {
          const name = fontName(command.args[0]), object = resolve(resolveDict(resources.get(PDFName.of('XObject')))?.get(command.args[0] as PDFName))
          if (!(object instanceof PDFRawStream) || fontName(object.dict.get(PDFName.of('Subtype'))) !== 'Form') break
          const formMatrix = resolve(object.dict.get(PDFName.of('Matrix')))
          const transform = formMatrix instanceof PDFArray ? formMatrix.asArray().map(numeric) as Matrix : identity()
          const child = walk(object, resolveDict(object.dict.get(PDFName.of('Resources'))) || resources, { ...state, ctm: multiplyMatrix(state.ctm, transform) }, new Set([...ancestors, stream]))
          invocation.children.push({ command, name, invocation: child }); break
        }
        case 'gs': {
          const gs = resolveDict(resolveDict(resources.get(PDFName.of('ExtGState')))?.get(command.args[0] as PDFName))
          const font = resolve(gs?.get(PDFName.of('Font')))
          if (font instanceof PDFArray) { state.font = resolveFont(resolveDict(font.get(0))); state.size = numeric(font.get(1)) }
          break
        }
      }
    }
    return invocation
  }
  const contents = resolve(page.node.get(PDFName.of('Contents')))
  const streams = contents instanceof PDFArray ? contents.asArray().map(resolve) : [contents]
  const resources = page.node.Resources()
  if (!resources || streams.some((stream) => !(stream instanceof PDFRawStream))) throw new Error('ui.nativeTextUnsupported')
  const stack: State[] = []
  const invocations = streams.map((stream) => walk(stream as PDFRawStream, resources, initial, new Set(), stack))
  const used = new Set<Glyph>()
  for (const [lineIndex, line] of region.lines.entries()) {
    if (newLines[lineIndex] === line.text) continue
    const selected: Glyph[] = []
    for (const source of line.sources!) {
      const font = nativeFonts[source.font]
      if (!font || font.vertical) throw new Error('ui.nativeTextUnsupported')
      const expected = clean(source.text)
      // PDF.js can aggregate several Type3 subsets into one TextItem and
      // report only the first subset's fontName. Match their actual glyphs.
      const sameTypeface = (other: NativeTextFont) => other === font || Boolean(other.type3 && font.type3 && other.name === font.name)
      const candidates = glyphs.filter((glyph) => sameTypeface(glyph.font) && Math.abs(glyph.y - source.y) < .75 && Math.abs(glyph.x - source.x) < .75)
      let matched: Glyph[] | undefined
      for (const first of candidates) {
        const start = glyphs.indexOf(first), group: Glyph[] = []
        const axis = multiplyMatrix(viewport, multiplyMatrix(first.state.ctm, first.state.tm))
        let value = ''
        for (let index = start; index < glyphs.length && clean(value).length <= expected.length; index++) {
          const glyph = glyphs[index]
          const perpendicular = Math.abs((glyph.y - source.y) * axis[0] - (glyph.x - source.x) * axis[1]) / Math.max(.000001, Math.hypot(axis[0], axis[1]))
          if (!sameTypeface(glyph.font) || perpendicular >= .75) break
          group.push(glyph); value += glyph.text
          const actual = clean(source.rtl ? [...group].reverse().map((entry) => entry.text).join('') : value)
          if (actual === expected) { matched = group; break }
        }
        if (matched) break
      }
      if (!matched) throw new Error('ui.nativeTextStale')
      selected.push(...(source.rtl ? [...matched].reverse() : matched))
    }
    const unique = [...new Set(selected)]
    if (unique.some((glyph) => used.has(glyph))) throw new Error('ui.nativeTextStale')
    unique.forEach((glyph) => used.add(glyph))
    if (removal) {
      const axis = multiplyMatrix(viewport, multiplyMatrix(unique[0].state.ctm, unique[0].state.tm))
      const horizontal = Math.hypot(axis[0], axis[1])
      removal.style ||= { size: unique[0].state.size, spacing: unique[0].state.spacing, wordSpacing: unique[0].state.wordSpacing, scale: unique[0].state.scale * Math.hypot(axis[0], axis[1]) / Math.max(.000001, Math.hypot(axis[2], axis[3])), color: unique[0].state.color }
      const gaps: number[] = []; let cursor = 0
      if (!line.sources![0].rtl) for (let index = 0; index < unique.length; index++) {
        const glyph = unique[index], start = line.text.indexOf(glyph.text, cursor), previous = unique[index - 1]
        if (start < 0) continue
        if (previous && previous.font === glyph.font && previous.state.size === glyph.state.size) {
          const distance = ((glyph.x - previous.x) * axis[0] + (glyph.y - previous.y) * axis[1]) / Math.max(.000001, horizontal)
          const adjustment = distance / Math.max(.000001, horizontal * glyph.state.scale) - previous.advance
          if (/^\s+$/u.test(line.text.slice(cursor, start))) {
            const space = Object.entries(glyph.font.unicode).find(([, value]) => value === ' ')
            if (space) gaps.push(adjustment - (glyph.font.widths[Number(space[0])] || 0) * glyph.font.matrix * glyph.state.size - glyph.state.spacing)
          } else if (start === cursor && Math.abs(adjustment) < glyph.state.size * .15) (removal.kerning ||= {})[previous.text + glyph.text] = adjustment
        }
        cursor = start + glyph.text.length
      }
      if (!removal.style.wordSpacing && gaps.length) removal.style.wordSpacing = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      unique.forEach(glyph => { glyph.replacement = number(-glyph.advance * 1000 / glyph.state.size) })
      continue
    }
    const original = Array.from(line.text), revised = Array.from(newLines[lineIndex])
    let prefix = 0, suffix = 0
    while (prefix < original.length && prefix < revised.length && original[prefix] === revised[prefix]) prefix++
    while (suffix < original.length - prefix && suffix < revised.length - prefix && original[original.length - suffix - 1] === revised[revised.length - suffix - 1]) suffix++
    let cursor = 0
    const mapped = unique.map((glyph) => {
      const characters = Array.from(glyph.text)
      if (!characters.length) throw new Error('ui.nativeTextUnsupported')
      if (clean(glyph.text)) while (/\s/u.test(original[cursor] || '') && cursor < original.length) cursor++
      const start = cursor
      for (const character of characters) {
        if (original[cursor] !== character) throw new Error('ui.nativeTextStale')
        cursor++
      }
      return { glyph, start, end: cursor }
    })
    if (clean(original.slice(cursor).join(''))) throw new Error('ui.nativeTextStale')
    let affected = mapped.filter((entry) => entry.end > prefix && entry.start < original.length - suffix)
    // Inserting in a geometric space or at the end needs a real glyph anchor.
    if (!affected.length) { const anchor = mapped.find((entry) => entry.end >= prefix) || mapped.at(-1); if (anchor) affected = [anchor] }
    if (!affected.length) throw new Error('ui.nativeTextUnsupported')
    const rtl = line.sources![0].rtl
    const first = rtl ? affected.at(-1)!.glyph : affected[0].glyph
    if (affected.some(({ glyph }) => glyph.font !== first.font || glyph.state.size !== first.state.size || glyph.state.scale !== first.state.scale || glyph.state.spacing !== first.state.spacing || glyph.state.wordSpacing !== first.state.wordSpacing || glyph.state.mode !== 0 || glyph.state.size <= 0)) throw new Error('ui.nativeTextUnsupported')
    const from = affected[0].start, to = affected.at(-1)!.end
    const replacement = original.slice(from, prefix).join('') + revised.slice(prefix, revised.length - suffix).join('') + original.slice(original.length - suffix, to).join('')
    const encoding = Object.entries(first.font.unicode).sort((a, b) => b[1].length - a[1].length)
    let remaining = rtl ? Array.from(replacement).reverse().join('') : replacement
    const encoded: Array<{ bytes: string; advance: number }> = []
    while (remaining) {
      let entry = encoding.find(([, unicode]) => remaining.startsWith(unicode))
      if (!entry) throw new Error('ui.nativeTextMissingGlyph')
      const ordinarySpace = entry[1] === ' ' && first.font.unicode[32] === ' ' && first.font.codeLengths[0]?.some((low, index, ranges) => index % 2 === 0 && low <= 32 && ranges[index + 1] >= 32)
      if (ordinarySpace) entry = ['32', ' ']
      // A nominal Unicode value can map to several contextual glyphs. Without
      // a shaping engine, choosing one would silently change Arabic/Indic forms.
      if (!ordinarySpace && encoding.filter(([, unicode]) => unicode === entry![1]).length > 1) throw new Error('ui.nativeTextUnsupported')
      const code = Number(entry[0]), unicode = entry[1]
      const lengthIndex = first.font.codeLengths.findIndex((ranges) => ranges.some((low, index) => index % 2 === 0 && code >= low && code <= ranges[index + 1]))
      if (lengthIndex < 0) throw new Error('ui.nativeTextMissingGlyph')
      const width = (first.font.widths[code] ?? 0) * first.state.size * first.font.matrix + first.state.spacing + (code === 32 && lengthIndex === 0 ? first.state.wordSpacing : 0)
      encoded.push({ bytes: hex(code, lengthIndex + 1), advance: width })
      remaining = remaining.slice(unicode.length)
    }
    // Compensate at the end of each changed command. Jumping backwards after
    // the first glyph makes PDF readers split an otherwise continuous line.
    const commands = new Map<Command, Glyph[]>(), drawn = new Map<Glyph, number>()
    const physical = rtl ? [...affected].reverse() : affected
    for (const [index, { glyph }] of physical.entries()) {
      const group = commands.get(glyph.command) || []; group.push(glyph); commands.set(glyph.command, group)
      const entries = index === physical.length - 1 ? encoded.slice(index) : encoded.slice(index, index + 1)
      glyph.replacement = entries.length ? `<${entries.map((entry) => entry.bytes).join('')}>` : ''
      drawn.set(glyph, entries.reduce((sum, entry) => sum + entry.advance, 0))
    }
    for (const group of commands.values()) {
      const tail = group.at(-1)!
      const delta = group.reduce((sum, glyph) => sum + drawn.get(glyph)! - glyph.advance, 0)
      // TJ kerning is retained, so compare advances without counting its gaps
      // twice. Each independently positioned command must fit its own span.
      if (delta > .2) throw new Error('ui.nativeTextOverflow')
      tail.replacement += ` ${number(delta * 1000 / tail.state.size)}`
    }
  }
  let resourceIndex = 0
  const materialize = (invocation: Invocation): PDFRef | undefined => {
    const patches: Array<{ start: number; end: number; value: string }> = []
    const newResources = invocation.resources.clone(context)
    for (const [command, parts] of invocation.glyphs) {
      if (!parts.some((part) => typeof part !== 'number' && part.replacement !== undefined)) continue
      const body = parts.map((part) => typeof part === 'number' ? number(part) : part.replacement ?? `<${hex(part.code, part.length)}>`).join(' ')
      const prefix = command.name === "'" ? 'T* ' : command.name === '"' ? `${command.args[0]} Tw ${command.args[1]} Tc T* ` : ''
      patches.push({ start: command.start, end: command.end, value: `${prefix}[${body}] TJ` })
    }
    for (const child of invocation.children) {
      const changed = materialize(child.invocation)
      if (!changed) continue
      const xobjects = (resolveDict(newResources.get(PDFName.of('XObject'))) || context.obj({})).clone(context)
      let name = `PDFuckEdit${resourceIndex++}`
      while (xobjects.has(PDFName.of(name))) name = `PDFuckEdit${resourceIndex++}`
      xobjects.set(PDFName.of(name), changed); newResources.set(PDFName.of('XObject'), xobjects)
      patches.push({ start: child.command.start, end: child.command.end, value: `/${name} Do` })
    }
    if (!patches.length) return undefined
    // Slice bytes rather than decode/re-encode: images and high bytes are opaque.
    const chunks: Uint8Array[] = [], encoder = new TextEncoder()
    let offset = 0
    for (const patch of patches.sort((a, b) => a.start - b.start)) { chunks.push(invocation.data.slice(offset, patch.start), encoder.encode(patch.value)); offset = patch.end }
    chunks.push(invocation.data.slice(offset))
    const data = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0))
    offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length }
    const dict = invocation.stream.dict.clone(context)
    dict.delete(PDFName.of('Filter')); dict.delete(PDFName.of('DecodeParms'))
    dict.set(PDFName.of('Resources'), newResources)
    const rewritten = context.flateStream(data)
    dict.entries().forEach(([name, value]) => { if (name !== PDFName.of('Length')) rewritten.dict.set(name, value) })
    return context.register(rewritten)
  }
  const updated = invocations.map((invocation, index) => materialize(invocation) || (contents instanceof PDFArray ? contents.get(index) : page.node.get(PDFName.of('Contents'))!))
  // Page streams share resources; Form edits add per-invocation XObject names.
  const pageResources = resources.clone(context)
  const xobjects = (resolveDict(resources.get(PDFName.of('XObject'))) || context.obj({})).clone(context)
  invocations.forEach((_invocation, index) => {
    const stream = resolve(updated[index])
    if (!(stream instanceof PDFRawStream)) return
    const res = resolveDict(stream.dict.get(PDFName.of('Resources')))
    const childObjects = resolveDict(res?.get(PDFName.of('XObject')))
    childObjects?.entries().forEach(([name, value]) => { if (!resolveDict(resources.get(PDFName.of('XObject')))?.has(name)) xobjects.set(name, value) })
  })
  pageResources.set(PDFName.of('XObject'), xobjects)
  page.node.set(PDFName.of('Resources'), pageResources)
  page.node.set(PDFName.of('Contents'), context.obj(updated))
  return true
}
