export const MARKDOWN_TEMPLATES = ['clean', 'academic', 'business', 'editorial', 'technical'] as const
export type MarkdownTemplate = typeof MARKDOWN_TEMPLATES[number]
export const MARKDOWN_FONTS = ['sans', 'serif', 'mono'] as const
export interface MarkdownOptions {
  template: MarkdownTemplate
  font: typeof MARKDOWN_FONTS[number]
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
}
export const MARKDOWN_PRESETS: Record<MarkdownTemplate, MarkdownOptions> = {
  clean: { template: 'clean', font: 'sans', fontSize: 11, lineHeight: 1.65, paragraphSpacing: 8 },
  academic: { template: 'academic', font: 'serif', fontSize: 12, lineHeight: 1.8, paragraphSpacing: 6 },
  business: { template: 'business', font: 'sans', fontSize: 11, lineHeight: 1.55, paragraphSpacing: 8 },
  editorial: { template: 'editorial', font: 'serif', fontSize: 12, lineHeight: 1.75, paragraphSpacing: 10 },
  technical: { template: 'technical', font: 'sans', fontSize: 10, lineHeight: 1.6, paragraphSpacing: 7 }
}
export const MAX_MARKDOWN_LENGTH = 5 * 1024 * 1024
export const TEXT_ENCODINGS = ['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'gb18030', 'big5', 'shift_jis', 'euc-kr', 'windows-1251', 'windows-1252'] as const
export type TextEncoding = typeof TEXT_ENCODINGS[number]
export type TextLineEnding = '\n' | '\r\n' | '\r'
export function isTextLineEnding(value: unknown): value is TextLineEnding { return value === '\n' || value === '\r\n' || value === '\r' }
export function isTextEncoding(value: unknown): value is TextEncoding { return TEXT_ENCODINGS.includes(value as TextEncoding) }
export function isTextPath(path: string): boolean { return /\.(md|txt)$/i.test(path) }
export function documentType(path = ''): 'TXT' | 'Markdown' | 'PDF' { return /\.txt$/i.test(path) ? 'TXT' : isMarkdownPath(path) ? 'Markdown' : 'PDF' }
export function sourceDirty(document: MarkdownDocument): boolean { return Boolean(document.unsaved) || document.source !== document.savedSource || (document.encoding || 'utf-8') !== (document.savedEncoding || 'utf-8') }
export interface MarkdownDocument {
  /** The display path has no file on disk until the first successful source save. */
  unsaved?: boolean
  path: string
  source: string
  savedSource: string
  encoding?: TextEncoding
  savedEncoding?: TextEncoding
  lineEnding?: TextLineEnding
  options: MarkdownOptions
  renderedKey: string
  /** PDF edits, including already exported edits, must survive source typing. */
  pdfModified?: boolean
}
export interface MarkdownRenderRequest { html: string; sourcePath: string; options: MarkdownOptions; unsaved?: boolean }
export interface SaveMarkdownRequest { source: string; currentPath: string; saveAs?: boolean; encoding?: TextEncoding; lineEnding?: TextLineEnding }
export function isMarkdownPath(path: string): boolean { return /\.md$/i.test(path) }
export function isDocumentPath(path: string): boolean { return /\.(pdf|md|txt)$/i.test(path) }
export function normalizeMarkdownOptions(value: Partial<MarkdownOptions> | null = {}): MarkdownOptions {
  value = value && typeof value === 'object' ? value : {}
  const template = MARKDOWN_TEMPLATES.includes(value.template!) ? value.template! : 'clean'
  const preset = MARKDOWN_PRESETS[template]
  const number = (v: number | undefined, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
  return { template, font: MARKDOWN_FONTS.includes(value.font!) ? value.font! : preset.font,
    fontSize: number(value.fontSize, 8, 24, preset.fontSize), lineHeight: number(value.lineHeight, 1.2, 2.4, preset.lineHeight),
    paragraphSpacing: number(value.paragraphSpacing, 0, 24, preset.paragraphSpacing) }
}
export function markdownRenderKey(document: Pick<MarkdownDocument, 'source' | 'options'> & { path?: string }): string { return JSON.stringify([document.path, document.source, document.options]) }
