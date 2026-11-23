import type { ResourcePhase } from './resources'
export interface AppUpdateState { version:string; name:string; phase:ResourcePhase; downloaded:number; total:number; speed:number; error?:string; installing?:boolean }
