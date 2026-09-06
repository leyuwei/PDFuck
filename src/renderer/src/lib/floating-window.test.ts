import { expect, it } from 'vitest'
import { clampFloatingPosition } from './floating-window'

it('keeps both corners inside the viewport and out of the native title bar', () => {
  expect(clampFloatingPosition(-100, -200, 430, 480, 900, 700, 80)).toEqual({ left: 8, top: 80 })
  expect(clampFloatingPosition(890, 690, 430, 480, 900, 700, 80)).toEqual({ left: 462, top: 212 })
  expect(clampFloatingPosition(500, 500, 430, 600, 700, 620, 80)).toEqual({ left: 262, top: 80 })
})
