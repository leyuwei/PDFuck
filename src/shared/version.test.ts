import { describe, expect, it } from 'vitest'
import { compareVersions } from './version'

describe('compareVersions', () => {
  it('compares release tags numerically', () => {
    expect(compareVersions('v1.7.0', '1.6.9')).toBe(1)
    expect(compareVersions('1.6', 'v1.6.0')).toBe(0)
    expect(compareVersions('1.5.12', '1.6.0')).toBe(-1)
  })
})
