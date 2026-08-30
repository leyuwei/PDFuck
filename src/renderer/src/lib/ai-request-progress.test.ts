import { describe, expect, it } from 'vitest'
import { aiRequestProgress } from './ai-request-progress'

describe('AI request progress', () => {
  it('counts down from the configured timeout and clamps at completion', () => {
    expect(aiRequestProgress(275, 1_000, 1_000)).toEqual({ totalSeconds: 275, remainingSeconds: 275, elapsedPercent: 0 })
    expect(aiRequestProgress(275, 1_000, 138_500)).toEqual({ totalSeconds: 275, remainingSeconds: 138, elapsedPercent: 50 })
    expect(aiRequestProgress(275, 1_000, 999_000)).toEqual({ totalSeconds: 275, remainingSeconds: 0, elapsedPercent: 100 })
  })

  it('uses the same timeout normalization as AI requests', () => {
    expect(aiRequestProgress(1, 0, 0).totalSeconds).toBe(5)
    expect(aiRequestProgress(9_999, 0, 0).totalSeconds).toBe(3600)
  })
})
