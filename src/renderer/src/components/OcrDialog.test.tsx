// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OcrDialog } from './OcrDialog'
import { setInterfaceLanguage } from '../lib/i18n'

it('uses the current page and language, and aborts on native close or unmount', async () => {
  let nativeClose = () => {}, signal: AbortSignal | undefined
  const detach = vi.fn(), onClose = vi.fn()
  const onRecognize = vi.fn(async (_options: unknown, active: AbortSignal) => {
    signal = active
    return new Promise<number>((_resolve, reject) => active.addEventListener('abort', () => reject(active.reason), { once: true }))
  })
  window.desktop = { onWindowRequestClose: (callback: () => void) => { nativeClose = callback; return detach } } as unknown as typeof window.desktop
  setInterfaceLanguage('ja')
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  try {
    await act(async () => root.render(<OcrDialog pageCount={10} currentPage={4} onClose={onClose} onRecognize={onRecognize} />))
    expect(host.querySelector('select')?.value).toBe('jpn')
    expect(host.querySelector('input')?.value).toBe('1-10')
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.page-selection-shortcuts button')[1].click())
    expect(host.querySelector('input')?.value).toBe('5')
    await act(async () => host.querySelector<HTMLButtonElement>('.primary')!.click())
    expect(onRecognize.mock.calls[0][0]).toEqual({ pages: [4], language: 'jpn' })
    expect(host.querySelector('fieldset')!.disabled).toBe(true)
    await act(async () => nativeClose())
    expect(signal?.aborted).toBe(true)
    expect(host.querySelector('.ocr-error')).toBeNull()
    await act(async () => host.querySelector<HTMLButtonElement>('.primary')!.click())
    expect(signal?.aborted).toBe(false)
    await act(async () => root.unmount())
    expect(signal?.aborted).toBe(true); expect(detach).toHaveBeenCalledOnce()
  } finally { host.remove(); setInterfaceLanguage('zh') }
})
