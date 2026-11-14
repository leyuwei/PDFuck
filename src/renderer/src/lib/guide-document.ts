import { MARKDOWN_PRESETS } from '../../../shared/markdown'
import { translateMessage, type InterfaceLanguage } from '../../../shared/i18n-catalogue'
import { PdfDocumentModel } from './pdf-document'

export function practiceHtml(language: InterfaceLanguage): string {
  const text = (key: Parameters<typeof translateMessage>[1]) => translateMessage(language, key).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const section = (title: string, body: string, index: number) => `<section style="${index ? 'break-before:page;' : ''}padding:20px 10px"><p style="color:#5575de">PDFuck · ${text('tour.practice')} · ${index + 1}</p><h1>${title}</h1><p style="font-size:16pt;line-height:2">${body}</p><div style="margin-top:48px;padding:22px;border:2px solid #dce5f8;border-radius:12px"><h2>${text('tour.article')}</h2><p>${text('tour.paragraph')}</p></div></section>`
  return `<div lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">${section(text('tour.reading'), text('tour.paragraph'), 0)}${section(text('tour.editing'), text('tour.editParagraph'), 1)}${section(text('tour.saving'), text('tour.paragraph'), 2)}</div>`
}
export async function createPracticeDocument(language: InterfaceLanguage): Promise<PdfDocumentModel> {
  const text = (key: Parameters<typeof translateMessage>[1]) => translateMessage(language, key)
  const bytes = await window.desktop.renderMarkdown({ html: practiceHtml(language), sourcePath: 'PDFuck-Practice.md', options: MARKDOWN_PRESETS.clean, unsaved: true })
  const model = await PdfDocumentModel.load(bytes, undefined, `${text('tour.practice')}.pdf`)
  await model.replaceBookmarks(['tour.reading', 'tour.editing', 'tour.saving'].map((key, pageIndex) => ({ id: `practice-${pageIndex}`, title: text(key as 'tour.reading'), pageIndex, position: 0, open: true, children: [] })))
  await model.addAnnotation(0, 'note', [{ x: 550, y: 150, width: 20, height: 20 }], text('tour.note'), { x: 550, y: 150 }, undefined, undefined, text('tour.author'))
  return PdfDocumentModel.load(model.bytes, undefined, model.fileName)
}
