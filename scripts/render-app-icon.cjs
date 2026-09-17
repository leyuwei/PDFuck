const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

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
  if (process.argv.includes('--ico-only')) {
    const image = nativeImage.createFromPath(pngPath)
    if (image.isEmpty()) throw new Error(`Unable to read ${pngPath}`)
    fs.writeFileSync(icoPath, icoFromPng(image))
    app.quit()
    return
  }
  const svg = fs.readFileSync(source, 'utf8')
  const window = new BrowserWindow({ show: false, frame: false, transparent: true, backgroundColor: '#00000000', width: 512, height: 512, useContentSize: true, webPreferences: { offscreen: true } })
  const html = `<style>html,body{margin:0;width:512px;height:512px;overflow:hidden;background:transparent}img{display:block;width:512px;height:512px}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}">`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const raster = await new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); window.webContents.removeListener('paint', onPaint) }
    const onPaint = (_event, _dirty, image) => {
      const size = image.getSize()
      if (image.isEmpty() || size.width !== 512 || size.height !== 512 || !image.toPNG().length) return
      cleanup(); resolve(image)
    }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Timed out while rendering the app icon.')) }, 5000)
    window.webContents.on('paint', onPaint)
    window.webContents.invalidate()
  })
  fs.writeFileSync(pngPath, raster.toPNG())
  fs.writeFileSync(icoPath, icoFromPng(nativeImage.createFromBuffer(raster.toPNG())))
  window.destroy()
  app.quit()
}).catch((error) => { console.error(error); app.exit(1) })
