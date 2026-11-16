import { copyFile, readFile } from 'node:fs/promises'
import { atomicWrite } from './atomic-write'
import { join } from 'node:path'
import { downloadResource, fileSize, downloadPath, verifiedFile, type DownloadSpec, type ResourceTransport } from './resource-download'
import type { AppUpdateState } from '../shared/app-update'
export interface UpdateAsset extends DownloadSpec { name:string }
export function selectUpdateAsset(assets:unknown,platform:string,arch:string):UpdateAsset|undefined {
 if(!Array.isArray(assets)||!['darwin','win32'].includes(platform))return
 return assets.flatMap(a=>{
  if(!a||typeof a.name!=='string'||!/^PDFuck-[\w.-]+$/.test(a.name)||!Number.isSafeInteger(a.size)||a.size<=0||a.size>1024**3||typeof a.digest!=='string'||!/^sha256:[a-f0-9]{64}$/i.test(a.digest)||typeof a.browser_download_url!=='string')return []
  let url:URL;try{url=new URL(a.browser_download_url)}catch{return []}if(url.origin!=='https://github.com'||!url.pathname.startsWith('/leyuwei/PDFuck/releases/download/'))return []
  const name=a.name,mac=platform==='darwin';if(mac?!/macOS.*\.dmg$/i.test(name):!/Windows.*Setup.*\.exe$/i.test(name))return []
  const explicit=/arm64|aarch64/i.test(name)?'arm64':/x64|x86_64|intel/i.test(name)?'x64':undefined
  if(explicit&&explicit!==arch&&!/universal/i.test(name))return []
  return [{id:name,name,url:url.href,bytes:a.size,sha256:a.digest.slice(7).toLowerCase(),rank:explicit===arch?2:1}]
 }).sort((a,b)=>b.rank-a.rank)[0]
}
export class AppUpdateDownload {
 state?:AppUpdateState
 private asset?:UpdateAsset
 private controller?:AbortController
 private task?:Promise<void>
 private last=0
 private writes:Promise<void>=Promise.resolve()
 constructor(readonly root:string,private transport:ResourceTransport,private notify:(state:AppUpdateState|undefined)=>void){}
 private journal(){const data=Buffer.from(JSON.stringify({asset:this.asset,state:this.state}));this.writes=this.writes.catch(()=>{}).then(()=>atomicWrite(join(this.root,'pending.json'),data));return this.writes}
 private emit(){this.notify(this.state?{...this.state}:undefined)}
 async restore(){try{const saved=JSON.parse(await readFile(join(this.root,'pending.json'),'utf8'));const a=saved.asset as UpdateAsset;const valid=selectUpdateAsset([{name:a.name,size:a.bytes,digest:'sha256:'+a.sha256,browser_download_url:a.url}],process.platform,process.arch);if(!valid)return;this.asset=valid;this.state={version:String(saved.state.version),name:a.name,phase:'paused',downloaded:Math.min(a.bytes,await fileSize(downloadPath(this.root,a)+'.part')),total:a.bytes,speed:0};if(await verifiedFile(join(this.root,a.name),a))this.state={...this.state,phase:'ready',downloaded:a.bytes}}catch{/* A new profile has no download journal. */}}
 async prepare(version:string,asset:UpdateAsset){if(!/^\d+(\.\d+){1,3}$/.test(version))throw Error('updates.unavailable');if(this.controller)throw Error('resources.busy');this.asset=asset;this.state={version,name:asset.name,phase:'confirm',downloaded:Math.min(asset.bytes,await fileSize(downloadPath(this.root,asset)+'.part')),total:asset.bytes,speed:0};await this.journal();this.emit()}
 action(action:'start'|'pause'|'cancel'){
  if(action==='pause'||action==='cancel'){this.controller?.abort();if(action==='cancel'){this.state=undefined;void this.journal().catch(()=>{});this.emit();return}if(this.state){this.state={...this.state,phase:'paused',speed:0};void this.journal().catch(()=>{});this.emit()}return}
  if(this.controller||!this.asset||!this.state)return
  const controller=new AbortController();this.controller=controller;const asset=this.asset
  this.state={...this.state,phase:'queued',error:undefined};this.emit()
  this.task=(async()=>{try{let lastBytes=this.state!.downloaded,lastTime=Date.now();const file=await downloadResource(this.root,asset,this.transport,controller.signal,(downloaded,phase)=>{if(controller.signal.aborted||!this.state)return;const now=Date.now(),elapsed=now-lastTime;this.state={...this.state!,downloaded,phase,speed:elapsed>=300?Math.max(0,(downloaded-lastBytes)*1000/elapsed):this.state!.speed};if(elapsed>=300){lastTime=now;lastBytes=downloaded}if(now-this.last>=150||phase==='verifying'){this.last=now;this.emit()}});controller.signal.throwIfAborted();await copyFile(file,join(this.root,asset.name));controller.signal.throwIfAborted();this.state={...this.state!,phase:'ready',downloaded:asset.bytes,speed:0};await this.journal();this.emit()}catch(error){if(this.state){this.state={...this.state,phase:controller.signal.aborted?'paused':'error',speed:0,error:controller.signal.aborted?undefined:error instanceof Error&&/^resources\./.test(error.message)?error.message:'resources.network'};await this.journal().catch(()=>{});this.emit()}}finally{this.controller=undefined}})()
 }
 async settled(){await this.task;await this.writes}
 async installer(){await this.settled();if(!this.asset||this.state?.phase!=='ready'||!await verifiedFile(join(this.root,this.asset.name),this.asset))throw Error('updates.unavailable');return join(this.root,this.asset.name)}
 stop(){this.controller?.abort()}
}
