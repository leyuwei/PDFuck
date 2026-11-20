import type { PageGraphic } from './page-visuals'
import type { WordBox } from './text-layout'

const edgeFraction = .10
export type MarginRegion = -1 | -2 | -3 | -4
interface MarginRun {
  region: MarginRegion
  words: WordBox[]
  y: number
  key: string
}
export type MarginSample = Pick<MarginRun, 'region' | 'y' | 'key'>

const baseline = (word: WordBox) => word.baselineY ?? word.rect.y + word.rect.height
const right = (word: WordBox) => word.rect.x + word.rect.width

function baselineRows(words: WordBox[]) {
  const rows: WordBox[][] = []
  for (const word of [...words].sort((a,b) => baseline(a)-baseline(b) || a.rect.x-b.rect.x)) {
    const row = rows.at(-1)
    if (row && Math.abs(baseline(row[0])-baseline(word)) <= Math.min(row[0].rect.height,word.rect.height)*.35) row.push(word)
    else rows.push([word])
  }
  return rows
}

function marginRuns(words: WordBox[], height: number): MarginRun[] {
  const rows = baselineRows(words.filter(w => w.visualRegion === undefined && w.tableCell === undefined &&
    (baseline(w) <= height * edgeFraction || baseline(w) >= height * (1-edgeFraction))))
  return rows.flatMap(row => {
    const chunks: WordBox[][] = []
    for (const word of row.sort((a,b) => a.rect.x-b.rect.x)) {
      const chunk = chunks.at(-1)
      const previous = chunk?.at(-1)
      if (previous && word.rect.x-right(previous) <= Math.max(previous.rect.height,word.rect.height)*1.6) chunk!.push(word)
      else chunks.push([word])
    }
    const y = baseline(row[0])/height
    const region = y < .5 ? -1 : -2
    return chunks.map(words => ({
      region, words, y,
      key: words.map(word=>word.text).join('').normalize('NFKC').toLowerCase().replace(/\s/gu,'').replace(/\p{Nd}+/gu,'#')
    }))
  })
}

export function marginSamples(words: WordBox[], height: number): MarginSample[] {
  return marginRuns(words,height).map(({region,y,key})=>({region,y,key}))
}

function markFirstPageFrontMatter(words: WordBox[], size: {width:number;height:number}, em: number, marks: Map<WordBox, MarginRegion>) {
  const rows = baselineRows(words.filter(word => !marks.has(word) && baseline(word) <= size.height*.34))
    .map(words => {
      const sorted = words.sort((a,b) => a.rect.x-b.rect.x)
      const left = sorted[0].rect.x, edge = Math.max(...sorted.map(right))
      const top = Math.min(...sorted.map(word => word.rect.y)), bottom = Math.max(...sorted.map(word => word.rect.y+word.rect.height))
      const heights = sorted.map(word => word.rect.height).sort((a,b) => a-b)
      const gaps = sorted.slice(1).filter((word,index) => word.rect.x-right(sorted[index]) >= em*.9 &&
        right(sorted[index])-left >= size.width*.18 && edge-word.rect.x >= size.width*.18)
      const ink = sorted.map(word => word.text).join('').replace(/[^\p{L}\p{N}]/gu,'').length
      return { words, left, edge, top, bottom, font: heights[Math.floor(heights.length/2)], center: (left+edge)/2, split: gaps.length > 0, ink }
    })
  const centered = (row: typeof rows[number]) => Math.abs(row.center-size.width/2) <= size.width*.10
  const title = (row: typeof rows[number]) => centered(row) && !row.split && row.font >= em*1.45 &&
    (row.edge-row.left >= size.width*.3 || row.font >= em*1.8 && row.ink >= 6)
  const start = rows.findIndex(row => row.top <= size.height*.19 && title(row))
  if (start < 0) return
  const laneLeft = Math.min(...rows.slice(start+1).filter(row => row.font <= em*1.18 && row.ink > 25).map(row => row.left))
  const laneRight = Math.max(...rows.slice(start+1).filter(row => row.font <= em*1.18 && row.ink > 25).map(row => row.edge))
  let previous = rows[start]
  for (const [index,row] of rows.slice(start).entries()) {
    if (index > 0 && (row.top-previous.bottom > Math.max(em*1.35,previous.font*.7) || !centered(row) || row.split && row.font < em*1.45 ||
        !title(row) && !(row.ink >= 4 && row.font <= em*1.25 && (row.left > laneLeft+em*.35 || row.edge < laneRight-em*.35)))) break
    for (const word of row.words) marks.set(word,-3)
    previous = row
  }

  // Contact notes at the foot of the first page can share the body baseline of another column.
  for (const leftHalf of [true,false]) {
    const footerRows = baselineRows(words.filter(word => !marks.has(word) && word.rect.height <= em*.89 &&
      baseline(word) >= size.height*.74 && (leftHalf ? right(word) <= size.width*.51 : word.rect.x >= size.width*.49)))
    const chunks: WordBox[][][] = []
    for (const row of footerRows) {
      const chunk = chunks.at(-1)
      if (chunk && baseline(row[0])-baseline(chunk.at(-1)![0]) <= em*1.45) chunk.push(row)
      else chunks.push([row])
    }
    for (const chunk of chunks) {
      const members = chunk.flat()
      if (chunk.length < 2 || baseline(chunk.at(-1)![0]) < size.height*.9 || !members.some(word => word.text.includes('@'))) continue
      for (const word of members) marks.set(word,-4)
    }
  }
}

/** Mark only text supported by edge geometry or a repeat at the same page height. */
export function classifyPageMargins(words: WordBox[], size: {width:number;height:number}, graphics: PageGraphic[], peers: MarginSample[][], firstPage = false): Map<WordBox, MarginRegion> {
  const runs = marginRuns(words,size.height)
  const marks = new Map<WordBox, MarginRegion>()
  const heights = words.filter(w => baseline(w) > size.height*.15 && baseline(w) < size.height*.85)
    .map(w=>w.rect.height).sort((a,b)=>a-b)
  const em = heights[Math.floor(heights.length/2)] || 10
  const rules = graphics.flatMap(graphic => graphic.image ? [] : graphic.rules || [graphic.rect])
  const verticals = rules.filter(rule=>rule.width < em*.2 && rule.height >= em)
  const separators = rules
    .filter(rule => rule.height <= 1.5 && rule.width >= size.width*.45 &&
      (rule.y <= size.height*edgeFraction || rule.y >= size.height*(1-edgeFraction)))
    .filter(rule => !verticals.some(edge => (Math.abs(edge.x-rule.x)<em*.25 || Math.abs(edge.x-rule.x-rule.width)<em*.25) &&
      edge.y <= rule.y+em*.25 && edge.y+edge.height >= rule.y-em*.25))
  for (const run of runs) {
    const letters = run.key.match(/\p{L}/gu)?.length || 0
    const matches = peers.filter(page=>page.some(other=>other.region===run.region && other.key===run.key &&
      Math.abs(other.y-run.y) <= .009)).length
    const outerEdge = run.y < .065 || run.y > .935
    const repeats = matches > 0 && (outerEdge || run.words.every(w=>w.rect.height < em*.92)) &&
      (letters >= 6 || letters >= 3 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Hangul}]/u.test(run.key)
      || run.key==='#' && outerEdge)
    const beyondRule = separators.some(rule => run.words.every(word => word.rect.height <= em*1.12 &&
      (run.region === -1 ? rule.y <= size.height*edgeFraction && baseline(word) < rule.y-em*.25
        : rule.y >= size.height*(1-edgeFraction) && word.rect.y > rule.y+em*.25)))
    if (repeats || beyondRule) for (const word of run.words) marks.set(word,run.region)
  }
  const anchors = runs.filter(run=>marks.has(run.words[0]))
  for (const run of runs) {
    if (marks.has(run.words[0]) || run.y > .045 && run.y < .955 || run.words.some(w=>w.rect.height > em)) continue
    if (anchors.some(anchor=>anchor.region===run.region && Math.abs(anchor.y-run.y)*size.height <= em*1.45)) {
      for (const word of run.words) marks.set(word,run.region)
    }
  }
  if (firstPage) markFirstPageFrontMatter(words,size,em,marks)
  return marks
}
