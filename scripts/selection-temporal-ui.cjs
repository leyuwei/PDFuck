async function traceSelectionMove(page, documentPage, from, to) {
  const steps = Math.min(120, Math.max(1, Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)))))
  await documentPage.evaluate((element) => {
    const state = { active: true, frames: [], pointer: undefined }
    const onPointerMove = (event) => { state.pointer = { x: event.clientX, y: event.clientY } }
    const sample = () => {
      if (!state.active) return
      const pointer = state.pointer
      if (pointer) {
        const pageBox = element.getBoundingClientRect()
        const targetPage = document.elementFromPoint(pointer.x, pointer.y)?.closest?.('.pdf-page')?.dataset.page
        const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
          const box = selection.getBoundingClientRect()
          return { left: (box.left - pageBox.left) / pageBox.width, right: (box.right - pageBox.left) / pageBox.width, top: box.top - pageBox.top, bottom: box.bottom - pageBox.top }
        })
        state.frames.push(rects.length ? {
          count: rects.length,
          minLeft: Math.min(...rects.map((rect) => rect.left)),
          maxRight: Math.max(...rects.map((rect) => rect.right)),
          minTop: Math.min(...rects.map((rect) => rect.top)),
          maxBottom: Math.max(...rects.map((rect) => rect.bottom)),
          targetPage,
          pointerX: pointer.x - pageBox.left,
          pointerY: pointer.y - pageBox.top
        } : { count: 0, targetPage })
      }
      requestAnimationFrame(sample)
    }
    element.addEventListener('pointermove', onPointerMove)
    window.__selectionTemporalTrace = { state, onPointerMove }
    requestAnimationFrame(sample)
  })
  await page.mouse.move(to.x, to.y, { steps })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return documentPage.evaluate((element) => {
    const trace = window.__selectionTemporalTrace
    trace.state.active = false
    element.removeEventListener('pointermove', trace.onPointerMove)
    delete window.__selectionTemporalTrace
    return trace.state.frames
  })
}

module.exports = { traceSelectionMove }
