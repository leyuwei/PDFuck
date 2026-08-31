const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out/main/index.js')
const output = path.join(root, 'output', 'playwright')
const papers = [
  {
    key: 'm91474',
    file: path.join(root, 'tmp', 'm91474-li paper.pdf'),
    expected: [
      'Abstract', 'I. INTRODUCTION', 'II. BLOCKCHAIN-ENHANCED RANDOM ACCESS', "III. ROGUE’S DILEMMA",
      'IV. PERFORMANCE ANALYSIS OF RANDOM ACCESS WITH ROGUE NODES', 'V. NUMERICAL RESULTS', 'VI. CONCLUSION', 'REFERENCES'
    ]
  },
  {
    key: 'scheduling0826m',
    file: path.join(root, 'tmp', 'Scheduling0826m.pdf'),
    expected: [
      'Abstract', 'I. INTRODUCTION', 'II. O-RAN MODEL', 'III. BLOCKCHAIN-BASED PROPORTIONAL FAIR SCHEDULING',
      'IV. DELAYED SCHEDULING MODEL', 'V. CONSENSUS FAILURE', 'VI. SCHEDULING DELAY VERSUS CONSENSUS FAILURE',
      'VII. POOLING EFFECT WITH DELAY', 'VIII. SIMULATION', 'IX. CONCLUSION', 'REFERENCES'
    ]
  }
]

async function recognize(paper) {
  assert.ok(fs.existsSync(paper.file), `missing real-paper fixture: ${paper.file}`)
  const userData = path.join(root, 'tmp', `bookmark-recognition-${paper.key}-user`)
  fs.rmSync(userData, { recursive: true, force: true })
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({
    executablePath: packagedExecutable || require('electron'),
    args: packagedExecutable ? [`--user-data-dir=${userData}`, paper.file] : [entry, paper.file],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1280, 820))
    await page.locator('.pdf-page[data-page="0"]').waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: '识别书签', exact: true }).click()
    const dialog = page.locator('.bookmark-recognition-dialog')
    await dialog.waitFor()
    await page.waitForFunction(() => !document.querySelector('.bookmark-recognition-dialog .bookmark-scanning'), undefined, { timeout: 60000 })
    const rows = await dialog.locator('.bookmark-preview-row').evaluateAll((nodes) => nodes.map((node) => ({
      level: Number(node.querySelector(':scope > i')?.textContent || 0),
      title: node.querySelector(':scope > span > b')?.textContent?.trim() || '',
      page: node.querySelector(':scope > span > small')?.textContent?.trim() || ''
    })))
    const topLevel = rows.filter((row) => row.level === 1).map((row) => row.title)
    assert.deepEqual(topLevel, paper.expected, `${paper.key} top-level recognition mismatch:\n${JSON.stringify(rows, null, 2)}`)
    assert.equal(rows.some((row) => /\bi\.e\.|equation|theorem proves/iu.test(row.title)), false, `${paper.key} must not recognize prose or formula fragments`)
    fs.mkdirSync(output, { recursive: true })
    const screenshot = path.join(output, `bookmark-recognition-${paper.key}-v1.21.8.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    return { paper: paper.key, topLevel, candidates: rows.length, screenshot }
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

async function main() {
  const results = []
  for (const paper of papers) results.push(await recognize(paper))
  console.log(JSON.stringify({ realAcademicPapers: true, defaultTypographyOptIn: true, results }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
