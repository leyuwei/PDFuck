export const FULL_REVIEW_PROMPT_STORAGE_KEY = 'pdfuck.full-review-prompt.v1'

export interface SavedFullReviewPrompt { presetId: string; instruction: string }

export function loadFullReviewPrompt(storage: Pick<Storage, 'getItem'> = window.localStorage): SavedFullReviewPrompt | undefined {
  try {
    const value = storage.getItem(FULL_REVIEW_PROMPT_STORAGE_KEY)
    if (!value) return undefined
    const parsed = JSON.parse(value) as Partial<SavedFullReviewPrompt>
    if (typeof parsed.presetId !== 'string' || typeof parsed.instruction !== 'string') return undefined
    return { presetId: parsed.presetId, instruction: parsed.instruction }
  } catch { return undefined }
}

export function saveFullReviewPrompt(value: SavedFullReviewPrompt, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try { storage.setItem(FULL_REVIEW_PROMPT_STORAGE_KEY, JSON.stringify(value)) } catch { /* Storage can be unavailable in private profiles. */ }
}
