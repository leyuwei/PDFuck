import { describe, expect, it } from 'vitest'
import { normalizeCopiedText } from './clipboard-text'

describe('normalizeCopiedText', () => {
  it('removes fragmented Chinese/Japanese gaps while preserving multilingual words and identifiers', () => {
    expect(normalizeCopiedText('文 档 保持 原来 的 页 面 外观 。')).toBe('文档保持原来的页面外观。')
    expect(normalizeCopiedText('「 日 本 語 」の テ ス ト')).toBe('「日本語」のテスト')
    expect(normalizeCopiedText('使用 GPT-5.2 模型，识 别 率 98.5%')).toBe('使用 GPT-5.2 模型，识别率 98.5%')
    for (const text of ['한국어 단어 사이 공백', 'العربية لغة جميلة', 'English words stay separate', 'français déjà vu', 'Русский текст', 'español con espacios', 'português com espaços', 'deutsche Wörter']) expect(normalizeCopiedText(text)).toBe(text)
  })
  it('removes PDF line endings while keeping word boundaries', () => {
    expect(normalizeCopiedText('PDF copy\r\noften has\nline breaks.')).toBe('PDF copy often has line breaks.')
  })

  it('joins wrapped CJK lines without adding artificial spaces', () => {
    expect(normalizeCopiedText('这是第一行\n这是第二行。')).toBe('这是第一行这是第二行。')
  })

  it('does not add spaces at mixed continuous-script boundaries', () => {
    expect(normalizeCopiedText('这是 PDF\n文档，支持中文\nEnglish。')).toBe('这是 PDF文档，支持中文English。')
    expect(normalizeCopiedText('日本語の\nPDF 文書')).toBe('日本語のPDF 文書')
    expect(normalizeCopiedText('ภาษาไทย\nต่อเนื่อง')).toBe('ภาษาไทยต่อเนื่อง')
  })

  it('keeps word boundaries for languages that use spaces', () => {
    expect(normalizeCopiedText('Русский текст\nпродолжается здесь.')).toBe('Русский текст продолжается здесь.')
    expect(normalizeCopiedText('한국어 문장이\n다음 줄로 이어집니다.')).toBe('한국어 문장이 다음 줄로 이어집니다.')
  })

  it('repairs simple English line-break hyphenation', () => {
    expect(normalizeCopiedText('high-perfor-\nmance PDF')).toBe('high-performance PDF')
    expect(normalizeCopiedText('интернацио-\nнальный текст')).toBe('интернациональный текст')
    expect(normalizeCopiedText('informá-\ntica')).toBe('informática')
  })

  it('does not insert a space before closing punctuation', () => {
    expect(normalizeCopiedText('Hello\n, world\n!')).toBe('Hello, world!')
  })
})
