const assert = require('node:assert/strict')

exports.buttons = async (page, module) => {
  if (module !== 0 && module !== 2) return
  const result = await page.locator(module === 0 ? '.reading-tools' : '.annotation-toolbar').evaluate((group, module) => {
    const buttons = [...group.querySelectorAll(module === 0 ? 'button' : '.annotation-author-button, .annotation-line-toggle')]
    const boxes = buttons.map(button => button.getBoundingClientRect())
    const kbd = group.querySelector('kbd'), key = kbd?.getBoundingClientRect(), owner = kbd?.parentElement.getBoundingClientRect()
    return { heights: boxes.map(b => b.height), keyFits: !key || (key.top >= owner.top + 4 && key.bottom <= owner.bottom - 4), count: buttons.length }
  }, module)
  assert.equal(result.count, module === 0 ? 5 : 2)
  assert.ok(Math.max(...result.heights) - Math.min(...result.heights) <= 1 && result.keyFits, JSON.stringify({ module, ...result }))
}

exports.scrollbars = async page => {
  for (let module = 0; module < 4; module++) {
    const nav = page.locator('.nav-rail button').nth(module)
    if (await nav.getAttribute('aria-expanded') !== 'true') await nav.click()
    const body = page.locator('.tool-panel .auto-hide-scrollbar')
    await body.waitFor()
    const metrics = () => body.evaluate(el => ({ width: el.clientWidth, top: el.scrollTop, color: getComputedStyle(el).scrollbarColor, visible: el.hasAttribute('data-scrollbar-visible') }))
    await body.evaluate(el => { el.scrollTop = 0 })
    const box = await body.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(60, box.height / 2))
    await page.mouse.wheel(0, 240)
    await page.waitForFunction(() => document.querySelector('.tool-panel .auto-hide-scrollbar')?.hasAttribute('data-scrollbar-visible'))
    await page.mouse.move(5, 5)
    await page.waitForFunction(() => !document.querySelector('.tool-panel .auto-hide-scrollbar')?.hasAttribute('data-scrollbar-visible'))
    const idle = await metrics()
    assert.match(idle.color, /rgba\(0, 0, 0, 0\) rgba\(0, 0, 0, 0\)/)
    assert.ok(idle.top > 0, `module ${module}: hidden scrollbar must still permit wheel scrolling`)
    if (module === 1) await page.screenshot({ path: `output/playwright/toolbar-scrollbar-idle-${require('../package.json').version}.png`, animations: 'disabled' })
    await page.mouse.move(box.x + box.width / 2, box.y + 40)
    const active = await metrics()
    assert.ok(active.visible && active.color !== idle.color)
    assert.equal(active.width, idle.width, 'showing the scrollbar must not shift content')
    assert.equal(active.top, idle.top, 'showing the scrollbar must not reset the scroll position')
    if (module === 1) await page.screenshot({ path: `output/playwright/toolbar-scrollbar-active-${require('../package.json').version}.png`, animations: 'disabled' })
    // Native scrollbar remains draggable, including a stationary hold beyond the idle delay.
    await body.evaluate(el => new Promise(resolve => { el.scrollTop = 0; requestAnimationFrame(() => requestAnimationFrame(resolve)) }))
    const thumb = await body.evaluate(el => { const b = el.getBoundingClientRect(), gutter = el.offsetWidth - el.clientWidth; return { x: getComputedStyle(el).direction === 'rtl' ? b.left + gutter / 2 : b.right - gutter / 2, y: b.top + gutter + Math.min(35, (el.clientHeight - 2 * gutter) * el.clientHeight / el.scrollHeight / 2) } })
    await page.mouse.move(thumb.x, thumb.y)
    await page.mouse.down()
    await page.mouse.move(thumb.x, thumb.y + 70, { steps: 8 })
    await page.waitForTimeout(1650)
    const held = await metrics()
    await page.mouse.up()
    if (!held.top) { await page.screenshot({ path: `output/playwright/toolbar-scrollbars-failure-${module}.png` }); console.error(await body.evaluate(el => ({ html: el.outerHTML.slice(0, 200), height: el.clientHeight, scrollHeight: el.scrollHeight, box: el.getBoundingClientRect().toJSON() })), thumb) }
    assert.ok(held.top > 0 && held.color !== idle.color, `module ${module}: native scrollbar drag failed: ${JSON.stringify(held)}`)
    if (module === 0) {
      await body.locator('button:enabled').first().focus()
      await page.waitForFunction(() => !document.querySelector('.tool-panel .auto-hide-scrollbar')?.hasAttribute('data-scrollbar-visible'))
      await page.keyboard.press('Shift')
      assert.equal((await metrics()).visible, true, 'keyboard input must reveal the scrollbar')
      await page.emulateMedia({ forcedColors: 'active' })
      assert.equal((await metrics()).color, 'auto')
      await page.emulateMedia({ forcedColors: 'none' })
    }
  }
  console.log(JSON.stringify({ toolScrollbars: 'passed', modules: 4, idleMilliseconds: 1500, wheel: 'passed', nativeDrag: 'passed', stableLayout: 'passed' }))
}
