import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import iconv from 'iconv-lite'
import { decodeText, encodeText } from './text-encoding'
import { readTextDocument, renderMarkdownPdf } from './markdown'
import { MARKDOWN_PRESETS, TEXT_ENCODINGS } from '../shared/markdown'
vi.mock('./html-pdf', () => ({ printHtmlPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) }))

it('detects Unicode BOMs, UTF-16 without BOM and representative legacy encodings', () => {
  const unicode = '中文 English 日本語 한국어 العربية 😀\r\nSecond line'
  for (const encoding of TEXT_ENCODINGS.slice(0, 4)) expect(decodeText(encodeText(unicode, encoding))).toEqual({ source: unicode, encoding })
  for (const encoding of ['utf-16le', 'utf-16be'] as const) expect(decodeText(iconv.encode('English text\nSecond line', encoding)).encoding).toBe(encoding)
  for (const [encoding, source] of [['gb18030', '这是一个中文文档，用于测试文件编码。'], ['shift_jis', '日本語の文書です。文字コードを確認します。'], ['euc-kr', '한국어 문서의 인코딩을 확인합니다.'], ['windows-1251', 'Это русский документ для проверки кодировки.'], ['windows-1252', 'Café déjà vu']] as const) expect(decodeText(iconv.encode(source, encoding)).source).toBe(source)
})
it('every supported encoding round-trips explicit input and BOMs without silent substitution', () => {
  const samples = { gb18030: '中文 😀', big5: '繁體中文', shift_jis: '日本語の文章', 'euc-kr': '한국어 문서', 'windows-1251': 'Русский текст', 'windows-1252': 'Café déjà vu' }
  for (const encoding of TEXT_ENCODINGS) {
    const source = samples[encoding as keyof typeof samples] || '中文 العربية 😀'
    expect(decodeText(encodeText(source, encoding), encoding)).toEqual({ source, encoding })
  }
  expect(() => encodeText('中文 😀', 'windows-1252')).toThrow('text.lossyEncoding')
  expect(() => decodeText(Uint8Array.from([0, 0, 0, 0]))).toThrow('text.invalidEncoding')
  expect(() => encodeText('text', 'utf-7' as never)).toThrow('text.invalidEncoding')
})
it('opens TXT and Markdown with normalized editor offsets and preserves newline metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pdfuck-215-unit-'))
  try {
    for (const extension of ['TXT', 'md']) {
      const file = join(dir, `中文.${extension}`)
      await writeFile(file, encodeText('第一行\r\nSecond line', 'gb18030'))
      expect(await readTextDocument(file)).toMatchObject({ source: '第一行\nSecond line', encoding: 'gb18030', lineEnding: '\r\n' })
    }
    const txt = join(dir, 'plain.txt')
    await writeFile(txt, 'plain')
    expect(await renderMarkdownPdf({ html: '<article class="plain-text"># literal</article>', sourcePath: txt, options: MARKDOWN_PRESETS.clean })).toEqual(new Uint8Array([37, 80, 68, 70]))
    await expect(readTextDocument(join(dir, 'bad.pdf'))).rejects.toThrow('md.invalid')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
