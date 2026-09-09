/** Bundled locally; the selected primary language is combined with English. */
export const OCR_LANGUAGES = {
  chi_sim: '简体中文', chi_tra: '繁體中文', eng: 'English', jpn: '日本語',
  rus: 'Русский', spa: 'Español', fra: 'Français', deu: 'Deutsch',
  por: 'Português', kor: '한국어', ara: 'العربية'
} as const
export type OcrLanguage = keyof typeof OCR_LANGUAGES
export interface OcrPageRequest { jobId: string; language: OcrLanguage; image: Uint8Array }
export interface OcrPageResult { pdf?: Uint8Array; characters: number }
export interface OcrLayer { pageIndex: number; pdf: Uint8Array }
