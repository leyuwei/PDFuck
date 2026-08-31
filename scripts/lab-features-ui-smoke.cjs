const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const screenshotDirectory = path.join(root, 'output', 'playwright')
const releaseVersion = process.env.PDFUCK_RELEASE_VERSION || require(path.join(root, 'package.json')).version
const reviewMarkdown = '# FULL REVIEW RESULT\n\n- **Structure:** improve the introduction.\n- Check `terminology` consistency.\n\n| Area | Status |\n| --- | --- |\n| Logic | Review |'
const suggestionMarkdown = '## ANNOTATION SUGGESTION RESULT\n\n1. Clarify the method.\n2. Align the conclusion.'

async function fixture(directory) {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (const text of ['First context passage for the method.', 'Second context passage for the conclusion.']) {
    const page = document.addPage([612, 792])
    page.drawText(text, { x: 72, y: 680, size: 18, font, color: rgb(0.08, 0.12, 0.2) })
  }
  const file = path.join(directory, 'lab-features.pdf')
  await fs.writeFile(file, await document.save())
  const switchDocument = await PDFDocument.create()
  const switchPage = switchDocument.addPage([612, 792])
  const switchFont = await switchDocument.embedFont(StandardFonts.Helvetica)
  switchPage.drawText('A separate PDF opened while AI is reviewing.', { x: 72, y: 680, size: 18, font: switchFont, color: rgb(0.08, 0.12, 0.2) })
  const switchFile = path.join(directory, 'lab-switch-target.pdf')
  await fs.writeFile(switchFile, await switchDocument.save())
  return { primary: file, switchTarget: switchFile }
}

async function launch(userData, pdf) {
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron')
  const args = process.env.PDFUCK_SMOKE_EXECUTABLE
    ? [`--user-data-dir=${userData}`, ...(pdf ? [pdf] : [])]
    : [path.join(root, 'out/main/index.js'), ...(pdf ? [pdf] : [])]
  return electron.launch({ executablePath: executable, args, env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: releaseVersion } })
}

async function configure(userData, baseUrl) {
  const app = await launch(userData)
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.titlebar', { timeout: 60000 })
    await page.evaluate(({ baseUrl }) => {
      localStorage.clear()
      localStorage.setItem('pdfuck.ai-settings.v1', JSON.stringify({ provider: 'custom', baseUrl, apiKey: 'lab-smoke-key', model: 'lab-smoke-model', timeoutSeconds: 120 }))
    }, { baseUrl })
    console.log('[lab-smoke] model settings prepared')
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => undefined)
    await app.close()
  }
}

async function selectPageText(page, pageIndex) {
  const pageRoot = page.locator(`.pdf-page[data-page="${pageIndex}"]`)
  await pageRoot.scrollIntoViewIfNeeded()
  const pageBox = await pageRoot.boundingBox()
  assert.ok(pageBox, `Expected PDF page ${pageIndex + 1}`)
  await page.mouse.click(pageBox.x + pageBox.width - 20, pageBox.y + 40)
  const word = page.locator(`.pdf-page[data-page="${pageIndex}"] .text-map span`).first()
  await word.waitFor({ state: 'attached', timeout: 60000 })
  await word.scrollIntoViewIfNeeded()
  const box = await word.boundingBox()
  assert.ok(box && box.width > 2 && box.height > 2, `Expected selectable text on page ${pageIndex + 1}`)
  await page.mouse.dblclick(box.x + Math.min(box.width - 1, Math.max(2, box.width * 0.25)), box.y + box.height / 2)
  const expected = pageIndex === 0 ? 'First' : 'Second'
  await page.waitForFunction((value) => document.querySelector('footer')?.textContent?.includes(`已选择：${value}`), expected, { timeout: 5000 })
}

async function verifyLabFeatures(userData, pdf, switchTarget, requests) {
  const app = await launch(userData, pdf)
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1200, 820))
    await page.waitForSelector('.pdf-page[data-page="0"]', { timeout: 60000 })
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    console.log('[lab-smoke] document and Lab opened')

    const headingLayout = await page.locator('.annotation-lab-heading').evaluate((heading) => {
      const title = heading.querySelector('h3').getBoundingClientRect()
      const gear = heading.querySelector('.annotation-lab-settings-trigger').getBoundingClientRect()
      return { titleRight: title.right, titleCenter: title.top + title.height / 2, gearLeft: gear.left, gearCenter: gear.top + gear.height / 2 }
    })
    assert.ok(headingLayout.gearLeft >= headingLayout.titleRight, 'Shared model settings must be to the right of the Lab title')
    assert.ok(Math.abs(headingLayout.gearCenter - headingLayout.titleCenter) < 8, 'Shared model settings must align with the Lab title')
    assert.equal(await page.locator('.annotation-lab-tools > button').count(), 3)
    assert.equal(await page.locator('.annotation-lab-tools kbd').count(), 1, 'Only AI Polish should display a shortcut')
    const typography = await page.evaluate(() => {
      const standard = document.querySelector('.tool-panel section > .tool-button')
      const lab = document.querySelector('.annotation-lab-tools > .tool-button')
      const standardHeading = document.querySelector('.tool-panel section > h3')
      const labHeading = document.querySelector('.annotation-lab-heading h3')
      const style = (element) => {
        const computed = getComputedStyle(element)
        return { fontSize: computed.fontSize, paddingLeft: computed.paddingLeft, paddingRight: computed.paddingRight }
      }
      const labGroup = getComputedStyle(document.querySelector('.annotation-lab'))
      const labHeadingStyle = getComputedStyle(document.querySelector('.annotation-lab-heading'))
      return {
        standardButton: style(standard), labButton: style(lab),
        standardStrong: style(standard.querySelector('strong')), labStrong: style(lab.querySelector('strong')),
        standardSmall: style(standard.querySelector('small')), labSmall: style(lab.querySelector('small')),
        standardHeading: style(standardHeading), labHeading: style(labHeading),
        groupBorderTop: labGroup.borderTopWidth, headingBorderBottom: labHeadingStyle.borderBottomWidth
      }
    })
    assert.deepEqual(typography.labStrong, typography.standardStrong, 'Lab action titles must match annotation tools')
    assert.deepEqual(typography.labSmall, typography.standardSmall, 'Lab action hints must match annotation tools')
    assert.deepEqual(typography.labButton, typography.standardButton, 'Lab action spacing must match annotation tools')
    assert.equal(typography.labHeading.fontSize, typography.standardHeading.fontSize, 'Lab heading must match other tool-group headings')
    assert.equal(typography.groupBorderTop, '0px', 'Lab heading must not have a top divider')
    assert.equal(typography.headingBorderBottom, '0px', 'Lab heading must not have a bottom divider')
    await fs.mkdir(screenshotDirectory, { recursive: true })
    await page.locator('.annotation-lab').evaluate((element) => element.scrollIntoView({ block: 'end' }))
    await page.waitForTimeout(100)
    await page.screenshot({ path: path.join(screenshotDirectory, `lab-toolbar-${releaseVersion}.png`) })
    console.log('[lab-smoke] shared header layout verified')

    await page.locator('.full-review-launch').click()
    await page.locator('.lab-disclaimer').waitFor()
    const consentLayout = await page.evaluate(() => {
      const modal = document.querySelector('.lab-disclaimer').getBoundingClientRect()
      const panel = document.querySelector('.lab-consent-check').getBoundingClientRect()
      const checkbox = document.querySelector('.lab-consent-check input').getBoundingClientRect()
      const copy = document.querySelector('.lab-consent-check > span').getBoundingClientRect()
      return { modal: { left: modal.left, right: modal.right }, panel: { left: panel.left, right: panel.right }, checkbox: { top: checkbox.top, right: checkbox.right }, copy: { top: copy.top, left: copy.left } }
    })
    assert.ok(consentLayout.copy.left >= consentLayout.checkbox.right + 6, 'Consent copy must be to the right of the checkbox')
    assert.ok(Math.abs(consentLayout.copy.top - consentLayout.checkbox.top) < 8, 'Consent checkbox and copy must share one row')
    assert.ok(consentLayout.panel.left - consentLayout.modal.left >= 20, 'Consent panel needs left breathing room')
    assert.ok(consentLayout.modal.right - consentLayout.panel.right >= 20, 'Consent panel needs right breathing room')
    await page.screenshot({ path: path.join(screenshotDirectory, `lab-disclaimer-${releaseVersion}.png`) })
    const continueButton = page.locator('.lab-disclaimer footer button.primary')
    assert.equal(await continueButton.isDisabled(), true)
    await page.locator('.lab-consent-check input').check()
    assert.equal(await continueButton.isDisabled(), false)
    await continueButton.click()
    assert.equal(await page.evaluate(() => localStorage.getItem('pdfuck.lab.full-review-consent.v1')), 'accepted')
    await page.locator('.full-review-window').waitFor()
    console.log('[lab-smoke] disclaimer accepted')
    assert.equal(await page.locator('.lab-send-mode button').count(), 2)
    assert.ok((await page.locator('.full-review-window textarea').inputValue()).includes('恰好三句话'))
    await page.locator('.full-review-window button.primary.wide').click()
    const progress = page.locator('.lab-review-progress')
    await progress.waitFor()
    assert.equal(await progress.getAttribute('role'), 'progressbar')
    const countdown = await progress.locator('header span').textContent()
    const remaining = Number(countdown.match(/\d+/)?.[0])
    assert.ok(remaining >= 118 && remaining <= 120, `Expected countdown to start from configured 120 seconds, got ${countdown}`)
    await page.screenshot({ path: path.join(screenshotDirectory, `lab-review-progress-${releaseVersion}.png`) })

    await app.evaluate(({ BrowserWindow }, source) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', source), switchTarget)
    const originalTab = page.locator('.window-tab').filter({ hasText: 'lab-features.pdf' })
    const switchTab = page.locator('.window-tab').filter({ hasText: 'lab-switch-target.pdf' })
    await switchTab.waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.full-review-window').count(), 0, 'The original document AI window must stay isolated while another PDF is active')
    await page.waitForTimeout(1200)
    await originalTab.click()
    await page.locator('.lab-review-progress').waitFor({ timeout: 10000 })
    const resumedCountdown = Number((await page.locator('.lab-review-progress header span').textContent()).match(/\d+/)?.[0])
    assert.ok(resumedCountdown < remaining && resumedCountdown > 0, `The restored countdown must keep advancing: ${resumedCountdown}`)
    await switchTab.click()
    assert.equal(await page.locator('.full-review-window').count(), 0, 'Manual document switching must hide, not transfer, another PDF AI session')
    await originalTab.click()
    await page.locator('.full-review-window').waitFor({ timeout: 10000 })
    console.log('[lab-smoke] running review survived PDF opening and manual tab switches')

    await page.getByText('FULL REVIEW RESULT', { exact: true }).waitFor({ timeout: 15000 })
    assert.equal(await page.locator('.full-review-window .ai-markdown h1').textContent(), 'FULL REVIEW RESULT')
    assert.equal(await page.locator('.full-review-window .ai-markdown li').count(), 2)
    assert.equal(await page.locator('.full-review-window .ai-markdown table').count(), 1)
    console.log('[lab-smoke] full review response received')
    await page.locator('.full-review-window .ai-polish-actions button').first().click()
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), reviewMarkdown)
    await page.locator('.full-review-window .ai-polish-actions button.primary').click()
    await page.locator('.annotation-row').filter({ hasText: 'FULL REVIEW RESULT' }).waitFor()
    console.log('[lab-smoke] full review copied and added')

    await page.locator('.full-review-launch').click()
    assert.equal(await page.locator('.lab-disclaimer').count(), 0, 'Accepted disclaimer must not reappear')
    await page.locator('.full-review-window > header button').click()

    const toggle = page.locator('.annotation-suggestion-toggle')
    await toggle.click()
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.lab-preferences.v1')).annotationSuggestionsEnabled), true)

    const annotation = page.locator('.annotation-row').filter({ hasText: 'FULL REVIEW RESULT' }).first()
    await annotation.locator('.annotation-settings-button').click()
    await annotation.locator('.annotation-ai-suggestion').click()
    await page.locator('.annotation-suggestion-window').waitFor()
    console.log('[lab-smoke] annotation suggestion collector opened')

    const automaticContextSwitch = page.locator('.suggestion-auto-context [role="switch"]')
    const automaticContextSlider = page.locator('.automatic-context-level input')
    assert.equal(await automaticContextSwitch.getAttribute('aria-checked'), 'true', 'automatic annotation context must be enabled by default')
    assert.equal(await automaticContextSlider.getAttribute('min'), '1')
    assert.equal(await automaticContextSlider.getAttribute('max'), '5')
    assert.equal(await automaticContextSlider.inputValue(), '3')
    assert.ok((await page.locator('.automatic-context-note').innerText()).includes('自由位置批注'), 'free-position notes must explain the conservative context rule')
    await page.locator('.automatic-context-state.warning').waitFor({ timeout: 10000 })
    assert.ok((await page.locator('.automatic-context-state.warning').innerText()).includes('未贴近可识别正文'), 'a detached free-position note must not capture unrelated text')
    await automaticContextSlider.fill('5')
    await automaticContextSlider.dispatchEvent('change')
    await page.waitForFunction(() => document.querySelector('.automatic-context-level output')?.textContent?.includes('5 / 5'))

    const collectorHeader = await page.locator('.annotation-suggestion-window > header').boundingBox()
    assert.ok(collectorHeader, 'Expected a draggable suggestion window header')
    await page.mouse.move(collectorHeader.x + collectorHeader.width / 2, collectorHeader.y + collectorHeader.height / 2)
    await page.mouse.down()
    await page.mouse.move(1180 - collectorHeader.width / 2, collectorHeader.y + collectorHeader.height / 2, { steps: 6 })
    await page.mouse.up()

    await selectPageText(page, 0)
    await page.locator('.annotation-suggestion-window .capture-context-button').click()
    assert.equal(await page.locator('.suggestion-contexts header span').textContent(), '1')
    await selectPageText(page, 1)
    await page.locator('.annotation-suggestion-window .capture-context-button').click()
    assert.equal(await page.locator('.suggestion-contexts header span').textContent(), '2')
    const contexts = await page.locator('.suggestion-contexts article').allInnerTexts()
    assert.ok(contexts.some((value) => value.includes('First')))
    assert.ok(contexts.some((value) => value.includes('Second')))
    const persist = page.locator('.suggestion-persist input')
    assert.equal(await persist.isDisabled(), false)
    await persist.check()
    assert.equal(await persist.isChecked(), true)
    await page.locator('.annotation-suggestion-window > header button').click()
    await annotation.locator('.annotation-settings-button').click()
    await annotation.locator('.annotation-ai-suggestion').click()
    await page.locator('.annotation-suggestion-window').waitFor()
    assert.equal(await page.locator('.suggestion-contexts article').count(), 2, 'Persisted contexts must load for another suggestion in the same document')
    assert.equal(await page.locator('.suggestion-persist input').isChecked(), true)
    await page.locator('.automatic-context-state.warning').waitFor({ timeout: 10000 })
    await page.screenshot({ path: path.join(screenshotDirectory, `lab-suggestion-contexts-${releaseVersion}.png`) })
    console.log('[lab-smoke] conservative automatic context and two manual context passages verified')

    await page.locator('.annotation-suggestion-window button.primary.wide').click()
    await page.getByText('ANNOTATION SUGGESTION RESULT', { exact: true }).waitFor({ timeout: 15000 })
    assert.equal(await page.locator('.annotation-suggestion-window .ai-markdown h2').textContent(), 'ANNOTATION SUGGESTION RESULT')
    assert.equal(await page.locator('.annotation-suggestion-window .ai-markdown ol li').count(), 2)
    console.log('[lab-smoke] annotation suggestion response received')
    await page.locator('.annotation-suggestion-window .ai-polish-actions button').first().click()
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), suggestionMarkdown)
    await page.locator('.annotation-suggestion-window .ai-polish-actions button.primary').click()
    await page.waitForFunction(() => document.querySelector('.annotation-row .annotation-settings-button')?.getAttribute('title')?.includes('ANNOTATION SUGGESTION RESULT'))

    assert.equal(requests.length, 2)
    assert.ok(requests[0].includes('--- Page 1 ---') && requests[0].includes('First context passage'))
    assert.ok(requests[0].includes('--- Page 2 ---') && requests[0].includes('Second context passage'))
    assert.ok(requests[1].includes('FULL REVIEW RESULT'))
    assert.ok(requests[1].includes('First'))
    assert.ok(requests[1].includes('Second'))
    console.log('[lab-smoke] copy, writeback, and payloads verified')
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => undefined)
    await app.close()
  }
}

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-lab-features-'))
  const requests = []
  const server = http.createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    assert.equal(request.url, '/v1/chat/completions')
    assert.equal(request.headers.authorization, 'Bearer lab-smoke-key')
    const payload = JSON.parse(body)
    assert.equal(payload.model, 'lab-smoke-model')
    requests.push(body)
    const content = body.includes('FULL REVIEW RESULT') ? suggestionMarkdown : reviewMarkdown
    if (!body.includes('FULL REVIEW RESULT')) await new Promise((resolve) => setTimeout(resolve, 6000))
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content } }] }))
  })
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const userData = path.join(temporary, 'user-data')
    const pdf = await fixture(temporary)
    await configure(userData, `http://127.0.0.1:${address.port}/v1`)
    await verifyLabFeatures(userData, pdf.primary, pdf.switchTarget, requests)
    console.log(JSON.stringify({ sharedSettings: 'passed', consistentLayout: 'passed', fullReview: 'passed', documentSwitchPersistence: 'passed', countdown: 'passed', markdown: 'passed', disclaimer: 'persisted', automaticContext: 'conservative-free-note-pass', contexts: 2, contextPersistence: 'passed', annotationSuggestion: 'passed', copyAndWriteback: 'passed' }))
  } finally {
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(temporary, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
