import { describe, expect, it } from 'vitest'
import { requiresSaveAs } from './save-pdf'

describe('requiresSaveAs', () => {
  it.each(['EACCES', 'EPERM', 'EROFS', 'EBUSY'])('asks the user to choose another location for %s', (code) => {
    expect(requiresSaveAs({ code })).toBe(true)
  })

  it('does not hide unrelated write errors behind the save-as guidance', () => {
    expect(requiresSaveAs({ code: 'ENOSPC' })).toBe(false)
    expect(requiresSaveAs(new Error('unknown failure'))).toBe(false)
  })
})
