/** Keep native appearances, suppressing only annotations already drawn by overlays. */
export function annotationOperationsFilter(list: {fnArray: number[]; argsArray: any[]}, hiddenIds: string[], ops: Record<string,number>): (index: number) => boolean {
  const hidden = new Set(hiddenIds), excluded = new Set<number>()
  let skip = false
  list.fnArray.forEach((op,index) => {
    if (op === ops.beginAnnotation) skip = hidden.has(list.argsArray[index][0])
    if (skip) excluded.add(index)
    if (op === ops.endAnnotation) skip = false
  })
  return index => !excluded.has(index)
}
