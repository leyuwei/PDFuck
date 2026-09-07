const { spawnSync } = require('node:child_process')
const path = require('node:path')

const flag = '--no-experimental-webstorage'
const nodeOptions = process.env.NODE_OPTIONS?.split(/\s+/u).filter(Boolean) || []
if (!nodeOptions.includes(flag)) nodeOptions.push(flag)

const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions.join(' ') }
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
