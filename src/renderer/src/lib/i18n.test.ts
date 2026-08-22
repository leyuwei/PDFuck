// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { phraseTranslations } from './i18n-locales'
import { setInterfaceLanguage, translateUiText, ui } from './i18n'

afterEach(() => setInterfaceLanguage('zh'))

describe('interface translations', () => {
  it('resolves every audited supplemental phrase in every supported language', () => {
    for (const language of ['en', 'ja', 'ru', 'es'] as const) {
      setInterfaceLanguage(language)
      for (const [source, translations] of Object.entries(phraseTranslations)) {
        expect(ui(source, translations.en)).toBe(translations[language])
      }
    }
  })

  it('localizes renderer and main-process failures before they reach status or alert UI', () => {
    const failure = '无法连接模型服务，请检查接口地址、网络或证书。'
    for (const language of ['en', 'ja', 'ru', 'es'] as const) {
      setInterfaceLanguage(language)
      expect(translateUiText(failure)).toBe(phraseTranslations[failure][language])
      expect(translateUiText(`操作失败：${failure}`)).not.toContain('操作失败')
      expect(translateUiText(`操作失败：${failure}`)).not.toContain('无法连接模型服务')
    }
  })
})
