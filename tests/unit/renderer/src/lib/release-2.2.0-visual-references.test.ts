import { expect, it } from 'vitest'
import { visualReferences } from '../../../../../src/renderer/src/lib/caption-label'
import { indexVisualReferences, targetForReference } from '../../../../../src/renderer/src/lib/visual-references'
import { visualReferenceMatches } from '../../../../../src/renderer/src/lib/text-link-matches'
import type { WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import type { PageVisual } from '../../../../../src/renderer/src/lib/page-visuals'
import { INTERFACE_LANGUAGES, translateMessage } from '../../../../../src/shared/i18n-catalogue'

const rect = {x:30,y:42,width:250,height:200}
const figure: PageVisual = { label:'Fig. 2', kind:'figure', caption:'Fig. 2. A model', rect }
const table: PageVisual = { label:'TABLE II', kind:'table', caption:'TABLE II. Outcomes', rect }
const word = (text: string, order=0, extra: Partial<WordBox> = {}): WordBox => ({
  text, order, rect:{x:10+order*50,y:20,width:Array.from(text).length*5,height:12}, column:0, ...extra
})
const index = indexVisualReferences([{pageIndex:2,text:'',visuals:[figure]},{pageIndex:3,text:'',visuals:[table]}])
const examples = [
  ['See Fig. 2 and Table II.', 'en'], ['如图２所示，见表2。','zh'], ['如圖2所示，見表2。','zh'],
  ['詳細は第2図と表2に示す。','ja'], ['см. рис. 2 и табл. II.', 'ru'],
  ['véase Figura 2 y Tabla 2.', 'es'], ['voir Fig. 2 et Tableau 2.', 'fr'],
  ['siehe Abb. 2 und Tabelle 2.', 'de'], ['ver Figura 2 e Tabela 2.', 'pt'],
  ['그림 2와 표 2를 참조하십시오.', 'ko'], ['راجع الشكل ٢ والجدول ۲.', 'ar']
] as const

it.each(examples)('links both figure and table references in %s', (text, language) => {
  const hits = visualReferenceMatches([word(text)], index, 0)
  expect(hits.map(hit=>[hit.target.kind,hit.target.pageIndex])).toEqual([['figure',2],['table',3]])
  expect(translateMessage(language,'reading.openVisualReference',{label:'Fig. 2'})).toContain('Fig. 2')
})

it('does not confuse prose words, unknown identifiers, different columns or captions with a reference', () => {
  expect(visualReferences('configuration 2, table 20th, stable 2')).toEqual([])
  expect(visualReferenceMatches([word('Fig. 20')], index, 0)).toEqual([])
  expect(visualReferenceMatches([word('Fig. 2',0,{visualRegion:0})], index, 0)).toEqual([])
  expect(visualReferenceMatches([word('Fig.'),word('2',1,{column:1})], index, 0)).toEqual([])
})

it('handles split punctuation and subfigures, preferring an explicit child label', () => {
  expect(visualReferenceMatches([word('Fig'),word('.',1),word('2(a)',2)],index,0)[0].target.pageIndex).toBe(2)
  const explicit = indexVisualReferences([{pageIndex:2,text:'',visuals:[figure]},{pageIndex:4,text:'',visuals:[{...figure,label:'Fig. 2a'}]}])
  expect(targetForReference(explicit,0,'figure','2(a)')?.pageIndex).toBe(4)
  expect(targetForReference(explicit,0,'figure','2(b)')?.pageIndex).toBe(2)
})

it('does not guess between duplicate targets across sections', () => {
  const duplicate = indexVisualReferences([{pageIndex:2,text:'',visuals:[figure]},{pageIndex:4,text:'',visuals:[figure]}])
  expect(targetForReference(duplicate,0,'figure','2')).toBeUndefined()
  expect(targetForReference(duplicate,4,'figure','2')?.pageIndex).toBe(4)
})

it('keeps all labels localized and locates only the referenced letters', () => {
  for (const lang of INTERFACE_LANGUAGES) for (const key of ['reading.linkVisualReferences','reading.visualPreview','reading.visualJump','reading.visualPreviewLoading','reading.visualPreviewFailed'] as const) {
    expect(translateMessage(lang,key)).not.toBe(key)
  }
  const [hit] = visualReferenceMatches([word('See Fig. 2.')], index, 0)
  expect(hit.rects).toEqual([{x:30,y:20,width:30,height:12}])
})
