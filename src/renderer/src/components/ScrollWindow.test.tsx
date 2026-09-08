// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ScrollWindow } from './ScrollWindow'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('hides after inactivity, renews on input, retains an active drag and cleans up on unmount', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  await act(async () => root.render(<ScrollWindow autoHideScrollbar><h2>Tools</h2><button>Action</button></ScrollWindow>))
  const body = container.querySelector<HTMLElement>('.window-scroll-body')!
  expect(body.contains(container.querySelector('h2'))).toBe(false)
  expect(body.dataset.scrollbarVisible).toBe('true')
  vi.advanceTimersByTime(1500)
  expect(body.dataset.scrollbarVisible).toBeUndefined()
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'focusin', 'scroll', 'wheel']) {
    body.dispatchEvent(new Event(type))
    vi.advanceTimersByTime(1499)
    expect(body.dataset.scrollbarVisible).toBe('true')
    body.dispatchEvent(new Event(type))
    vi.advanceTimersByTime(1499)
    expect(body.dataset.scrollbarVisible).toBe('true')
    vi.advanceTimersByTime(1)
    expect(body.dataset.scrollbarVisible).toBeUndefined()
  }
  const active = vi.spyOn(body, 'matches').mockReturnValue(true)
  body.dispatchEvent(new Event('pointerdown'))
  vi.advanceTimersByTime(3000)
  expect(body.dataset.scrollbarVisible).toBe('true')
  active.mockReturnValue(false)
  vi.advanceTimersByTime(1500)
  expect(body.dataset.scrollbarVisible).toBeUndefined()
  body.dispatchEvent(new Event('scroll'))
  await act(async () => root.unmount())
  expect(vi.getTimerCount()).toBe(0)
  body.dispatchEvent(new Event('scroll'))
  expect(body.dataset.scrollbarVisible).toBeUndefined()
})

it('leaves other windows on their normal scrollbar behavior', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  await act(async () => root.render(<ScrollWindow><h2>Dialog</h2><p>Content</p></ScrollWindow>))
  expect(container.querySelector('.auto-hide-scrollbar')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  await act(async () => root.unmount())
})
