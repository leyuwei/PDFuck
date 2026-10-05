import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inlineMarkdownImages, markdownPrintCss, readMarkdown, renderMarkdownPdf } from './markdown'
import { MARKDOWN_PRESETS, MARKDOWN_TEMPLATES, MAX_MARKDOWN_LENGTH } from '../shared/markdown'
import { printHtmlPdf } from './html-pdf'
vi.mock('./html-pdf', () => ({ printHtmlPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) }))
const temporary: string[] = []
async function directory() { const path = await mkdtemp(join(tmpdir(), 'pdfuck-md-unit-')); temporary.push(path); return path }
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); vi.clearAllMocks() })
describe('2.1.0 Markdown', () => {
  it('reads UTF-8, BOM, mixed languages and CRLF, rejects invalid encoding and oversized files', async () => {
    const dir = await directory(), file = join(dir, 'hello.MD')
    const source = '# 中文 日本語 한국어 العربية\r\n**Hello**'
    await writeFile(file, '\uFEFF' + source)
    expect(await readMarkdown(file)).toBe(source)
    await writeFile(file, Buffer.from([0xff, 0xfe, 0x41, 0]))
    await expect(readMarkdown(file)).rejects.toThrow('md.invalid')
    await writeFile(file, Buffer.alloc(MAX_MARKDOWN_LENGTH + 1))
    await expect(readMarkdown(file)).rejects.toThrow('md.invalid')
    await expect(readMarkdown(join(dir, 'test.pdf'))).rejects.toThrow('md.invalid')
  })
  it('embeds local raster images and data URLs, blocks external, absolute, traversal and SVG resources', async () => {
    const dir = await directory(), root = join(dir, 'doc'); await mkdir(root)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB/8AAAAASUVORK5CYII=', 'base64')
    await writeFile(join(root, 'a b.png'), png); await writeFile(join(dir, 'outside.png'), png); await writeFile(join(root, 'x.svg'), '<svg/>')
    const html = '<img src="a%20b.png" alt="local"/><img src="../outside.png" alt="outside"/><img src="https://example.com/a.png" alt="remote"/><img src="x.svg" alt="svg"/>'
    const result = await inlineMarkdownImages(html, join(root, 'note.md'))
    expect(result).toContain('src="data:image/png;base64,')
    expect(result.match(/<img/g)).toHaveLength(1)
    for (const alt of ['outside', 'remote', 'svg']) expect(result).toContain(`class="image-unavailable">${alt}`)
    expect(await inlineMarkdownImages(`<img src="${join(root, 'a b.png')}" alt="absolute"/>`, join(root, 'note.md'))).not.toContain('<img')
    expect(await inlineMarkdownImages(`<img src="data:image/png;base64,${png.toString('base64')}"/>`, join(root, 'note.md'))).toContain('<img')
  })
  it('provides five distinct printable templates with real numeric settings and pagination rules', () => {
    const styles = MARKDOWN_TEMPLATES.map(template => markdownPrintCss({ ...MARKDOWN_PRESETS[template], fontSize: 14, lineHeight: 1.9, paragraphSpacing: 13 }))
    expect(new Set(styles).size).toBe(5)
    for (const css of styles) { expect(css).toContain('14pt/1.9'); expect(css).toContain('13pt'); expect(css).toContain('size: A4'); expect(css).toContain('table-layout: fixed'); expect(css).toContain('pre-wrap'); expect(css).toContain('widows: 3') }
  })
  it('validates rendering requests before printing and keeps the HTML isolated from the source path', async () => {
    const dir = await directory(), sourcePath = join(dir, 'note.md'), options = MARKDOWN_PRESETS.clean
    const html = '<article><h1>中文</h1></article>'
    expect(await renderMarkdownPdf({ html, sourcePath, options })).toEqual(new Uint8Array([37, 80, 68, 70]))
    expect(printHtmlPdf).toHaveBeenCalledWith(html, expect.stringContaining('font: 11pt/1.65'))
    await expect(renderMarkdownPdf({ html, sourcePath, options: { ...options, fontSize: 1000 } })).rejects.toThrow('md.invalid')
    await expect(renderMarkdownPdf({ html, sourcePath: 'test.exe', options })).rejects.toThrow('md.invalid')
    expect(printHtmlPdf).toHaveBeenCalledOnce()
  })
  it('declares Markdown editor associations on both platforms and one consistent version', async () => {
    const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8')), lock = JSON.parse(await readFile(resolve('package-lock.json'), 'utf8'))
    expect([pkg.version, lock.version, lock.packages[''].version]).toEqual(['2.1.0', '2.1.0', '2.1.0'])
    expect(pkg.build.win.fileAssociations).toContainEqual(expect.objectContaining({ ext: 'md', mimeType: 'text/markdown', role: 'Editor', rank: 'Default' }))
    expect(pkg.build.mac.extendInfo.CFBundleDocumentTypes).toContainEqual(expect.objectContaining({ CFBundleTypeExtensions: ['md'], CFBundleTypeRole: 'Editor', LSHandlerRank: 'Default' }))
    expect(pkg.build.mac.extendInfo.UTImportedTypeDeclarations[0].UTTypeTagSpecification['public.filename-extension']).toEqual(['md'])
  })
})
