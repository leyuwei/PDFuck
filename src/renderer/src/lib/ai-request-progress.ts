import { normalizeAiTimeoutSeconds } from './ai-polish'

export interface AiRequestProgress {
  totalSeconds: number
  remainingSeconds: number
  elapsedPercent: number
}

export function aiRequestProgress(timeoutSeconds: number, startedAt: number, now = Date.now()): AiRequestProgress {
  const totalSeconds = normalizeAiTimeoutSeconds(timeoutSeconds)
  const totalMilliseconds = totalSeconds * 1000
  const elapsedMilliseconds = Math.max(0, Math.min(totalMilliseconds, now - startedAt))
  return {
    totalSeconds,
    remainingSeconds: Math.max(0, Math.ceil((totalMilliseconds - elapsedMilliseconds) / 1000)),
    elapsedPercent: Math.max(0, Math.min(100, elapsedMilliseconds / totalMilliseconds * 100))
  }
}
