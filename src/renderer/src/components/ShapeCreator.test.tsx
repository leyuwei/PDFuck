// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShapeCreator, ShapeToolIcon, type ShapeCreatorLabels } from './ShapeCreator'

const labels: ShapeCreatorLabels = {
  title: '添加图形', description: '设置图形样式并添加到页面', preview: '预览', shapeType: '图形类型',
  arrow: '箭头', ellipse: '椭圆', rectangle: '方框', outline: '边框颜色', fill: '填充颜色', transparent: '透明',
  lineWidth: '线宽', lineStyle: '线型', solid: '实线', dashed: '虚线', dotted: '点线', arrowSize: '箭头大小',
  arrowStyle: '箭头样式', openArrow: '开放', triangleArrow: '三角', diamondArrow: '菱形', nothingVisible: '至少保留一种可见颜色',
  cancel: '取消', addToPage: '添加到页面', encoding: '正在生成', encodeFailed: '无法生成图片'
}

describe('ShapeCreator', () => {
  let container: HTMLDivElement
  const context = {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), rect: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn()
  }

  beforeEach(() => {
    container = document.createElement('div'); document.body.append(container)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback({ arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer } as Blob))
  })
  afterEach(() => { vi.restoreAllMocks(); container.remove() })

  it('exports a tool-panel icon that follows the existing edit icon classes', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<ShapeToolIcon />))
    expect(container.querySelector('svg.edit-tool-icon.shape-tool-icon .accent')).not.toBeNull()
    await act(async () => root.unmount())
  })

  it('previews every shape and exposes all requested style controls', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<ShapeCreator labels={labels} onCancel={() => undefined} onCreate={() => undefined} />))
    expect(container.querySelectorAll('.shape-creator-kinds button')).toHaveLength(3)
    expect(container.textContent).toContain('箭头大小')
    expect(context.lineTo).toHaveBeenCalled()

    context.ellipse.mockClear()
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.shape-creator-kinds button')].find((button) => button.textContent === '椭圆')!.click() })
    expect(context.ellipse).toHaveBeenCalled()
    expect(container.textContent).not.toContain('箭头大小')

    context.rect.mockClear()
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.shape-creator-kinds button')].find((button) => button.textContent === '方框')!.click() })
    expect(context.rect).toHaveBeenCalled()
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.shape-creator-segmented button')].find((button) => button.textContent === '虚线')!.click() })
    expect(context.setLineDash).toHaveBeenLastCalledWith([20, 12])
    await act(async () => root.unmount())
  })

  it('blocks invisible output and returns only encoded PNG bytes', async () => {
    const onCreate = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<ShapeCreator labels={labels} onCancel={() => undefined} onCreate={onCreate} />))
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.shape-creator-kinds button')].find((button) => button.textContent === '方框')!.click() })
    const outlineTransparent = container.querySelector<HTMLInputElement>('[aria-label="边框颜色 · 透明"]')!
    await act(async () => { outlineTransparent.click() })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('至少保留一种可见颜色')
    expect([...container.querySelectorAll<HTMLButtonElement>('footer button')].at(-1)?.disabled).toBe(true)

    const fillTransparent = container.querySelector<HTMLInputElement>('[aria-label="填充颜色 · 透明"]')!
    await act(async () => { fillTransparent.click() })
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('footer button')].at(-1)!.click() })
    expect(onCreate).toHaveBeenCalledWith(Uint8Array.from([137, 80, 78, 71]))
    await act(async () => root.unmount())
  })
})
