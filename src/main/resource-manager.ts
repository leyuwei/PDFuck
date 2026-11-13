import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import type { FeatureResourceRequest, ResourceAction, ResourceDownloadState } from '../shared/resources'
import { FeatureResourceCatalog, validResourceRequest, type ResourceAsset } from './feature-resources'
import { downloadPath, downloadResource, fileSize, resourceError, type ResourceTransport } from './resource-download'
interface ResourceJob { owner:number; state:ResourceDownloadState; assets:ResourceAsset[]; promise:Promise<boolean>; resolve:(value:boolean)=>void; controller?:AbortController; action?:ResourceAction; lastEvent:number }

/** One app-owned queue serializes writes; a window can only control its own request. */
export class ResourceManager {
  private jobs=new Map<number,ResourceJob>()
  private preparing=new Map<number,{request:FeatureResourceRequest;controller:AbortController;promise:Promise<boolean>}>()
  private queue:ResourceJob[]=[]
  private active?:ResourceJob
  private stopped=false
  constructor(readonly catalog:FeatureResourceCatalog,private transport:ResourceTransport,private notify:(owner:number,state:ResourceDownloadState|undefined)=>void){}
  state(owner:number):ResourceDownloadState|undefined{return this.jobs.get(owner)?.state}
  isActive():boolean{return Boolean(this.active)}
  request(owner:number,request:FeatureResourceRequest):Promise<boolean>{
    if(!validResourceRequest(request))return Promise.reject(resourceError('invalidResource'))
    request=request.kind==='grammar'?{kind:'grammar'}:{kind:'ocr',language:request.language}
    const existing=this.jobs.get(owner)
    if(existing)return JSON.stringify(existing.state.request)===JSON.stringify(request)?existing.promise:Promise.reject(resourceError('busy'))
    const preparing=this.preparing.get(owner);if(preparing)return JSON.stringify(preparing.request)===JSON.stringify(request)?preparing.promise:Promise.reject(resourceError('busy'))
    const controller=new AbortController(),work=this.prepare(owner,request,controller.signal).finally(()=>this.preparing.delete(owner));this.preparing.set(owner,{request,controller,promise:work});return work
  }
  private async prepare(owner:number,request:FeatureResourceRequest,signal:AbortSignal):Promise<boolean>{
    const assets=await this.catalog.missing(request,signal)
    if(signal.aborted)return false
    if(this.stopped)return false
    if(!assets.length)return true
    let resolve:(value:boolean)=>void=()=>{};const promise=new Promise<boolean>(r=>{resolve=r}),total=assets.reduce((n,a)=>n+a.bytes,0)
    let downloaded=0;for(const asset of assets)downloaded+=Math.min(asset.bytes,await fileSize(downloadPath(this.catalog.root,asset))||await fileSize(downloadPath(this.catalog.root,asset)+'.part'))
    const state:ResourceDownloadState={id:randomUUID(),request,phase:'confirm',downloaded,total,speed:0,current:'',files:assets.map(a=>({name:a.kind==='package'?a.id.replace(/^node_modules\//,''):a.id,bytes:a.bytes,source:new URL(a.url).hostname}))}
    if(signal.aborted||this.stopped)return false
    const job={owner,state,assets,promise,resolve,lastEvent:0};this.jobs.set(owner,job);this.emit(job);return promise
  }
  private emit(job:ResourceJob):void{job.lastEvent=Date.now();this.notify(job.owner,{...job.state})}
  action(owner:number,id:string,action:ResourceAction):void{
    const job=this.jobs.get(owner);if(!job||job.state.id!==id||!['start','pause','cancel'].includes(action))throw resourceError('invalidResource')
    if(action==='cancel'){
      job.action='cancel';job.controller?.abort(resourceError('canceled'));this.queue=this.queue.filter(q=>q!==job)
      if(this.active!==job)this.finish(job,false)
    }else if(action==='pause'){
      if(job.state.phase==='installing'||job.state.phase==='verifying')return
      job.action='pause';job.controller?.abort(resourceError('canceled'));this.queue=this.queue.filter(q=>q!==job)
      if(this.active!==job){job.state.phase='paused';job.state.speed=0;this.emit(job)}
    }else if(['confirm','paused','error'].includes(job.state.phase)){
      job.action=undefined;job.state.phase='queued';job.state.error=undefined;this.queue.push(job);this.emit(job);void this.pump()
    }
  }
  private finish(job:ResourceJob,result:boolean):void{if(this.jobs.get(job.owner)===job){this.jobs.delete(job.owner);this.notify(job.owner,undefined)}job.resolve(result)}
  private async pump():Promise<void>{
    if(this.active||this.stopped)return
    const job=this.queue.shift();if(!job)return
    this.active=job;const controller=new AbortController();job.controller=controller
    try{
      const needed=await this.catalog.missing(job.state.request,controller.signal),archives=new Map<string,string>(),sizes=new Map<string,number>()
      // Another window may have installed the same group while this one was queued.
      for(const asset of job.assets)sizes.set(asset.id,needed.some(a=>a.id===asset.id)?Math.min(asset.bytes,await fileSize(downloadPath(this.catalog.root,asset))||await fileSize(downloadPath(this.catalog.root,asset)+'.part')):asset.bytes)
      let lastBytes=[...sizes.values()].reduce((a,b)=>a+b,0),lastTime=Date.now()
      for(const asset of needed){
        controller.signal.throwIfAborted();job.state.current=asset.kind==='package'?asset.id.replace(/^node_modules\//,''):asset.id
        const file=await downloadResource(this.catalog.root,asset,this.transport,controller.signal,(bytes,phase)=>{
          sizes.set(asset.id,bytes);job.state.downloaded=[...sizes.values()].reduce((a,b)=>a+b,0);job.state.phase=phase
          const now=Date.now();if(now-lastTime>=500){job.state.speed=Math.max(0,(job.state.downloaded-lastBytes)*1000/(now-lastTime));lastBytes=job.state.downloaded;lastTime=now}
          if(now-job.lastEvent>100||phase==='verifying')this.emit(job)
        });archives.set(asset.id,file)
      }
      if(needed.length){job.state.phase='installing';job.state.speed=0;this.emit(job);await this.catalog.install(job.state.request,needed,archives,controller.signal)}
      controller.signal.throwIfAborted();job.state.phase='ready';job.state.downloaded=job.state.total;this.emit(job)
      // Installed payloads are retained; successful compressed archives no longer need duplicate space.
      for(const archive of archives.values())await rm(archive,{force:true}).catch(()=>{})
      this.finish(job,true)
    }catch(error){
      if(job.action==='cancel'||this.stopped)this.finish(job,false)
      else {job.state.phase=job.action==='pause'?'paused':'error';job.state.speed=0;job.state.error=job.action==='pause'?undefined:error instanceof Error&&/^resources\.[a-zA-Z]+$/.test(error.message)?error.message:'resources.installFailed';this.emit(job)}
    }finally{job.controller=undefined;this.active=undefined;void this.pump()}
  }
  cancelRequest(owner:number,request:FeatureResourceRequest):void{request=request.kind==='grammar'?{kind:'grammar'}:{kind:'ocr',language:request.language};const pending=this.preparing.get(owner);if(pending&&JSON.stringify(pending.request)===JSON.stringify(request))pending.controller.abort(resourceError('canceled'));const job=this.jobs.get(owner);if(job&&JSON.stringify(job.state.request)===JSON.stringify(request))this.action(owner,job.state.id,'cancel')}
  closeOwner(owner:number):void{this.preparing.get(owner)?.controller.abort(resourceError('canceled'));const job=this.jobs.get(owner);if(job)this.action(owner,job.state.id,'cancel')}
  stop():void{this.stopped=true;for(const pending of this.preparing.values())pending.controller.abort(resourceError('canceled'));for(const owner of this.jobs.keys())this.closeOwner(owner)}
}
