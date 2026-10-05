import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { renderToStaticMarkup } from 'react-dom/server'
import { MARKDOWN_TEMPLATES, normalizeMarkdownOptions, type MarkdownDocument, type MarkdownTemplate } from '../../../shared/markdown'

export const MARKDOWN_PREFERENCES_KEY = 'pdfuck.markdown.v1'
export type MarkdownView = 'both' | 'source' | 'pdf'
export function normalizeMarkdownView(value: unknown): MarkdownView { return value === 'source' || value === 'pdf' ? value : 'both' }
export function normalizeMarkdownRatio(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(20, Math.min(80, value)) : 42 }
function readMarkdownPreferences(): Record<string, unknown> {
  let value: Record<string, unknown> = {}
  try { value = JSON.parse(localStorage.getItem(MARKDOWN_PREFERENCES_KEY) || '{}') || {} } catch { /* Use defaults. */ }
  return typeof value === 'object' && !Array.isArray(value) ? value : {}
}
function templateOptions(value: Record<string, unknown>, template: MarkdownTemplate) {
  const current = normalizeMarkdownOptions(value.options as MarkdownDocument['options'] | undefined)
  if (current.template === template) return current
  const templates = value.templates as Partial<Record<MarkdownTemplate, MarkdownDocument['options']>> | undefined
  return normalizeMarkdownOptions({ ...templates?.[template], template })
}
export function loadMarkdownTemplateOptions(template: MarkdownTemplate) {
  return templateOptions(readMarkdownPreferences(), template)
}
export function loadMarkdownPreferences() {
  const value = readMarkdownPreferences()
  return { view: normalizeMarkdownView(value.view), ratio: normalizeMarkdownRatio(value.ratio), options: normalizeMarkdownOptions(value.options as MarkdownDocument['options'] | undefined) }
}
export function saveMarkdownPreferences(value: Partial<ReturnType<typeof loadMarkdownPreferences>>): void {
  try {
    const stored = readMarkdownPreferences(), next = { ...loadMarkdownPreferences(), ...value }
    next.options = normalizeMarkdownOptions(next.options)
    const templates = Object.fromEntries(MARKDOWN_TEMPLATES.map(template => [template, templateOptions(stored, template)]))
    templates[next.options.template] = next.options
    localStorage.setItem(MARKDOWN_PREFERENCES_KEY, JSON.stringify({ ...next, templates }))
  } catch { /* Editing remains usable when storage is unavailable. */ }
}
export function markdownHtml(source: string): string {
  return renderToStaticMarkup(<article dir="auto"><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={(url, key) => key === 'src' && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(url) ? url : defaultUrlTransform(url)} components={{ img: props => <img {...props} loading="eager" />, p: props => <p dir="auto" {...props} />, h1: props => <h1 dir="auto" {...props} />, h2: props => <h2 dir="auto" {...props} />, li: props => <li dir="auto" {...props} /> }}>{source}</Markdown></article>)
}
export const MARKDOWN_INSERT_TYPES = ['heading', 'bold', 'italic', 'strike', 'inline_code', 'list', 'ordered', 'task', 'quote', 'code', 'link', 'image', 'table', 'rule'] as const
export type MarkdownInsertType = typeof MARKDOWN_INSERT_TYPES[number]
export interface MarkdownInsertionOptions { level?: number; language?: string; rows?: number; columns?: number }
export function markdownInsertion(source: string, start: number, end: number, type: MarkdownInsertType, text: string, address = '', options: MarkdownInsertionOptions = {}): { source: string; start: number; end: number } {
  const selected = source.slice(start, end), content = text || selected
  let value: string, offset = 0
  if (type === 'bold' || type === 'italic' || type === 'strike' || type === 'inline_code') {
    const marker = type === 'bold' ? '**' : type === 'italic' ? '*' : type === 'strike' ? '~~' : '`'.repeat(Math.max(0, ...(content.match(/`+/g) || []).map(run => run.length)) + 1)
    const padding = type === 'inline_code' && /^`|`$|^ | $/.test(content) ? ' ' : ''
    value = `${marker}${padding}${content}${padding}${marker}`; offset = marker.length + padding.length
  }
  else if (type === 'link' || type === 'image') { value = `${type === 'image' ? '!' : ''}[${content.replace(/([\[\]\\])/g, '\\$1')}](${address.replace(/[\r\n]/g, '').replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29') || 'https://example.com'})`; offset = type === 'image' ? 2 : 1 }
  else {
    const prefix = { heading: '#'.repeat(Math.max(1, Math.min(6, options.level || 2))) + ' ', list: '- ', ordered: '1. ', task: '- [ ] ', quote: '> ' }
    const fence = '`'.repeat(Math.max(2, ...(content.match(/`+/g) || []).map(run => run.length)) + 1)
    const language = /^[\w+-]{0,32}$/.test(options.language || '') ? options.language || '' : ''
    if (type === 'code') value = `${fence}${language}\n${content}\n${fence}`
    else if (type === 'rule') value = '---'
    else if (type === 'table') {
      const rows = Math.max(1, Math.min(8, options.rows || 2)), columns = Math.max(1, Math.min(8, options.columns || 2))
      const lines = content.split('\n').map(line => line.split('|').map(cell => cell.trim()))
      const row = (cells: string[]) => '| ' + Array.from({ length: columns }, (_, index) => cells[index] || '…').join(' | ') + ' |'
      value = [row(lines[0] || []), row(Array(columns).fill('---')), ...Array.from({ length: rows }, (_, index) => row(lines[index + 1] || []))].join('\n')
    } else value = content.split('\n').map((line, index) => `${type === 'ordered' ? `${index + 1}. ` : prefix[type as keyof typeof prefix]}${line}`).join('\n')
    const before = source.slice(0, start), after = source.slice(end)
    const pad = before && !before.endsWith('\n\n') ? before.endsWith('\n') ? '\n' : '\n\n' : ''
    value = `${pad}${value}${after && !after.startsWith('\n\n') ? after.startsWith('\n') ? '\n' : '\n\n' : ''}`
    offset = pad.length + (type === 'code' ? fence.length + language.length + 1 : type === 'table' ? 2 : type === 'rule' ? 0 : prefix[type as keyof typeof prefix].length)
  }
  return { source: source.slice(0, start) + value + source.slice(end), start: start + offset, end: Math.min(start + value.length, start + offset + (type === 'rule' ? 3 : content.length)) }
}
