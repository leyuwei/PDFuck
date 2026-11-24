import { createRequire } from 'node:module'
import { join } from 'node:path'

// PDFium runs in a disposable utility process. A bad native decoder cannot
// bring down the Electron main process or the editor.
const { dll, appPath, path, index, width, height } = JSON.parse(process.argv[2])
const koffi = createRequire(join(appPath, 'package.json'))('koffi') as typeof import('koffi')
const library = koffi.load(dll)
const init = library.func('void FPDF_InitLibrary()')
const destroy = library.func('void FPDF_DestroyLibrary()')
const load = library.func('void *FPDF_LoadDocument(const char *path, const char *password)')
const close = library.func('void FPDF_CloseDocument(void *doc)')
const loadPage = library.func('void *FPDF_LoadPage(void *doc, int index)')
const closePage = library.func('void FPDF_ClosePage(void *page)')
const createBitmap = library.func('void *FPDFBitmap_CreateEx(int width,int height,int format,void *pixels,int stride)')
const closeBitmap = library.func('void FPDFBitmap_Destroy(void *bitmap)')
const fill = library.func('void FPDFBitmap_FillRect(void *bitmap,int left,int top,int width,int height,uint32_t color)')
const render = library.func('void FPDF_RenderPageBitmap(void *bitmap,void *page,int x,int y,int width,int height,int rotate,int flags)')
try {
  init()
  const document = load(path, null)
  if (!document) throw new Error('PDFium could not open the document')
  try {
    const page = loadPage(document, index)
    if (!page) throw new Error('PDFium could not open the page')
    const data = Buffer.alloc(width * height * 4)
    const bitmap = createBitmap(width, height, 4, data, width * 4)
    if (!bitmap) { closePage(page); throw new Error('PDFium could not allocate the bitmap') }
    try {
      fill(bitmap, 0, 0, width, height, 0xffffffff)
      render(bitmap, page, 0, 0, width, height, 0, 1)
      process.parentPort!.postMessage({ data })
    } finally { closeBitmap(bitmap); closePage(page) }
  } finally { close(document) }
} catch { process.parentPort!.postMessage({ failed: true }) }
finally { destroy() }
