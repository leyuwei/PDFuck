// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { englishPhrases, phraseTranslations, translateCataloguePhrase } from '../../../shared/i18n-catalogue'
import { setInterfaceLanguage, translateUiText, ui } from './i18n'

afterEach(() => setInterfaceLanguage('zh'))

describe('interface translations', () => {
  it('resolves every shared catalogue key in all five supported languages', () => {
    for (const source of Object.keys(englishPhrases)) {
      expect(translateCataloguePhrase('zh', source)).toBe(source)
      for (const language of ['en', 'ja', 'ru', 'es'] as const) expect(translateCataloguePhrase(language, source).trim()).not.toBe('')
    }
  })

  it('resolves every audited supplemental phrase in every supported language', () => {
    for (const language of ['en', 'ja', 'ru', 'es'] as const) {
      setInterfaceLanguage(language)
      for (const [source, translations] of Object.entries(phraseTranslations)) {
        expect(ui(source)).toBe(translations[language])
      }
    }
  })

  it('localizes renderer and main-process failures before they reach status or alert UI', () => {
    const failure = '无法连接模型服务，请检查接口地址、网络或证书。'
    const localTimeout = '已达到模型设置中的响应超时时间，软件已停止等待。请缩短输入、改用更快的模型，或在确认服务商允许更长请求后调大超时。'
    const gatewayTimeout = 'AI 服务或中转网关等待模型返回超时。这通常不是本软件的响应超时；请缩短输入、改用更快的模型、直连官方 API，或联系中转服务商。'
    for (const language of ['en', 'ja', 'ru', 'es'] as const) {
      setInterfaceLanguage(language)
      expect(translateUiText(failure)).toBe(phraseTranslations[failure][language])
      expect(translateUiText(localTimeout)).toBe(phraseTranslations[localTimeout][language])
      expect(translateUiText(`请求失败（524）：${gatewayTimeout}`)).toBe(`${translateUiText('请求失败（524）：服务未返回详细原因').split(phraseTranslations['服务未返回详细原因'][language])[0]}${phraseTranslations[gatewayTimeout][language]}`)
      expect(translateUiText(`操作失败：${failure}`)).not.toContain('操作失败')
      expect(translateUiText(`操作失败：${failure}`)).not.toContain('无法连接模型服务')
      expect(translateUiText('请求失败（429）：服务未返回详细原因')).not.toContain('请求失败')
      expect(translateUiText('请求失败（429）：服务未返回详细原因')).not.toContain('服务未返回详细原因')
    }
  })

  it('localizes dynamic annotation status messages and their generated defaults', () => {
    const messages = [
      '文本高亮已添加',
      '已在 2 页添加文本替换',
      '已删除 3 条批注，可按 Ctrl/⌘Z 撤销',
      '已回复：已处理',
      '标记删除'
    ]
    for (const language of ['en', 'ja', 'ru', 'es'] as const) {
      setInterfaceLanguage(language)
      for (const message of messages) {
        expect(translateUiText(message)).not.toContain('文本高亮')
        expect(translateUiText(message)).not.toContain('文本替换')
        expect(translateUiText(message)).not.toContain('批注')
        expect(translateUiText(message)).not.toContain('标记删除')
      }
    }
    setInterfaceLanguage('en')
    expect(translateUiText('文本高亮已添加')).toBe('Highlight Text added')
    expect(translateUiText('已在 2 页添加文本替换')).toBe('Added Replace Text on 2 pages')
    expect(translateUiText('已删除 3 条批注，可按 Ctrl/⌘Z 撤销')).toBe('Deleted 3 annotations. Press Ctrl/⌘Z to undo.')
    expect(translateUiText('已回复：已处理')).toBe('Replied: Resolved')
  })
})
