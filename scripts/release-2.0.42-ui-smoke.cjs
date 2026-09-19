const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out', 'main', 'index.js')
const version = require('../package.json').version
const fixture = path.join(root, 'tmp', 'test-enc.pdf')
const directory = path.join(root, 'tmp', `release-2.0.42-ui-${process.pid}`)
const savedCopy = path.join(directory, 'test-enc-editable-copy.pdf')
const userData = path.join(directory, 'profile')
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']

async function launch() {
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  return electron.launch({
    executablePath: executable || require('electron'),
    args: executable ? [`--user-data-dir=${userData}`, fixture] : [entry, fixture],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: version }
  })
}

async function main() {
  assert.equal(version, '2.0.42')
  assert.ok(fs.existsSync(fixture), 'tmp/test-enc.pdf is required')
  fs.mkdirSync(directory, { recursive: true })
  let app
  try {
    app = await launch()
    const page = await app.firstWindow(); page.setDefaultTimeout(50000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 920))
    const banner = page.locator('.document-security-banner'); await banner.waitFor()
    assert.equal(await page.locator('.error-dialog').count(), 0, 'encrypted PDF surfaced a raw load error')
    assert.match(await banner.innerText(), /加密权限限制/)
    assert.match(await banner.innerText(), /数字签名/)
    assert.equal(await page.locator('.nav-rail > button').nth(1).isDisabled(), true, 'restricted source must start read-only')

    await banner.getByRole('button', { name: '验证签名', exact: true }).click()
    const details = page.locator('.security-details-dialog'); await details.waitFor()
    assert.match(await details.innerText(), /签名完整有效/)
    assert.match(await details.innerText(), /国家移民管理局 National Immigration Administration/)
    assert.match(await details.innerText(), /BJCA DocSign CA3/)
    assert.equal(await details.locator('.security-permissions .allowed').count(), 1)
    assert.equal(await details.locator('.security-permissions .restricted').count(), 3)
    const spacing = await details.locator('.window-scroll-body').evaluate((body) => {
      const children = [...body.children]
      const bounds = children.map((child) => child.getBoundingClientRect())
      return { top: bounds[0].top - body.getBoundingClientRect().top, gaps: bounds.slice(1).map((bound, index) => bound.top - bounds[index].bottom) }
    })
    assert.ok(spacing.top >= 12 && spacing.gaps.every((gap) => gap >= 12), `security details spacing is too tight: ${JSON.stringify(spacing)}`)
    assert.match(await details.innerText(), /签名覆盖整个原文件/)
    assert.match(await details.innerText(), /不代表操作系统或颁发机构已确认/)
    fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true })
    const packaged = process.env.PDFUCK_SMOKE_EXECUTABLE ? '-packaged' : ''
    await details.screenshot({ path: path.join(root, 'output', 'playwright', `release-${version}-pdf-signature-details${packaged}.png`) })
    await details.locator('.modal-actions button').click()

    const compactDialogAudit = await page.evaluate(() => {
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;left:-2000px;top:0;width:900px;visibility:hidden'
      document.body.append(host)
      const fixtures = [
        ['confirm', 'modal scroll-window', '<h2>确认</h2>', '<p>说明</p><div class="modal-actions"><button>取消</button></div>', 'h2', 'p'],
        ['error', 'modal error-dialog scroll-window', '<div class="error-dialog-heading"><span>!</span><h2>操作失败</h2></div>', '<p>错误说明</p><div class="modal-actions"><button>确定</button></div>', '.error-dialog-heading', 'p'],
        ['password', 'modal password-dialog scroll-window', '<div class="password-heading"><span class="password-lock">□</span><div><small>加密 PDF</small><h2>输入密码</h2></div></div>', '<div class="password-file">文件</div><p class="password-message">说明</p><label class="password-field">密码</label><label class="remember-password">记住</label>', '.password-heading', '.password-file'],
        ['secure-storage', 'modal secure-storage-dialog scroll-window', '<div class="secure-storage-heading"><span class="secure-storage-icon">□</span><div><small>加密 PDF</small><h2>使用本机安全存储</h2></div></div>', '<p>安全存储说明</p><div class="secure-storage-note">系统授权说明</div><div class="modal-actions"><button>继续</button></div>', '.secure-storage-heading', 'p'],
        ['save-as', 'modal save-as-required-dialog scroll-window', '<header class="save-as-required-heading">另存为</header>', '<div class="save-as-required-note">说明</div><div class="modal-actions"><button>保存</button></div>', '.save-as-required-heading', '.save-as-required-note'],
        ['update', 'modal update-dialog scroll-window', '<header class="update-heading">发现更新</header>', '<div class="update-version">版本</div><div class="update-actions"><button>下载</button></div>', '.update-heading', '.update-version'],
        ['translation', 'modal translation-dialog scroll-window', '<header><div>翻译</div></header>', '<section>原文</section><div class="modal-actions"><button>关闭</button></div>', 'header > div', 'section'],
        ['about', 'modal ocr-dialog about-dialog scroll-window', '<header><h2>关于</h2></header>', '<p>说明</p><div class="modal-actions"><button>关闭</button></div>', 'header h2', 'p'],
        ['interface-size', 'modal interface-size-dialog scroll-window', '<header><h2>界面字号</h2></header>', '<p>说明</p><div class="modal-actions"><button>确定</button></div>', 'header h2', 'p']
      ]
      const failures = []
      for (const [name, className, heading, body, anchorSelector, targetSelector] of fixtures) {
        host.innerHTML = `<div class="${className}">${heading}<div class="window-scroll-body">${body}</div></div>`
        const dialog = host.firstElementChild
        const anchor = dialog.querySelector(anchorSelector)
        const target = dialog.querySelector(targetSelector)
        const anchorStyle = getComputedStyle(anchor)
        const expected = anchor.getBoundingClientRect().left + (name === 'password' || name === 'secure-storage' ? parseFloat(anchorStyle.paddingLeft) : 0)
        const delta = target.getBoundingClientRect().left - expected
        if (Math.abs(delta) > 1) failures.push(`${name}:${delta}`)
      }
      host.remove()
      return failures
    })
    assert.deepEqual(compactDialogAudit, [], `compact dialogs are misaligned: ${compactDialogAudit.join(', ')}`)

    await page.evaluate(() => {
      const backdrop = document.createElement('div')
      backdrop.id = 'compact-dialog-qa'
      backdrop.className = 'modal-backdrop secure-storage-backdrop'
      backdrop.innerHTML = '<div class="modal secure-storage-dialog scroll-window"><div class="secure-storage-heading"><span class="secure-storage-icon">▣</span><div><small>加密 PDF</small><h2>使用本机安全存储</h2></div></div><div class="window-scroll-body"><p>此文档已确认受密码保护。继续后，PDFuck 会尝试读取本机保存的打开密码。</p><div class="secure-storage-note"><b>你可能会看到系统安全授权</b><span>这是系统凭据保护的正常提示，仅用于保护这个 PDF 的密码。</span></div><div class="modal-actions"><button>跳过并手动输入</button><button class="primary">继续尝试</button></div></div></div>'
      document.body.append(backdrop)
    })
    await page.locator('#compact-dialog-qa .secure-storage-dialog').screenshot({ path: path.join(root, 'output', 'playwright', `release-${version}-compact-dialogs${packaged}.png`) })
    await page.locator('#compact-dialog-qa').evaluate((element) => element.remove())

    for (const language of languages) {
      await page.locator('.language-select select').selectOption(language)
      const geometry = await banner.evaluate((element) => ({
        text: element.textContent?.trim(),
        contained: [...element.querySelectorAll('button')].every((button) => button.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1 && button.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1)
      }))
      assert.ok(geometry.text && geometry.contained, `security banner is incomplete in ${language}`)
    }
    await page.locator('.language-select select').selectOption('zh')

    await banner.screenshot({ path: path.join(root, 'output', 'playwright', `release-${version}-pdf-security-notice${packaged}.png`) })

    await app.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }) }, savedCopy)
    await banner.getByRole('button', { name: '生成可编辑副本', exact: true }).click()
    const confirmation = page.getByRole('alertdialog'); await confirmation.waitFor()
    assert.match(await confirmation.locator('#confirm-dialog-message').innerText(), /原文件不会覆盖/)
    await confirmation.getByRole('button', { name: '生成可编辑副本', exact: true }).click()
    await banner.waitFor({ state: 'detached' })
    await page.locator('.pdf-page').waitFor()
    assert.equal(await page.locator('.nav-rail > button').nth(1).isEnabled(), true, 'editable copy did not unlock editing')
    assert.equal(await page.locator('.quick-save').isEnabled(), true, 'editable copy must require Save As')
    assert.match(await page.locator('.window-tab.current').innerText(), /editable-copy/i)

    await page.locator('.quick-save').click()
    await page.waitForFunction(() => document.querySelector('.quick-save')?.hasAttribute('disabled'))
    assert.ok(fs.existsSync(savedCopy), 'editable copy was not saved')
    const saved = fs.readFileSync(savedCopy)
    const reopened = await PDFDocument.load(saved)
    assert.equal(reopened.getPageCount(), 1)
    const raw = saved.toString('latin1')
    assert.doesNotMatch(raw, /\/Encrypt\b/)
    assert.doesNotMatch(raw, /\/ByteRange\b/)

    await page.locator('.titlebar').screenshot({ path: path.join(root, 'output', 'playwright', `release-${version}-pdf-security-editable${packaged}.png`) })
    console.log(JSON.stringify({ release2042: 'passed', version, packaged: Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE), encryption: { permissionProtectedOpen: true, rawErrorHidden: true, editableCopySaved: true }, signatures: { cmsIntegrity: 'valid', signer: 'National Immigration Administration', wholeFile: true }, languages: languages.length }))
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
