import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { access, copyFile, cp, mkdir, readdir, readFile, readlink, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import manifest from '../../resources/feature-resources.json'
import { OCR_LANGUAGES } from '../shared/ocr'
import type { FeatureResourceRequest } from '../shared/resources'
import { fileSize, resourceError, verifiedFile, type DownloadSpec } from './resource-download'
const execute=promisify(execFile)
export const resourceTarget=()=>`${process.platform==='darwin'?'mac':process.platform==='win32'?'win':'linux'}-${process.arch}`
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20)
export function validResourceRequest(value:unknown):value is FeatureResourceRequest {const r=value as FeatureResourceRequest;return Boolean(r&&typeof r==='object'&&(r.kind==='grammar'||r.kind==='ocr'&&Object.hasOwn(OCR_LANGUAGES,r.language)))}
export type ResourceAsset=DownloadSpec&{kind:'package'|'model'|'engine'|'java';path?:string;language?:string}
interface InventoryEntry {sha256?:string;link?:string;bytes?:number}
async function inventory(directory:string,signal:AbortSignal,base=directory):Promise<Record<string,InventoryEntry>> {
  const result:Record<string,InventoryEntry>={}
  for(const entry of await readdir(directory,{withFileTypes:true})){
    signal.throwIfAborted();const file=join(directory,entry.name),relative=file.slice(base.length+1).replaceAll('\\','/')
    if(entry.isDirectory())Object.assign(result,await inventory(file,signal,base))
    else if(entry.isSymbolicLink())result[relative]={link:await readlink(file)}
    else {const hash=createHash('sha256');for await(const chunk of createReadStream(file)){signal.throwIfAborted();hash.update(chunk)}result[relative]={bytes:await fileSize(file),sha256:hash.digest('hex')}}
  }
  return result
}
async function exists(file:string):Promise<boolean>{try{await access(file);return true}catch{return false}}

export class FeatureResourceCatalog {
  readonly ocrRuntime:string
  readonly ocrModels:string
  readonly grammar:string
  private checked=new Set<string>()
  constructor(readonly root:string,private notices:string,private target=resourceTarget()){
    this.ocrRuntime=join(root,'ocr-'+fingerprint(manifest.ocr.packages));this.ocrModels=join(root,'models-'+fingerprint(manifest.ocr.models));this.grammar=join(root,'grammar-'+fingerprint({engine:manifest.grammar.engine,java:manifest.grammar.runtimes[target as keyof typeof manifest.grammar.runtimes]}))
  }
  private async ready(directory:string,expected:string,signal:AbortSignal):Promise<boolean>{
    if(this.checked.has(directory))return true
    try{
      const record=JSON.parse(await readFile(join(directory,'.ready.json'),'utf8'));if(record.fingerprint!==expected||!Object.keys(record.files||{}).length)return false
      for(const [file,value]of Object.entries(record.files) as Array<[string,InventoryEntry]>){signal.throwIfAborted();const installed=join(directory,file);if(value.link){if(await readlink(installed)!==value.link)return false}else{if(await fileSize(installed)!==value.bytes)return false;const hash=createHash('sha256');for await(const chunk of createReadStream(installed)){signal.throwIfAborted();hash.update(chunk)}if(hash.digest('hex')!==value.sha256)return false}}
      this.checked.add(directory);return true
    }catch(error){signal.throwIfAborted();return false}
  }
  async missing(request:FeatureResourceRequest,signal:AbortSignal):Promise<ResourceAsset[]>{
    if(!validResourceRequest(request))throw resourceError('invalidResource')
    if(request.kind==='grammar'){
      const runtime=manifest.grammar.runtimes[this.target as keyof typeof manifest.grammar.runtimes];if(!runtime)throw resourceError('unsupportedPlatform')
      if(await this.ready(this.grammar,fingerprint({engine:manifest.grammar.engine,java:runtime}),signal))return []
      return [{...manifest.grammar.engine,id:'LanguageTool',kind:'engine'},{...runtime,id:'Java',kind:'java'}]
    }
    const needed:ResourceAsset[]=await this.ready(this.ocrRuntime,fingerprint(manifest.ocr.packages),signal)?[]:manifest.ocr.packages.map(p=>({...p,kind:'package' as const}))
    for(const language of new Set([request.language,'eng'] as const)){const model=manifest.ocr.models[language];if(!await verifiedFile(join(this.ocrModels,language+'.traineddata.gz'),model))needed.push({...model,kind:'model',language})}
    return needed
  }
  private async installDirectory(destination:string,expected:string,signal:AbortSignal,build:(stage:string)=>Promise<void>):Promise<void>{
    const stage=join(this.root,'.install-'+randomUUID());await mkdir(stage,{recursive:true})
    try{await build(stage);signal.throwIfAborted();const files=await inventory(stage,signal);await writeFile(join(stage,'.ready.json'),JSON.stringify({fingerprint:expected,files}));signal.throwIfAborted();await rm(destination,{recursive:true,force:true});await rename(stage,destination);this.checked.add(destination)}
    finally{await rm(stage,{recursive:true,force:true})}
  }
  async install(request:FeatureResourceRequest,assets:ResourceAsset[],archives:Map<string,string>,signal:AbortSignal):Promise<void>{
    const extract=async(file:string,to:string)=>{signal.throwIfAborted();await mkdir(to,{recursive:true});await execute(process.platform==='win32'?'tar.exe':'/usr/bin/tar',['-xf',file,'-C',to],{signal,windowsHide:true,maxBuffer:4*1024*1024})}
    if(request.kind==='grammar'){
      const runtime=manifest.grammar.runtimes[this.target as keyof typeof manifest.grammar.runtimes]
      await this.installDirectory(this.grammar,fingerprint({engine:manifest.grammar.engine,java:runtime}),signal,async stage=>{
        await extract(archives.get('LanguageTool')!,stage);await rename(join(stage,'LanguageTool-'+manifest.grammar.engine.version),join(stage,'engine'))
        const javaStage=join(stage,'java');await extract(archives.get('Java')!,javaStage);const javaRoot=join(javaStage,(await readdir(javaStage))[0]),home=this.target.startsWith('mac-')?join(javaRoot,'Contents/Home'):javaRoot
        await cp(home,join(stage,'runtime'),{recursive:true,verbatimSymlinks:true});await rm(javaStage,{recursive:true})
        if(!await exists(join(stage,'runtime/bin',this.target.startsWith('win-')?'java.exe':'java'))||!await exists(join(stage,'engine/languagetool-server.jar')))throw resourceError('installFailed')
        await copyFile(join(this.notices,'GRAMMAR-NOTICE.txt'),join(stage,'NOTICE.txt'));await writeFile(join(stage,'server.properties'),'maxCheckThreads=1\nmaxTextLength=20000\nmaxCheckTimeMillis=30000\ncacheSize=1000\n')
      })
    }else{
      const packages=assets.filter(a=>a.kind==='package')
      if(packages.length)await this.installDirectory(this.ocrRuntime,fingerprint(manifest.ocr.packages),signal,async stage=>{
        for(const asset of packages){const temporary=join(stage,'.package');await extract(archives.get(asset.id)!,temporary);const destination=join(stage,asset.path!);await mkdir(join(destination,'..'),{recursive:true});await rename(join(temporary,'package'),destination);await rm(temporary,{recursive:true})}
        await writeFile(join(stage,'package.json'),'{"private":true}');await copyFile(join(this.notices,'OCR-NOTICE.txt'),join(stage,'NOTICE.txt'))
      })
      await mkdir(this.ocrModels,{recursive:true})
      for(const asset of assets.filter(a=>a.kind==='model')){signal.throwIfAborted();const file=join(this.ocrModels,asset.language+'.traineddata.gz');await copyFile(archives.get(asset.id)!,file+'.tmp');signal.throwIfAborted();await rename(file+'.tmp',file)}
    }
  }
  async cleanup():Promise<void>{await mkdir(this.root,{recursive:true});for(const name of await readdir(this.root))if(name.startsWith('.install-'))await rm(join(this.root,name),{recursive:true,force:true})}
}
