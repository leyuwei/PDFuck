const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { _electron } = require('playwright')

const root = path.resolve(__dirname, '../..')
const fixtures = path.join(root, 'tests/fixtures')
const fixture = require('../fixtures/release-2.2.0-visual-inputs.json').fixtures[0]
const archive = path.join(fixtures, fixture.file)
const dir = path.join(root, 'tests/tmp/release-2.2.0-columns')
const output = path.join(root, 'tests/output/release-2.2.0-columns')
const languages = ['zh','en','ja','ru','es','fr','de','pt','ko','ar']
const expected = [
  [[329.8,348.1]], [[225.5,243.2]], [[121,138.8],[329.8,348.1]], [[225.5,243.2]], [[329.8,348.1]],
  [[225.5,243.2],[434.1,451.7]], [[329.8,348.1]], [[225.5,243.2]], [[329.8,348.1]]
]
const body = new Map([[2,[255,34.5,225.5,243.3,434.2]],[5,[345,138.9,329.8,348.3,538.5]],[8,[289,34.5,225.5,243.3,434.2]]])
const command = process.platform === 'darwin' ? 'Meta' : 'Control'
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const normalized = text => text.normalize('NFKC').replace(/\s+/gu, '')

async function main() {
  const original = process.argv[2] && path.resolve(process.argv[2])
  const files = original ? [original,archive] : [archive]
  const before = files.map(sha)
  assert.equal(sha(archive), fixture.sha256)
  fs.mkdirSync(dir,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const profile = fs.mkdtempSync(path.join(dir,'profile-'))
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(12000)
  const errors = []
  win.on('pageerror',error=>errors.push(error.message))
  const result = { documents: [], interfaceLanguages: 0 }
  const zoom = win.locator('input.zoom-value')
  const tool = win.locator('.reading-tools button').filter({has:win.locator('svg.visual')})
  const panel = win.locator('.insight-panel')
  const guide = '.column-boundary-guide'
  async function language(code) {
    await win.locator('.tool-panel .language-picker-trigger').click()
    await win.locator(`.tool-panel .language-picker-options button[lang="${code}"]`).click()
    await win.waitForFunction(code=>document.documentElement.lang===code,code)
  }
  async function pageAt(number) {
    const field = win.locator('.page-controls input')
    await field.fill(String(number))
    await field.press('Enter')
    const paper = win.locator(`.pdf-page[data-page="${number-1}"]`)
    await paper.locator('.text-map span').first().waitFor()
    return paper
  }
  async function setZoom(value) {
    await zoom.fill(String(value))
    await zoom.press('Enter')
  }
  async function showEditor(paper) {
    await paper.click({button:'right',position:{x:77,y:158}})
    await win.locator('.column-boundary-item').click()
    const editor = paper.locator('.column-boundary-editor')
    await editor.waitFor()
    return editor
  }
  const guidePositions = editor => editor.locator(guide).evaluateAll(elements => elements.map(element =>
    parseFloat(element.style.left) / 100 * Number(element.closest('.pdf-page').dataset.pageWidth)))
  function assertGuides(guides, ranges, detail) {
    assert.equal(guides.length,ranges.length,detail + ': ' + JSON.stringify(guides))
    guides.forEach((value,i)=>assert.ok(value > ranges[i][0] && value < ranges[i][1],detail + ': ' + value))
  }
  async function dragBody(paper, y, left, right, detail) {
    const { lines, bounds, scale } = await paper.evaluate((sheet,{y,left,right})=>{
      const bounds = sheet.getBoundingClientRect().toJSON()
      const scale = bounds.width / Number(sheet.dataset.pageWidth)
      const words = [...sheet.querySelectorAll('.text-map > span')].map(e => ({
        text:e.textContent, x:parseFloat(e.style.left)/scale, y:parseFloat(e.style.top)/scale,
        w:parseFloat(e.style.width)/scale, h:parseFloat(e.style.height)/scale
      })).filter(w=>w.text.trim() && w.x+w.w/2>=left-.3 && w.x+w.w/2<=right+.3 && w.y>=y && w.y<y+110)
      words.sort((a,b)=>a.y-b.y||a.x-b.x)
      const rows = []
      for (const w of words) {
        const row = rows.at(-1)
        if (row && Math.abs(w.y-row[0].y)<1.7) row.push(w)
        else rows.push([w])
      }
      for (const row of rows) row.sort((a,b)=>a.x-b.x)
      let lines
      for (const [i,a] of rows.entries()) {
        const b = rows[i+1]
        if (!b || a.length<5 || b.length<5 || b[0].y-a[0].y<8 || b[0].y-a[0].y>13 || /[-\u00ad]$/.test(a.at(-1).text) || /[-\u00ad]$/.test(b.at(-1).text)) continue
        lines = [a,b]; break
      }
      return {lines,bounds,scale}
    },{y,left,right})
    assert.ok(lines,detail + ' no testable body lines')
    const a = lines[0][0], b = lines[1].at(-1)
    const points = [
      {x:bounds.left+(a.x+.04)*scale,y:bounds.top+(a.y+a.h/2)*scale},
      {x:bounds.left+(b.x+b.w-.04)*scale,y:bounds.top+(b.y+b.h/2)*scale}
    ]
    const want = normalized(lines.flat().map(w=>w.text).join(''))
    for (const reverse of [false,true]) {
      const [start,end] = reverse ? [...points].reverse() : points
      await app.evaluate(()=>{globalThis.columnCopy=null})
      await win.mouse.move(start.x,start.y)
      await win.mouse.down()
      await win.mouse.move(end.x,end.y,{steps:14})
      await win.mouse.up()
      await win.keyboard.press(command+'+c')
      const received = await app.evaluate(()=>globalThis.columnCopy || '')
      assert.ok(normalized(received)===want,detail + ' clipboard mismatch, reverse=' + reverse)
      const selected = await paper.locator('.text-selection').evaluateAll(elements=>elements.map(e=>[parseFloat(e.style.left),parseFloat(e.style.width)]))
      assert.ok(selected.length>=2 && selected.every(([x,w])=>x/scale>=left-1.1 && (x+w)/scale<=right+1.1),detail + ' selection crosses column')
    }
  }

  try {
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1500,1030)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write',(_event,text)=>{globalThis.columnCopy=text})
    })
    for (const file of files) {
      const kind = file===archive ? 'archive' : 'original'
      await language(kind==='archive'?'ar':'en')
      await app.evaluate(({BrowserWindow},name)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',name),file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
      if (await win.locator('.temporary-document-warning button').isVisible()) await win.locator('.temporary-document-warning button').click()
      await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
      await setZoom(95)
      await pageAt(1)
      await tool.click()
      await win.waitForFunction(()=>document.querySelectorAll('.insight-list>button').length===6)
      assert.deepEqual(await panel.locator('.insight-list>b, .insight-list>button>b').evaluateAll(rows=>rows.map(r=>r.textContent.match(/FIGURE [1-6]/)?.[0])),
        ['FIGURE 1','FIGURE 2','FIGURE 3','FIGURE 4','FIGURE 5','FIGURE 6'])
      await panel.locator('header>button').click()
      const counts={kind,pages:[],bodyDrags:0,manualChecks:0,zoomChecks:0,figures:6}
      for (let page=1;page<=9;page++) {
        const paper = await pageAt(page)
        const editor = await showEditor(paper)
        const ranges = expected[page-1]
        const coords = await guidePositions(editor)
        assertGuides(coords,ranges,kind+' p'+page)
        counts.pages.push(coords.map(x=>Number(x.toFixed(3))))
        if (page===2) {
          const guideHandle = editor.locator(guide).first()
          await guideHandle.focus()
          await guideHandle.press('ArrowRight')
          const [manual] = await guidePositions(editor)
          assert.ok(manual>coords[0]+1,kind+' manual adjustment')
          await editor.locator('.restore-automatic-boundaries').click()
          const restored = await guidePositions(editor)
          assertGuides(restored,ranges,kind+' restored')
          assert.ok(Math.abs(restored[0]-coords[0])<.05)
          counts.manualChecks++
        }
        await editor.locator('.column-boundary-toolbar .primary').click()
        if (body.has(page)) {
          const [y,left,right,otherLeft,otherRight] = body.get(page)
          await dragBody(paper,y,left,right,kind+' p'+page+' left')
          await dragBody(paper,y,otherLeft,otherRight,kind+' p'+page+' right')
          counts.bodyDrags+=4
          for (const percent of [65,120]) {
            await setZoom(percent)
            const editor = await showEditor(paper)
            const positions = await guidePositions(editor)
            assertGuides(positions,ranges,kind+' p'+page+' '+percent+'%')
            assert.ok(Math.abs(positions[0]-coords[0])<.1)
            await editor.locator('.column-boundary-toolbar .primary').click()
            counts.zoomChecks++
          }
          await setZoom(95)
        }
      }
      result.documents.push(counts)
    }
    const paper=await pageAt(5)
    const editor=await showEditor(paper)
    for (const code of languages) {
      await language(code)
      const label=await editor.locator('.column-boundary-toolbar strong').innerText()
      assert.ok(label.trim() && !label.startsWith('ui.'))
      assertGuides(await guidePositions(editor),expected[4],code)
      result.interfaceLanguages++
    }
    await paper.screenshot({path:path.join(output,'archive-page-5-guides.png')})
    await editor.locator('.column-boundary-toolbar .primary').click()
    assert.deepEqual(errors,[])
    assert.deepEqual(files.map(sha),before)
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result))
  } finally {
    await app.evaluate(({app})=>app.exit(0)).catch(()=>{})
    await app.close().catch(()=>{})
    fs.rmSync(profile,{recursive:true,force:true})
  }
}

main().catch(error=>{console.error(error);process.exitCode=1})
