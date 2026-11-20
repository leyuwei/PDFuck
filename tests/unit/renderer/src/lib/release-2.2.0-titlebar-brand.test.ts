import { expect, it } from 'vitest'
import { titlebarAccent } from '../../../../../src/renderer/src/lib/app-preferences'

function luminance(color: string): number {
  const weights = [.2126,.7152,.0722]
  return [1,3,5].reduce((sum, offset, index) => {
    const s = parseInt(color.slice(offset,offset+2),16) / 255
    return sum + weights[index] * (s > .04045 ? ((s+.055)/1.055)**2.4 : s/12.92)
  },0)
}
it.each(['#000000','#ffffff','#ffeb00','#12d1b7','#cf4f66','#264083','#400060','#808080'])('keeps %s legible in both themes', accent => {
  for (const [theme, background] of [['light','#f5f7fa'],['dark','#202b3c']] as const) {
    const color = titlebarAccent(accent,theme)
    const [low,high] = [luminance(background),luminance(color)].sort((a,b)=>a-b)
    expect((high+.05)/(low+.05)).toBeGreaterThanOrEqual(4.5)
  }
})
it('keeps already legible colors at the chosen accent', () => {
  expect(titlebarAccent('#b84360','light')).toBe('#b84360')
  expect(titlebarAccent('#8bb6ff','dark')).toBe('#8bb6ff')
})
