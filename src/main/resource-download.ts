import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'

export interface DownloadSpec { id:string; url:string; bytes:number; sha256?:string; integrity?:string }
export interface ResourceResponse { status:number; headers:Record<string,string>; body:Readable; close():void }
export type ResourceTransport = (url:string,headers:Record<string,string>,signal:AbortSignal)=>Promise<ResourceResponse>
export const resourceError = (key:string) => new Error('resources.'+key)
export async function fileSize(file:string):Promise<number> { try {return (await stat(file)).size}catch{return 0} }
export async function verifiedFile(file:string,spec:DownloadSpec):Promise<boolean> {
  if(await fileSize(file)!==spec.bytes)return false
  const algorithm=spec.sha256?'sha256':'sha512',expected=spec.sha256||spec.integrity?.replace(/^sha512-/,'')
  if(!expected)return false
  const hash=createHash(algorithm);for await(const chunk of createReadStream(file))hash.update(chunk)
  return hash.digest(spec.sha256?'hex':'base64')===expected
}
export function downloadPath(root:string,spec:DownloadSpec):string { return join(root,'downloads',createHash('sha256').update(spec.url+'\n'+(spec.sha256||spec.integrity)).digest('hex')+'.archive') }
async function metadata(file:string,value:unknown):Promise<void> {await writeFile(file+'.tmp',JSON.stringify(value));await rename(file+'.tmp',file)}

/** Partial files survive cancellation and process death. Only a pinned digest can promote one. */
export async function downloadResource(root:string,spec:DownloadSpec,transport:ResourceTransport,signal:AbortSignal,progress:(bytes:number,phase:'downloading'|'verifying')=>void):Promise<string> {
  if(!Number.isSafeInteger(spec.bytes)||spec.bytes<=0||spec.bytes>1024*1024*1024)throw resourceError('invalidResource')
  const target=downloadPath(root,spec),partial=target+'.part',meta=target+'.json'
  await mkdir(dirname(target),{recursive:true});signal.throwIfAborted()
  if(await verifiedFile(target,spec)){progress(spec.bytes,'verifying');return target}
  await rm(target,{force:true})
  for(let attempt=0;attempt<3;attempt++) {
    signal.throwIfAborted()
    let offset=await fileSize(partial),validator:string|undefined
    try{const m=JSON.parse(await readFile(meta,'utf8'));validator=m.validator}catch{/* A missing journal does not invalidate bytes; the final digest still protects them. */}
    if(offset===spec.bytes){progress(offset,'verifying');if(await verifiedFile(partial,spec)){signal.throwIfAborted();await rename(partial,target);await rm(meta,{force:true});return target}await rm(partial,{force:true});offset=0}
    if(offset>spec.bytes){await rm(partial,{force:true});offset=0}
    const headers:Record<string,string>={'Accept-Encoding':'identity'}
    if(offset){headers.Range=`bytes=${offset}-`;if(validator)headers['If-Range']=validator}
    let response:ResourceResponse|undefined
    const controller=new AbortController(),abort=()=>controller.abort(signal.reason)
    signal.addEventListener('abort',abort,{once:true})
    let timer:ReturnType<typeof setTimeout>|undefined
    const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(resourceError('network')),30000)}
    try{
      touch();response=await transport(spec.url,headers,controller.signal)
      if(response.status===416){response.close();await rm(partial,{force:true});continue}
      if(response.status!==200&&response.status!==206)throw resourceError(response.status===407?'proxyAuth':'network')
      if(response.status===206){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers['content-range']||'');if(!range||Number(range[1])!==offset||Number(range[3])!==spec.bytes||Number(range[2])<offset||Number(range[2])>=spec.bytes)throw resourceError('invalidRange')}
      else offset=0 // A server that ignores Range restarts safely instead of appending a second file.
      const length=Number(response.headers['content-length']);if(length&&length>spec.bytes-offset)throw resourceError('invalidRange')
      const etag=response.headers.etag,newValidator=etag&&!etag.startsWith('W/')?etag:response.headers['last-modified']
      await metadata(meta,{validator:newValidator});signal.throwIfAborted()
      const handle=await open(partial,offset?'a':'w')
      try{
        progress(offset,'downloading')
        for await(const raw of response.body){touch();controller.signal.throwIfAborted();const chunk=Buffer.from(raw);if(offset+chunk.length>spec.bytes)throw resourceError('invalidRange');let written=0;while(written<chunk.length){const value=await handle.write(chunk,written,chunk.length-written);if(!value.bytesWritten)throw resourceError('disk');written+=value.bytesWritten}offset+=chunk.length;progress(offset,'downloading')}
      }finally{try{await handle.sync()}finally{await handle.close()}}
      controller.signal.throwIfAborted()
      if(offset!==spec.bytes)throw resourceError('network')
      progress(offset,'verifying');if(!await verifiedFile(partial,spec)){await rm(partial,{force:true});await rm(meta,{force:true});throw resourceError('checksum')}
      signal.throwIfAborted();await rename(partial,target);await rm(meta,{force:true});return target
    }catch(error){
      if(signal.aborted)throw signal.reason
      const code=(error as NodeJS.ErrnoException)?.code
      if(code&&['ENOSPC','EACCES','EPERM','EROFS','EIO','EMFILE','ENFILE','EDQUOT','EISDIR'].includes(code))throw resourceError('disk')
      if(error instanceof Error&&error.message==='resources.invalidRange'){await rm(partial,{force:true});await rm(meta,{force:true});if(attempt<2)continue;throw error}
      if(error instanceof Error&&/resources\.(?:checksum|proxyAuth)/.test(error.message))throw error
      if(attempt===2)throw error instanceof Error&&error.message.startsWith('resources.')?error:resourceError('network')
      await new Promise<void>((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',stop);resolve()},t=setTimeout(done,500*(attempt+1)),stop=()=>{clearTimeout(t);signal.removeEventListener('abort',stop);reject(signal.reason)};signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop()})
    }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);response?.close()}
  }
  throw resourceError('network')
}
