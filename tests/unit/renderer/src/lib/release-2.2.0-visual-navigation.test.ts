import { afterEach, expect, it, vi } from 'vitest'
import { visualReferencePlacement } from '../../../../../src/renderer/src/components/VisualReferencePreview'
import { loadReadingTools } from '../../../../../src/renderer/src/lib/reading-tools'
import { translateMessage, INTERFACE_LANGUAGES } from '../../../../../src/shared/i18n-catalogue'

const viewer = { left: 250, top: 100, bottom: 760, width: 900 }
afterEach(() => vi.unstubAllGlobals())

it('migrates either former figure toggle into the one linked-figure tool', () => {
  const old = {
    frames: { visual:true, citation:true },
    links: { visualReference:true, abbreviation:true },
    combined: { visual:true, visualReference:true },
    disabled: { visual:false, visualReference:false }
  }
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(old) })
  expect(loadReadingTools()).toEqual({
    frames:{ visual:true, citation:true, abbreviation:false },
    links:{ visual:true, citation:false, abbreviation:true },
    combined:{ visual:true, citation:false, abbreviation:false },
    disabled:{ visual:false, citation:false, abbreviation:false }
  })
})

it('places the preview next to the current reference and tracks its movement', () => {
  expect(visualReferencePlacement(viewer,{left:310,top:240,bottom:254,width:38},300,150))
    .toMatchObject({left:310,top:262,width:322,maxHeight:490})
  expect(visualReferencePlacement(viewer,{left:417,top:311,bottom:342,width:70},450,225))
    .toMatchObject({left:417,top:350,width:472,maxHeight:402})
})

it('flips an oversized preview above the reference while preserving the gap and viewport limits', () => {
  expect(visualReferencePlacement(viewer,{left:1030,top:634,bottom:655,width:65},1400,900))
    .toMatchObject({left:258,top:626,transform:'translateY(-100%)',width:884,maxHeight:518})
})

it('keeps a preview at the viewport edge if its reference is scrolled outside', () => {
  expect(visualReferencePlacement(viewer,{left:20,top:-300,bottom:-270,width:52},350,200))
    .toMatchObject({left:258,top:108,maxHeight:644})
})

it('uses the localized linked-figure entry and return button in every interface language', () => {
  for (const language of INTERFACE_LANGUAGES) {
    for (const key of ['reading.linkVisualReferences','ui.returnBeforeJump'] as const) {
      expect(translateMessage(language,key)).not.toEqual(key)
    }
  }
})
