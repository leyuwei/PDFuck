import type { PdfRect } from '../types'

interface ColorSample { foreground: string; background: string }

function hex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`
}

export function inferRegionColors(data: Uint8ClampedArray): ColorSample {
  const colors = new Map<string, { red: number; green: number; blue: number; count: number }>()
  for (let index = 0; index + 3 < data.length; index += 4) {
    if (data[index + 3] < 128) continue
    const red = data[index], green = data[index + 1], blue = data[index + 2]
    const key = `${Math.round(red / 16)},${Math.round(green / 16)},${Math.round(blue / 16)}`
    const current = colors.get(key)
    if (current) { current.red += red; current.green += green; current.blue += blue; current.count += 1 }
    else colors.set(key, { red, green, blue, count: 1 })
  }
  const ranked = [...colors.values()].map((value) => ({ red: value.red / value.count, green: value.green / value.count, blue: value.blue / value.count, count: value.count })).sort((left, right) => right.count - left.count)
  const background = ranked[0] || { red: 255, green: 255, blue: 255, count: 1 }
  let foreground: typeof background | undefined
  let bestScore = 0
  for (const candidate of ranked.slice(1)) {
    const distance = Math.hypot(candidate.red - background.red, candidate.green - background.green, candidate.blue - background.blue)
    if (distance < 42) continue
    const score = distance * Math.log2(candidate.count + 1)
    if (score > bestScore) { bestScore = score; foreground = candidate }
  }
  return { foreground: foreground ? hex(foreground.red, foreground.green, foreground.blue) : '#182033', background: hex(background.red, background.green, background.blue) }
}

export function sampleCanvasRegionColors(canvas: HTMLCanvasElement | null, rect: PdfRect, page: { width: number; height: number }): ColorSample {
  const context = canvas?.getContext('2d', { willReadFrequently: true })
  if (!canvas || !context || page.width <= 0 || page.height <= 0) return { foreground: '#182033', background: '#ffffff' }
  const scaleX = canvas.width / page.width, scaleY = canvas.height / page.height
  const x = Math.max(0, Math.floor((rect.x - 1) * scaleX)), y = Math.max(0, Math.floor((rect.y - 1) * scaleY))
  const width = Math.max(1, Math.min(canvas.width - x, Math.ceil((rect.width + 2) * scaleX)))
  const height = Math.max(1, Math.min(canvas.height - y, Math.ceil((rect.height + 2) * scaleY)))
  try { return inferRegionColors(context.getImageData(x, y, width, height).data) } catch { return { foreground: '#182033', background: '#ffffff' } }
}
