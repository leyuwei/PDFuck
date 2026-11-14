import type { OcrLanguage } from './ocr'
export type FeatureResourceRequest = { kind:'ocr'; language:OcrLanguage } | { kind:'grammar' }
export type ResourcePhase = 'confirm'|'queued'|'downloading'|'verifying'|'installing'|'paused'|'error'|'ready'
export interface ResourceProxy { mode:'system'|'direct'|'manual'; url:string; username:string; password?:string; hasPassword?:boolean }
export interface ResourceDownloadState {
  id:string; request:FeatureResourceRequest; phase:ResourcePhase; downloaded:number; total:number; speed:number; current:string
  files:Array<{name:string;bytes:number;source:string}>; error?:string
}
export type ResourceAction = 'start'|'pause'|'cancel'
