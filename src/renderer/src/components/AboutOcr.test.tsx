// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { OcrDialog } from './OcrDialog'
import { AboutDialog } from './AboutDialog'
import { ui } from '../lib/i18n'

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })

it('keeps OCR alive while minimized and restores the completed result without another request', async () => {
  Object.defineProperty(window, 'desktop', { configurable: true, value: { onWindowRequestClose: () => () => {} } })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  let finish!: (count: number) => void
  let signal!: AbortSignal
  const recognize = vi.fn((_options, value: AbortSignal) => { signal = value; return new Promise<number>(resolve => { finish = resolve }) })
  const minimize = vi.fn(), close = vi.fn()
  const render = (hidden: boolean) => root.render(<OcrDialog pageCount={3} currentPage={0} hidden={hidden} onMinimize={minimize} onClose={close} onRecognize={recognize} />)
  await act(async () => render(false))
  await act(async () => container.querySelector<HTMLButtonElement>('.primary')!.click())
  await act(async () => container.querySelector<HTMLButtonElement>('header button')!.click())
  expect(minimize).toHaveBeenCalledOnce()
  await act(async () => render(true))
  expect(signal.aborted).toBe(false)
  await act(async () => finish(3))
  await act(async () => render(false))
  expect(container.querySelector('.ocr-status')!.textContent).toContain('3')
  expect(recognize).toHaveBeenCalledOnce()
  expect(close).not.toHaveBeenCalled()
  await act(async () => container.querySelector<HTMLButtonElement>('.primary')!.click())
  await act(async () => container.querySelector<HTMLButtonElement>('.modal-actions button')!.click())
  expect(signal.aborted).toBe(true)
  expect(close).toHaveBeenCalledOnce()
  await act(async () => { finish(0); root.unmount() })
})

it.each(['current', 'available', 'skipped', 'unavailable', 'reject'] as const)('shows accurate update state: %s', async status => {
  const checkForUpdates = status === 'reject' ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue({ status, currentVersion: '2.0.36', latestVersion: '2.0.37' })
  const openReleasePage = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, 'desktop', { configurable: true, value: { checkForUpdates, openReleasePage } })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<AboutDialog version="2.0.36" onClose={() => {}} />))
  const text = container.querySelector('[role="status"]')!.textContent
  expect(text).toContain(status === 'current' ? ui('about.current') : status === 'available' || status === 'skipped' ? '2.0.37' : ui('about.unavailable'))
  await act(async () => container.querySelector('a')!.click())
  expect(openReleasePage).toHaveBeenCalledWith('https://github.com/leyuwei/PDFuck/releases')
  await act(async () => container.querySelector<HTMLButtonElement>('.modal-actions button')!.click())
  expect(checkForUpdates).toHaveBeenCalledTimes(2)
  await act(async () => root.unmount())
})
