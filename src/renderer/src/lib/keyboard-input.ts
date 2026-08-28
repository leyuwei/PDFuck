export function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const editable = target.closest<HTMLElement>('[contenteditable]')
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
    || Boolean(editable && editable.getAttribute('contenteditable')?.toLowerCase() !== 'false')
}

export function isImeCompositionKey(event: KeyboardEvent): boolean {
  return event.isComposing || event.key === 'Process' || event.keyCode === 229
}

export function isTextEntryEvent(event: KeyboardEvent): boolean {
  return event.composedPath().some((target) => isTextEntryElement(target)) || isTextEntryElement(document.activeElement)
}
