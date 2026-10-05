const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'resources', 'icon.svg')
const pngPath = path.join(root, 'resources', 'icon.png')
const icoPath = path.join(root, 'resources', 'icon.ico')
app.disableHardwareAcceleration()

function icoFromPng(image) {
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const images = sizes.map((size) => image.resize({ width: size, height: size, quality: 'best' }).toPNG())
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach((buffer, index) => {
    const entry = 6 + index * 16, size = sizes[index]
    header[entry] = size === 256 ? 0 : size
    header[entry + 1] = size === 256 ? 0 : size
    header[entry + 2] = 0
    header[entry + 3] = 0
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(buffer.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += buffer.length
  })
  return Buffer.concat([header, ...images])
}

app.whenReady().then(async () => {
  const dmgBackground = process.argv.includes('--dmg-background')
  const documentIcon = process.argv.includes('--mac-document')
  const macIcon = documentIcon || process.argv.includes('--mac-app')
  if (macIcon && process.platform !== 'darwin') throw new Error('The document icon requires macOS iconutil.')
  if (process.argv.includes('--ico-only')) {
    const image = nativeImage.createFromPath(pngPath)
    if (image.isEmpty()) throw new Error(`Unable to read ${pngPath}`)
    fs.writeFileSync(icoPath, icoFromPng(image))
    app.quit()
    return
  }
  const logo = fs.readFileSync(source, 'utf8')
  // Vector-only document artwork has no font or locale-dependent glyphs.
  const svg = dmgBackground ? fs.readFileSync(path.join(root, 'resources/dmg-background.svg'), 'utf8').replace('href="icon.svg"', `href="data:image/svg+xml,${encodeURIComponent(logo)}"`) : documentIcon ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M96 24h224l112 112v328a24 24 0 0 1-24 24H96a24 24 0 0 1-24-24V48a24 24 0 0 1 24-24Z" fill="#f4f7ff" stroke="#7893c4" stroke-width="12"/><path d="M320 24v112h112" fill="#c9dcff" stroke="#7893c4" stroke-width="12" stroke-linejoin="round"/><svg x="128" y="166" width="256" height="256" viewBox="0 0 512 512">${logo.replace(/<\/?svg[^>]*>/g, '')}</svg></svg>` : logo
  const size = macIcon ? 1024 : 512
  const width = dmgBackground ? 1520 : size, height = dmgBackground ? 1040 : size
  const window = new BrowserWindow({ show: false, frame: false, transparent: true, backgroundColor: '#00000000', width, height, useContentSize: true, webPreferences: { offscreen: true } })
  const html = `<style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}img{display:block;width:${width}px;height:${height}px}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}">`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await window.webContents.executeJavaScript('document.querySelector("img").decode()')
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  const captured = await window.webContents.capturePage(undefined, { stayHidden: true })
  if (captured.isEmpty()) throw new Error('Unable to render the artwork')
  const raster = captured.resize({ width, height, quality: 'best' })
  if (dmgBackground) {
    fs.writeFileSync(path.join(root, 'resources/dmg-background.png'), raster.resize({ width: 760, height: 520, quality: 'best' }).toPNG())
    fs.writeFileSync(path.join(root, 'resources/dmg-background@2x.png'), raster.toPNG())
  } else if (macIcon) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-icon-'))
    try {
      const iconset = path.join(temporary, 'pdf.iconset')
      fs.mkdirSync(iconset)
      for (const pixels of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) {
        fs.writeFileSync(path.join(iconset, `icon_${pixels}x${pixels}${scale === 2 ? '@2x' : ''}.png`), raster.resize({ width: pixels * scale, height: pixels * scale, quality: 'best' }).toPNG())
      }
      execFileSync('/usr/bin/iconutil', ['--convert', 'icns', '--output', path.join(root, documentIcon ? 'resources/pdf.icns' : 'resources/icon.icns'), iconset])
    } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
  } else {
    fs.writeFileSync(pngPath, raster.toPNG())
    fs.writeFileSync(icoPath, icoFromPng(nativeImage.createFromBuffer(raster.toPNG())))
  }
  window.destroy()
  app.quit()
}).catch((error) => { console.error(error); app.exit(1) })
