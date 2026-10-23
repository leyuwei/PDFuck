import type { PdfRect } from '../types'
import { applyMatrix, multiplyMatrix, type Matrix } from './page-coordinates'
import type { WordBox } from './text-layout'

export interface PageGraphic { rect: PdfRect; image: boolean; parts: number }
export interface PageVisual { rect: PdfRect; caption: string; label: string; kind: 'figure' | 'table' }
const right = (r: PdfRect) => r.x + r.width
const bottom = (r: PdfRect) => r.y + r.height
const overlapX = (a: PdfRect, b: PdfRect) => Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x))
const gapY = (a: PdfRect, b: PdfRect) => Math.max(a.y - bottom(b), b.y - bottom(a), 0)
const union = (a: PdfRect, b: PdfRect): PdfRect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(right(a), right(b)) - Math.min(a.x, b.x), height: Math.max(bottom(a), bottom(b)) - Math.min(a.y, b.y) })
const inside = (a: PdfRect, b: PdfRect) => a.x + a.width / 2 >= b.x && a.x + a.width / 2 <= right(b) && a.y + a.height / 2 >= b.y && a.y + a.height / 2 <= bottom(b)
const captionPattern = /^(?:(?:fig(?:ure)?\.?|image|plate|table|tab\.?)\s*(?:\d+(?:[.\-–]\d+)*[a-z]?|[IVX]+)\b|[图表]\s*\d+(?:[.\-–]\d+)*[a-z]?)/i

/** Read painted bounds, including repeated images and PDF.js 6 vector paths. */
export function pageGraphics(operators: { fnArray: number[]; argsArray: any[] }, viewport: Matrix, ops: Record<string, number>): PageGraphic[] {
  const result: PageGraphic[] = [], stack: Array<{ matrix: Matrix; clip?: PdfRect }> = []
  let matrix: Matrix = [1, 0, 0, 1, 0, 0], clip: PdfRect | undefined, pendingClip = false
  const boundsRect = (bounds: number[], local = matrix): PdfRect | undefined => {
    if (bounds.length !== 4 || !bounds.every(Number.isFinite)) return
    const [x1, y1, x2, y2] = bounds, transform = multiplyMatrix(viewport, local)
    const points = [[x1,y1],[x2,y1],[x1,y2],[x2,y2]].map(([x,y]) => applyMatrix(transform, {x,y}))
    const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y))
    return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y }
  }
  const intersect = (a: PdfRect, b: PdfRect): PdfRect => {
    const x = Math.max(a.x,b.x), y = Math.max(a.y,b.y)
    return {x,y,width:Math.max(0,Math.min(right(a),right(b))-x),height:Math.max(0,Math.min(bottom(a),bottom(b))-y)}
  }
  // shortcut: clips use bounding rectangles; use path intersections if irregular clips cause false regions.
  const constrain = (bounds: number[], local = matrix) => {
    const rect = boundsRect(bounds,local)
    if (rect) clip = clip ? intersect(clip,rect) : rect
  }
  const save = () => stack.push({matrix,clip})
  const restore = () => {
    const state = stack.pop()
    matrix = state?.matrix || [1,0,0,1,0,0]; clip = state?.clip; pendingClip = false
  }
  const add = (bounds: number[], image: boolean, local = matrix) => {
    let rect = boundsRect(bounds,local)
    if (!rect || clip && (clip.width <= 0 || clip.height <= 0)) return
    if (clip) {
      if (right(rect) < clip.x || rect.x > right(clip) || bottom(rect) < clip.y || rect.y > bottom(clip)) return
      rect = intersect(rect,clip)
    }
    result.push({rect,image,parts:1})
  }
  const images = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject, ops.paintSolidColorImageMask])
  operators.fnArray.forEach((op, index) => {
    const args = operators.argsArray[index]
    if (op === ops.save) save()
    else if (op === ops.restore || op === ops.paintFormXObjectEnd || op === ops.endGroup) restore()
    else if (op === ops.transform) matrix = multiplyMatrix(matrix, args as Matrix)
    else if (op === ops.paintFormXObjectBegin) {
      save()
      if (args[0]) matrix = multiplyMatrix(matrix,args[0])
      if (args[1]) constrain(Array.from(args[1]))
    } else if (op === ops.beginGroup) {
      save()
      if (args[0].bbox) constrain(Array.from(args[0].bbox),args[0].matrix ? multiplyMatrix(matrix,args[0].matrix) : matrix)
    } else if (op === ops.clip || op === ops.eoClip) pendingClip = true
    else if (op === ops.constructPath) {
      const bounds = args[2] ? Array.from(args[2]) as number[] : [0,0,0,0]
      if (args[0] !== ops.endPath && args[2]) add(bounds,false)
      // PDF.js emits the clip mode before the path that consumes it.
      if (pendingClip) { constrain(bounds); pendingClip = false }
    } else if (images.has(op)) add([0,0,1,1], true)
    else if (op === ops.paintImageXObjectRepeat) {
      const [, sx, sy, positions] = args
      for (let i = 0; i + 1 < positions.length; i += 2) add([0,0,1,1], true, multiplyMatrix(matrix, [sx,0,0,sy,positions[i],positions[i+1]]))
    } else if (op === ops.paintImageMaskXObjectRepeat) {
      const [, sx, kx, ky, sy, positions] = args
      for (let i = 0; i + 1 < positions.length; i += 2) add([0,0,1,1], true, multiplyMatrix(matrix, [sx,kx,ky,sy,positions[i],positions[i+1]]))
    } else if (op === ops.paintInlineImageXObjectGroup) {
      for (const entry of args[1]) add([0,0,1,1], true, multiplyMatrix(matrix, entry.transform))
    } else if (op === ops.paintImageMaskXObjectGroup) {
      for (const entry of args[0]) add([0,0,1,1], true, multiplyMatrix(matrix, entry.transform))
    }
  })
  return result
}

export function detectPageVisuals(words: WordBox[], graphics: PageGraphic[], size: { width: number; height: number }): PageVisual[] {
  if (![size.width,size.height].every(value => Number.isFinite(value) && value > 0)) return []
  const clip = (rect: PdfRect): PdfRect | undefined => {
    if (![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0) return undefined
    const x = Math.max(0,rect.x), y = Math.max(0,rect.y), r = Math.min(size.width,right(rect)), b = Math.min(size.height,bottom(rect))
    // A zero-width/height vector rule inside the crop can still belong to a table.
    if (r < x || b < y || right(rect) <= 0 || bottom(rect) <= 0 || rect.x >= size.width || rect.y >= size.height) return undefined
    return {x,y,width:r-x,height:b-y}
  }
  words = words.filter(word => clip(word.rect))
  const heights = words.map(w => w.rect.height).sort((a,b) => a-b), em = heights[Math.floor(heights.length / 2)] || 10
  const rows: Array<{ words: WordBox[]; rect: PdfRect; text: string }> = []
  for (const word of [...words].sort((a,b) => (a.baselineY ?? bottom(a.rect)) - (b.baselineY ?? bottom(b.rect)) || a.rect.x - b.rect.x)) {
    const row = rows.find(row => Math.abs((row.words[0].baselineY ?? bottom(row.words[0].rect)) - (word.baselineY ?? bottom(word.rect))) < Math.min(em, word.rect.height) * .3 && (row.words[0].column === word.column || word.textRun !== undefined && row.words.some(w => w.textRun === word.textRun)) && !(word.rect.x-right(row.rect) > em * 4 && (/^(?:fig(?:ure)?\.?|image|plate|table|tab\.?|[图表])(?:\s|\d|$)/i.test(word.text) || /^\([a-z]\)$/i.test(word.text))))
    if (row) { row.words.push(word); row.rect = union(row.rect, word.rect) }
    else rows.push({words: [word], rect: {...word.rect}, text: ''})
  }
  for (const row of rows) row.text = row.words.sort((a,b) => a.rect.x-b.rect.x).map(w => w.text).join(' ').replace(/([图表])\s+(?=\d)/g, '$1')
  const captions = rows.filter(row => {
    const marker = row.text.match(captionPattern)
    return marker && !/^(?:shows?|illustrates?|is|are|was|were|can|provides?|compares?|summarizes?|presents?|所示|显示|展示|说明|给出)\b/i.test(row.text.slice(marker[0].length).trim())
  })
  const clusters: PageGraphic[] = []
  for (const graphic of graphics) {
    const r = clip(graphic.rect)
    if (!r || r.width > size.width * .95 && r.height > size.height * .8 || r.width * r.height > size.width * size.height * .7) continue
    if (r.width < 2 && r.height < 2) continue
    let merged = {...graphic, rect: {...r}}
    // Transitive merging keeps a grid or multi-part vector plot together.
    for (let index = 0; index < clusters.length;) {
      const other = clusters[index], dx = Math.max(merged.rect.x - right(other.rect), other.rect.x - right(merged.rect), 0)
      if (dx <= em * .45 && gapY(merged.rect, other.rect) <= em * .45) {
        merged = {rect: union(merged.rect, other.rect), image: merged.image || other.image, parts: merged.parts + other.parts}; clusters.splice(index,1); index = 0
      } else index++
    }
    clusters.push(merged)
  }
  // Explicit (a), (b), ... labels bind separated panels to their shared caption.
  for (const caption of captions.filter(row => !/^(?:table|tab\.?|表)/i.test(row.text) && /\(a\)/i.test(row.text))) {
    const captionEm = Math.max(em,caption.rect.height), previous = Math.max(0,...captions.filter(row => row.rect.y < caption.rect.y).map(row => bottom(row.rect)))
    const panels = rows.filter(row => /^\([a-z]\)$/i.test(row.text) && row.rect.y >= previous && bottom(row.rect) <= caption.rect.y && row.rect.x >= caption.rect.x && right(row.rect) <= right(caption.rect))
      .map(row => ({row,graphic:clusters.filter(g => row.rect.x+row.rect.width/2 >= g.rect.x && row.rect.x+row.rect.width/2 <= right(g.rect) && row.rect.y >= bottom(g.rect)-captionEm*.3 && gapY(row.rect,g.rect) <= captionEm*3.5).sort((a,b) => gapY(row.rect,a.rect)-gapY(row.rect,b.rect))[0]}))
      .filter(panel => panel.graphic).sort((a,b) => a.row.text.localeCompare(b.row.text))
    if (panels.length < 2 || panels.some((panel,i) => panel.row.text.toLowerCase() !== `(${String.fromCharCode(97+i)})`) || caption.rect.y-Math.max(...panels.map(panel => bottom(panel.row.rect))) > captionEm*3.5) continue
    const parts = [...new Set(panels.map(panel => panel.graphic))], rect = panels.reduce((r,panel) => union(union(r,panel.graphic.rect),panel.row.rect),parts[0].rect)
    // Body text between panels is evidence that they are separate figures.
    if (rows.some(row => row.rect.y >= rect.y && bottom(row.rect) <= bottom(rect) && overlapX(row.rect,rect) > Math.min(row.rect.width,rect.width)*.45 && row.text.length > 85 && !parts.some(part => inside(row.rect,part.rect)))) continue
    for (const part of parts) clusters.splice(clusters.indexOf(part),1)
    clusters.push({rect,image:parts.some(part => part.image),parts:parts.reduce((sum,part) => sum+part.parts,0)})
  }
  const visuals: PageVisual[] = [], used = new Set<typeof captions[number]>()
  for (const graphic of clusters.sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)) {
    const r = graphic.rect
    if (r.width < em * 2 || r.height < em * 1.6) continue
    const caption = captions.filter(row => !used.has(row) && overlapX(row.rect,r) >= Math.min(row.rect.width,r.width) * .45 && gapY(row.rect,r) <= Math.max(em,row.rect.height) * 3.5)
      .sort((a,b) => gapY(a.rect,r)-gapY(b.rect,r))[0]
    const enclosedRows = rows.filter(row => inside(row.rect,r))
    const prose = enclosedRows.filter(row => row.text.length > 85 && row.rect.width > Math.min(r.width * .7,size.width * .35))
    // A page-sized scan, highlighted paragraph or decorated heading is not a figure.
    if (prose.length >= 3 && (!caption || inside(caption.rect,r)) || !caption && (r.width < em * 4 || r.height < em * 3 || !graphic.image && (graphic.parts < 6 || r.height < em * 5))) continue
    const kind = caption && /^(?:table|tab\.?|表)/i.test(caption.text) ? 'table' : 'figure'
    let bounds = {...r}, text = caption?.text || ''
    if (caption) {
      used.add(caption); bounds = union(bounds, caption.rect)
      // Follow only tightly spaced caption continuation rows; stop at body spacing/indent.
      let last = caption
      const captionEm = Math.max(em,caption.rect.height)
      for (const next of rows.filter(row => row.rect.y > caption.rect.y && overlapX(row.rect,caption.rect) > 0).sort((a,b) => a.rect.y-b.rect.y)) {
        if (next === caption || next.rect.y < bottom(last.rect) - em * .2) continue
        const gap = next.rect.y-bottom(last.rect)
        if (gap > captionEm * .65 || captionPattern.test(next.text) || Math.abs(next.rect.x-caption.rect.x) > captionEm || next.rect.width > Math.max(r.width,caption.rect.width) + captionEm) break
        bounds = union(bounds,next.rect); text += ' ' + next.text; last = next
      }
    }
    if (kind === 'table') {
      const noteWords = words.filter(w => w.rect.y >= bottom(bounds) && w.rect.y-bottom(bounds) <= em * 1.2 && overlapX(w.rect,bounds) > 0).sort((a,b) => a.rect.x-b.rect.x)
      if (noteWords.length) {
        const note = noteWords.reduce((r,w) => union(r,w.rect),noteWords[0].rect)
        const noteText = noteWords.map(w => w.text).join(' ')
        const legend = /^(?:[●○•◦*†‡]|notes?\b|source\b|注|说明)/i.test(noteText) || note.width > bounds.width * .7 && noteWords.filter(w => w.text.length === 1).length >= 3
        if (legend) bounds = union(bounds,note)
      }
    }
    visuals.push({rect: bounds, caption: text, label: caption?.text.match(captionPattern)?.[0] || 'ui.image', kind})
  }
  // Borderless tables require a caption and at least three aligned multi-cell rows.
  for (const caption of captions.filter(c => !used.has(c) && /^(?:table|tab\.?|表)/i.test(c.text))) {
    const tableRight = Math.min(size.width, ...captions.filter(row => row.rect.x > caption.rect.x + em * 3 && Math.abs(row.rect.y-caption.rect.y) < em * 2).map(row => row.rect.x-em))
    const candidates: typeof rows = []
    for (const word of words.filter(w => w.rect.x >= caption.rect.x-em && right(w.rect) <= tableRight && w.rect.y >= bottom(caption.rect) && w.rect.y-bottom(caption.rect) <= em * 14).sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)) {
      const row = candidates.find(row => Math.abs(row.rect.y-word.rect.y) < em * .3)
      if (row) { row.words.push(word); row.rect = union(row.rect,word.rect); row.text += ' ' + word.text }
      else candidates.push({words:[word],rect:{...word.rect},text:word.text})
    }
    candidates.forEach(row => row.words.sort((a,b) => a.rect.x-b.rect.x))
    const grid: typeof rows = []
    for (const row of candidates) {
      const previous = grid.at(-1)
      if (row.rect.y - (previous ? bottom(previous.rect) : bottom(caption.rect)) > em * 2.5) break
      const cells = row.words.filter((w,i) => i === 0 || w.rect.x-right(row.words[i-1].rect) > em * 1.5)
      if (cells.length < 2 || row.text.length > 100) break
      if (grid.length && cells.filter(cell => grid[0].words.some(w => Math.abs(w.rect.x-cell.rect.x) < em)).length < 2) break
      grid.push(row)
    }
    if (grid.length >= 3) visuals.push({rect: grid.reduce((r,row) => union(r,row.rect),caption.rect),caption:caption.text,label:caption.text.match(captionPattern)![0],kind:'table'})
  }
  return visuals.flatMap(visual => { const rect = clip(visual.rect); return rect && rect.width > 0 && rect.height > 0 ? [{...visual,rect}] : [] }).sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)
}

export function isolateVisualWords(words: WordBox[], visuals: PageVisual[]): WordBox[] {
  return words.map(word => {
    const region = visuals.findIndex(visual => inside(word.rect,visual.rect))
    return region < 0 ? word : {...word, visualRegion: region}
  })
}
