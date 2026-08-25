const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling08241630m.pdf')
const userData = path.join(root, 'tmp', 'scheduling-inline-selection-ui-user')

function covers(rect, word) {
  return rect.x <= word.x + .5 && rect.x + rect.width >= word.x + word.width - .5 && rect.y <= word.y + .5 && rect.y + rect.height >= word.y + word.height - .5
}

async function selectAndRead(page, pageIndex, source) {
  const documentPage = page.locator(`.pdf-page[data-page="${pageIndex}"]`)
  await documentPage.waitFor({ timeout: 60000 })
  // Distant pages load their text map only after entering the viewport.
  await documentPage.scrollIntoViewIfNeeded()
  await documentPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
  const anchors = await documentPage.evaluate((element, target) => {
    const pageBox = element.getBoundingClientRect()
    const words = [...element.querySelectorAll('.text-map span')].map((span) => {
      const box = span.getBoundingClientRect()
      return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, left: Number.parseFloat(span.style.left), top: Number.parseFloat(span.style.top) }
    })
    const find = ({ text, left, top }) => words.find((word) => word.text === text && Math.abs(word.left - left) < 2 && Math.abs(word.top - top) < 3)
    return { start: find(target.start), end: find(target.end), expected: target.expected.map(find), page: { x: pageBox.x, y: pageBox.y } }
  }, source)
  assert.ok(anchors.start && anchors.end && anchors.expected.every(Boolean), `page ${pageIndex + 1} inline-formula anchors unavailable`)
  await page.mouse.move(anchors.start.x + 1, anchors.start.y + anchors.start.height / 2)
  await page.mouse.down()
  await page.mouse.move(anchors.end.x + anchors.end.width - 1, anchors.end.y + anchors.end.height / 2, { steps: 18 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelectorAll('.text-selection').length > 0)
  const selection = await documentPage.evaluate((element) => {
    const pageBox = element.getBoundingClientRect()
    return [...element.querySelectorAll('.text-selection')].map((item) => {
      const box = item.getBoundingClientRect()
      return { x: box.x - pageBox.x, y: box.y - pageBox.y, width: box.width, height: box.height }
    })
  })
  anchors.expected.forEach((word) => {
    const relativeWord = { ...word, x: word.x - anchors.page.x, y: word.y - anchors.page.y }
    assert.ok(selection.some((rect) => covers(rect, relativeWord)), `page ${pageIndex + 1} selection rectangle is misaligned for ${word.text}`)
  })
  return selection.length
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  const app = await electron.launch({
    executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'),
    args: [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    const pageFiveRects = await selectAndRead(page, 4, {
      start: { text: 'The', left: 312, top: 368 }, end: { text: '(C5).', left: 312, top: 416 },
      expected: [{ text: 'α', left: 377, top: 366 }, { text: 'i', left: 377, top: 372 }, { text: 'μ', left: 312, top: 380 }]
    })
    const pageNineRects = await selectAndRead(page, 8, {
      start: { text: 'stable', left: 49, top: 524 }, end: { text: 'evident,', left: 140, top: 572 },
      expected: [{ text: 'τ', left: 52, top: 558 }, { text: 'T', left: 50, top: 565 }, { text: 'c', left: 55, top: 568 }, { text: 'increases,', left: 63, top: 560 }, { text: 'mation', left: 49, top: 572 }]
    })
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), pages: [5, 9], selectionRects: [pageFiveRects, pageNineRects], checked: ['rendered-inline-script-coverage', 'rendered-fraction-coverage'] }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
