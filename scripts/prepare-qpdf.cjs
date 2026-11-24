const fs = require('node:fs/promises')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { tmpdir } = require('node:os')
const path = require('node:path')

const version = '12.4.2'
const assets = {
  'win32-x64': ['msvc64', 'db87077e683630c1217e0e8f9a20a9749d952ab676e881c3689187763a5de25d'],
  'darwin-arm64': ['bin-macos-arm64', '62e46987a30ea167cbc530ccb22690aec3d8c812ed09979a941bcee92e504b79'],
  'darwin-x64': ['bin-macos-x86_64', 'dd3b01f4414d198529bb0f13bba59c2f016a328bb3506695087a96fb80fc1481']
}

async function prepare(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`
  const asset = assets[key]
  if (!asset) return
  const destination = path.resolve(__dirname, '../resources/qpdf', key)
  const executable = path.join(destination, 'bin', platform === 'win32' ? 'qpdf.exe' : 'qpdf')
  if (await fs.readFile(path.join(destination, 'version'), 'utf8').catch(() => '') === version &&
      await fs.stat(executable).then(value => value.isFile(), () => false)) return
  const [variant, sha256] = asset
  const base = `qpdf-${version}-${variant}`
  const folder = await fs.mkdtemp(path.join(tmpdir(), 'pdfuck-qpdf-'))
  try {
    const archive = path.join(folder, `${base}.zip`)
    const cached = path.join(tmpdir(), `pdfuck-${base}.zip`)
    let bytes = await fs.readFile(cached).catch(() => undefined)
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== sha256) {
      const response = await fetch(`https://github.com/qpdf/qpdf/releases/download/v${version}/${base}.zip`)
      if (!response.ok) throw new Error(`qpdf download failed (${response.status})`)
      bytes = Buffer.from(await response.arrayBuffer())
    }
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('qpdf archive checksum mismatch')
    await fs.writeFile(archive, bytes)
    execFileSync('tar', ['-xf', archive, '-C', folder], { windowsHide: true })
    const roots = (await fs.readdir(folder, { withFileTypes: true })).filter(entry => entry.isDirectory())
    const source = roots.length === 1 ? path.join(folder, roots[0].name) : folder
    await fs.mkdir(path.join(destination, 'bin'), { recursive: true })
    for (const name of await fs.readdir(path.join(source, 'bin'))) {
      if (/^qpdf(?:\.exe)?$|\.dll$/i.test(name)) await fs.copyFile(path.join(source, 'bin', name), path.join(destination, 'bin', name))
    }
    if (platform === 'darwin') {
      await fs.cp(path.join(source, 'lib'), path.join(destination, 'lib'), { recursive: true, verbatimSymlinks: true })
      await fs.chmod(executable, 0o755)
    }
    const license = path.join(source, 'share/doc/qpdf/manual-html/license.html')
    if (await fs.stat(license).then(() => true, () => false)) await fs.copyFile(license, path.join(destination, 'license.html'))
    await fs.writeFile(path.join(destination, 'version'), version)
  } finally {
    if (path.dirname(path.resolve(folder)) === path.resolve(tmpdir())) await fs.rm(folder, { recursive: true, force: true })
  }
}

module.exports = context => prepare(context.electronPlatformName, ({ 1: 'x64', 3: 'arm64' })[context.arch])
if (require.main === module) prepare().catch(error => { console.error(error); process.exitCode = 1 })
