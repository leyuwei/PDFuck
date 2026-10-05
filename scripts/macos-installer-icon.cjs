const path = require('node:path')
const { execFileSync } = require('node:child_process')

module.exports = ({ file }) => {
  if (process.platform !== 'darwin' || !file.endsWith('.dmg')) return
  // dmg.icon sets the mounted volume; Finder's DMG file needs its own custom icon.
  execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', `
    ObjC.import('AppKit')
    function run(args) {
      var image = $.NSImage.alloc.initWithContentsOfFile(args[1])
      if (image.isNil() || !$.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, args[0], 0))
        throw new Error('Unable to set the DMG installer icon')
    }
  `, file, path.resolve(__dirname, '../resources/icon.icns')])
}
