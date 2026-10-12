import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { createCmap } from 'pdf-lib/cjs/core/embedders/CMap'
import type { Glyph } from 'pdf-lib/cjs/types/fontkit'
import { createHash } from 'node:crypto'
import type { PageTextRenderRequest, PageTextRenderResult } from '../shared/contracts'
import { printHtmlPdf } from './html-pdf'
import { readUnicodeCmap } from '../shared/pdf-cmap'
import { fontCssFamily } from '../renderer/src/lib/text-fonts'

// Executed in our isolated Chromium print window, never in the PDF document.
async function layout(request: PageTextRenderRequest): Promise<{ height: number; fallbackUsed: boolean }> {
  const source = request.source
  let native = false, fallbackUsed = false
  if (source) {
    const descriptor = `${request.italic ? 'italic ' : ''}${request.bold ? 'bold ' : ''}${request.size}px NativePageText`
    try { await document.fonts.load(descriptor); native = document.fonts.check(descriptor) } catch { /* Use the local font when an embedded program cannot load. */ }
  }
  const fallback = request.family.replace(/["\\]/g, '')
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!
  const entries = source ? Object.entries(source.unicode).filter(([code]) => source.fontChars[Number(code)] !== undefined).sort((a, b) => b[1].length - a[1].length) : []
  const tokens: Array<{ logical: string; paint: string; native: boolean; width: number }> = []
  const soft = (request.text.match(/\n/g)?.length || 0) <= (request.originalText.match(/\n/g)?.length || 0)
  const cjk = (value: string) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u.test(value)
  let remaining = soft ? request.text.replace(/([^\n])\n(?=[^\n])/g, (_match, before: string, index: number) => before + (cjk(before) && cjk(request.text[index + 2]) ? '' : ' ')) : request.text
  const contextual = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Thai}]/u.test(remaining)
  while (remaining) {
    const entry = native && !contextual ? entries.find(([, value]) => remaining.startsWith(value)) : undefined
    // Keep connected scripts together so Chromium measures and shapes a word,
    // rather than adding isolated letter widths or reversing native glyphs.
    const connected = contextual && remaining.match(/^[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Thai}\p{M}\u200c\u200d]+/u)?.[0]
    context.font = `${request.italic ? 'italic ' : ''}${request.bold ? 'bold ' : ''}${request.size}px ${entry ? 'NativePageText' : fallback}`
    const logical = entry?.[1] || (connected && context.measureText(connected).width * request.scale <= request.width ? connected : '') || [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(remaining)][0].segment
    const code = entry ? Number(entry[0]) : undefined, paint = code === undefined ? logical : String.fromCodePoint(source!.fontChars[code])
    const natural = code === undefined ? context.measureText(logical).width : source!.widths[code] * source!.matrix * request.size
    const width = (natural + request.spacing * (connected ? Array.from(logical).length : 1) + (logical === ' ' ? request.wordSpacing : 0)) * request.scale
    if (logical !== '\n' && width > request.width) throw new Error('ui.nativeTextOverflow')
    if (!entry && logical.trim()) fallbackUsed = true
    tokens.push({ logical, paint, native: Boolean(entry), width: logical === '\n' ? 0 : width }); remaining = remaining.slice(logical.length)
  }
  const lines: typeof tokens[] = []; let line: typeof tokens = [], width = request.firstIndent
  const flush = () => { lines.push(line); line = []; width = 0 }
  for (const token of tokens) {
    if (token.logical === '\n') { flush(); continue }
    if (line.length && width + token.width > request.width) {
      let space = line.length - 1
      while (space >= 0 && !/\s/u.test(line[space].logical)) space--
      const tail = space >= 0 ? line.splice(space + 1) : []
      if (space >= 0) line.pop()
      // Carry the preceding character with closing punctuation, including
      // consecutive closing marks and a break at an extracted PDF space.
      const closing = (value: string) => /^[，。？！：；、）》】」』,.!?:;)}\]]/u.test(value)
      if (!tail.length && closing(token.logical) || tail.length && closing(tail[0].logical)) {
        while (line.length) { tail.unshift(line.pop()!); if (!closing(tail[0].logical)) break }
      }
      if (line.length && /[（《【「『({\[]$/u.test(line.at(-1)!.logical)) tail.unshift(line.pop()!)
      flush(); line = tail; width = tail.reduce((sum, value) => sum + value.width, 0)
    }
    if (!line.length && token.logical === ' ') continue
    const previous = line.at(-1)
    if (previous?.native && token.native) { const adjustment = (request.kerning?.[previous.logical + token.logical] || 0) * request.scale; previous.width += adjustment; width += adjustment }
    line.push(token); width += token.width
  }
  flush()
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg')
  const height = Math.max(request.size * 1.3, request.baseline + (lines.length - 1) * request.leading + request.size * .35) + (request.bottom || 0)
  svg.setAttribute('viewBox', `0 0 ${request.width} ${height}`)
  svg.style.width = `${request.width}pt`; svg.style.height = `${height}pt`
  lines.forEach((values, index) => {
    const total = values.reduce((sum, value) => sum + value.width, 0)
    let x = request.align === 'right' ? request.width - total : request.align === 'center' ? (request.width - total) / 2 : index === 0 ? request.firstIndent : 0
    const y = request.baseline + index * request.leading
    const spaces = values.filter(value => /\s/u.test(value.logical)).length
    const supplement = request.justified && index < lines.length - 1 && spaces ? Math.max(0, request.width - total - x) / spaces : 0
    for (let start = 0; start < values.length;) {
      const end = values[start].native ? start + 1 : (() => { let n = start + 1; while (n < values.length && !values[n].native) n++; return n })()
      const part = values.slice(start, end), text = document.createElementNS(ns, 'text')
      text.textContent = part.map(value => value.paint).join('')
      text.setAttribute('x', String(x / request.scale)); text.setAttribute('y', String(y)); text.setAttribute('transform', `scale(${request.scale},1)`)
      text.style.fontFamily = part[0].native ? 'NativePageText' : fallback; text.style.fontSize = `${request.size}px`
      text.style.fontWeight = request.bold ? 'bold' : 'normal'; text.style.fontStyle = request.italic ? 'italic' : 'normal'; text.style.fill = request.color
      text.style.whiteSpace = 'pre'; text.style.letterSpacing = `${request.spacing}px`; text.style.wordSpacing = `${request.wordSpacing}px`
      if (/^[\s\p{P}]*[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text.textContent)) { text.setAttribute('direction', 'rtl'); text.setAttribute('x', String((x + part.reduce((sum, token) => sum + token.width, 0)) / request.scale)) }
      svg.append(text)
      x += part.reduce((sum, token) => sum + token.width + (/\s/u.test(token.logical) ? supplement : 0), 0); start = end
    }
  })
  document.body.replaceChildren(svg)
  const style = document.createElement('style'); style.textContent = `@page { size:${request.width}pt ${height}pt; margin:0 } body {margin:0} svg {display:block}`; document.head.append(style)
  await document.fonts.ready
  return { height, fallbackUsed }
}

function remapFonts(document: PDFDocument, request: PageTextRenderRequest) {
  const source = request.source, requested = new Set(Array.from(request.text))
  const unicode = new Map(source ? Object.entries(source.unicode).map(([code, value]) => [source.fontChars[Number(code)], value] as const) : [])
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue
    const descriptor = document.context.lookup(object.get(PDFName.of('FontDescriptor')))
    const names = [object.get(PDFName.of('BaseFont')), descriptor instanceof PDFDict ? descriptor.get(PDFName.of('FontName')) : undefined].flatMap(value => value instanceof PDFName ? [value.decodeText()] : [])
    const original = source && names.some(name => name.includes(source.loadedName) || name.replace(/^[A-Z]{6}\+/, '').replace(/\+/g, '_') === source.postscriptName?.replace(/\+/g, '_'))
    const cmap = document.context.lookup(object.get(PDFName.of('ToUnicode')))
    if (!(cmap instanceof PDFRawStream)) continue
    const text = new TextDecoder().decode(decodePDFRawStream(cmap).decode()), pairs = readUnicodeCmap(text)
    const glyphs = [...pairs].map(([id, value]) => {
      const logical = original ? unicode.get(value.codePointAt(0)!) || value : value
      // Chromium can choose the Kangxi-radical alias for a shared CJK glyph.
      // Correct only aliases requested by the edit, preserving full-width text.
      const normalized = logical.normalize('NFKC').replace(/[\u06cc\u06a9]/gu, character => {
        const arabic = character === '\u06cc' ? '\u064a' : '\u0643'
        return !requested.has(character) && requested.has(arabic) ? arabic : character
      })
      const restored = !requested.has(logical) && Array.from(normalized).every(character => requested.has(character)) ? normalized : logical
      return { id, codePoints: Array.from(restored).map(character => character.codePointAt(0)!) }
    }) as Glyph[]
    object.set(PDFName.of('ToUnicode'), document.context.register(document.context.flateStream(createCmap(glyphs, glyph => glyph!.id))))
    if (!original || !source) continue
    const editedName = (source.postscriptName || source.name).replace(/-PDFuckEdit-[\da-f]+$/, '') + '-PDFuckEdit-' + createHash('sha256').update(text + source.loadedName).digest('hex').slice(0, 10)
    object.set(PDFName.of('BaseFont'), PDFName.of(editedName))
    if (descriptor instanceof PDFDict) descriptor.set(PDFName.of('FontName'), PDFName.of(editedName))
    const descendants = document.context.lookup(object.get(PDFName.of('DescendantFonts')))
    if (descendants instanceof PDFArray) { const descendant = document.context.lookup(descendants.get(0)) as PDFDict; descendant.set(PDFName.of('BaseFont'), PDFName.of(editedName)); const descriptor = descendant.lookup(PDFName.of('FontDescriptor'), PDFDict); descriptor.set(PDFName.of('FontName'), PDFName.of(editedName)) }
  }
}

let recent: { key: string; result: Promise<PageTextRenderResult> } | undefined
export function renderPageText(request: PageTextRenderRequest): Promise<PageTextRenderResult> {
  if (!request || typeof request.text !== 'string' || request.text.length > 50000 || typeof request.originalText !== 'string' || typeof request.family !== 'string' || request.family.length > 200 || !/^#[\da-f]{6}$/i.test(request.color) || ![request.width, request.size, request.leading, request.baseline, request.spacing, request.wordSpacing, request.scale, request.firstIndent].every(Number.isFinite) || request.width <= 0 || request.width > 5000 || request.size <= 0 || request.size > 1000 || request.scale <= 0 || request.scale > 10 || request.leading <= 0 || !['left', 'center', 'right'].includes(request.align)) return Promise.reject(new Error('ui.nativeTextUnsupported'))
  if (request.source && (!(request.source.program instanceof Uint8Array) || request.source.program.length > 10_000_000)) return Promise.reject(new Error('ui.nativeTextUnsupported'))
  if (request.bottom !== undefined && (!Number.isFinite(request.bottom) || request.bottom < 0 || request.bottom > 1000)) return Promise.reject(new Error('ui.nativeTextUnsupported'))
  if (request.source && (!Number.isFinite(request.source.matrix) || request.source.matrix <= 0 || typeof request.source.name !== 'string' || typeof request.source.loadedName !== 'string' || !request.source.unicode || !request.source.widths || !request.source.fontChars || Object.entries(request.source.unicode).some(([code, text]) => typeof text !== 'string' || !Number.isFinite(request.source!.widths[Number(code)]) || request.source!.fontChars[Number(code)] !== undefined && (!Number.isInteger(request.source!.fontChars[Number(code)]) || request.source!.fontChars[Number(code)] < 0 || request.source!.fontChars[Number(code)] > 0x10ffff)))) return Promise.reject(new Error('ui.nativeTextUnsupported'))
  const key = createHash('sha256').update(JSON.stringify({ ...request, source: request.source ? { ...request.source, program: undefined } : undefined })).update(request.source?.program || '').digest('hex')
  if (recent?.key === key) return recent.result
  const result = (async () => {
    let measured = { height: request.size, fallbackUsed: false }
    const face = request.source ? `@font-face{font-family:NativePageText;font-weight:${request.bold ? 700 : 400};font-style:${request.italic ? 'italic' : 'normal'};src:url(data:font/ttf;base64,${Buffer.from(request.source.program).toString('base64')})}` : ''
    const pdf = await printHtmlPdf('', face, async contents => {
      const data = JSON.stringify({ ...request, family: fontCssFamily(request.family), source: request.source ? { ...request.source, program: undefined } : undefined })
      const value = await contents.executeJavaScript(`(async()=>{try{return await (${layout.toString()})(${data})}catch(error){return {error:String(error),stack:error.stack}}})()`)
      if (value.error) throw new Error(value.error + '\n' + value.stack)
      measured = value
    })
    const parsed = await PDFDocument.load(pdf)
    if (parsed.getPageCount() !== 1) throw new Error('ui.nativeTextOverflow')
    remapFonts(parsed, request)
    for (const page of parsed.getPages()) {
      const content = page.node.Contents(), streams = content instanceof PDFArray ? content.asArray().map(ref => parsed.context.lookup(ref)) : [content]
      for (const [index, stream] of streams.entries()) if (stream instanceof PDFRawStream) {
        const instructions = new TextDecoder().decode(decodePDFRawStream(stream).decode())
        // Chrome wraps alias glyphs in ActualText spans. Our corrected CMap
        // already restores Unicode; these redundant per-letter spans make PDF
        // readers split connected Arabic words into individual reversed items.
        const joined = instructions.replace(/\/Span\s*<<\s*\/ActualText\s*<[\da-f\s]*>\s*>>\s*BDC([\s\S]*?)\bEMC/gi, '$1')
        if (joined !== instructions) {
          const replacement = parsed.context.register(parsed.context.flateStream(joined))
          if (content instanceof PDFArray) content.set(index, replacement)
          else page.node.set(PDFName.of('Contents'), replacement)
        }
      }
    }
    return { pdf: await parsed.save(), width: request.width, ...measured }
  })()
  recent = { key, result }; result.catch(() => { if (recent?.key === key) recent = undefined })
  return result
}
