// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawingBoard, type DrawingBoardLabels } from './DrawingBoard'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: DrawingBoardLabels = {
  title: 'Drawing board', brushSize: 'Brush size', color: 'Color', clear: 'Clear', drawingArea: 'Drawing area',
  exportPng: 'Export PNG', addToPage: 'Add to page', close: 'Close', encodingFailed: 'Encoding failed', actionFailed: 'Action failed'
}

function pointer(target: Element, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, { button: { value: 0 }, pointerId: { value: 7 }, clientX: { value: x }, clientY: { value: y } })
  target.dispatchEvent(event)
}

describe('DrawingBoard', () => {
  let container: HTMLDivElement
  const context = {
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
    strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: ''
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640, x: 0, y: 0, toJSON: () => undefined }) })
    Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
    Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
    Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false })
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback({ arrayBuffer: async () => Uint8Array.of(137, 80, 78, 71).buffer } as Blob))
  })

  afterEach(() => { vi.restoreAllMocks(); container.remove() })

  it('draws with the selected brush and sends the same PNG shape to both actions', async () => {
    const root = createRoot(container)
    const added: Uint8Array[] = [], exported: Uint8Array[] = []
    const onAddPng = vi.fn(async (data: Uint8Array) => { added.push(data) })
    const onExportPng = vi.fn(async (data: Uint8Array) => { exported.push(data) })
    await act(async () => root.render(<DrawingBoard labels={labels} onClose={() => undefined} onAddPng={onAddPng} onExportPng={onExportPng} />))

    const range = container.querySelector<HTMLInputElement>('input[type="range"]')!
    const color = container.querySelector<HTMLInputElement>('input[type="color"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(range, '12')
      range.dispatchEvent(new Event('input', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(color, '#cc3344')
      color.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const canvas = container.querySelector('canvas')!
    await act(async () => { pointer(canvas, 'pointerdown', 20, 30); pointer(canvas, 'pointermove', 80, 90); pointer(canvas, 'pointerup', 80, 90) })
    expect(context.strokeStyle).toBe('#cc3344')
    expect(context.lineWidth).toBe(12)
    expect(context.lineTo).toHaveBeenCalledWith(80, 90)

    const actions = container.querySelectorAll<HTMLButtonElement>('.drawing-board-window > footer button')
    await act(async () => actions[0].click())
    expect(onExportPng).toHaveBeenCalledWith(expect.any(Uint8Array))
    await act(async () => actions[1].click())
    expect(onAddPng).toHaveBeenCalledWith(expect.any(Uint8Array))
    expect(added[0]).toEqual(exported[0])
    await act(async () => root.unmount())
  })

  it('starts empty, clears ink, and exposes native window resizing', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<DrawingBoard labels={labels} onClose={() => undefined} onAddPng={() => undefined} onExportPng={() => undefined} />))
    const actions = [...container.querySelectorAll<HTMLButtonElement>('footer button')]
    expect(actions.every((button) => button.disabled)).toBe(true)
    expect(container.querySelector<HTMLElement>('.drawing-board-window')!.style.resize).toBe('both')
    const canvas = container.querySelector('canvas')!
    await act(async () => pointer(canvas, 'pointerdown', 10, 10))
    const clear = [...container.querySelectorAll<HTMLButtonElement>('.drawing-board-toolbar button')].find((button) => button.textContent === labels.clear)!
    await act(async () => clear.click())
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 960, 640)
    expect(actions.every((button) => button.disabled)).toBe(true)
    await act(async () => root.unmount())
  })
})
