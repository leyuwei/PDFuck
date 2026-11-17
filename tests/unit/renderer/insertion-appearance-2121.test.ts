import { PDFDocument, PDFName, PDFDict, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { it, expect } from 'vitest'
import { PdfDocumentModel } from '../../../src/renderer/src/lib/pdf-document'
it('persists the upper stem and lower triangle through recoloring and reopening', async()=>{
 const doc=await PDFDocument.create();doc.addPage([612,792]);const model=await PdfDocumentModel.load(await doc.save());const id=await model.addAnnotation(0,'insert',[],'Insert here',{x:150,y:150},'#ff0000');
 for(const color of ['#ff0000','#00ff00']){await model.updateAnnotationColor(id,color);const saved=await PDFDocument.load(model.bytes);const annotation=saved.getPage(0).node.Annots()!.lookup(0,PDFDict);const stream=annotation.lookup(PDFName.of('AP'),PDFDict).lookup(PDFName.of('N'),PDFRawStream);const appearance=new TextDecoder().decode(decodePDFRawStream(stream).decode());expect(appearance).toContain('0 0 m');expect(model.annotations()[0].insertionAligned).toBe(true);expect((await PdfDocumentModel.load(model.bytes)).annotations()[0].color).toBe(color)}
})
