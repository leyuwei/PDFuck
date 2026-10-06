// Match textarea typography and its usable width, including the native scrollbar.
export function sourceMirror(editor: HTMLTextAreaElement, source = editor.value): HTMLDivElement {
  const css = getComputedStyle(editor), mirror = document.createElement('div')
  for (const key of ['font', 'lineHeight', 'letterSpacing', 'wordSpacing', 'padding', 'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize', 'direction', 'textAlign', 'textIndent', 'unicodeBidi'] as const) mirror.style[key] = css[key]
  Object.assign(mirror.style, { position: 'fixed', left: '-10000px', top: '0', width: `${editor.clientWidth}px`, boxSizing: 'border-box', visibility: 'hidden', pointerEvents: 'none' })
  mirror.textContent = source; document.body.append(mirror)
  return mirror
}
export function sourceLineStarts(source: string): number[] {
  const starts = [0]
  for (let offset = source.indexOf('\n'); offset >= 0; offset = source.indexOf('\n', offset + 1)) starts.push(offset + 1)
  return starts
}
export function visibleSourceLines(editor: HTMLTextAreaElement, starts: number[], mirror: HTMLDivElement): Array<{ number: number; top: number }> {
  const css = getComputedStyle(editor), height = parseFloat(css.lineHeight), padding = parseFloat(css.paddingTop)
  const range = document.createRange(), text = mirror.firstChild!, content = text.textContent!
  const rectTop = (offset: number) => {
    range.setStart(text, offset); range.setEnd(text, offset + ((content.codePointAt(offset) || 0) > 0xffff ? 2 : 1))
    return range.getClientRects()[0]?.top || 0
  }
  const origin = rectTop(0)
  // Read native positions directly: multiplying serialized line-height drifts in long files.
  const top = (line: number) => padding + rectTop(starts[line]) - origin
  // Query only visible logical lines; one text node avoids a DOM node per source line.
  let first = 0, last = starts.length
  while (first < last) { const middle = (first + last) >>> 1; if (top(middle) < editor.scrollTop - height) first = middle + 1; else last = middle }
  const visible = []
  for (let line = first; line < starts.length; line++) {
    const y = top(line) - editor.scrollTop
    if (y > editor.clientHeight) break
    visible.push({ number: line + 1, top: y })
  }
  return visible
}
