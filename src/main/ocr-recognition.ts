import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream, concatTransformationMatrix, pushGraphicsState, popGraphicsState } from 'pdf-lib'
import { PSM, type Worker, type Page } from 'tesseract.js'
import type { OcrPageResult } from '../shared/ocr'
import { normalizeTextSpacing } from '../shared/text-spacing'

const decodeWord = (hex: string) => Buffer.from(hex, 'hex').swap16().toString('utf16le')

/** Only Tesseract's generated GlyphLessFont stream: convert reflected RTL words to visual order. */
function normalizeOcrRtl(source: string): string {
  let matrix = [1, 0, 0, 1, 0, 0], size = 0, scale = 100
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return source.replace(/((?:[-\d.]+\s+){6})Tm|([-\d.]+)\s+([-\d.]+)\s+Td|\/\S+\s+([-\d.]+)\s+Tf|([-\d.]+)\s+Tz|\[\s*<([0-9a-f]+)>\s*\]\s*TJ/gi, (token, tm, dx, dy, fontSize, stretch, hex) => {
    if (tm) matrix = tm.trim().split(/\s+/).map(Number)
    else if (dx !== undefined) { matrix[4] += matrix[0] * Number(dx) + matrix[2] * Number(dy); matrix[5] += matrix[1] * Number(dx) + matrix[3] * Number(dy) }
    else if (fontSize) size = Number(fontSize)
    else if (stretch) scale = Number(stretch)
    else if (hex && matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0) {
      const text = decodeWord(hex).trimEnd()
      if (!/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text)) return token
      const visual = [...graphemes.segment(text)].map(part => part.segment).reverse().join('').replace(/[0-9٠-٩۰-۹]+/gu, digits => Array.from(digits).reverse().join(''))
      // GlyphLessFont has a fixed 500-unit advance; Tesseract excludes its appended space from word width.
      const width = Array.from(text).length * size * scale / 200
      const [a, b, c, d, x, y] = matrix
      const encoded = Buffer.from(visual, 'utf16le').swap16().toString('hex')
      return `${[-a, -b, c, d, x + a * width, y + b * width].join(' ')} Tm [ <${encoded}> ] TJ ${matrix.join(' ')} Tm`
    }
    return token
  })
}

/** Tesseract's own UCS-2 text renderer appends a space to each word, including CJK characters. */
export async function normalizeOcrPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes)
  let changed = false
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents()
    const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : []
    for (const ref of streams) {
      const stream = pdf.context.lookup(ref)
      if (!(stream instanceof PDFRawStream)) continue
      const source = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')
      let next = normalizeOcrRtl(source)
      const words = [...next.matchAll(/\[\s*<([0-9A-Fa-f]+)>\s*\]\s*TJ/g)]
      for (let i = words.length - 2; i >= 0; i--) {
        const match = words[i], text = decodeWord(match[1]), following = decodeWord(words[i + 1][1])
        if (!text.endsWith(' ')) continue
        const left = Array.from(text.trimEnd()).at(-1) || '', right = Array.from(following)[0] || ''
        if (normalizeTextSpacing(`${left} ${right}`) !== left + right) continue
        const replacement = match[0].replace(/0020(?=>)/i, '')
        next = next.slice(0, match.index) + replacement + next.slice(match.index + match[0].length)
      }
      if (next !== source) {
        // Word positions use Td/Tm, so deleting the trailing space preserves every glyph's position.
        const replacement = pdf.context.flateStream(Buffer.from(next, 'latin1'))
        if (contents instanceof PDFArray) pdf.context.assign(ref as import('pdf-lib').PDFRef, replacement)
        else page.node.set(PDFName.of('Contents'), pdf.context.register(replacement))
        changed = true
      }
    }
  }
  return changed ? pdf.save() : bytes
}

/** Undo the engine's deskew around the raster centre, including any expanded canvas. */
export async function restoreOcrGeometry(bytes: Uint8Array, width: number, height: number, angle: number): Promise<Uint8Array> {
  if (!angle) return bytes
  const pdf = await PDFDocument.create(), [text] = await pdf.embedPdf(bytes)
  const w = width * 72 / 300, h = height * 72 / 300, c = Math.cos(angle), s = Math.sin(angle)
  const page = pdf.addPage([w, h])
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(c, s, -s, c, w / 2 - c * text.width / 2 + s * text.height / 2, h / 2 - s * text.width / 2 - c * text.height / 2))
  page.drawPage(text); page.pushOperators(popGraphicsState())
  return pdf.save()
}

export async function recognizeRaster(worker: Worker, image: Uint8Array): Promise<OcrPageResult> {
  const recognize = async (psm: PSM, threshold: string): Promise<Page> => {
    await worker.setParameters({ tessedit_pageseg_mode: psm, user_defined_dpi: '300', preserve_interword_spaces: '0', thresholding_method: threshold })
    return (await worker.recognize(Buffer.from(image), { pdfTextOnly: true, rotateAuto: true }, { text: true, pdf: true })).data
  }
  let best = await recognize(PSM.AUTO, '0')
  const count = (page: Page) => Array.from(page.text.replace(/\s/gu, '')).length
  // ponytail: at most two passes; a dedicated layout model is needed for complex tables/handwriting.
  if (!count(best) || best.confidence < 82) {
    try {
      const sparse = count(best) < 80
      const candidate = await recognize(sparse ? PSM.SPARSE_TEXT : PSM.AUTO, sparse ? '0' : '2')
      // A tiny high-confidence fragment must not replace a mostly complete page.
      if (count(candidate) >= Math.max(1, count(best) * .85) && (!count(best) || candidate.confidence > best.confidence + 2)) best = candidate
    } catch { if (!count(best)) throw new Error('ocr.failed') }
  }
  const characters = count(best)
  if (characters && !best.pdf?.length) throw new Error('ocr.invalidResult')
  const header = Buffer.from(image.subarray(16, 24))
  return { characters, ...(characters ? { pdf: await restoreOcrGeometry(await normalizeOcrPdf(Uint8Array.from(best.pdf!)), header.readUInt32BE(0), header.readUInt32BE(4), best.rotateRadians || 0) } : {}) }
}
