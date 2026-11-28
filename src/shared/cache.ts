import type { OcrLanguage } from './ocr'

export interface CacheEntry {
  id: string
  group: 'app' | 'libraries' | 'updates'
  kind: 'web' | 'runtime' | 'ocrEngine' | 'model' | 'grammar' | 'archives' | 'update'
  bytes: number
  status: 'empty' | 'stored' | 'installed' | 'partial' | 'restart' | 'busy' | 'unknown'
  language?: OcrLanguage
  detail?: string
}

export interface CacheRemoval { failed: string[]; restart: boolean }
