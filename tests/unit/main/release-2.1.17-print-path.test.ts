import {it,expect} from 'vitest'
import {cupsSupportsUrf} from '../../../src/main/macos-printing'
it('2.1.17 routes only URF-capable drivers through host rasterization',()=>{
 expect(cupsSupportsUrf('*cupsFilter2: "image/urf image/urf 10 -"')).toBe(true)
 expect(cupsSupportsUrf('*cupsFilter: "image/urf 10 -"')).toBe(true)
 expect(cupsSupportsUrf('*cupsFilter: "application/vnd.cups-pdf 0 vendor-filter"')).toBe(false)
})
