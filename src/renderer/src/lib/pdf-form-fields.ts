import { getDocument, PDFJS_CMAP_URL, PDFJS_STANDARD_FONTS_URL, PDFJS_WASM_URL } from './pdfjs'
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFTextField, StandardFonts, decodePDFRawStream } from 'pdf-lib'
import type { PageTextRenderRequest, PageTextRenderResult } from '../../../shared/contracts'

export interface FormFieldEdit { pageIndex: number; id: string; value: string }

/** Use the latest document, never the viewer's possibly older annotation storage. */
export async function writeFormField(bytes: Uint8Array, edit: FormFieldEdit, render: (request: PageTextRenderRequest) => Promise<PageTextRenderResult>): Promise<Uint8Array> {
  const task = getDocument({ data: bytes.slice(), cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDFJS_STANDARD_FONTS_URL, wasmUrl: PDFJS_WASM_URL })
  try {
    const pdf = await task.promise
    if (!Number.isInteger(edit.pageIndex) || edit.pageIndex < 0 || edit.pageIndex >= pdf.numPages) throw new Error('form.invalidField')
    const page = await pdf.getPage(edit.pageIndex + 1)
    const fields = await page.getAnnotations({ intent: 'display' })
    const field = fields.find(field => field.id === edit.id && field.fieldType === 'Tx')
    if (!field || field.readOnly || field.password || field.hidden || field.noView || typeof edit.value !== 'string' || (field.maxLen > 0 && edit.value.length > field.maxLen)) throw new Error('form.invalidField')
    if (edit.value === (field.fieldValue || '')) return bytes
    const objects = await pdf.getFieldObjects()
    const siblings = objects?.[field.fieldName] || [field]
    for (const sibling of siblings) {
      if (sibling.id) pdf.annotationStorage.setValue(sibling.id, { value: edit.value })
    }
    const saved = await pdf.saveDocument()
    const document = await PDFDocument.load(saved, { updateMetadata: false })
    let repaired = false
    const standards: Record<string, StandardFonts> = { ...Object.fromEntries(Object.values(StandardFonts).map(name => [name, name])), Helv: StandardFonts.Helvetica, TiRo: StandardFonts.TimesRoman, Cour: StandardFonts.Courier, ZaDb: StandardFonts.ZapfDingbats }
    for (const widget of document.getForm().getTextField(field.fieldName).acroField.getWidgets()) {
      const appearance = widget.dict.lookupMaybe(PDFName.of('AP'), PDFDict)?.lookup(PDFName.of('N'))
      if (!(appearance instanceof PDFRawStream)) continue
      const resources = appearance.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) || document.context.obj({})
      const fonts = resources.lookupMaybe(PDFName.of('Font'), PDFDict) || document.context.obj({})
      // Missing original AP resources make PDF.js' standard-font fallback implicit; save it explicitly.
      const content = new TextDecoder('latin1').decode(decodePDFRawStream(appearance).decode())
      for (const [, name] of content.matchAll(/\/([^\s()[\]<>/%]+)\s+[-\d.]+\s+Tf\b/g)) {
        if (!standards[name] || fonts.has(PDFName.of(name))) continue
        fonts.set(PDFName.of(name), (await document.embedFont(standards[name])).ref)
        resources.set(PDFName.of('Font'), fonts); appearance.dict.set(PDFName.of('Resources'), resources); repaired = true
      }
    }
    const missing = document.getForm().getFields().flatMap(field => field instanceof PDFTextField && !field.isPassword() && field.getText()
      ? field.acroField.getWidgets().filter(widget => !widget.dict.lookupMaybe(PDFName.of('AP'), PDFDict)?.has(PDFName.of('N'))).map(widget => ({ field, widget })) : [])
    if (!missing.length) return repaired ? document.save({ useObjectStreams: false, updateFieldAppearances: false }) : saved
    // PDF.js deliberately omits AP when the original font cannot encode new glyphs.
    // Embed our existing native text renderer's fonts in the widget, keeping /V editable.
    const annotations = (await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => (await pdf.getPage(index + 1)).getAnnotations({ intent: 'any' })))).flat()
    for (const { field: textField, widget } of missing) {
      const ref = document.context.getObjectRef(widget.dict)
      const data = annotations.find(annotation => annotation.id === `${ref?.objectNumber}R${ref?.generationNumber || ''}`)
      if (!data) throw new Error('form.invalidField')
      const rect = widget.getRectangle(), rotation = data.rotation || 0, swap = rotation % 180 !== 0
      const width = swap ? rect.height : rect.width, height = swap ? rect.width : rect.height
      if (![width, height].every(value => Number.isFinite(value) && value > 4 && value <= 5000)) throw new Error('form.invalidField')
      const text = textField.getText()!, fontSize = Math.min(data.defaultAppearanceData.fontSize || 12, (height - 2) / 1.35)
      const color = '#' + Array.from(data.defaultAppearanceData.fontColor as Uint8ClampedArray).map(value => value.toString(16).padStart(2, '0')).join('')
      const result = await render({ text, originalText: '', width: width - 4, size: fontSize, color, family: 'Arial', bold: false, italic: false,
        align: (['left', 'center', 'right'] as const)[data.textAlignment || 0], leading: fontSize * 1.35, baseline: fontSize, spacing: 0, wordSpacing: 0, scale: 1, firstIndent: 0 })
      const [embedded] = await document.embedPdf(result.pdf, [0]); await embedded.embed()
      const rgb = (values: Uint8ClampedArray) => Array.from(values, value => value / 255).join(' ')
      const border = Math.max(0, Math.min(data.borderStyle.width || 0, width / 2, height / 2))
      const background = data.backgroundColor ? `${rgb(data.backgroundColor)} rg 0 0 ${width} ${height} re f` : ''
      const stroke = border && data.borderColor ? `${rgb(data.borderColor)} RG ${border} w ${border / 2} ${border / 2} ${width - border} ${height - border} re S` : ''
      const scale = data.defaultAppearanceData.fontSize ? 1 : Math.min(1, (height - 2) / result.height)
      const y = data.multiLine ? height - 1 - result.height * scale : (height - result.height * scale) / 2
      const matrix = rotation === 90 ? [0, 1, -1, 0, rect.width, 0] : rotation === 180 ? [-1, 0, 0, -1, rect.width, rect.height] : rotation === 270 ? [0, -1, 1, 0, 0, rect.height] : [1, 0, 0, 1, 0, 0]
      const appearance = document.context.flateStream(`q ${background} ${stroke} 0 0 ${width} ${height} re W n ${scale} 0 0 ${scale} 2 ${y} cm /Text Do Q`, {
        Type: 'XObject', Subtype: 'Form', BBox: [0, 0, width, height], Matrix: matrix, Resources: { XObject: { Text: embedded.ref } }
      })
      widget.dict.set(PDFName.of('AP'), document.context.obj({ N: document.context.register(appearance) }))
    }
    document.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)?.delete(PDFName.of('NeedAppearances'))
    return await document.save({ useObjectStreams: false, updateFieldAppearances: false })
  } finally { await task.destroy() }
}

const pendingFormEdits = new Set<Promise<boolean>>()

export function trackFormFieldEdit(edit: Promise<boolean>): void {
  pendingFormEdits.add(edit)
  void edit.finally(() => pendingFormEdits.delete(edit))
}

/** Native controls must commit before app commands inspect dirty state or save bytes. */
export async function commitFocusedFormField(): Promise<boolean> {
  const element = document.activeElement
  if (element instanceof HTMLElement && element.closest('.pdf-form-fields')) element.blur()
  while (pendingFormEdits.size) await Promise.all([...pendingFormEdits])
  return !document.querySelector('.pdf-form-fields [data-failed="true"]')
}
