import {afterEach,it,expect} from 'vitest'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {Readable} from 'node:stream'
import {execFileSync} from 'node:child_process'
import {AppUpdateDownload,selectUpdateAsset} from '../../../src/main/app-update'
import {macUpdateScript} from '../../../src/main/update-installer'
import type {ResourceTransport} from '../../../src/main/resource-download'
const roots:string[]=[]
afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true})})
const digest='a'.repeat(64),asset=(name:string)=>({name,size:100,digest:'sha256:'+digest,browser_download_url:'https://github.com/leyuwei/PDFuck/releases/download/v2.1.21/'+name})
it('selects platform and explicit architecture, rejects portable Windows executables, foreign URLs and missing hashes',()=>{
 const assets=[asset('PDFuck-2.1.21-macOS.dmg'),asset('PDFuck-2.1.21-macOS-arm64.dmg'),asset('PDFuck-2.1.21-Windows-Setup.exe'),asset('PDFuck-2.1.21-Windows.exe')]
 expect(selectUpdateAsset(assets,'darwin','arm64')?.name).toContain('arm64');expect(selectUpdateAsset(assets,'win32','x64')?.name).toContain('Setup');expect(selectUpdateAsset(assets,'linux','x64')).toBeUndefined()
 for(const bad of [{...assets[0],browser_download_url:'file:///tmp/a'},{...assets[0],browser_download_url:'https://github.com/other/repo/releases/download/a'},{...assets[0],digest:undefined},{...assets[0],name:'../PDFuck-x-macOS.dmg'},{...assets[0],browser_download_url:'garbage'}])expect(selectUpdateAsset([bad],'darwin','arm64')).toBeUndefined()
})
it('downloads through the shared verified transport, reuses cached installers and detects tampering',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pdfuck-update-'));roots.push(root);const data=Buffer.alloc(65536,7),sha=createHash('sha256').update(data).digest('hex'),spec=selectUpdateAsset([{...asset('PDFuck-2.1.21-macOS.dmg'),size:data.length,digest:'sha256:'+sha}],'darwin','arm64')!;let calls=0
 const transport:ResourceTransport=async()=>{calls++;return{status:200,headers:{'content-length':String(data.length)},body:Readable.from([data]),close(){}}}
 const first=new AppUpdateDownload(root,transport,()=>{});await first.prepare('2.1.21',spec);first.action('start');await first.settled();expect(first.state?.phase).toBe('ready');expect(await readFile(await first.installer())).toEqual(data)
 const restored=new AppUpdateDownload(root,transport,()=>{});await restored.restore();expect(restored.state?.phase).toBe('ready');expect(calls).toBe(1);await writeFile(await restored.installer(),'tampered');await expect(restored.installer()).rejects.toThrow('updates.unavailable')
})
it('retains interrupted bytes, restores as paused and resumes with Range after process restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pdfuck-update-'));roots.push(root);const data=Buffer.alloc(65536,9),spec=selectUpdateAsset([{...asset('PDFuck-2.1.21-macOS.dmg'),size:data.length,digest:'sha256:'+createHash('sha256').update(data).digest('hex')}],'darwin','arm64')!,ranges:string[]=[]
 const transport:ResourceTransport=async(_url,headers,signal)=>{const offset=headers.Range?Number(headers.Range.match(/\d+/)![0]):0;ranges.push(headers.Range||'');const body=Readable.from((async function*(){for(let n=offset;n<data.length;n+=4096){signal.throwIfAborted();yield data.subarray(n,n+4096);await new Promise(r=>setTimeout(r,4))}})());return{status:offset?206:200,headers:{'content-range':offset?`bytes ${offset}-${data.length-1}/${data.length}`:''},body,close(){body.destroy()}}}
 const first=new AppUpdateDownload(root,transport,()=>{});await first.prepare('2.1.21',spec);first.action('start');await new Promise(r=>setTimeout(r,24));first.stop();await first.settled();expect(first.state?.phase).toBe('paused')
 const second=new AppUpdateDownload(root,transport,()=>{});await second.restore();expect(second.state?.downloaded).toBeGreaterThan(0);second.action('start');await second.settled();expect(second.state?.phase).toBe('ready');expect(ranges.at(-1)).toMatch(/^bytes=\d+-$/)
})
it('keeps checksum failures retryable and rejects installing unverified data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pdfuck-update-'));roots.push(root);const spec=selectUpdateAsset([asset('PDFuck-2.1.21-macOS.dmg')],'darwin','arm64')!
 const service=new AppUpdateDownload(root,async()=>({status:200,headers:{},body:Readable.from([Buffer.alloc(100)]),close(){}}),()=>{});await service.prepare('2.1.21',spec);service.action('start');await service.settled();expect(service.state?.phase).toBe('error');expect(service.state?.error).toBe('resources.checksum');await expect(service.installer()).rejects.toThrow()
})
it('does not revive a canceled download when a pending stream finishes and persists the cancellation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pdfuck-update-'));roots.push(root);const data=Buffer.alloc(100,7),spec=selectUpdateAsset([{...asset('PDFuck-2.1.21-macOS.dmg'),digest:'sha256:'+createHash('sha256').update(data).digest('hex')}],'darwin','arm64')!
 const service=new AppUpdateDownload(root,async()=>({status:200,headers:{},body:Readable.from((async function*(){yield data.subarray(0,50);await new Promise(r=>setTimeout(r,25));yield data.subarray(50)})()),close(){}}),()=>{});await service.prepare('2.1.21',spec);service.action('start');await new Promise(r=>setTimeout(r,10));service.action('cancel');await service.settled();expect(service.state).toBeUndefined();const restored=new AppUpdateDownload(root,async()=>{throw Error('network should not be used')},()=>{});await restored.restore();expect(restored.state).toBeUndefined()
})
it('generates a syntactically valid installer that waits for exit, verifies app identity/version/architecture and rolls back',()=>{
 const script=macUpdateScript("/tmp/a'b.dmg",'/Applications/PDFuck.app','2.1.21',12345,'arm64',"/tmp/a'b.sh")
 expect(execFileSync('/bin/bash',['-n'],{input:script}).toString()).toBe('');for(const value of ['kill -0 12345','CFBundleIdentifier','CFBundleShortVersionString','codesign --verify','lipo -archs','trap cleanup EXIT','previous-','with administrator privileges','display alert'])expect(script).toContain(value)
 expect(()=>macUpdateScript('a','/','x;bad',1,'arm64','a')).toThrow()
})
