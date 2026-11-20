const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../..')
const baseline = path.resolve(process.argv[2])
const recheck = new Set(process.argv.slice(3))
const target = path.join(root, 'tests/output/release-2.2.0-visuals/history')
const env = { ...process.env }
delete env.PDFUCK_SMOKE_EXECUTABLE
delete env.PDFUCK_PACKAGED_EXECUTABLE

const layout = [
  'release-2.1.14-selection-ranges', 'release-2.1.17-crosspage-pdfs', 'release-2.1.17-open-tables',
  'release-2.1.17-selection-latest', 'release-2.1.17-selection-review', 'release-2.1.17-table-pdfs',
  'release-2.1.19-selection', 'release-2.1.20-text-layer', 'release-2.1.21-crossflow-selection',
  'release-2.1.21-selection', 'release-2.1.16-layout', 'release-2.1.17-input-pdfs', 'release-2.1.17-performance',
  'selection-columns-2115', 'selection-figure-table-2115', 'selection-gutter-clusters-2115'
]
const ui = [
  'release-2.1.11-papers', 'release-2.1.11-visual-bounds-ui', 'release-2.1.14-cross-page-selection',
  'release-2.1.14-selection-followup', 'release-2.1.17-crosspage-extra-layouts', 'release-2.1.17-crosspage-style-ui',
  'release-2.1.17-open-tables-ui', 'release-2.1.17-tables-ui', 'release-2.1.21-crossflow-ui',
  'release-2.1.10-ui', 'release-2.1.11-ui', 'release-2.1.12-ui', 'release-2.1.11-followup-ui',
  'release-2.1.16-ui', 'release-2.1.17-grammar-layout-ui', 'release-2.1.17-input-ui',
  'release-2.1.17-reading-archive-ui', 'release-2.1.17-reading-ui', 'release-2.1.20-ui',
  'release-2.1.21-ui', 'release-2.1.21-overlays-ui', 'release-2.1.9-survey-ui', 'release-2.1.9-ui',
  'selection-figure-table-2115-ui', 'selection-gutter-clusters-2115-ui', 'selection-smoke', 'release-2.2.0-captions-ui'
]
for (const name of ['bc', 'chinese-alignment', 'cpaper', 'm91474', 'scheduling-0826',
  'scheduling-inline-formula', 'scheduling', 'test2', 'test3']) {
  layout.push(`selection-${name}-smoke`)
  ui.push(`selection-${name}-ui-smoke`)
}

function run(source, name, phase, timeout) {
  return new Promise(resolve => {
    const log = path.join(target, `${name}.${phase}.log`)
    const fd = fs.openSync(log, 'w')
    const child = spawn(process.execPath, [`tests/scripts/${name}.cjs`], {
      cwd: source, env, detached: true, stdio: ['ignore', fd, fd]
    })
    fs.closeSync(fd)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* Already exited. */ }
    }, timeout)
    child.once('close', code => {
      clearTimeout(timer)
      const output = fs.readFileSync(log, 'utf8')
      if (/(?:ENOENT|no such file|fixture.*(?:missing|not found))/i.test(output) && code !== 0) return resolve('missing fixture')
      if (/^\s*\[[\s\S]*"skipped"\s*:\s*true/.test(output) && code === 0) {
        try { if (JSON.parse(output).every(sample => sample.skipped)) return resolve('missing fixture') } catch { /* Non-JSON diagnostics. */ }
      }
      resolve(timedOut ? 'timeout' : code === 0 ? 'passed' : `exit ${code}`)
    })
  })
}

async function main() {
  for (const dir of [root, baseline]) assert.ok(fs.existsSync(path.join(dir, 'out/main/index.js')), 'Build both source checkouts first')
  fs.mkdirSync(target, { recursive: true })
  const reportFile = path.join(target, 'results.json')
  const reports = recheck.size ? JSON.parse(fs.readFileSync(reportFile, 'utf8')).filter(test => !recheck.has(test.name)) : []
  async function lane(names, timeout) {
    for (const name of names.filter(name => !recheck.size || recheck.has(name))) {
      const fixed = await run(root, name, 'fixed', timeout)
      const before = fixed === 'passed' ? null : await run(baseline, name, 'baseline', timeout)
      const result = { name, fixed, baseline: before }
      reports.push(result)
      fs.writeFileSync(reportFile, JSON.stringify(reports, null, 2) + '\n')
      console.log(result)
    }
  }
  await Promise.all([lane(layout, 30_000), lane(ui.filter((_,i) => i % 2 === 0), 38_000), lane(ui.filter((_,i) => i % 2 === 1), 38_000)])
  assert.ok(reports.every(test => test.fixed === 'passed' || test.baseline !== 'passed'), 'A historical run newly failed')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
