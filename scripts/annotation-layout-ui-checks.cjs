const assert = require('node:assert/strict')
const path = require('node:path')

module.exports = async (app, page, version) => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1300, 1050))
  await page.evaluate(() => localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted'))
  const navigate = async index => {
    const button = page.locator('.nav-rail button').nth(index)
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  }
  const results = []
  for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
    await navigate(0)
    await page.locator('.language-select select').selectOption(language)
    for (const size of [0, 1, 2, 3]) {
      await navigate(0)
      await page.locator('.interface-size-action').click()
      await page.locator('.interface-size-options button').nth(size).click()
      await page.locator('.interface-size-dialog .primary').click()
      await navigate(2)
      await page.locator('.annotation-row').nth(1).locator('.annotation-content-value').dblclick()
      const dialog = page.locator('.annotation-dialog'), editor = dialog.locator('.rich-editor-content').first()
      await editor.fill('Resize draft / 中文 / العربية')
      const measure = () => dialog.evaluate(element => {
        const box = element.getBoundingClientRect(), body = element.querySelector('.window-scroll-body'), field = element.querySelector('.rich-editor-content'), actions = element.querySelector('.modal-actions')
        return { height: box.height, editorHeight: field.getBoundingClientRect().height, bottomGap: box.bottom - actions.getBoundingClientRect().bottom, overflow: body.scrollWidth - body.clientWidth }
      })
      const before = await measure()
      if (language === 'zh' && size === 0) {
        // Exercise Chromium's actual resize grip, then check the same layout at every preset.
        const box = await dialog.boundingBox()
        await page.mouse.move(box.x + box.width - 3, box.y + box.height - 3)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width - 3, box.y + box.height + 177, { steps: 12 })
        await page.mouse.up()
      } else await dialog.evaluate(element => { element.style.height = `${element.getBoundingClientRect().height + 180}px` })
      const larger = await measure()
      assert.ok(larger.height - before.height > 100, JSON.stringify({ language, size, before, larger }))
      assert.ok(Math.abs((larger.editorHeight - before.editorHeight) - (larger.height - before.height)) < 3, 'Extra window space must grow the editor: ' + JSON.stringify({ before, larger }))
      assert.ok(larger.bottomGap < 30 && larger.overflow <= 1, JSON.stringify(larger))
      if (language === 'zh' && size === 1) await page.screenshot({ path: path.join(__dirname, `../output/playwright/annotation-resized-${version}.png`) })
      await dialog.evaluate(element => { element.style.width = '440px'; element.style.height = '420px' })
      assert.ok((await measure()).overflow <= 1, `${language}/${size}: narrow editor must wrap its controls`)
      await dialog.locator('.annotation-ai-suggestion').click()
      await dialog.locator('.annotation-suggestion-inline').waitFor()
      assert.equal(await dialog.locator('.annotation-suggestion-inline').count(), 1)
      assert.equal(await dialog.getAttribute('aria-modal'), 'false', 'PDF context selection must remain available')
      assert.equal(await page.locator('.annotation-suggestion-window.scroll-window').count(), 0)
      if (language === 'zh' && size === 0) {
        await navigate(0)
        assert.equal(await dialog.locator('.annotation-suggestion-inline').isVisible(), true, 'Changing the tool module must not empty the AI stage')
        await navigate(2)
      }
      assert.ok((await dialog.locator('.annotation-suggestion-back').innerText()).length > 0)
      const persistAlignment = await dialog.locator('.suggestion-persist label').evaluate(element => Math.abs(element.querySelector('input').getBoundingClientRect().top - element.querySelector('span').getBoundingClientRect().top))
      assert.ok(persistAlignment <= 2, `${language}/${size}: context checkbox and label must align`)
      await dialog.locator('.annotation-suggestion-inline textarea').focus()
      await page.keyboard.press('Escape')
      assert.equal(await editor.innerText(), 'Resize draft / 中文 / العربية')
      assert.equal(await dialog.getAttribute('aria-modal'), 'true')
      await dialog.locator('.annotation-dialog-close').click()
      assert.doesNotMatch(await page.locator('.annotation-row').nth(1).innerText(), /Resize draft/)
      await page.locator('.automatic-annotation-launch').click()
      const automatic = page.locator('.automatic-annotation-window')
      const weights = await automatic.locator('.automatic-option-grid label').evaluateAll(labels => labels.map(label => ({ title: getComputedStyle(label.querySelector('b')).fontWeight, hint: getComputedStyle(label.querySelector('small')).fontWeight })))
      assert.equal(weights.length, 8)
      assert.ok(weights.every(weight => Number(weight.title) >= 650 && weight.hint === '400'), JSON.stringify({ language, size, weights }))
      assert.ok(await automatic.locator('small').evaluateAll(elements => elements.every(element => getComputedStyle(element).fontWeight === '400')))
      if (language === 'zh' && size === 1) {
        await automatic.locator('.window-scroll-body').evaluate(element => { element.scrollTop = element.scrollHeight })
        await page.screenshot({ path: path.join(__dirname, `../output/playwright/automatic-option-weights-${version}.png`) })
      }
      await automatic.locator(':scope > header button').last().click()
      results.push({ language, size, growth: Math.round(larger.editorHeight - before.editorHeight), weights: weights.length })
    }
  }
  console.log(JSON.stringify({ annotationLayout: 'passed', cases: results }))
}
