const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const packageVersion = require('../package.json').version
const userData = path.join(root, 'tmp', 'i18n-ui-smoke-user')
const entry = path.join(root, 'out/main/index.js')
const pdfPath = path.join(root, 'tmp', 'Scheduling0821m.pdf')
const screenshotDirectory = path.join(root, 'output', 'playwright')

async function launch(args = []) {
  return electron.launch({ executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'), args: [entry, ...args], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
}

async function assertNoChineseControls(page, scope) {
  const copy = await page.locator(scope).allInnerTexts()
  // Operating-system printer names are external device data and must be
  // displayed and dispatched verbatim, even when they contain CJK text.
  const printerNames = await page.locator('.print-printer-select option').allInnerTexts()
  let visible = copy.join('\n').replace(/简体中文|English|日本語|Русский|Español|Français|Deutsch|Português|한국어|العربية/g, '')
  for (const printerName of printerNames) visible = visible.split(printerName).join('')
  assert.ok(!/[\u3400-\u9fff]/u.test(visible), `untranslated Chinese UI text in ${scope}: ${copy.join(' | ')}`)
}

// PDF pages and annotation bodies are user/document data. They may rightly contain
// Chinese while the application chrome is displayed in another language.
const interfaceControls = '.titlebar, .tool-panel, .nav-rail, .window-manager-bar, .modal-backdrop, .toast, .temporary-document-warning'

async function assertAdaptiveToolPanel(page, language, module) {
  const violations = await page.locator('.tool-panel .tool-action-button, .tool-panel .tool-panel-action, .tool-panel .tool-button, .tool-panel .subtitle, .tool-panel .hint, .tool-panel .info-card').evaluateAll((elements) => elements.flatMap((element) => {
    if (!(element instanceof HTMLElement) || !element.offsetParent) return []
    const bounds = element.getBoundingClientRect()
    const horizontal = element.scrollWidth - element.clientWidth
    const vertical = element.scrollHeight - element.clientHeight
    const descendants = [...element.querySelectorAll('span, strong, small, kbd')].filter((child) => child instanceof HTMLElement)
    const childEscapes = descendants.some((child) => { const box = child.getBoundingClientRect(); return box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1 || child.scrollWidth > child.clientWidth + 1 || child.scrollHeight > child.clientHeight + 1 })
    const escaped = vertical > 1 || (element.tagName !== 'BUTTON' && horizontal > 1) || childEscapes
    return escaped ? [{ tag: element.tagName, className: element.className, text: (element.innerText || '').replace(/\s+/g, ' ').slice(0, 120), client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight], children: descendants.map((child) => { const box = child.getBoundingClientRect(); return { tag: child.tagName, className: child.className, left: box.left, right: box.right, width: box.width, client: [child.clientWidth, child.clientHeight], scroll: [child.scrollWidth, child.scrollHeight] } }) }] : []
  }))
  assert.deepEqual(violations, [], `${language}/${module} tool-panel copy escaped its adaptive border`)
}

async function main() {
  // The former page-wide DOM translator caused both missed copy and a performance
  // regression. The catalogue audit owns the source scan; this smoke test keeps a
  // direct guard around the two retired split-catalogue files.
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/components/InterfaceLanguageBridge.tsx')), false, 'legacy DOM translator must stay removed')
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/lib/i18n-locales.ts')), false, 'split renderer locale catalogue must stay removed')

  fs.rmSync(userData, { recursive: true, force: true })
  const app = await launch()
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(900, 700))
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    const languages = [
      { value: 'zh', view: '查看', recent: '最近打开', modules: ['编辑', '批注', '保存'], shape: '在页面上添加图形…', drawing: '自由画板', timeout: '响应超时时间', transferPrompt: '释放以移回文档标签页', cjkFree: false },
      { value: 'en', view: 'View', recent: 'Recent Files', modules: ['Edit', 'Annotate', 'Save'], shape: 'Add Shape to Page…', drawing: 'Free Drawing Board', timeout: 'Response timeout', transferPrompt: 'Drop to Move into Document Tabs', cjkFree: true },
      { value: 'ja', view: '表示', recent: '最近開いたファイル', modules: ['編集', '注釈', '保存'], shape: 'ページに図形を追加…', drawing: 'フリードローイングボード', timeout: '応答タイムアウト', transferPrompt: 'ドロップして文書タブに戻す', cjkFree: false },
      { value: 'ru', view: 'Просмотр', recent: 'Недавние файлы', modules: ['Редактирование', 'Аннотации', 'Сохранить'], shape: 'Добавить фигуру на страницу…', drawing: 'Свободная доска', timeout: 'Тайм-аут ответа', transferPrompt: 'Отпустите, чтобы вернуть во вкладки документов', cjkFree: true },
      { value: 'es', view: 'Ver', recent: 'Archivos recientes', modules: ['Editar', 'Anotar', 'Guardar'], shape: 'Añadir forma a la página…', drawing: 'Pizarra de dibujo libre', timeout: 'Tiempo de espera de respuesta', transferPrompt: 'Suelte para mover a las pestañas del documento', cjkFree: true },
      { value: 'fr', view: 'Affichage', recent: 'Fichiers récents', modules: ['Modifier', 'Annoter', 'Enregistrer'], shape: 'Ajouter une forme à la page…', drawing: 'Tableau de dessin libre', timeout: 'Délai de réponse', transferPrompt: 'Déposez pour replacer dans les onglets de document', cjkFree: true },
      { value: 'de', view: 'Ansicht', recent: 'Zuletzt verwendete Dateien', modules: ['Bearbeiten', 'Anmerkungen hinzufügen', 'Speichern'], shape: 'Form zur Seite hinzufügen…', drawing: 'Freie Zeichenfläche', timeout: 'Antwort-Timeout', transferPrompt: 'Zum Verschieben in die Dokumentregisterkarten ziehen', cjkFree: true },
      { value: 'pt', view: 'Visualizar', recent: 'Arquivos recentes', modules: ['Editar', 'Anotar', 'Salvar'], shape: 'Adicionar forma à página…', drawing: 'Quadro de desenho livre', timeout: 'Tempo limite de resposta', transferPrompt: 'Solte para mover para as guias do documento', cjkFree: true },
      { value: 'ko', view: '보기', recent: '최근 파일', modules: ['편집', '주석 달기', '저장'], shape: '페이지에 도형 추가…', drawing: '자유 그리기 보드', timeout: '응답 시간 초과', transferPrompt: '드롭하여 문서 탭으로 이동', cjkFree: true },
      { value: 'ar', view: 'عرض', recent: 'الملفات الأخيرة', modules: ['تحرير', 'إضافة تعليق', 'حفظ'], shape: 'إضافة شكل إلى الصفحة…', drawing: 'لوحة رسم حرة', timeout: 'مهلة الاستجابة', transferPrompt: 'اسحب وأفلت للنقل إلى علامات تبويب المستند', cjkFree: true, dir: 'rtl' }
    ]
    const languageSelect = page.locator('.language-select select')
    await languageSelect.waitFor()
    assert.equal(await languageSelect.count(), 1, 'language control must be a single dropdown')
    assert.equal(await languageSelect.locator('option').count(), 10, 'language dropdown must expose all ten interface languages')
    assert.equal(await page.locator('.language-segmented').count(), 0, 'language options must not be shown as buttons')
    assert.equal(await page.locator('.language-select').evaluate((element) => Boolean(element.closest('.theme-setting'))), false, 'language dropdown must not be nested in a display-language card')
    assert.equal(await page.getByText('显示语言', { exact: true }).count(), 0, 'language dropdown must not repeat the section heading')
    for (const language of languages) {
      await languageSelect.selectOption(language.value)
      assert.equal(await languageSelect.inputValue(), language.value)
      assert.deepEqual(await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir })), { lang: language.value, dir: language.dir || 'ltr' }, `${language.value} document locale metadata`)
      await page.getByRole('heading', { name: language.view, exact: true }).waitFor()
      await page.getByRole('heading', { name: language.recent, exact: true }).waitFor()
      for (const module of language.modules) {
        await page.locator('.nav-rail').getByRole('button', { name: module, exact: true }).click()
        await page.getByRole('heading', { name: module, exact: true }).waitFor()
        await assertAdaptiveToolPanel(page, language.value, module)
      }
      await page.locator('.nav-rail').getByRole('button', { name: language.modules[0], exact: true }).click()
      await page.getByText(language.shape, { exact: true }).waitFor()
      await page.locator('.nav-rail').getByRole('button', { name: language.modules[1], exact: true }).click()
      await page.getByText(language.drawing, { exact: true }).waitFor()
      await page.locator('.annotation-lab-settings-trigger').click()
      await page.locator('.annotation-lab-settings label').filter({ hasText: language.timeout }).waitFor()
      assert.equal(await page.locator('.ai-timeout-input input').inputValue(), '120', `${language.value} timeout default must be 120 seconds`)
      if (language.cjkFree) await assertNoChineseControls(page, '.annotation-lab-settings')
      await page.locator('.annotation-lab-settings header button').click()
      await page.locator('.nav-rail').getByRole('button', { name: language.view, exact: true }).click()
      await assertAdaptiveToolPanel(page, language.value, language.view)
      const documentTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer()
        const token = '12345678-1234-1234-1234-1234567890ab'
        transfer.setData('application/x-pdfuck-document-transfer', token)
        transfer.setData('text/plain', `pdfuck-document-transfer:${token}`)
        return transfer
      })
      await page.locator('.app-shell').dispatchEvent('dragenter', { dataTransfer: documentTransfer })
      await page.getByText(language.transferPrompt, { exact: true }).waitFor()
      assert.equal(await page.locator('.drop-overlay').count(), 0, 'a document return must not use the external-file overlay')
      assert.equal(await page.locator('.document-transfer-overlay').count(), 1, 'a document return needs its own localized overlay')
      if (language.cjkFree) await assertNoChineseControls(page, '.titlebar, .tool-panel, .nav-rail, .window-manager-bar, .document-transfer-overlay')
      await page.locator('.app-shell').dispatchEvent('dragleave', { dataTransfer: documentTransfer, relatedTarget: null })
      assert.equal(await page.locator('.document-transfer-overlay').count(), 0, 'the document-return overlay must clear when the drag leaves')
    }
  } finally { await app.close() }

  const restarted = await launch()
  try {
    const page = await restarted.firstWindow()
    await page.getByRole('heading', { name: 'عرض', exact: true }).waitFor()
    await page.getByText('لا يوجد مستند مفتوح', { exact: true }).first().waitFor()
    assert.deepEqual(await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir })), { lang: 'ar', dir: 'rtl' }, 'stored Arabic direction was not restored')
    assert.equal(await page.getByText('准备就绪', { exact: true }).count(), 0, 'stored initial status was not localized after restart')
    console.log(JSON.stringify({ languages: ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar'], persisted: 'ar', adaptiveSmallWindow: [900, 700], domObserver: false }, null, 2))
    // Keep the established document-flow assertions below in their Spanish fixture.
    await page.locator('.language-select select').selectOption('es')
    await page.getByRole('heading', { name: 'Ver', exact: true }).waitFor()
  } finally {
    await restarted.close()
  }

  assert.ok(fs.existsSync(pdfPath), `missing PDF fixture: ${pdfPath}`)
  const documentApp = await launch([pdfPath])
  try {
    const page = await documentApp.firstWindow()
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    const documentPage = page.locator('.pdf-page[data-page="1"]')
    await documentPage.waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: 'Ajustar al ancho', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Ajustar página', exact: true }).waitFor()
    assert.equal(await page.locator('.fit-control svg').count(), 2, 'both page fitting controls must be icon buttons')
    const platform = await page.evaluate(() => window.desktop.platform)
    const searchAction = page.locator('.search-pdf-action')
    await searchAction.getByText('Buscar en PDF', { exact: true }).waitFor()
    assert.equal(await searchAction.locator('small').count(), 0, 'search PDF must not render a subtitle')
    assert.equal(await searchAction.locator('kbd').innerText(), platform === 'darwin' ? '⌘F' : 'Ctrl+F', 'search keycap must match the current platform')
    const searchLayout = await searchAction.evaluate((element) => {
      const peer = element.nextElementSibling
      const label = element.querySelector('span')
      if (!(peer instanceof HTMLElement) || !(label instanceof HTMLElement)) return null
      const labelStyle = getComputedStyle(label), peerStyle = getComputedStyle(peer)
      const elementStyle = getComputedStyle(element)
      return { searchHeight: element.getBoundingClientRect().height, peerHeight: peer.getBoundingClientRect().height, searchMinHeight: elementStyle.minHeight, peerMinHeight: peerStyle.minHeight, searchPaddingTop: elementStyle.paddingTop, peerPaddingTop: peerStyle.paddingTop, searchRadius: elementStyle.borderRadius, peerRadius: peerStyle.borderRadius, searchFontSize: labelStyle.fontSize, peerFontSize: peerStyle.fontSize, searchFontWeight: labelStyle.fontWeight, peerFontWeight: peerStyle.fontWeight, searchFits: element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1, peerFits: peer.scrollWidth <= peer.clientWidth + 1 && peer.scrollHeight <= peer.clientHeight + 1 }
    })
    assert.ok(searchLayout && searchLayout.searchHeight >= 38 && searchLayout.peerHeight >= 38, 'reading-tool borders must keep the shared minimum height')
    assert.equal(searchLayout.searchMinHeight, searchLayout.peerMinHeight, 'search PDF must use the same adaptive minimum height as peer actions')
    assert.equal(searchLayout.searchPaddingTop, searchLayout.peerPaddingTop, 'search PDF must use the same adaptive vertical padding as peer actions')
    assert.equal(searchLayout.searchRadius, searchLayout.peerRadius, 'search PDF must use the same border radius as peer actions')
    assert.equal(searchLayout.searchFontSize, searchLayout.peerFontSize, 'search PDF must use the same text size as the reading tools below it')
    assert.equal(searchLayout.searchFontWeight, searchLayout.peerFontWeight, 'search PDF must use the same text weight as the reading tools below it')
    assert.ok(searchLayout.searchFits && searchLayout.peerFits, 'localized reading-tool text must remain inside its adaptive button border')
    fs.mkdirSync(screenshotDirectory, { recursive: true })
    await page.screenshot({ path: path.join(screenshotDirectory, `reading-tools-${packageVersion}.png`) })
    await page.locator('.nav-rail').getByRole('button', { name: 'Editar', exact: true }).click()
    assert.equal(await page.locator('.edit-tool-icon').count(), 8, 'all eight edit actions must use the shared line-icon system')
    await page.getByText('Añadir números de página', { exact: true }).click()
    await page.getByRole('heading', { name: 'Añadir números de página', exact: true }).waitFor()
    await page.getByText('Página + total', { exact: true }).waitFor()
    await assertNoChineseControls(page, interfaceControls)
    await page.getByRole('button', { name: 'Añadir números', exact: true }).click()
    await page.locator('.window-dirty-dot').waitFor()
    await page.locator('.text-object').first().waitFor()
    assert.equal(await page.locator('.text-object.editable').count(), 0, 'page numbers must not become individually draggable text objects')
    await page.getByText('Añadir números de página', { exact: true }).click()
    await page.getByText('Se detectaron números de página', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Eliminar números añadidos', exact: true }).click()
    await page.locator('.text-object').first().waitFor({ state: 'detached' })
    await page.keyboard.press('Control+z')
    await page.locator('.text-object').first().waitFor()
    await page.keyboard.press('Control+z')
    await page.locator('.text-object').first().waitFor({ state: 'detached' })
    await page.locator('.window-dirty-dot').waitFor({ state: 'detached' })
    if (await page.locator('.error-dialog').count()) throw new Error(`unexpected page-number undo error: ${await page.locator('.error-dialog').innerText()}`)
    await page.locator('.nav-rail').getByRole('button', { name: 'Anotar', exact: true }).click()
    await page.waitForTimeout(150)
    for (const label of ['Lista de anotaciones', 'Resumen de respuestas', 'Tamaño de texto de la lista', 'Una línea', 'Laboratorio', 'Edición con IA']) {
      await page.getByText(label, { exact: true }).first().waitFor()
    }
    for (const chinese of ['批注列表', '回复统计', '列表字号', '单行', '实验室', '智能润色', '适合宽度']) {
      assert.equal(await page.getByText(chinese, { exact: true }).count(), 0, `untranslated UI label: ${chinese}`)
    }
    const shortcutKeys = await page.locator('.tool-panel .tool-button kbd').allInnerTexts()
    if (platform === 'darwin') {
      assert.ok(shortcutKeys.includes('⌘H') && shortcutKeys.includes('⌫'), 'macOS annotation keycaps must use Command and Backspace symbols')
      assert.ok(shortcutKeys.every((key) => !key.includes('Ctrl') && key !== 'Insert'), 'macOS must not advertise Windows-only keycaps')
    } else {
      assert.ok(shortcutKeys.includes('Ctrl+H') && shortcutKeys.includes('Delete') && shortcutKeys.includes('Insert'), 'Windows annotation keycaps must use Windows conventions')
      assert.ok(shortcutKeys.every((key) => !key.includes('⌘')), 'Windows must not advertise macOS keycaps')
    }
    await page.locator('.annotation-author-button').click()
    const authorWindow = page.locator('.annotation-author-window')
    await authorWindow.getByText('Autor de anotaciones', { exact: true }).waitFor()
    await assertNoChineseControls(page, '.annotation-author-window')
    const authorBefore = await authorWindow.boundingBox()
    if (authorBefore) {
      await page.mouse.move(authorBefore.x + 80, authorBefore.y + 24)
      await page.mouse.down()
      await page.mouse.move(authorBefore.x - 35, authorBefore.y + 55, { steps: 4 })
      await page.mouse.up()
      const authorAfter = await authorWindow.boundingBox()
      assert.ok(authorAfter && (Math.abs(authorAfter.x - authorBefore.x) > 10 || Math.abs(authorAfter.y - authorBefore.y) > 10), 'annotation author window must be movable')
    }
    await authorWindow.locator('.annotation-author-name input').fill('Revisor Uno')
    assert.equal(await authorWindow.locator('input[type="checkbox"]').count(), 0, 'annotation author settings must not expose a duplicate checkbox')
    const authorVisibility = authorWindow.getByRole('switch', { name: 'Mostrar autores en la lista', exact: true })
    assert.equal(await authorVisibility.getAttribute('aria-checked'), 'false', 'author visibility switch must start from the persisted state')
    await authorVisibility.click()
    assert.equal(await authorVisibility.getAttribute('aria-checked'), 'true', 'the single author visibility switch must toggle the setting')
    await page.screenshot({ path: path.join(screenshotDirectory, `annotation-author-${packageVersion}.png`) })
    await authorWindow.getByRole('button', { name: 'Guardar ajustes', exact: true }).click()
    const storedAuthor = await page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.preferences.v1') || '{}'))
    assert.equal(storedAuthor.annotationAuthor, 'Revisor Uno', 'annotation author name must persist locally')
    assert.equal(storedAuthor.showAnnotationAuthors, true, 'author visibility must persist locally')
    await documentPage.click({ button: 'right', position: { x: 220, y: 170 } })
    await page.locator('.context-menu').getByText('Nota', { exact: true }).click()
    const annotationDialog = page.locator('.annotation-dialog')
    await annotationDialog.locator('textarea').fill('Author smoke annotation')
    await annotationDialog.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await page.locator('.annotation-row .annotation-author-badge').getByText('Revisor Uno', { exact: true }).waitFor()
    assert.equal(await page.locator('.annotation-header').evaluate((element) => element.children.length), 5, 'author badges must not add a list column')
    const authoredRow = page.locator('.annotation-row').filter({ hasText: 'Author smoke annotation' }).first()
    const authorLayout = await authoredRow.evaluate((row) => {
      const content = row.querySelector('.annotation-content'), author = row.querySelector('.annotation-author-meta'), value = row.querySelector('.annotation-content-value')
      if (!(content instanceof HTMLElement) || !(author instanceof HTMLElement) || !(value instanceof HTMLElement)) return null
      const contentRect = content.getBoundingClientRect(), authorRect = author.getBoundingClientRect(), valueRect = value.getBoundingClientRect()
      return { authorBottom: authorRect.bottom, valueTop: valueRect.top, contentLeft: contentRect.left, contentWidth: contentRect.width, valueLeft: valueRect.left, valueWidth: valueRect.width }
    })
    assert.ok(authorLayout && authorLayout.authorBottom <= authorLayout.valueTop + 0.5, 'annotation author must sit above the annotation body')
    assert.ok(authorLayout && Math.abs(authorLayout.contentLeft - authorLayout.valueLeft) <= 0.5 && authorLayout.valueWidth >= authorLayout.contentWidth - 0.5, 'annotation body must retain the full content-column width')
    await page.screenshot({ path: path.join(screenshotDirectory, `annotation-author-list-${packageVersion}.png`) })
    await page.locator('.annotation-line-toggle').click()
    const compactAuthorBottom = await authoredRow.locator('.annotation-author-meta').evaluate((element) => element.getBoundingClientRect().bottom)
    const compactValueTop = await authoredRow.locator('.annotation-content-value').evaluate((element) => element.getBoundingClientRect().top)
    assert.ok(compactAuthorBottom <= compactValueTop + 0.5, 'single-line mode must keep the author above the annotation body')
    await page.locator('.annotation-lab-launch.has-shortcut').click()
    for (const label of ['Explicación sencilla', 'Mejorar la lógica', 'Solo gramática', 'Redacción natural', 'Resolver incoherencias', 'Destacar puntos fuertes']) {
      await page.locator('.ai-polish-window').getByText(label, { exact: true }).waitFor()
    }
    await assertNoChineseControls(page, '.ai-polish-window')
    await page.locator('.ai-polish-window').getByRole('button', { name: 'Cerrar', exact: true }).click()
    const temporaryWarning = page.locator('.temporary-document-warning')
    if (await temporaryWarning.count()) {
      await temporaryWarning.getByText('Este archivo puede estar en una carpeta temporal. Guárdelo en otro lugar para no perderlo.', { exact: true }).waitFor()
    }
    await page.locator('.nav-rail').getByRole('button', { name: 'Guardar', exact: true }).click()
    await page.getByText('Seleccionar páginas e imprimir…', { exact: true }).click()
    await page.getByRole('heading', { name: 'Configuración y vista previa de impresión', exact: true }).waitFor()
    assert.equal(await page.locator('.page-selection-dialog').count(), 0, 'printing must not open a separate page-selection dialog')
    await page.getByText('15 páginas del documento · 15 hojas', { exact: true }).waitFor()
    await page.getByText('15 páginas usarán 15 hojas', { exact: true }).waitFor()
    const automaticOrientation = page.getByText('A4 · Adaptación automática', { exact: true })
    await automaticOrientation.waitFor({ state: 'attached' })
    await automaticOrientation.scrollIntoViewIfNeeded()
    await automaticOrientation.waitFor()
    assert.equal(await page.locator('.print-page-strip button').count(), 15, 'page selection must live inside the print preview')
    await assertNoChineseControls(page, interfaceControls)
    assert.equal(await page.getByText('15 个文档页面 · 15 张纸', { exact: true }).count(), 0, 'print overview was not localized')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click()
    await page.locator('.nav-rail').getByRole('button', { name: 'Anotar', exact: true }).click()
    await documentPage.click({ button: 'right', position: { x: 120, y: 120 } })
    await page.locator('.context-menu').waitFor()
    await page.locator('.context-menu').getByText('Nota', { exact: true }).waitFor()
    await assertNoChineseControls(page, '.context-menu')
    assert.equal(await page.getByText('自由批注', { exact: true }).count(), 0, 'PDF context menu was not localized')
    await page.keyboard.press('Escape')

    await page.locator('.nav-rail').getByRole('button', { name: 'Ver', exact: true }).click()
    const documentLanguage = page.locator('.language-select select')
    await documentLanguage.selectOption('ru')
    await page.getByRole('heading', { name: 'Просмотр', exact: true }).waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: 'Редактирование', exact: true }).click()
    await page.getByText('Управление страницами…', { exact: true }).click()
    await page.getByRole('heading', { name: 'Управление страницами', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Раскадровка страниц', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Применить изменения', exact: true }).waitFor()
    for (const label of ['Повернуть влево на 90°', 'Перевернуть на 180°', 'Повернуть вправо на 90°']) await page.getByRole('button', { name: label, exact: true }).waitFor()
    assert.equal(await page.locator('.page-manager-card').count(), 15, 'page manager must preview the visible Russian document group')
    await assertNoChineseControls(page, interfaceControls)
    await page.getByRole('button', { name: 'Отмена', exact: true }).last().click()

    await page.locator('.nav-rail').getByRole('button', { name: 'Просмотр', exact: true }).click()
    await documentLanguage.selectOption('ja')
    await page.getByRole('heading', { name: '表示', exact: true }).waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: '注釈', exact: true }).click()
    await page.getByText('注釈リスト', { exact: true }).waitFor()
  } finally {
    const cleanupWindow = documentApp.windows()[0]
    if (cleanupWindow && !cleanupWindow.isClosed()) {
      try {
        await cleanupWindow.keyboard.press('Escape')
        for (let attempt = 0; attempt < 4 && await cleanupWindow.locator('.quick-save').isEnabled(); attempt += 1) {
          await cleanupWindow.keyboard.press('Control+z')
          await cleanupWindow.waitForTimeout(120)
        }
        await cleanupWindow.waitForFunction(() => document.querySelector('.quick-save')?.hasAttribute('disabled'), undefined, { timeout: 5000 })
      } catch { /* A failed assertion may already have closed the renderer. */ }
    }
    await documentApp.close()
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
