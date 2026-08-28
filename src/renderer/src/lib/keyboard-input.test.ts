// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { isImeCompositionKey, isTextEntryElement, isTextEntryEvent } from './keyboard-input'

describe('keyboard text-entry guards', () => {
  afterEach(() => { document.body.replaceChildren() })

  it('recognizes all native text-entry surfaces and their descendants', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    const child = document.createElement('span')
    editable.setAttribute('contenteditable', 'true'); editable.append(child)
    expect([input, textarea, select, editable, child].map(isTextEntryElement)).toEqual([true, true, true, true, true])
    expect(isTextEntryElement(document.createElement('button'))).toBe(false)
  })

  it('uses the active editor when Chromium reports a global event target', () => {
    const input = document.createElement('input')
    document.body.append(input); input.focus()
    const event = new KeyboardEvent('keydown', { key: 'a' })
    window.dispatchEvent(event)
    expect(isTextEntryEvent(event)).toBe(true)
  })

  it('recognizes modern and legacy IME composition key events', () => {
    expect(isImeCompositionKey(new KeyboardEvent('keydown', { key: 'Process', isComposing: true }))).toBe(true)
    const legacy = new KeyboardEvent('keydown', { key: 'Unidentified' })
    Object.defineProperty(legacy, 'keyCode', { value: 229 })
    expect(isImeCompositionKey(legacy)).toBe(true)
    expect(isImeCompositionKey(new KeyboardEvent('keydown', { key: 'a' }))).toBe(false)
  })
})
