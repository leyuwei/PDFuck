import { readFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ResourceProxy } from '../shared/resources'
import { resourceError } from './resource-download'
interface SecretStorage { getSelectedStorageBackend?():string; isEncryptionAvailable():boolean; encryptString(value:string):Buffer; decryptString(value:Buffer):string }
export function normalizedProxy(value:unknown):ResourceProxy {
  if(!value||typeof value!=='object')throw resourceError('invalidProxy')
  const p=value as ResourceProxy
  if(!['system','direct','manual'].includes(p.mode)||typeof p.url!=='string'||typeof p.username!=='string'||p.url.length>2048||p.username.length>256||p.password!==undefined&&(typeof p.password!=='string'||p.password.length>1024))throw resourceError('invalidProxy')
  let url=''
  if(p.mode==='manual'){
    try{const parsed=new URL(p.url.trim());if(!['http:','https:','socks5:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname&&parsed.pathname!=='/'||!parsed.port&&parsed.protocol==='socks5:')throw Error();url=parsed.origin==='null'?`${parsed.protocol}//${parsed.host}`:parsed.origin}catch{throw resourceError('invalidProxy')}
    // Chromium supports SOCKS5 transport but not SOCKS proxy authentication.
    if(url.startsWith('socks5:')&&(p.username||p.password))throw resourceError('socksAuth')
  }
  return {mode:p.mode,url,username:p.mode==='manual'?p.username:'',password:p.mode==='manual'?p.password:undefined}
}
export class ResourceProxyStore {
  private value:ResourceProxy={mode:'system',url:'',username:''}
  constructor(private file:string,private storage:SecretStorage){
    try{const v=JSON.parse(readFileSync(file,'utf8')),credentials=v.secret?JSON.parse(storage.decryptString(Buffer.from(v.secret,'base64'))):{};this.value=normalizedProxy({...v,...credentials})}catch{/* Broken or unavailable secrets fall back to system settings. */}
  }
  publicValue():ResourceProxy {const {password,...visible}=this.value;return {...visible,hasPassword:Boolean(password)}}
  credentials():ResourceProxy {return this.value}
  save(value:unknown):ResourceProxy {
    const next=normalizedProxy(value)
    if(next.password===undefined&&next.url===this.value.url&&next.username===this.value.username)next.password=this.value.password
    if(next.password&&(!this.storage.isEncryptionAvailable()||this.storage.getSelectedStorageBackend?.()==='basic_text'))throw resourceError('credentialsUnavailable')
    const secret=next.password?this.storage.encryptString(JSON.stringify({username:next.username,password:next.password})).toString('base64'):undefined
    const output={mode:next.mode,url:next.url,username:next.username,secret}
    try{mkdirSync(dirname(this.file),{recursive:true});writeFileSync(this.file+'.tmp',JSON.stringify(output),{mode:0o600});renameSync(this.file+'.tmp',this.file)}catch{throw resourceError('disk')}this.value=next;return this.publicValue()
  }
}
