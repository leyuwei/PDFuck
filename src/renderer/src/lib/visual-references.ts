import { visualReferences } from './caption-label'
import type { PageTextSnapshot } from './document-insights'
import type { PageVisual } from './page-visuals'

export interface VisualReferenceTarget extends PageVisual { pageIndex: number }
export type VisualReferenceIndex = Map<string, VisualReferenceTarget[]>

function referenceKey(kind: PageVisual['kind'], number: string): string {
  const digits = number.toLowerCase().replace(/[٠-٩۰-۹]/g, char => String((char.charCodeAt(0) - (char <= '٩' ? 0x660 : 0x6f0))))
    .replace(/–/g, '-').replace(/\(([a-z])\)$/u, '$1').replace(/\d+/g, value => value.replace(/^0+(?=\d)/, ''))
  const roman: Record<string, number> = { i:1, v:5, x:10, l:50, c:100, d:500, m:1000 }
  if (!/^[ivxlcdm]+$/u.test(digits)) return kind + ':' + digits
  const value = [...digits].reduce((sum, char, index) => sum + (roman[char] < roman[digits[index+1]] ? -1 : 1) * roman[char], 0)
  return kind + ':' + value
}

export function indexVisualReferences(pages: PageTextSnapshot[]): VisualReferenceIndex {
  const index: VisualReferenceIndex = new Map()
  for (const { pageIndex, visuals } of pages) for (const visual of visuals ?? []) {
    const label = visualReferences(visual.label.normalize('NFKC'))[0]
    if (!label || label.index !== 0 || label.label.length !== visual.label.normalize('NFKC').length) continue
    const key = referenceKey(visual.kind, label.number)
    const targets = index.get(key) ?? []
    targets.push({ ...visual, pageIndex })
    index.set(key, targets)
  }
  return index
}

export function targetForReference(index: VisualReferenceIndex, pageIndex: number, kind: PageVisual['kind'], number: string) {
  const key = referenceKey(kind, number)
  const targets = index.get(key) ?? (/\d[a-z]$/u.test(key) ? index.get(key.slice(0,-1)) : undefined)
  if (targets?.length === 1) return targets[0]
  const samePage = targets?.filter(target => target.pageIndex === pageIndex)
  if (samePage?.length === 1) return samePage[0]
}
