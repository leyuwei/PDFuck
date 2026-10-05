const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'), pkg = require('../package.json'), config = pkg.build.dmg
const output = path.join(root, 'output/playwright'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-installer-'))
const dmg = path.resolve(process.argv[2] || path.join(root, `release/PDFuck-${pkg.version}-macOS.dmg`))
const icon = fs.readFileSync(path.join(root, config.icon))
function png(file, width, height) {
  const bytes = fs.readFileSync(file)
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
  assert.equal(bytes.readUInt32BE(16), width); assert.equal(bytes.readUInt32BE(20), height)
  assert.ok(bytes.length > 50000, 'Background must contain artwork rather than a blank frame')
}
function main() {
  assert.equal(process.platform, 'darwin')
  assert.equal(pkg.build.mac.icon, config.icon)
  assert.equal(config.backgroundColor, undefined)
  assert.deepEqual(config.window, { width: 760, height: 520 })
  png(path.join(root, config.background), 760, 520)
  png(path.join(root, 'resources/dmg-background@2x.png'), 1520, 1040)
  // Reapply to a disposable file: checks the build hook without changing the artifact.
  const sample = path.join(temporary, 'sample.dmg'); fs.writeFileSync(sample, 'icon check')
  require('./macos-installer-icon.cjs')({ file: sample })
  for (const file of [sample, dmg]) {
    const finder = Buffer.from(execFileSync('/usr/bin/xattr', ['-px', 'com.apple.FinderInfo', file], { encoding: 'utf8' }).replace(/\s/g, ''), 'hex')
    assert.ok(finder.readUInt16BE(8) & 0x0400, 'Finder custom icon flag must be set')
    assert.ok(fs.readFileSync(`${file}/..namedfork/rsrc`).includes(Buffer.from('icns')), 'DMG must carry a custom ICNS resource')
  }
  fs.mkdirSync(output, { recursive: true })
  execFileSync('/usr/bin/hdiutil', ['verify', dmg], { stdio: 'pipe' })
  const mount = path.join(temporary, 'mount'); fs.mkdirSync(mount)
  execFileSync('/usr/bin/hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount], { stdio: 'pipe' })
  try {
    assert.deepEqual(fs.readFileSync(path.join(mount, '.VolumeIcon.icns')), icon)
    const volumeFinder = Buffer.from(execFileSync('/usr/bin/xattr', ['-px', 'com.apple.FinderInfo', mount], { encoding: 'utf8' }).replace(/\s/g, ''), 'hex')
    assert.ok(volumeFinder.readUInt16BE(8) & 0x0400, 'Mounted volume must enable its custom Logo, not merely contain the ICNS file')
    assert.ok(fs.statSync(path.join(mount, '.DS_Store')).size > 0)
    assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
    assert.ok(fs.statSync(path.join(mount, 'PDFuck.app')).isDirectory())
    assert.ok(!fs.existsSync(path.join(mount, 'PDFuck.app/PDFuck.app')))
    const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(mount, 'PDFuck.app/Contents/Info.plist')], { encoding: 'utf8' }))
    assert.equal(plist.CFBundleShortVersionString, pkg.version)
    assert.deepEqual(fs.readFileSync(path.join(mount, 'PDFuck.app/Contents/Resources', plist.CFBundleIconFile)), icon)
    const representations = JSON.parse(execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', `
      ObjC.import('AppKit')
      function run(args) {
        var workspace = $.NSWorkspace.sharedWorkspace
        var image = workspace.iconForFile(args[0])
        $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation).representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})).writeToFileAtomically(args[1], true)
        var reps = $.NSImage.alloc.initWithContentsOfFile(args[2]).representations, sizes = []
        for (var i = 0; i < reps.count; i++) sizes.push([Number(reps.objectAtIndex(i).pixelsWide), Number(reps.objectAtIndex(i).pixelsHigh)])
        return JSON.stringify(sizes)
      }
    `, dmg, path.join(output, 'macos-installer-file-icon.png'), path.join(mount, '.background.tiff')], { encoding: 'utf8' }))
    assert.deepEqual(representations, [[760, 520], [1520, 1040]])
    const report = { version: pkg.version, dmg, background: representations, contents: config.contents, checks: ['native DMG file icon and build hook', 'volume and app icons match the logo', 'standard and Retina artwork', 'DMG integrity, Finder metadata, Applications link, flat app layout and version'] }
    fs.writeFileSync(path.join(output, 'macos-installer.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  } finally { execFileSync('/usr/bin/hdiutil', ['detach', mount, '-quiet']) }
}
try { main() } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
