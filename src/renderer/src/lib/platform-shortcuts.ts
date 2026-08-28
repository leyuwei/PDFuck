export type ShortcutAction =
  | 'aiPolish'
  | 'copy'
  | 'deleteSelection'
  | 'highlight'
  | 'insert'
  | 'note'
  | 'print'
  | 'redo'
  | 'replace'
  | 'save'
  | 'search'
  | 'underline'
  | 'undo'

export function isMacPlatform(platform: string): boolean { return platform === 'darwin' }

/** Labels are kept separate from translated prose so one platform never advertises another platform's keys. */
export function shortcutLabel(action: ShortcutAction, platform: string): string | undefined {
  const mac = isMacPlatform(platform)
  const command = mac ? '⌘' : 'Ctrl+'
  switch (action) {
    case 'aiPolish': return `${command}I`
    case 'copy': return `${command}C`
    case 'deleteSelection': return mac ? '⌫' : 'Delete'
    case 'highlight': return `${command}H`
    case 'insert': return mac ? undefined : 'Insert'
    case 'note': return `${command}N`
    case 'print': return `${command}P`
    case 'redo': return mac ? '⌘⇧Z' : 'Ctrl+Y / Ctrl+Shift+Z'
    case 'replace': return `${command}R`
    case 'save': return `${command}S`
    case 'search': return `${command}F`
    case 'underline': return `${command}U`
    case 'undo': return `${command}Z`
  }
}

/** Adapt older persisted status text without translating document or user content. */
export function adaptShortcutText(value: string, platform: string): string {
  const mac = isMacPlatform(platform)
  return value
    .replace(/Ctrl\+([A-Z])\s*\/\s*⌘\1/giu, (_match, key: string) => mac ? `⌘${key}` : `Ctrl+${key}`)
    .replace(/Ctrl\/⌘(?=[A-Z])/gu, mac ? '⌘' : 'Ctrl+')
    .replace(/Ctrl\/⌘/gu, mac ? '⌘' : 'Ctrl')
    .replace(/Alt\/Option/gu, mac ? 'Option' : 'Alt')
    .replace(/Ctrl\+([A-Z])/giu, (_match, key: string) => mac ? `⌘${key}` : `Ctrl+${key}`)
}
