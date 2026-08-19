import type { Tool } from '../types'

export function pageToolUsesPointerCapture(tool: Tool): boolean {
  return tool !== 'note' && tool !== 'insert'
}
