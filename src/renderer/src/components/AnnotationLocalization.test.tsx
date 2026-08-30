// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setInterfaceLanguage } from '../lib/i18n'
import { AnnotationLab } from './AnnotationLab'
import { AnnotationPanel } from './AnnotationPanel'

describe('annotation localization', () => {
  let container: HTMLDivElement

  beforeEach(() => { container = document.createElement('div'); document.body.append(container) })
  afterEach(() => { container.remove(); setInterfaceLanguage('zh') })

  it('renders every AI preset in the selected interface language', async () => {
    const root = createRoot(container)
    const expectations = {
      en: ['Plain-language explanation', 'Improve logic', 'Grammar only', 'Natural phrasing', 'Resolve inconsistencies', 'Highlight strengths'],
      ja: ['わかりやすく説明', '論理を改善', '文法のみ確認', '自然な表現', '不整合を解消', '強みを強調'],
      ru: ['Объяснить простым языком', 'Улучшить логику', 'Только грамматика', 'Естественная формулировка', 'Устранить несоответствия', 'Подчеркнуть сильные стороны'],
      es: ['Explicación sencilla', 'Mejorar la lógica', 'Solo gramática', 'Redacción natural', 'Resolver incoherencias', 'Destacar puntos fuertes']
    }
    for (const [language, labels] of Object.entries(expectations) as Array<[keyof typeof expectations, string[]]>) {
      setInterfaceLanguage(language)
      await act(async () => { root.render(<AnnotationLab selection={{ pageIndex: 0, text: 'Sample text', rects: [{ x: 0, y: 0, width: 10, height: 10 }] }} onAdd={() => undefined} onCopy={() => undefined} />) })
      await act(async () => { (container.querySelector('.annotation-lab-launch') as HTMLButtonElement).click() })
      for (const label of labels) expect(container.getElementsByClassName('ai-preset-grid')[0].textContent).toContain(label)
    }
    await act(async () => root.unmount())
  })

  it('localizes blank annotation defaults, quick replies, and the delete action', async () => {
    const root = createRoot(container)
    setInterfaceLanguage('en')
    await act(async () => root.render(<AnnotationPanel collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" annotations={[{ id: 'empty', pageIndex: 0, kind: 'underline', author: '', content: '', color: '#000000', reply: { status: 'handled', content: '已处理' }, rects: [] }]} onAuthorSettings={() => undefined} onToggle={() => undefined} onSelect={() => undefined} onEdit={async () => undefined} onColor={async () => undefined} onReply={async () => undefined} onDelete={() => undefined} />))
    expect(container.textContent).toContain('No content')
    expect(container.querySelector('.annotation-actions button')?.textContent).toBe('Delete Annotation')
    expect(container.querySelector('.annotation-settings-button')?.getAttribute('title')).toBe('Reply: Resolved')
    await act(async () => root.unmount())
  })
})
