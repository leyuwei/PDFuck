import { captionKind, captionLabel, captionMarkerPattern, captionNumberPattern } from './caption-label'
import type { PdfRect } from '../types'
import { applyMatrix, multiplyMatrix, type Matrix } from './page-coordinates'
import { textLineRect, type WordBox } from './text-layout'
import { detectTableGrids } from './table-cells'

export interface PageGraphic { rect: PdfRect; image: boolean; parts: number; rules?: PdfRect[]; fillOnly?: true }
export interface PageVisual { rect: PdfRect; caption: string; label: string; kind: 'figure' | 'table'; cells?: PdfRect[]; textRects?: PdfRect[]; tableBody?: PdfRect; figureBody?: PdfRect; labelRects?: PdfRect[] }
const right = (r: PdfRect) => r.x + r.width
const bottom = (r: PdfRect) => r.y + r.height
const centerX = (r: PdfRect) => r.x + r.width / 2
const overlapX = (a: PdfRect, b: PdfRect) => Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x))
const overlapY = (a: PdfRect, b: PdfRect) => Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y))
const gapY = (a: PdfRect, b: PdfRect) => Math.max(a.y - bottom(b), b.y - bottom(a), 0)
const union = (a: PdfRect, b: PdfRect): PdfRect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(right(a), right(b)) - Math.min(a.x, b.x), height: Math.max(bottom(a), bottom(b)) - Math.min(a.y, b.y) })
const inside = (a: PdfRect, b: PdfRect) => a.x + a.width / 2 >= b.x && a.x + a.width / 2 <= right(b) && a.y + a.height / 2 >= b.y && a.y + a.height / 2 <= bottom(b)
const baseline = (word: WordBox) => word.baselineY ?? bottom(word.rect)
const rightToLeft = (words: WordBox[]) => words.filter(word => word.rtl || /\p{Script=Arabic}/u.test(word.text)).length >= (words.length + 1) / 2
  || words.some(word => /\p{Script=Arabic}/u.test(word.text)) && words.every(word => !/\p{Script=Latin}/u.test(word.text))
const rowText = (words: WordBox[]) => {
  const direction = rightToLeft(words) ? -1 : 1
  return [...words].sort((a,b) => direction * (a.rect.x - b.rect.x)).map(word => word.text).join(' ')
}

/** Read painted bounds, including repeated images and PDF.js 6 vector paths. */
export function pageGraphics(operators: { fnArray: number[]; argsArray: any[] }, viewport: Matrix, ops: Record<string, number>): PageGraphic[] {
  const result: PageGraphic[] = [], stack: Array<{ matrix: Matrix; clip?: PdfRect; fillAlpha: number; strokeAlpha: number }> = []
  let matrix: Matrix = [1, 0, 0, 1, 0, 0], clip: PdfRect | undefined, pendingClip = false
  let fillAlpha = 1, strokeAlpha = 1
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
  const save = () => stack.push({matrix,clip,fillAlpha,strokeAlpha})
  const restore = () => {
    const state = stack.pop()
    matrix = state?.matrix || [1,0,0,1,0,0]; clip = state?.clip; pendingClip = false
    fillAlpha = state?.fillAlpha ?? 1; strokeAlpha = state?.strokeAlpha ?? 1
  }
  const visibleRect = (bounds: number[], local = matrix) => {
    let rect = boundsRect(bounds,local)
    if (!rect || clip && (clip.width <= 0 || clip.height <= 0)) return
    if (clip) {
      if (right(rect) < clip.x || rect.x > right(clip) || bottom(rect) < clip.y || rect.y > bottom(clip)) return
      rect = intersect(rect,clip)
    }
    return rect
  }
  const add = (bounds: number[], image: boolean, local = matrix) => {
    const rect = visibleRect(bounds,local)
    if (!rect) return
    const graphic: PageGraphic = {rect,image,parts:1}
    result.push(graphic)
    return graphic
  }
  const images = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject, ops.paintSolidColorImageMask])
  const fillOps = new Set([ops.fill, ops.eoFill])
  const strokeOps = new Set([ops.stroke, ops.closeStroke])
  const fillStrokeOps = new Set([ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke])
  let annotation = false
  operators.fnArray.forEach((op, index) => {
    const args = operators.argsArray[index]
    if (op === ops.beginAnnotation) { annotation = true; return }
    if (op === ops.endAnnotation) { annotation = false; return }
    if (annotation) return
    if (op === ops.save) save()
    else if (op === ops.restore || op === ops.paintFormXObjectEnd || op === ops.endGroup) restore()
    else if (op === ops.transform) matrix = multiplyMatrix(matrix, args as Matrix)
    else if (op === ops.setGState) {
      for (const [key, value] of args) {
        if (key === 'ca') fillAlpha = value
        else if (key === 'CA') strokeAlpha = value
      }
    }
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
      const paint = args[0]
      const fills = fillOps.has(paint) || fillStrokeOps.has(paint)
      const strokes = strokeOps.has(paint) || fillStrokeOps.has(paint)
      const visiblePaint = !fills && !strokes || fills && fillAlpha > 0 || strokes && strokeAlpha > 0
      if (paint !== ops.endPath && args[2] && visiblePaint) {
        const graphic = add(bounds,false), data = args[1]?.[0]
        if (graphic && (fills && (!strokes || strokeAlpha === 0))) graphic.fillOnly = true
        if (graphic && strokes && strokeAlpha > 0 && (Array.isArray(data) || ArrayBuffer.isView(data))) {
          const values = Array.from(data as ArrayLike<number>), rules: PdfRect[] = []
          let current: number[] | undefined, start: number[] | undefined
          const edge = (next: number[]) => {
            if (current) {
              const rect = visibleRect([current[0],current[1],next[0],next[1]])
              if (rect && Math.min(rect.width,rect.height) < .01) rules.push(rect)
            }
            current = next
          }
          for (let i=0;i<values.length;) {
            const command=values[i++]
            if (command===0) {current=values.slice(i,i+2);start=current;i+=2}
            else if (command===1) {edge(values.slice(i,i+2));i+=2}
            else if (command===2) {current=values.slice(i+4,i+6);i+=6}
            else if (command===3) {current=values.slice(i+2,i+4);i+=4}
            else if (command===4 && start) edge(start)
            else break
          }
          if (rules.length) graphic.rules=rules
        }
      }
      // PDF.js emits the clip mode before the path that consumes it.
      if (pendingClip) { constrain(bounds); pendingClip = false }
    } else if (fillAlpha === 0) return
    else if (images.has(op)) add([0,0,1,1], true)
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
  // An interior table rule near the edge can resemble a running-header separator.
  const tableWords = words.filter(word => (word.visualRegion === undefined || word.visualRegion >= -2) && clip(word.rect))
  words = tableWords.filter(word => word.visualRegion === undefined || word.visualRegion >= 0)
  const heights = words.map(w => w.rect.height).sort((a,b) => a-b), em = heights[Math.floor(heights.length / 2)] || 10
  const textLeft = words.reduce((left, word) => /^\d+$/.test(word.text) ? left : Math.min(left, word.rect.x), Infinity)
  const captionPair = (marker: WordBox, number: WordBox) => {
    if (!captionMarkerPattern.test(marker.text) || !captionNumberPattern.test(number.text)) return false
    const gap = rightToLeft([marker]) ? marker.rect.x-right(number.rect) : number.rect.x-right(marker.rect)
    return gap >= -em*.25 && gap < em*2
  }
  const makeRows = (source: WordBox[], contiguous = false) => {
    const rows: Array<{ words: WordBox[]; rect: PdfRect; text: string }> = []
    for (const word of [...source].sort((a,b) => baseline(a) - baseline(b) || a.rect.x - b.rect.x)) {
      const row = rows.find(row => {
        if (Math.abs(baseline(row.words[0]) - baseline(word)) >= Math.min(em, word.rect.height) * .3) return false
        const gap = Math.max(word.rect.x-right(row.rect),row.rect.x-right(word.rect))
        if (contiguous) return gap <= em * .85
        const sameRun = word.textRun !== undefined && row.words.some(w => w.textRun === word.textRun)
        const joinsNumber = row.words.some(other => captionPair(other,word) || captionPair(word,other))
        return (row.words[0].column === word.column || sameRun || joinsNumber)
          && !(row.words.every(w => /^\d+$/.test(w.text)) && right(row.rect) < textLeft - em * .5)
          && !(gap > em * 4 && (captionMarkerPattern.test(word.text) || captionLabel(word.text) || /^\([a-z]\)$/i.test(word.text)))
      })
      if (row) { row.words.push(word); row.rect = union(row.rect, word.rect) }
      else rows.push({words: [word], rect: {...word.rect}, text: ''})
    }
    for (const row of rows) row.text = rowText(row.words).replace(/([图圖図表])\s+(?=\p{Nd})/gu, '$1')
    return rows
  }
  const rows = makeRows(words)
  const captions = rows.flatMap(row => {
    const label = captionLabel(row.text)
    return label ? [{ ...row, label, kind: captionKind(label) }] : []
  })
  const proseRows = rows.filter(row => row.rect.width >= em * 8
    && row.words.reduce((width, word) => width + word.rect.width, 0) / row.rect.width >= .65
    && row.text.replace(/[^\p{L}\p{N}]/gu, '').length >= 12)
  const proseHeights = proseRows.filter(row => row.words.length >= 6 && !row.words.some(word => word.rotated))
    .map(row => row.words[0].rect.height).sort((a,b) => a-b)
  const bodyEm = Math.max(em,proseHeights[Math.floor(proseHeights.length / 2)] ?? em)
  function containsProseBand(rect: PdfRect, fraction: number) {
    const insideRows = proseRows.filter(row => inside(row.rect,rect) && overlapX(row.rect,rect) >= row.rect.width * .8)
    if (insideRows.length < 5 || baseline(insideRows.at(-1)!.words[0]) - baseline(insideRows[0].words[0]) < rect.height * fraction) return false
    return insideRows.some((row, index) => {
      const firstY = baseline(row.words[0])
      return insideRows.slice(index + 1, index + 5).filter(next => {
        const dy = baseline(next.words[0]) - firstY
        return dy > em * .45 && dy < em * 3.8 && overlapX(row.rect,next.rect) >= Math.min(row.rect.width,next.rect.width) * .8
      }).length >= 2
    })
  }
  const tables = detectTableGrids(words,graphics,size)
  const ruleSegments = graphics.filter(g => !g.image).flatMap(g => g.rules || [g.rect])
    .filter(r => r.height <= em * .15 && r.width >= em * 2).sort((a,b) => a.y-b.y || a.x-b.x)
  const horizontalRules: PdfRect[] = []
  for (const segment of ruleSegments) {
    const index = horizontalRules.findIndex(rule => Math.abs(rule.y-segment.y) <= em*.12 &&
      Math.max(rule.x-right(segment),segment.x-right(rule)) <= em*.3)
    if (index < 0) horizontalRules.push(segment)
    else horizontalRules[index] = union(horizontalRules[index],segment)
  }
  const longRules = horizontalRules.filter(r => r.width >= em * 8)
  const openTableCaptions = new Map<PdfRect, typeof captions[number]>()
  const aligned = (a: PdfRect, b: PdfRect) => Math.abs(a.x-b.x) <= em*.3 && Math.abs(right(a)-right(b)) <= em*.3
  const sameLane = (a: PdfRect, b: PdfRect) => overlapX(a,b) >= Math.min(a.width,b.width)*.8
  const inRuleBand = (w: WordBox, edge: PdfRect, top: number, foot: number) => {
    const x = w.rect.x + w.rect.width / 2, y = baseline(w)
    return x >= edge.x - em*.2 && x <= right(edge) + em*.2 && y >= top && y < foot
  }
  const edgeCaptions = makeRows(tableWords.filter(word => word.visualRegion === -1 || word.visualRegion === -2)).flatMap(row => {
    const label = captionLabel(row.text)
    return label && captionKind(label) === 'table' ? [{...row,label,kind:'table' as const}] : []
  })
  for (const caption of [...captions.filter(c => c.kind === 'table'), ...edgeCaptions]) {
    const adjacentRules = longRules.filter(rule => sameLane(rule,caption.rect) &&
      (rule.y >= bottom(caption.rect) - em*.2 && rule.y - bottom(caption.rect) <= em*6 ||
       bottom(rule) <= caption.rect.y + em*.2 && caption.rect.y - bottom(rule) <= em*2.5))
      .sort((a,b) => gapY(a,caption.rect)-gapY(b,caption.rect))
    for (const edge of adjacentRules) {
      const below = edge.y > caption.rect.y
      const otherCaptions = captions.filter(other => other !== caption && sameLane(other.rect,edge))
      const limit = below
        ? Math.min(size.height,...otherCaptions.filter(other => other.rect.y > edge.y).map(other => other.rect.y))
        : Math.max(0,...otherCaptions.filter(other => bottom(other.rect) < edge.y).map(other => bottom(other.rect)))
      let rules = longRules.filter(rule => aligned(edge,rule) &&
        (below ? rule.y >= edge.y && rule.y < limit : rule.y <= edge.y && rule.y > limit))
        .filter((rule,index,all) => !index || rule.y-all[index-1].y > em*.2)
      // The empty interval between two same-width tables separates their rules.
      for (let index = below ? 1 : rules.length - 1; index > 0 && index < rules.length; index += below ? 1 : -1) {
        if (rules[index].y-rules[index-1].y <= em*.65 ||
            tableWords.some(word => inRuleBand(word,edge,rules[index-1].y,rules[index].y))) continue
        rules = below ? rules.slice(0,index) : rules.slice(index)
        break
      }
      if (rules.length < 3) continue
      const [top,header] = rules, foot = rules.at(-1)!
      if (header.y-top.y > em*5 || !tableWords.some(word => inRuleBand(word,edge,top.y,header.y))) continue
      const lines: WordBox[][] = []
      for (const word of tableWords.filter(word => inRuleBand(word,edge,header.y,foot.y)).sort((a,b) => baseline(a)-baseline(b) || a.rect.x-b.rect.x)) {
        const row = lines.at(-1)
        if (row && Math.abs(baseline(row[0])-baseline(word)) < em*.3) row.push(word)
        else lines.push([word])
      }
      const starts = lines.map(line => line.sort((a,b) => a.rect.x-b.rect.x)
        .filter((word,index) => index > 0 && word.rect.x-right(line[index-1].rect) > em*.8).map(word => word.rect.x))
      if (!starts.some((row,index) => row.some(x => starts.slice(index+1).some(next => next.some(other => Math.abs(other-x)<em*.6))))) continue
      const rect = union(top,foot)
      if (!tables.some(table => inside(rect,table.rect))) {
        tables.push({rect,cells:[]})
        openTableCaptions.set(rect,caption)
      }
      break
    }
  }
  const clusters: PageGraphic[] = []
  const openTables = [...openTableCaptions.keys()]
  const boundCaptions = new Set(openTableCaptions.values())
  for (const graphic of graphics) {
    const r = clip(graphic.rect)
    if (!r || r.width > size.width * .95 && r.height > size.height * .8 || r.width * r.height > size.width * size.height * .7) continue
    if (!graphic.image && openTables.some(table => inside(r,table) && overlapX(r,table) >= r.width*.9 && overlapY(r,table) >= r.height*.9)) continue
    // A continuous prose band on a large filled path is evidence of page furniture.
    if (!graphic.image && (r.height > size.height * .55 || 'fillOnly' in graphic && graphic.fillOnly && r.height > size.height * .24)
      && containsProseBand(r,.45) && !tables.some(table => inside(r,table.rect) && table.rect.height >= r.height * .9)) continue
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
  const panelRects = new Map<PageGraphic, PdfRect[]>()
  const panelCaptions = new Map<PageGraphic, typeof captions[number]>()
  const groupedCaptions = new Set<typeof captions[number]>()
  const mergePanels = (parts: PageGraphic[], rects: PdfRect[], caption: typeof captions[number]) => {
    const merged = {
      rect: rects.reduce(union),
      image: parts.some(part => part.image),
      parts: parts.reduce((sum, part) => sum + part.parts, 0)
    }
    for (const part of parts) clusters.splice(clusters.indexOf(part), 1)
    clusters.push(merged)
    panelRects.set(merged, rects)
    panelCaptions.set(merged, caption)
    groupedCaptions.add(caption)
  }
  // Explicit (a), (b), ... labels bind separated panels to their shared caption.
  for (const caption of captions.filter(row => row.kind === 'figure' && /\(a\)/i.test(row.text))) {
    const captionEm = Math.max(em,caption.rect.height), previous = Math.max(0,...captions.filter(row => row.rect.y < caption.rect.y).map(row => bottom(row.rect)))
    const panels = rows.filter(row => /^\([a-z]\)$/i.test(row.text) && row.rect.y >= previous && bottom(row.rect) <= caption.rect.y && row.rect.x >= caption.rect.x && right(row.rect) <= right(caption.rect))
      .map(row => ({row,graphic:clusters.filter(g => row.rect.x+row.rect.width/2 >= g.rect.x && row.rect.x+row.rect.width/2 <= right(g.rect) && row.rect.y >= bottom(g.rect)-captionEm*.3 && gapY(row.rect,g.rect) <= captionEm*3.5).sort((a,b) => gapY(row.rect,a.rect)-gapY(row.rect,b.rect))[0]}))
      .filter(panel => panel.graphic).sort((a,b) => a.row.text.localeCompare(b.row.text))
    if (panels.length < 2 || panels.some((panel,i) => panel.row.text.toLowerCase() !== `(${String.fromCharCode(97+i)})`) || caption.rect.y-Math.max(...panels.map(panel => bottom(panel.row.rect))) > captionEm*3.5) continue
    const parts = [...new Set(panels.map(panel => panel.graphic))], rect = panels.reduce((r,panel) => union(union(r,panel.graphic.rect),panel.row.rect),parts[0].rect)
    // Body text between panels is evidence that they are separate figures.
    if (rows.some(row => row.rect.y >= rect.y && bottom(row.rect) <= bottom(rect) && overlapX(row.rect,rect) > Math.min(row.rect.width,rect.width)*.45 && row.text.length > 85 && !parts.some(part => inside(row.rect,part.rect)))) continue
    mergePanels(parts, [...parts.map(part => part.rect), ...panels.map(panel => panel.row.rect)], caption)
  }
  // Closely stacked, aligned panels can share one caption without (a)/(b) markers.
  for (const caption of captions.filter(row => row.kind === 'figure' && !groupedCaptions.has(row))) {
    const available = clusters.filter(part => !panelCaptions.has(part) && part.rect.width >= em * 5 && part.rect.height >= em * 2.5
      && bottom(part.rect) <= caption.rect.y + em * .25
      && !tables.some(table => inside(table.rect, part.rect))
      && !containsProseBand(part.rect, .5))
    const aligned = (a: PdfRect, b: PdfRect) => overlapX(a,b) >= Math.max(a.width,b.width) * .82
    const sharesLane = (rect: PdfRect, panel: PdfRect) => overlapX(rect,panel) >= Math.min(rect.width,panel.width) * .6
    const blocked = (upper: PdfRect, lower: PdfRect) =>
      captions.some(other => other !== caption && other.rect.y >= upper.y && other.rect.y < lower.y && sharesLane(other.rect,upper))
      || proseRows.some(row => row.rect.y >= bottom(upper) - em * .25 && bottom(row.rect) <= lower.y + em * .25
        && row.rect.height >= em * .85 && !row.words.some(word => word.rotated) && sharesLane(row.rect,upper))
    // A shallow, detached legend centered across two aligned plots can sit closer
    // to the caption than either plot. Bind the three pieces before proximity matching.
    for (const legend of clusters.filter(part => !part.image && !panelCaptions.has(part)
      && part.parts >= 3 && part.rect.width >= em * 8 && part.rect.height >= em * .9 && part.rect.height <= em * 3.6
      && bottom(part.rect) <= caption.rect.y + em * .25 && gapY(part.rect,caption.rect) <= em * 2.5
      && sharesLane(part.rect,caption.rect) && !blocked(part.rect,caption.rect))) {
      const panels = available.filter(part => part !== legend && bottom(part.rect) <= legend.rect.y
        && gapY(part.rect,legend.rect) <= em * 6 && overlapX(part.rect,legend.rect) >= part.rect.width * .2
        && overlapX(part.rect,caption.rect) >= part.rect.width * .3 && !blocked(part.rect,legend.rect))
        .sort((a,b) => bottom(b.rect) - bottom(a.rect))
      const matches = (a: PageGraphic, b: PageGraphic) => {
        const [left, rightPanel] = [a.rect,b.rect].sort((x,y) => x.x-y.x)
        const gap = rightPanel.x - right(left)
        return gap >= 0 && gap <= em * 3.5 && overlapY(left,rightPanel) >= Math.max(left.height,rightPanel.height) * .82
          && Math.min(left.width,rightPanel.width) >= Math.max(left.width,rightPanel.width) * .65
      }
      const first = panels.find((part,index) => panels.slice(index+1).some(other => matches(part,other)))
      const second = first && panels.slice(panels.indexOf(first)+1).find(part => matches(first,part))
      if (!first || !second) continue
      const parts = [first,second,legend]
      mergePanels(parts, parts.map(part => part.rect), caption)
      break
    }
    if (groupedCaptions.has(caption)) continue
    const seed = available.filter(part => overlapX(part.rect,caption.rect) >= Math.min(part.rect.width,caption.rect.width) * .65
      && gapY(part.rect,caption.rect) <= em * 3.5)
      .sort((a,b) => bottom(b.rect) - bottom(a.rect))[0]
    if (!seed) continue
    if (blocked(seed.rect, caption.rect)) continue
    const parts = [seed]
    for (const part of available.sort((a,b) => bottom(b.rect) - bottom(a.rect))) {
      const lower = parts.at(-1)!.rect
      if (part === seed || bottom(part.rect) > lower.y + em * .2 || gapY(part.rect,lower) > em * 1.65
        || !aligned(part.rect,seed.rect) || blocked(part.rect,lower)) continue
      parts.push(part)
    }
    // A caption spanning two side-by-side panels is stronger evidence than proximity alone.
    const aboveCaption = (rect: PdfRect) => gapY(rect,caption.rect) <= em * 3.5
      && overlapX(rect,caption.rect) >= rect.width * .4
    if (parts.length === 1 && aboveCaption(seed.rect)) {
      for (const part of available) {
        if (part === seed || !aboveCaption(part.rect)) continue
        const [left, rightPanel] = [seed.rect,part.rect].sort((a,b) => a.x-b.x)
        const gap = rightPanel.x - right(left)
        if (gap < 0 || gap > em * 1.65 || overlapY(left,rightPanel) < Math.max(left.height,rightPanel.height) * .85
          || blocked(part.rect,caption.rect)) continue
        parts.push(part)
      }
    }
    if (parts.length < 2) continue
    const titles = parts.flatMap(part => rows.flatMap(row => {
      if (row.rect.y >= part.rect.y || bottom(row.rect) < part.rect.y - em * 1.2 || captionLabel(row.text)) return []
      const words = row.words.filter(word => word.rect.height < em * .85 && word.rect.x >= part.rect.x && right(word.rect) <= right(part.rect))
      return words.length ? [words.map(word => word.rect).reduce(union)] : []
    }))
    mergePanels(parts, [...parts.map(part => part.rect), ...titles], caption)
  }
  for (const rect of openTables) clusters.push({rect,image:false,parts:3})
  const visuals: PageVisual[] = [], used = new Set<typeof captions[number]>()
  for (const graphic of clusters.sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)) {
    const r = graphic.rect
    if (r.width < em * 2 || r.height < em * 1.6) continue
    const table = tables.find(table => Math.abs(table.rect.x-r.x)<=em && Math.abs(table.rect.y-r.y)<=em && Math.abs(right(table.rect)-right(r))<=em && Math.abs(bottom(table.rect)-bottom(r))<=em)
    const hasGrid=tables.some(grid=>inside(grid.rect,r))
    const boundCaption = table && openTableCaptions.get(table.rect)
    const caption = boundCaption ?? panelCaptions.get(graphic) ?? captions.filter(row => (!hasGrid || row.kind === 'table') && !used.has(row) && !groupedCaptions.has(row) && !boundCaptions.has(row) && overlapX(row.rect,r) >= Math.min(row.rect.width,r.width) * .45 && gapY(row.rect,r) <= Math.max(em,row.rect.height) * (hasGrid && row.kind === 'table' ? 6 : 3.5))
      .sort((a,b) => gapY(a.rect,r)-gapY(b.rect,r))[0]
    const enclosedRows = rows.filter(row => inside(row.rect,r))
    const prose = enclosedRows.filter(row => row.text.length > 85 && row.rect.width > Math.min(r.width * .7,size.width * .35))
    // A page-sized scan, highlighted paragraph or decorated heading is not a figure.
    if (!table && (r.height > size.height * .35 && containsProseBand(r,.55) || prose.length >= 3 && (!caption || inside(caption.rect,r)) || !caption && (r.width < em * 4 || r.height < em * 3 || !graphic.image && (graphic.parts < 6 || r.height < em * 5)))) continue
    const kind = table ? 'table' : caption?.kind ?? 'figure'
    let bounds = {...(table?.rect || r)}, text = ''
    const panels = panelRects.get(graphic) ?? [bounds]
    const textRects = [...panels]
    const labelRects: PdfRect[] = []
    if (caption) {
      used.add(caption)
      const captionHeights=caption.words.map(word=>word.rect.height).sort((a,b)=>a-b)
      const captionFont=captionHeights[Math.floor(captionHeights.length/2)] || em
      const captionEm = Math.max(em,caption.rect.height)
      const rtl = rightToLeft(caption.words)
      const startEdge = rtl ? right : (rect: PdfRect) => rect.x
      const captionBand = union(r, caption.rect)
      const spanningFigure = kind === 'figure' && r.width >= size.width * .65
      const endingAllowance = spanningFigure ? captionEm * (caption.rect.width >= size.width * .62 ? 4.2 : 2.1) : captionEm * .3
      const nearby = rows.filter(row => overlapX(row.rect,captionBand) > 0).sort((a,b) =>
        baseline(a.words[0]) - baseline(b.words[0]) || (rtl ? right(b.rect)-right(a.rect) : a.rect.x-b.rect.x))
      // Spanning titles can be split by the page gutter or a raised formula fragment.
      const joinFragments = (start: typeof rows[number]) => {
        let rect = start.rect
        const parts = [...start.words]
        const sourceRuns = new Set(start.words.flatMap(word => word.textRun === undefined ? [] : [word.textRun]))
        const fragments = nearby.filter(row => row.words !== start.words && Math.abs(baseline(row.words[0]) - baseline(start.words[0])) <= captionEm * .5)
          .sort((a,b) => rtl ? right(b.rect)-right(a.rect) : a.rect.x-b.rect.x)
        for (const fragment of fragments) {
          const inBand = fragment.rect.x >= captionBand.x - (rtl ? endingAllowance : captionEm * .3)
            && right(fragment.rect) <= right(captionBand) + (rtl ? captionEm * .3 : endingAllowance)
          const members = inBand ? fragment.words.filter(word => !word.rotated && word.rect.height <= captionFont * 1.2)
            : fragment.words.filter(word => word.textRun !== undefined && sourceRuns.has(word.textRun))
          if (!members.length) continue
          const memberRect = members.reduce((bounds,word) => union(bounds,word.rect),members[0].rect)
          const gap = rtl ? rect.x - right(memberRect) : memberRect.x - right(rect)
          if (gap < -captionEm * .3 || gap > captionEm * 1.35 || captionLabel(fragment.text)) continue
          rect = union(rect,memberRect)
          parts.push(...members)
        }
        return {rect,words:parts,text:rowText(parts)}
      }
      let last = joinFragments(caption)
      text = last.text
      bounds = union(bounds,last.rect); textRects.push(last.rect)
      const headingAlone = last.text.slice(caption.label.length).replace(/[\s.:：]/gu,'') === ''
      const gutters = caption.words[0].columnBoundaries || []
      for (const row of nearby) {
        if (baseline(row.words[0]) <= baseline(caption.words[0]) + captionEm * .5 || overlapX(row.rect,last.rect) <= 0) continue
        if (boundCaption && caption.rect.y < r.y && baseline(row.words[0]) >= r.y) break
        const next = joinFragments(row)
        if (next.rect.y < bottom(last.rect) - em * .2) continue
        const gap = next.rect.y-bottom(last.rect)
        // A short title followed by a much wider line often ends just before body prose.
        const widensIntoBody = !headingAlone && last.rect.width < captionBand.width*.88 &&
          next.rect.width > last.rect.width + Math.max(captionEm,last.rect.width*.12)
        const parallelProse = gutters.some(x => x > r.x && x < right(r) &&
          (rtl ? next.rect.x >= x : right(next.rect) <= x) && nearby.some(other => other.words !== row.words &&
            Math.abs(baseline(other.words[0])-baseline(row.words[0])) <= captionEm*.3 &&
            (rtl ? right(other.rect) <= x : other.rect.x >= x) && other.rect.width >= captionEm*6 && other.words.length >= 4))
        if (widensIntoBody || parallelProse || gap > captionEm * .65 || next.words.some(word=>/\p{L}/u.test(word.text)&&word.rect.height>captionFont*1.18) || captionLabel(next.text) || (caption.kind === 'table' ? next.rect.x < Math.min(r.x,caption.rect.x)-captionEm : Math.abs(startEdge(next.rect)-startEdge(caption.rect)) > captionEm) || next.rect.width > Math.max(captionBand.width,last.rect.width) + captionEm) break
        bounds = union(bounds,next.rect); textRects.push(next.rect); text += ' ' + next.text; last = next
      }
      if (kind === 'figure' && graphic.parts >= 6 && bottom(r) <= caption.rect.y + em * .25) {
        for (const panel of panels.filter(panel => panel.height >= em * 2.5)) {
          for (const row of rows) {
            if (row.words === caption.words || row.rect.y > caption.rect.y || row.rect.y > bottom(panel) + bodyEm * 3.35
              || bottom(row.rect) < panel.y - bodyEm * 3.35) continue
            const horizontal = row.words.filter(word => !word.rotated)
            const marker = /^\([a-z]\)(?:\s|$)/i.test(row.text)
            const title = horizontal.length ? horizontal.map(word => word.rect).reduce(union) : undefined
            const smallTitle = title && title.y < panel.y && gapY(title,panel) <= bodyEm * 1.3
              && (title.height < bodyEm * .86 || marker) && title.width < panel.width * .75
              && overlapX(title,panel) >= title.width * .95 && !captionLabel(rowText(horizontal))
            const panelMarker = marker && row.rect.y >= bottom(panel)
              && row.rect.y - bottom(panel) <= em * 1.55 && row.rect.width < panel.width * .6
              && overlapX(row.rect,panel) >= row.rect.width * .95
            if (smallTitle || panelMarker) labelRects.push(...horizontal.map(word => word.rect))
            for (const word of row.words) {
              const rect = word.rect
              if (bottom(rect) > caption.rect.y + em * .2) continue
              const dx = Math.max(rect.x - right(panel), panel.x - right(rect), 0)
              if (word.rotated && dx <= bodyEm * 3.5 && gapY(rect,panel) <= bodyEm * 3.35
                && (overlapY(rect,panel) > 0 || dx <= bodyEm * 1.5)) labelRects.push(rect)
              else if (/^[+−-]?\p{Nd}+(?:[.,]\p{Nd}+)?%?$/u.test(word.text) && rect.height < bodyEm * .86
                && horizontal.length <= 3 && dx <= bodyEm * 1.7
                && rect.y + rect.height / 2 >= panel.y - bodyEm * .15
                && rect.y + rect.height / 2 <= bottom(panel) + bodyEm * .15) labelRects.push(rect)
            }
          }
        }
      }
      if (kind === 'figure' && caption.rect.y > bottom(r)) {
        const exterior = makeRows(words.filter(word => !word.rotated &&
          (word.rect.y >= r.y - bodyEm * 2 && bottom(word.rect) <= r.y
            || word.rect.y >= bottom(r) && bottom(word.rect) <= caption.rect.y)), true)
        // A centered note in the gap above the caption belongs to the artwork.
        let noteBottom = bottom(r)
        for (const line of exterior.filter(line => line.rect.y >= bottom(r) &&
          line.rect.x >= r.x + bodyEm * .4 && right(line.rect) <= right(r) - bodyEm * .4 &&
          Math.abs(centerX(line.rect) - centerX(r)) <= r.width * .1)) {
          if (line.rect.y - noteBottom > bodyEm * 1.1 || line.rect.height > bodyEm * .89 || captionLabel(line.text)) break
          labelRects.push(...line.words.map(word => word.rect))
          noteBottom = bottom(line.rect)
        }
        const outerHeadings = exterior.filter(line => bottom(line.rect) <= r.y && gapY(line.rect,r) <= bodyEm * .8 &&
          line.rect.width <= bodyEm * 7 && !captionLabel(line.text))
        if (outerHeadings.length && graphic.parts >= 6 && !graphic.image) {
          const nodes = graphics.filter(g => !g.image && inside(g.rect,r) && g.rect.width >= bodyEm * 4 &&
            g.rect.width <= r.width * .75 && g.rect.height >= bodyEm * 1.8 && g.rect.height < r.height * .6).map(g => g.rect)
          const interior = makeRows(words.filter(word => !word.rotated && word.rect.y >= r.y &&
            nodes.some(node => bottom(word.rect) <= node.y && gapY(word.rect,node) <= bodyEm * 1.6)), true)
          // Flowchart headings can use the body font. Require the same placement at a second node.
          const labelsNode = (line: typeof exterior[number], node: PdfRect) => {
            const edge = rightToLeft(line.words) ? right : (rect: PdfRect) => rect.x
            return Math.abs(edge(line.rect) - edge(node)) <= bodyEm * .4 && bottom(line.rect) <= node.y &&
              gapY(line.rect,node) <= bodyEm * 1.6
          }
          for (const heading of outerHeadings) {
            const node = nodes.find(node => labelsNode(heading,node))
            if (!node) continue
            const peer = nodes.some(other => other.y >= bottom(node) && aligned(node,other) &&
              Math.abs(other.height - node.height) <= bodyEm * .4 && interior.some(line =>
                line.rect.width <= bodyEm * 7 && Math.abs(line.rect.height - heading.rect.height) <= bodyEm * .18 &&
                labelsNode(line,other)))
            if (peer) labelRects.push(...heading.words.map(word => word.rect))
          }
        }
      }
      for (const rect of labelRects) bounds = union(bounds,rect)
    }
    if (kind === 'table') {
      const tableFoot = bottom(bounds)
      const withinWidth = (word: WordBox) => word.rect.x + word.rect.width / 2 >= bounds.x && word.rect.x + word.rect.width / 2 <= right(bounds)
      const footRows: Array<{ words: WordBox[]; rect: PdfRect }> = []
      for (const word of words.filter(word => withinWidth(word) && word.rect.y + word.rect.height / 2 >= tableFoot)
        .sort((a,b) => baseline(a) - baseline(b))) {
        const row = footRows.at(-1)
        if (row && baseline(word) - baseline(row.words[0]) <= em * .45) {
          row.words.push(word)
          row.rect = union(row.rect,word.rect)
        } else footRows.push({ words: [word], rect: word.rect })
      }
      const noteWords = footRows.find(row => row.rect.y - tableFoot <= em * 1.2 && row.rect.width >= em * 2)?.words || []
      if (noteWords.length) {
        const note = noteWords.reduce((r,w) => union(r,w.rect),noteWords[0].rect)
        const noteText = rowText(noteWords)
        const legend = /^(?:[●○•◦*†‡]|notes?\b|source\b|注|说明|주[:：]|anmerkung|fuente|fonte|nota\b|примечание|ملاحظة)/iu.test(noteText) || note.width > bounds.width * .7 && noteWords.filter(w => w.text.length === 1).length >= 3
        const captionSized = caption && noteWords.every(word => word.rect.height < em * .95) && note.width > bounds.width * .5
        if (legend || captionSized) {
          bounds = union(bounds,note)
          const noteHeight = Math.max(...noteWords.map(w => w.rect.height))
          if (noteHeight < em*.95) {
            for (const row of footRows.filter(row => row.rect.y > note.y)) {
              if (bottom(row.rect) <= bottom(bounds)) continue
              if (row.rect.y-bottom(bounds) > em*.6 || row.words.some(w => w.rect.height > noteHeight*1.15) || row.rect.x < bounds.x-em*.3 || right(row.rect) > right(bounds)+em*.3 || captionLabel(rowText(row.words))) break
              bounds = union(bounds,row.rect)
            }
          }
          textRects.push({ x: bounds.x, y: tableFoot, width: bounds.width, height: bottom(bounds) - tableFoot })
        }
      }
    }
    visuals.push({rect: bounds, textRects, caption: text, label: caption?.label || (table ? 'ui.table' : 'ui.image'), kind, ...(table ? {cells:table.cells} : {}),
      ...(boundCaption && table ? {tableBody:table.rect} : {}), ...(kind === 'figure' && caption ? {figureBody:r} : {}),
      ...(labelRects.length ? {labelRects:[...new Set(labelRects)]} : {})})
  }
  for (const visual of visuals) {
    const grids=tables.filter(table=>inside(table.rect,visual.rect))
    if(!grids.length)continue
    const bounds=grids.reduce((rect,table)=>union(rect,table.rect),grids[0].rect)
    if(visual.kind==='table'||bounds.width*bounds.height>=visual.rect.width*visual.rect.height*.65) {
      visual.kind='table'
      visual.cells=grids.flatMap(table=>table.cells)
      if(visual.label==='ui.image')visual.label='ui.table'
    }
  }
  for (const table of tables) {
    if(!visuals.some(visual=>visual.kind==='table'&&inside(table.rect,visual.rect)))
      visuals.push({rect:table.rect,cells:table.cells,caption:'',label:'ui.table',kind:'table'})
  }
  // Borderless tables require a caption and at least three aligned multi-cell rows.
  for (const caption of captions.filter(c => !used.has(c) && c.kind === 'table')) {
    const boundaries=caption.words[0].columnBoundaries||[]
    const center=caption.rect.x+caption.rect.width/2
    const spanning=Math.abs(center-size.width/2)<em*6 || boundaries.some(x=>caption.rect.x<x&&right(caption.rect)>x)
    const tableLeft=spanning?0:[...boundaries].reverse().find(x=>x<center)??0
    const columnRight=spanning?size.width:boundaries.find(x=>x>center)??size.width
    const tableRight = Math.min(columnRight, ...captions.filter(row => row.rect.x > caption.rect.x + em * 3 && Math.abs(row.rect.y-caption.rect.y) < em * 2).map(row => row.rect.x-em))
    const candidates: typeof rows = []
    for (const word of words.filter(w => w.rect.x >= tableLeft && right(w.rect) <= tableRight && w.rect.y >= bottom(caption.rect) && w.rect.y-bottom(caption.rect) <= em * 14).sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)) {
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
      if (cells.length < 2 || row.text.length > 100) { if(grid.length)break; else continue }
      if (grid.length && cells.filter(cell => grid[0].words.some(w => Math.abs(w.rect.x-cell.rect.x) < em)).length < 2) break
      grid.push(row)
    }
    if (grid.length >= 3) visuals.push({rect: grid.reduce((r,row) => union(r,row.rect),caption.rect),textRects:[caption.rect,...grid.map(row => row.rect)],caption:caption.text,label:caption.label,kind:'table'})
  }
  return visuals.flatMap(visual => { const rect = clip(visual.rect); return rect && rect.width > 0 && rect.height > 0 ? [{...visual,rect}] : [] }).sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x)
}

export function isolateVisualWords(words: WordBox[], visuals: PageVisual[]): WordBox[] {
  const cells=visuals.flatMap(v=>v.cells||[])
  if (!visuals.length) return words
  const isolated = words.map(word => {
    if (word.visualRegion === -1 || word.visualRegion === -2) {
      const table = visuals.findIndex(visual => visual.tableBody && visual.textRects?.some(rect => inside(word.rect,rect)))
      return table === -1 ? word : {...word, visualRegion:table}
    }
    if (word.visualRegion !== undefined && word.visualRegion < 0) return word
    const region = visuals.findIndex(visual => visual.labelRects?.includes(word.rect) || (visual.textRects ?? (visual.caption && visual.cells?.length ? visual.cells : [visual.rect])).some(rect => {
      if (!inside(word.rect,rect)) return false
      if (visual.kind !== 'figure' || !word.textRunRect) return true
      const em = word.rect.height
      const nearSide = Math.min(word.rect.x - rect.x, right(rect) - right(word.rect)) < em * 1.8
      const run = nearSide && word.textRunRect.width < em * 5 ? textLineRect(words, word, baseline) ?? word.textRunRect : word.textRunRect
      // A wide line grazing a side of a figure keeps all words in the same text flow.
      return run.width < em * 5
        || overlapX(run,rect) >= run.width * .55 || overlapY(run,rect) < run.height * .4
    }))
    const cell = cells.findIndex(cell => inside(word.rect,cell))
    return {...word,...(region<0?{}:{visualRegion:region}),...(cell<0?{}:{tableCell:cell,tableCellRect:cells[cell]})}
  })
  const laneWords = isolated.filter(word => word.visualRegion === undefined && word.tableCell === undefined
    && word.column !== undefined && !word.columnAmbiguous && !word.rotated)
  const laneCenters = [...new Set(laneWords.map(word => word.column))].flatMap(column => {
    const centers = laneWords.filter(word => word.column === column).map(word => word.rect.x+word.rect.width/2).sort((a,b) => a-b)
    return centers.length >= 6 ? [centers[Math.floor(centers.length/2)]] : []
  })
  if (laneCenters.length < 2) return isolated
  const fences = visuals.flatMap(visual => {
    const art = visual.figureBody
    return visual.kind === 'figure' && art && laneCenters.every(x => x > art.x && x < right(art))
      ? [bottom(visual.rect)] : []
  })
  if (!fences.length) return isolated
  // A page-spanning figure interrupts the reading order of every prose column.
  return isolated.map(word => word.visualRegion === undefined && word.tableCell === undefined
    ? {...word, bodyBand:fences.filter(y => baseline(word) > y).length} : word)
}
