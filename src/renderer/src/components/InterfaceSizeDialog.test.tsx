// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { InterfaceSizeDialog } from './InterfaceSizeDialog'
import { interfaceFontSizes, INTERFACE_SIZE_KEY, savedInterfaceSize, validInterfaceSize } from '../lib/interface-size'
import { INTERFACE_LANGUAGES, setInterfaceLanguage, ui } from '../lib/i18n'

it('previews without saving, restores on unmount, persists on confirmation and localizes all languages', async () => {
  localStorage.removeItem(INTERFACE_SIZE_KEY)
  expect(validInterfaceSize('NaN')).toBe(14)
  expect(validInterfaceSize(99)).toBe(14)
  expect(interfaceFontSizes(14)).toEqual({ small: 11, body: 13, title: 17 })
  const host = document.createElement('div'); document.body.append(host)
  let root = createRoot(host)
  const font = () => document.documentElement.style.getPropertyValue('--ui-font-body')
  try {
    await act(async () => root.render(<InterfaceSizeDialog theme="light" onClose={() => undefined} />))
    for (const language of INTERFACE_LANGUAGES) {
      await act(async () => setInterfaceLanguage(language))
      expect(host.querySelector('h2')!.textContent).toBe(ui('ui.interfaceFontSize'))
      expect(host.querySelectorAll('.interface-size-options button')).toHaveLength(4)
      for (const key of ['ui.mergePdfFromFiles2', 'ui.managePages', 'ui.addImageToPage', 'ui.addShapeToPage'] as const) expect(ui(key)).not.toMatch(/(?:…|\.{3})$/)
    }
    await act(async () => (host.querySelectorAll('.interface-size-options button')[0] as HTMLButtonElement).click())
    expect(font()).toBe('12px'); expect(savedInterfaceSize()).toBe(14)
    await act(async () => (host.querySelectorAll('.interface-size-options button')[3] as HTMLButtonElement).click())
    expect(font()).toBe('18px'); expect(savedInterfaceSize()).toBe(14)
    await act(async () => root.unmount()); expect(font()).toBe('13px')
    root = createRoot(host)
    await act(async () => root.render(<InterfaceSizeDialog theme="dark" onClose={() => undefined} />))
    await act(async () => (host.querySelectorAll('.interface-size-options button')[2] as HTMLButtonElement).click())
    await act(async () => host.querySelector<HTMLButtonElement>('.primary')!.click())
    expect(savedInterfaceSize()).toBe(16)
    await act(async () => root.unmount()); expect(font()).toBe('16px')
  } finally { host.remove(); localStorage.removeItem(INTERFACE_SIZE_KEY); setInterfaceLanguage('zh') }
})
