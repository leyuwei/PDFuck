import type { PdfPoint, PdfRect } from '../types'

export type Matrix = [number, number, number, number, number, number]

export interface PageGeometry {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export function multiplyMatrix(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ]
}

export function applyMatrix(matrix: Matrix, point: PdfPoint): PdfPoint {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5]
  }
}

export function inverseMatrix(matrix: Matrix): Matrix {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2]
  if (Math.abs(determinant) < 1e-12) throw new Error('页面坐标矩阵不可逆。')
  return [
    matrix[3] / determinant,
    -matrix[1] / determinant,
    -matrix[2] / determinant,
    matrix[0] / determinant,
    (matrix[2] * matrix[5] - matrix[4] * matrix[3]) / determinant,
    (matrix[4] * matrix[1] - matrix[0] * matrix[5]) / determinant
  ]
}

export function pageViewportMatrix(page: PageGeometry): Matrix {
  const rotation = ((page.rotation % 360) + 360) % 360
  const centerX = page.x + page.width / 2
  const centerY = page.y + page.height / 2
  let a = 1, b = 0, c = 0, d = -1
  if (rotation === 90) [a, b, c, d] = [0, 1, 1, 0]
  else if (rotation === 180) [a, b, c, d] = [-1, 0, 0, 1]
  else if (rotation === 270) [a, b, c, d] = [0, -1, -1, 0]
  else if (rotation !== 0) throw new Error('页面旋转角度必须是 90 度的倍数。')
  const offsetX = a === 0 ? page.height / 2 : page.width / 2
  const offsetY = a === 0 ? page.width / 2 : page.height / 2
  return [a, b, c, d, offsetX - a * centerX - c * centerY, offsetY - b * centerX - d * centerY]
}

function rectCorners(rect: PdfRect): PdfPoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height }
  ]
}

function bounds(points: PdfPoint[]): PdfRect {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function displayRectToPdfBounds(rect: PdfRect, page: PageGeometry): number[] {
  const inverse = inverseMatrix(pageViewportMatrix(page))
  const result = bounds(rectCorners(rect).map((point) => applyMatrix(inverse, point)))
  return [result.x, result.y, result.x + result.width, result.y + result.height]
}

export function pdfBoundsToDisplayRect(values: number[], page: PageGeometry): PdfRect {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = values
  return bounds(rectCorners({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }).map((point) => applyMatrix(pageViewportMatrix(page), point)))
}

export function displayRectsToPdfQuads(rects: PdfRect[], page: PageGeometry): number[] {
  const inverse = inverseMatrix(pageViewportMatrix(page))
  return rects.flatMap((rect) => {
    const [topLeft, topRight, bottomLeft, bottomRight] = rectCorners(rect).map((point) => applyMatrix(inverse, point))
    return [topLeft.x, topLeft.y, topRight.x, topRight.y, bottomLeft.x, bottomLeft.y, bottomRight.x, bottomRight.y]
  })
}

export function pdfQuadsToDisplayRects(values: number[], page: PageGeometry): PdfRect[] {
  const matrix = pageViewportMatrix(page)
  const rects: PdfRect[] = []
  for (let index = 0; index + 7 < values.length; index += 8) {
    const points: PdfPoint[] = []
    for (let offset = 0; offset < 8; offset += 2) points.push(applyMatrix(matrix, { x: values[index + offset], y: values[index + offset + 1] }))
    rects.push(bounds(points))
  }
  return rects
}
