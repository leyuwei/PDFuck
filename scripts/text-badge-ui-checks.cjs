const assert = require('node:assert/strict'), path = require('node:path')

// Runs inside typography-ui-smoke for both source and packaged Electron builds.
module.exports = async function checkTextBadges(page, version) {
  await page.locator('.window-tab.current .window-tab-close').click()
  await page.locator('.welcome-layout').waitFor()
  const view = page.locator('.nav-rail button').first()
  if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
  const checkRecent = async selector => {
    const results = await page.locator(selector).evaluateAll(items => items.map(item => {
      const icon = item.querySelector('.recent-pdf-icon'), copy = item.querySelector('.recent-copy'), box = icon.getBoundingClientRect(), name = copy.getBoundingClientRect()
      const range = document.createRange(); range.selectNodeContents(icon); const text = range.getBoundingClientRect()
      return { fits: text.left >= box.left + 2 && text.right <= box.right - 2 && text.top >= box.top && text.bottom <= box.bottom,
        dx: Math.abs(text.left + text.right - box.left - box.right) / 2, dy: Math.abs(text.top + text.bottom - box.top - box.bottom) / 2,
        gap: getComputedStyle(item).direction === 'rtl' ? box.left - name.right : name.left - box.right, aligned: Math.abs(box.top + box.bottom - name.top - name.bottom) / 2,
        contained: item.scrollWidth <= item.clientWidth + 1, ellipsis: getComputedStyle(copy.querySelector('b')).textOverflow === 'ellipsis' }
    }))
    assert.ok(results.length && results.every(r => r.fits && r.dx <= 1 && r.dy <= 1.5 && r.gap >= 7 && r.aligned <= 1 && r.contained && r.ellipsis), `${selector}: ${JSON.stringify(results)}`)
  }
  let surfaces = 0, specimens = 0
  for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
    await page.locator('.language-select select').selectOption(language)
    for (let preset = 0; preset < 4; preset++) {
      await page.locator('.interface-size-action').click()
      await page.locator('.interface-size-options button').nth(preset).click()
      await page.locator('.interface-size-dialog .primary').click()
      for (const dark of [false, true]) {
        // Exercise both theme style branches without depending on localized button text.
        await page.locator('.app-shell').evaluate((shell, dark) => shell.classList.toggle('theme-dark', dark), dark)
        await checkRecent('.recent-panel .recent-item')
        if (language === 'zh' && preset === 3 && !dark) await page.screenshot({ path: path.resolve(`output/playwright/badges-welcome-${version}.png`) })
        await page.locator('.open-button').click()
        await checkRecent('.open-pdf-recent .recent-item')
        if (language === 'zh' && preset === 3 && !dark) await page.screenshot({ path: path.resolve(`output/playwright/badges-open-${version}.png`) })
        await page.locator('.open-pdf-dialog .modal-actions button').first().click()
        surfaces += 2
      }
      if (language !== 'zh') continue
      // Style specimens cover dialogs/states that cannot coexist in a real workflow.
      const result = await page.evaluate(() => {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:90px 20px;z-index:9999;overflow:auto;background:white;display:flex;align-content:start;align-items:start;flex-wrap:wrap;gap:20px;padding:20px'
        host.innerHTML = `<div class="password-file"><span data-fit>PDF</span></div>
          <div class="welcome-icon"><span data-fit>PDF</span></div>
          <span class="menu-delete-icon" data-fit>×</span><span class="menu-copy-icon" data-fit>▣</span><span class="menu-column-boundary-icon" data-fit>╎</span>
          <span class="print-heading-icon" data-fit>⎙</span><span class="page-selection-icon" data-fit>⇩</span><span class="lab-warning-icon" data-fit>!</span><span class="bookmark-recognition-icon" data-fit>⌑</span>
          <span class="format-toolbar-grip" data-fit>Aa</span><span class="save-as-required-symbol" data-fit>!</span>
          <div class="annotation-color-picker compact"><label class="annotation-custom-color"><span><svg viewBox="0 0 12 12"><path d="M2 6h8M6 2v8" /></svg></span></label></div>
          <div class="rich-editor-toolbar"><button class="rich-format-bold" data-fit>B</button><button class="rich-format-italic" data-fit>I</button><button class="rich-format-underline" data-fit>U</button></div>
          <span class="annotation-panel-glyph" data-fit>≡</span><span class="bookmark-panel-glyph" data-fit>⌑</span>
          <div class="annotation-font-stepper"><button data-fit>A−</button><output data-fit>L</output><button data-fit>A＋</button></div>
          <div style="width:110px"><b class="annotation-author-badge" title="Alexander / 作者 / مؤلف"><i></i><span dir="auto">Alexander / 作者 / مؤلف</span></b></div>
          <div class="temporary-document-warning" style="position:static;transform:none;min-width:0;max-width:150px"><span data-fit>!</span><b>Temporäres Dokument</b></div>
          <div style="position:relative;width:220px;height:260px"><span class="page-manager-original-badge" data-fit>Originalseite 1234</span><span class="page-manager-current-badge" data-fit>Aktuelle Seite</span><span class="page-manager-rotation-badge" data-fit>Gedreht um 270°</span><span class="page-manager-removed-badge" data-fit>Zum Entfernen markiert</span></div>`
        for (const count of ['1', '12', '1234', '123456']) {
          host.insertAdjacentHTML('beforeend', `<aside class="annotation-panel collapsed"><button class="annotation-expand"><em data-fit>${count}</em></button></aside><aside class="bookmark-panel collapsed"><button class="bookmark-expand"><em data-fit>${count}</em></button></aside><span class="bookmark-page" data-fit>${count}</span>`)
        }
        document.body.append(host)
        const errors = [], elements = [...host.querySelectorAll('[data-fit]')]
        for (const el of elements) {
          const box = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el)
          if ([...range.getClientRects()].some(t => t.left < box.left - 1 || t.right > box.right + 1 || t.top < box.top - 1 || t.bottom > box.bottom + 1)) errors.push(['text', el.outerHTML])
          if (el.matches('em, .bookmark-page')) {
            const t = range.getBoundingClientRect()
            if (Math.abs(t.left + t.right - box.left - box.right) > 2 || Math.abs(t.top + t.bottom - box.top - box.bottom) > 3) errors.push(['center', el.outerHTML])
          }
          if (el.matches('em')) {
            const parent = el.closest('aside').getBoundingClientRect()
            if (box.left < parent.left || box.right > parent.right) errors.push(['parent', el.outerHTML])
          }
        }
        const author = host.querySelector('.annotation-author-badge'), name = author.querySelector('span'), dot = author.querySelector('i')
        if (getComputedStyle(name).textOverflow !== 'ellipsis' || name.scrollWidth <= name.clientWidth || dot.getBoundingClientRect().right > name.getBoundingClientRect().left || author.getBoundingClientRect().width > 110) errors.push(['author', author.outerHTML])
        const original = host.querySelector('.page-manager-original-badge').getBoundingClientRect(), current = host.querySelector('.page-manager-current-badge').getBoundingClientRect()
        if (original.right + 7 > current.left) errors.push(['page-badges-overlap'])
        const circle = host.querySelector('.annotation-custom-color span').getBoundingClientRect(), plus = host.querySelector('.annotation-custom-color svg').getBoundingClientRect()
        if (plus.width <= 0 || plus.left < circle.left || plus.right > circle.right || plus.top < circle.top || plus.bottom > circle.bottom) errors.push(['color-plus'])
        host.remove(); return { errors, count: elements.length + 1 }
      })
      assert.deepEqual(result.errors, [], `preset ${preset}: ${JSON.stringify(result)}`)
      specimens += result.count
    }
  }
  console.log(JSON.stringify({ textBadges: 'passed', actualRecentSurfaces: surfaces, styleSpecimens: specimens, longCounts: '1–6 digits', themes: 2 }))
}
