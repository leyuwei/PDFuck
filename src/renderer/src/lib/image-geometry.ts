import type { PdfPoint, PdfRect } from '../types'

export type ImageResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export interface ImageResizeOptions { lockAspectRatio?: boolean; aspectRatio?: number }

const minimumImageSize = 20

export function normalizeImageRotation(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function radians(value: number): number { return normalizeImageRotation(value) * Math.PI / 180 }

export function rotateImageVector(vector: PdfPoint, rotation: number): PdfPoint {
  const angle = radians(rotation), cosine = Math.cos(angle), sine = Math.sin(angle)
  return { x: vector.x * cosine - vector.y * sine, y: vector.x * sine + vector.y * cosine }
}

function unrotateImageVector(vector: PdfPoint, rotation: number): PdfPoint { return rotateImageVector(vector, -rotation) }

export function rotatedImageBounds(rect: PdfRect, rotation: number): PdfRect {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const corners = [
    { x: -rect.width / 2, y: -rect.height / 2 }, { x: rect.width / 2, y: -rect.height / 2 },
    { x: rect.width / 2, y: rect.height / 2 }, { x: -rect.width / 2, y: rect.height / 2 }
  ].map((corner) => {
    const rotated = rotateImageVector(corner, rotation)
    return { x: center.x + rotated.x, y: center.y + rotated.y }
  })
  const xs = corners.map((corner) => corner.x), ys = corners.map((corner) => corner.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function clampRotatedImageRect(rect: PdfRect, rotation: number, bounds: { width: number; height: number }): PdfRect {
  const displayed = rotatedImageBounds(rect, rotation)
  const move = (start: number, length: number, maximum: number) => {
    if (length >= maximum) return (maximum - length) / 2 - start
    if (start < 0) return -start
    if (start + length > maximum) return maximum - start - length
    return 0
  }
  return { ...rect, x: rect.x + move(displayed.x, displayed.width, bounds.width), y: rect.y + move(displayed.y, displayed.height, bounds.height) }
}

export function moveImageRect(rect: PdfRect, delta: PdfPoint, rotation: number, bounds: { width: number; height: number }): PdfRect {
  return clampRotatedImageRect({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, rotation, bounds)
}

/** Resize in the image's local axes while keeping the opposite handle fixed. */
export function resizeImageRect(rect: PdfRect, handle: ImageResizeHandle, delta: PdfPoint, rotation: number, bounds: { width: number; height: number }, options: ImageResizeOptions = {}): PdfRect {
  const local = unrotateImageVector(delta, rotation)
  let left = -rect.width / 2, right = rect.width / 2, top = -rect.height / 2, bottom = rect.height / 2
  if (options.lockAspectRatio) {
    const aspectRatio = Number.isFinite(options.aspectRatio) && options.aspectRatio! > 0 ? options.aspectRatio! : rect.width / Math.max(1, rect.height)
    const minimumWidth = Math.max(minimumImageSize, minimumImageSize * aspectRatio)
    const minimumHeight = minimumWidth / aspectRatio
    const hasHorizontal = handle.includes('w') || handle.includes('e')
    const hasVertical = handle.includes('n') || handle.includes('s')
    const requestedWidth = rect.width + (handle.includes('e') ? local.x : handle.includes('w') ? -local.x : 0)
    const requestedHeight = rect.height + (handle.includes('s') ? local.y : handle.includes('n') ? -local.y : 0)
    let width: number
    if (hasHorizontal && hasVertical) {
      const widthScale = Math.abs(requestedWidth / Math.max(1, rect.width) - 1)
      const heightScale = Math.abs(requestedHeight / Math.max(1, rect.height) - 1)
      width = widthScale >= heightScale ? Math.max(minimumWidth, requestedWidth) : Math.max(minimumWidth, requestedHeight * aspectRatio)
    } else if (hasHorizontal) width = Math.max(minimumWidth, requestedWidth)
    else width = Math.max(minimumWidth, requestedHeight * aspectRatio)
    const height = Math.max(minimumHeight, width / aspectRatio)
    if (handle.includes('e')) { left = -rect.width / 2; right = left + width } else if (handle.includes('w')) { right = rect.width / 2; left = right - width } else { left = -width / 2; right = width / 2 }
    if (handle.includes('s')) { top = -rect.height / 2; bottom = top + height } else if (handle.includes('n')) { bottom = rect.height / 2; top = bottom - height } else { top = -height / 2; bottom = height / 2 }
  } else {
    if (handle.includes('w')) left = Math.min(left + local.x, right - minimumImageSize)
    if (handle.includes('e')) right = Math.max(right + local.x, left + minimumImageSize)
    if (handle.includes('n')) top = Math.min(top + local.y, bottom - minimumImageSize)
    if (handle.includes('s')) bottom = Math.max(bottom + local.y, top + minimumImageSize)
  }
  const centerShift = rotateImageVector({ x: (left + right) / 2, y: (top + bottom) / 2 }, rotation)
  const center = { x: rect.x + rect.width / 2 + centerShift.x, y: rect.y + rect.height / 2 + centerShift.y }
  return clampRotatedImageRect({ x: center.x - (right - left) / 2, y: center.y - (bottom - top) / 2, width: right - left, height: bottom - top }, rotation, bounds)
}

export function imageRotationForPointer(center: PdfPoint, pointer: PdfPoint, snap = false): number {
  const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180 / Math.PI + 90
  const normalized = normalizeImageRotation(angle)
  return snap ? normalizeImageRotation(Math.round(normalized / 15) * 15) : normalized
}

export function initialImageRect(image: { width: number; height: number }, bounds: { width: number; height: number }): PdfRect {
  const safeWidth = Math.max(1, image.width), safeHeight = Math.max(1, image.height)
  const maximumWidth = Math.max(minimumImageSize, bounds.width * .55)
  const maximumHeight = Math.max(minimumImageSize, bounds.height * .55)
  const scale = Math.min(maximumWidth / safeWidth, maximumHeight / safeHeight)
  const width = Math.max(minimumImageSize, safeWidth * scale), height = Math.max(minimumImageSize, safeHeight * scale)
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height }
}
