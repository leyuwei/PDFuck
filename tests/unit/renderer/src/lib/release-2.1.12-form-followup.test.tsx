// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { PdfDocumentModel } from '../../../../../src/renderer/src/lib/pdf-document'
import { WindowManagerBar } from '../../../../../src/renderer/src/components/WindowManagerBar'
import type { DocumentTabsSnapshot } from '../../../../../src/shared/contracts'
import { setInterfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'
import { INTERFACE_LANGUAGES, messages } from '../../../../../src/shared/i18n-catalogue'

async function fixture() {
  const pdf = await PDFDocument.create(), page = pdf.addPage([400, 600])
  const field = pdf.getForm().createTextField('name')
  field.setText('Original'); field.addToPage(page, { x: 20, y: 400, width: 240, height: 30 })
  return PdfDocumentModel.load(await pdf.save())
}
async function writer(bytes: Uint8Array, edit: {value: string}) {
  const pdf = await PDFDocument.load(bytes)
  pdf.getForm().getTextField('name').setText(edit.value)
  return pdf.save({ useObjectStreams: false })
}
async function value(model: PdfDocumentModel) { return (await PDFDocument.load(model.bytes)).getForm().getTextField('name').getText() }

describe('form follow-up model transactions', () => {
  it('writes the native value and preserves the editable form through undo and redo', async () => {
    const model = await fixture(), original = model.bytes
    await model.editFormField({pageIndex: 0, id: 'test', value: 'Changed'}, writer)
    expect(await value(model)).toBe('Changed'); expect(model.dirty).toBe(true)
    await model.undo(); expect(model.bytes).toEqual(original); expect(model.dirty).toBe(false)
    await model.redo(); expect(await value(model)).toBe('Changed')
  })
  it('does not create history or dirty state for an unchanged field', async () => {
    const model = await fixture()
    await model.editFormField({pageIndex: 0, id: 'test', value: 'Original'}, async bytes => bytes)
    expect(model.canUndo).toBe(false); expect(model.dirty).toBe(false)
  })
  it('retains original bytes and history if the field writer fails', async () => {
    const model = await fixture(), original = model.bytes
    await expect(model.editFormField({pageIndex:0,id:'test',value:'Changed'}, async () => { throw Error('failed') })).rejects.toThrow('failed')
    expect(model.bytes).toEqual(original); expect(model.canUndo).toBe(false); expect(await value(model)).toBe('Original')
  })
  it('rejects malformed replacement bytes without changing the model', async () => {
    const model = await fixture(), original = model.bytes
    await expect(model.editFormField({pageIndex:0,id:'test',value:'Changed'}, async () => new Uint8Array([1,2,3]))).rejects.toThrow()
    expect(model.bytes).toEqual(original); expect(model.canUndo).toBe(false)
  })
  it('rejects page loss before installing the field update', async () => {
    const model = await fixture(), original = model.bytes
    const wrong = await PDFDocument.create(); wrong.addPage(); wrong.addPage()
    await expect(model.editFormField({pageIndex:0,id:'test',value:'Changed'}, async () => wrong.save())).rejects.toThrow('form.invalidField')
    expect(model.bytes).toEqual(original); expect(model.dirty).toBe(false)
  })
  it('writes against the latest model after another edit and preserves both changes', async () => {
    const model = await fixture()
    await model.editFormField({pageIndex:0,id:'test',value:'First'}, writer)
    await model.editFormField({pageIndex:0,id:'test',value:'Second'}, async bytes => {
      expect((await PDFDocument.load(bytes)).getForm().getTextField('name').getText()).toBe('First')
      return writer(bytes,{value:'Second'})
    })
    await model.undo(); expect(await value(model)).toBe('First')
  })
})

describe('temporary document tab indicator', () => {
  it('provides nonempty form instructions and errors in every supported interface language', () => {
    for (const key of ['form.field', 'form.hint', 'form.readOnly', 'form.updated', 'form.invalidField'] as const) {
      for (const language of INTERFACE_LANGUAGES) expect(messages[key][language].trim().length).toBeGreaterThan(0)
    }
  })
  const snapshot: DocumentTabsSnapshot = {currentId:1,documents:[
    {id:1,title:'temporary.pdf',fileName:'temporary.pdf',filePath:'/private/var/folders/aa/TemporaryItems/temporary.pdf',dirty:true,encrypted:false,hasDocument:true},
    {id:2,title:'normal.pdf',fileName:'normal.pdf',filePath:'/Users/example/Documents/normal.pdf',dirty:false,encrypted:false,hasDocument:true}
  ]}
  async function render(snapshot: DocumentTabsSnapshot) {
    const div = document.createElement('div'); document.body.append(div)
    const root = createRoot(div)
    await act(async () => root.render(<WindowManagerBar snapshot={snapshot} onFocus={()=>{}} onClose={()=>{}} onReorder={()=>{}} onDetach={()=>{}} onBeginTransfer={()=>{}} onTabDragStateChange={()=>{}} onRestoreArchive={async()=>[]} />))
    return {div, dispose:async()=>{await act(async()=>root.unmount());div.remove()}}
  }
  it('adds a nontext clock icon with an accessible warning while keeping dirty and close controls', async () => {
    setInterfaceLanguage('zh');const {div,dispose}=await render(snapshot)
    const current=div.querySelector('.window-tab.current')!
    expect(current.querySelector('.window-tab-temporary svg circle')).not.toBeNull()
    expect(current.querySelector('.window-tab-temporary')?.getAttribute('aria-label')).toContain('临时')
    expect(current.querySelector('.window-dirty-dot')).not.toBeNull();expect(current.querySelector('.window-tab-close')).not.toBeNull()
    expect(div.querySelectorAll('.window-tab-temporary')).toHaveLength(1)
    await dispose()
  })
  it('retains the indicator on inactive tabs and removes it after Save As to a normal folder', async () => {
    const {div,dispose}=await render({...snapshot,currentId:2})
    expect(div.querySelector('.window-tab:not(.current) .window-tab-temporary')).not.toBeNull();await dispose()
    const normal=await render({...snapshot,documents:snapshot.documents.map(d=>({...d,filePath:'/Users/example/Documents/'+d.fileName}))})
    expect(normal.div.querySelector('.window-tab-temporary')).toBeNull();await normal.dispose()
  })
  it('translates the tooltip and does not label untitled documents as temporary', async () => {
    setInterfaceLanguage('en');const {div,dispose}=await render({...snapshot,documents:[snapshot.documents[0],{...snapshot.documents[1],filePath:undefined}]})
    expect(div.querySelector<HTMLElement>('.window-tab-temporary')!.title).toContain('temporary')
    expect(div.querySelectorAll('.window-tab-temporary')).toHaveLength(1)
    await dispose();setInterfaceLanguage('zh')
  })
})
