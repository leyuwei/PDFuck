// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FeatureGuide } from '../../../../../src/renderer/src/components/FeatureGuide'
let root: Root, host: HTMLDivElement, frames: Map<number, FrameRequestCallback>, sequence: number
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
beforeEach(() => {
  frames = new Map(); sequence = 0
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function tick() { const [id, callback] = frames.entries().next().value!; frames.delete(id); await act(async () => callback(0)) }
async function highlight() {
  await act(async () => root.render(<FeatureGuide onStart={async () => {}} onStep={() => {}} onAction={() => {}} onClose={() => {}}/>))
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-start')!.click())
  for (let i = 0; i < 2; i++) await act(async () => host.querySelector<HTMLButtonElement>('.guide-actions .primary')!.click())
}
function expectBox(rect: DOMRect) {
  const style = host.querySelector<HTMLElement>('.guide-spotlight')!.style
  expect([style.left, style.top, style.width, style.height]).toEqual([rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4].map(v => `${v}px`))
}
it('follows a page that moves during sidebar layout changes without a resize or scroll event', async () => {
  const page = document.createElement('div'); page.className = 'pdf-page'; document.body.append(page)
  let rect = new DOMRect(900, 110, 500, 700); page.getBoundingClientRect = () => rect
  await highlight(); await tick(); expectBox(rect)
  for (const x of [870, 820, 740, 600]) { rect = new DOMRect(x, 110, 500, 700); await tick(); expectBox(rect) }
})
it('reacquires the rendered page after replacing a fallback or a PDF page node', async () => {
  const area = document.createElement('div'); area.className = 'document-area'; document.body.append(area)
  const fallback = new DOMRect(400, 100, 700, 750); area.getBoundingClientRect = () => fallback
  await highlight(); await tick(); expectBox(fallback)
  for (const rect of [new DOMRect(500, 130, 450, 630), new DOMRect(610, 140, 600, 840)]) {
    area.replaceChildren(); const page = document.createElement('div'); page.className = 'pdf-page'; page.getBoundingClientRect = () => rect; area.append(page)
    await tick(); expectBox(rect)
  }
})
it('stops tracking while minimized or unmounted and measures again when restored', async () => {
  const page = document.createElement('div'); page.className = 'pdf-page'; document.body.append(page)
  let rect = new DOMRect(500, 110, 500, 700); page.getBoundingClientRect = () => rect
  await highlight(); await tick()
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-practice-actions button')!.click())
  expect(frames.size).toBe(0); expect(host.querySelector('.guide-spotlight')).toBeNull()
  rect = new DOMRect(650, 130, 550, 770)
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-practice-actions button')!.click())
  await tick(); expectBox(rect)
  await act(async () => root.render(null)); expect(frames.size).toBe(0)
})
