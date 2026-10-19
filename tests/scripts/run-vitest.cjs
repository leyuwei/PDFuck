const { spawnSync } = require('node:child_process')
const path = require('node:path')

const flag = '--no-experimental-webstorage'
const nodeOptions = process.env.NODE_OPTIONS?.split(/\s+/u).filter(Boolean) || []
if (!nodeOptions.includes(flag)) nodeOptions.push(flag)

const root = path.resolve(__dirname, '../..')
require('node:fs').mkdirSync(path.join(root, 'tests/tmp'), { recursive: true })
const result = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), '--config', path.join(root, 'tests/vitest.config.ts'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions.join(' ') }
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
