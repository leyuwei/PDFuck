import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { isMarkdownPath, MAX_MARKDOWN_LENGTH, normalizeMarkdownOptions, type MarkdownOptions, type MarkdownRenderRequest } from '../shared/markdown'
import { printHtmlPdf } from './html-pdf'

export async function readMarkdown(path: string): Promise<string> {
  if (!isMarkdownPath(path) || (await stat(path)).size > MAX_MARKDOWN_LENGTH) throw new Error('md.invalid')
  try { return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path)) }
  catch { throw new Error('md.invalid') }
}

const families = {
  sans: 'Arial,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans",sans-serif',
  serif: 'Georgia,"Times New Roman","Songti SC",SimSun,"Noto Serif",serif',
  mono: 'Consolas,Menlo,"Noto Sans Mono","Microsoft YaHei",monospace'
}
const accents = { clean: '#3157b5', academic: '#263247', business: '#08786f', editorial: '#94502e', technical: '#5e42a6' }
const templateStyles: Record<MarkdownOptions['template'], string> = {
  clean: `
    h1 { border-bottom: 2px solid #e3e9f5; padding-bottom: .35em }
    h2 { border-bottom: 1px solid #e3e9f5; padding-bottom: .2em }
    blockquote { background: #f1f5fd; border-radius: 0 5px 5px 0; color: #3f5275 }
    pre { border-color: #e0e6f0; background: #f6f8fc }
    th { background: #edf2fc; color: #3157b5 }
    tbody tr:nth-child(even) { background: #fafbfe }
    li::marker { color: #3157b5 }
  `,
  academic: `
    h1 { text-align: center; font-size: 1.8em; padding-bottom: .5em; border-bottom: 2px solid #263247 }
    h2 { border-bottom: 1px solid #a4afbe; padding-bottom: .25em }
    h3 { font-style: italic }
    blockquote { border: 0; border-block: 1px solid #a4afbe; padding: .7em 1.3em; background: #fafafa; color: #465164 }
    pre { border: 1px solid #a4afbe; border-radius: 0; background: #fafafa }
    code { background: #f0f1f3; border-radius: 0 }
    th,td { border: 0; border-bottom: 1px solid #d8dde5 }
    th { border-block: 2px solid #263247; background: #fff; color: #263247 }
    tbody tr:last-child td { border-bottom: 2px solid #263247 }
    hr { width: 60%; margin-inline: auto; border-color: #a4afbe }
  `,
  business: `
    h1 { border-top: 6px solid #08786f; padding-top: .5em }
    h2 { padding: .35em .6em; background: #e9f4f1; border-inline-start: 4px solid #08786f; border-radius: 3px }
    h3 { color: #285c57 }
    blockquote { padding: .8em 1em; border-inline-start-width: 5px; background: #e9f4f1; border-radius: 4px; color: #285c57 }
    pre { background: #f1f6f5; border-color: #bbd7d0; border-radius: 6px }
    code { background: #e9f4f1; color: #285c57 }
    th { background: #08786f; color: #fff; border-color: #08786f }
    td { border-color: #bbd7d0 } tbody tr:nth-child(even) { background: #f0f7f5 }
    li::marker { color: #08786f; font-weight: bold }
    hr { border-top: 2px solid #08786f }
  `,
  editorial: `
    h1 { font-size: 2.6em; letter-spacing: -.025em; border-bottom: 3px double #bc957b; padding-bottom: .3em }
    h2 { font-weight: 500; font-style: italic; padding-bottom: .2em; border-bottom: 1px solid #dcc7b8 }
    article > h1:first-child + p { color: #705749; font-size: 1.08em }
    blockquote { border: 0; border-inline-start: 2px solid #bc957b; padding: .7em 1.2em; font-style: italic; font-size: 1.12em; color: #94502e; background: #faf5f0 }
    pre { background: #faf7f2; border: 0; border-inline-start: 2px solid #bc957b; border-radius: 0 }
    code { background: #f5ede4; color: #705749 }
    th,td { border: 0; border-bottom: 1px solid #dcc7b8 }
    th { background: #f5ede4; color: #705749; font-weight: 600 }
    hr { width: 25%; margin-inline: auto; border-top: 3px double #bc957b }
  `,
  technical: `
    h1,h2,h3 { font-family: ${families.sans} }
    h1 { border-bottom: 3px solid #5e42a6; padding-bottom: .3em }
    h2 { border-inline-start: 4px solid #5e42a6; padding: .3em .6em; background: #f1edfa; border-radius: 0 4px 4px 0 }
    h3 { font-family: ${families.mono}; font-size: 1.1em }
    blockquote { border: 1px solid #d3c6ed; border-inline-start: 4px solid #5e42a6; background: #f6f3fc; color: #52416e; border-radius: 4px }
    pre { background: #242735; color: #f0eef8; border-color: #242735; border-radius: 6px }
    code { background: #eee8f9; color: #5e42a6; border-radius: 3px }
    pre code { color: inherit }
    th { background: #e9e1f6; color: #52416e; font-family: ${families.mono} }
    th,td { border-color: #d3c6ed } tbody tr:nth-child(even) { background: #faf8fe }
    li::marker { color: #5e42a6 } hr { border-top: 1px dashed #a895cb }
  `
}
export function markdownPrintCss(options: MarkdownOptions): string {
  const o = normalizeMarkdownOptions(options)
  return `
    @page { size: A4; margin: 18mm 18mm 20mm }
    @page { @bottom-center { content: counter(page) " / " counter(pages); font: 9pt Arial, sans-serif; color: #68768d } }
    * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact }
    body { margin: 0; font: ${o.fontSize}pt/${o.lineHeight} ${families[o.font]}; color: #232937; overflow-wrap: anywhere }
    article { white-space: normal }
    p, ul, ol, pre, table, blockquote { margin-block: 0 ${o.paragraphSpacing}pt }
    h1,h2,h3,h4,h5,h6 { color: ${accents[o.template]}; line-height: 1.3; margin: 1.3em 0 .6em; break-after: avoid; page-break-after: avoid }
    h1 { font-size: 2em; margin-top: 0 } h2 { font-size: 1.5em } h3 { font-size: 1.2em } h4,h5,h6 { font-size: 1em }
    p { orphans: 3; widows: 3 } a { color: ${accents[o.template]}; text-decoration: underline; overflow-wrap: anywhere }
    ul,ol { padding-inline-start: 1.8em } li > p { margin-bottom: .3em } li { margin-block: .25em }
    blockquote { margin-inline: 0; border-inline-start: 3px solid ${accents[o.template]}; padding: .5em 1em; background: #f5f6f8 }
    blockquote > :last-child { margin-bottom: 0 }
    pre { font: .88em/1.5 ${families.mono}; white-space: pre-wrap; overflow-wrap: anywhere; padding: 1em; background: #f3f5f8; border: 1px solid #dce1e9; border-radius: 4px }
    code { font-family: ${families.mono}; font-size: .9em; background: #f3f5f8; padding: .1em .25em } pre code { font: inherit; padding: 0; background: transparent }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: .9em }
    th,td { padding: .55em .65em; border: 1px solid #d6dce5; vertical-align: top; overflow-wrap: anywhere }
    th { background: #edf1f6; text-align: start } thead { display: table-header-group } tr { break-inside: avoid }
    img { max-width: 100%; max-height: 230mm; object-fit: contain; break-inside: avoid; vertical-align: middle }
    hr { border: 0; border-top: 1px solid #cdd5df; margin: 1.5em 0 } input[type=checkbox] { accent-color: ${accents[o.template]} }
    .image-unavailable { display: inline-block; padding: .5em; border: 1px dashed #b0bacb; color: #647087 }
    ${templateStyles[o.template]}
  `
}

function imageMime(bytes: Uint8Array): string | undefined {
  const hex = Buffer.from(bytes.subarray(0, 12)).toString('hex')
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png'
  if (hex.startsWith('ffd8ff')) return 'image/jpeg'
  if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) return 'image/gif'
  if (hex.startsWith('52494646') && hex.endsWith('57454250')) return 'image/webp'
  return undefined
}
function decodeAttribute(value: string): string { return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>') }
export async function inlineMarkdownImages(html: string, sourcePath: string): Promise<string> {
  const root = await realpath(dirname(sourcePath))
  const tags = [...html.matchAll(/<img\b[^>]*>/gi)]
  // Process sequentially to bound disk reads and base64 memory for image-heavy documents.
  for (const match of tags) {
    const tag = match[0], src = decodeAttribute(tag.match(/\bsrc="([^"]*)"/i)?.[1] || '')
    let data: string | undefined
    try {
      if (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(src) && src.length < 28_000_000) {
        const bytes = Buffer.from(src.slice(src.indexOf(',') + 1), 'base64'), mime = imageMime(bytes)
        if (mime) data = `data:${mime};base64,${bytes.toString('base64')}`
      } else if (src && !/^(?:[a-z][\w+.-]*:|[/\\])/i.test(src)) {
        const file = await realpath(resolve(root, decodeURIComponent(src))), rel = relative(root, file)
        if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`) && (await stat(file)).size <= 20 * 1024 * 1024) {
          const bytes = await readFile(file), mime = imageMime(bytes)
          if (mime) data = `data:${mime};base64,${bytes.toString('base64')}`
        }
      }
    } catch { /* Unavailable images retain their escaped alternative text. */ }
    html = html.replace(tag, data ? tag.replace(/\bsrc="[^"]*"/i, `src="${data}"`) : `<span class="image-unavailable">${tag.match(/\balt="([^"]*)"/i)?.[1] || '▧'}</span>`)
  }
  return html
}
export async function renderMarkdownPdf(request: MarkdownRenderRequest): Promise<Uint8Array> {
  if (!request || typeof request.html !== 'string' || request.html.length > 20_000_000 || typeof request.sourcePath !== 'string' || !isMarkdownPath(request.sourcePath) || !request.options) throw new Error('md.invalid')
  const options = normalizeMarkdownOptions(request.options)
  if (Object.keys(options).some(key => options[key as keyof MarkdownOptions] !== request.options[key as keyof MarkdownOptions])) throw new Error('md.invalid')
  return printHtmlPdf(await inlineMarkdownImages(request.html, request.sourcePath), markdownPrintCss(options))
}
