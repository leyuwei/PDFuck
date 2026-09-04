import type { Tool } from '../types'

export function pageToolUsesPointerCapture(tool: Tool): boolean {
  return tool !== 'note' && tool !== 'insert'
}

export function pagePointerLossCancelsDrag(type: string, buttons: number): boolean {
  return type !== 'lostpointercapture' || buttons !== 0
}
