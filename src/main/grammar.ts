import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import type { GrammarRequest, GrammarResponse } from '../shared/grammar'

export function validGrammarRequest(value: unknown): value is GrammarRequest {
  if (!value || typeof value !== 'object') return false
  const r = value as GrammarRequest
  return typeof r.text === 'string' && r.text.length > 0 && r.text.length <= 20000 && (r.language === undefined || typeof r.language === 'string' && /^(?:auto|[a-z]{2,3}(?:-[A-Za-z]{2,8})?)$/.test(r.language))
}
const ignoredCategories = new Set(['STYLE','TYPOGRAPHY','CASING','REDUNDANCY','REGISTER','BIASED_LANGUAGE','PUNCTUATION'])
export function grammarResponse(value: any, text: string): GrammarResponse {
  if (!value || value.warnings?.incompleteResults === true || !Array.isArray(value.matches) || typeof value.language?.code !== 'string') throw new Error('grammar.checkFailed')
  return { language: value.language.code, matches: value.matches.flatMap((m: any) => {
    if (!Number.isInteger(m.offset) || !Number.isInteger(m.length) || m.offset < 0 || m.length <= 0 || m.offset+m.length > text.length || typeof m.message !== 'string' || typeof m.rule?.id !== 'string') return []
    // Dictionary guesses, style preferences and speculative noun rules are noisy around PDF notation.
    if (ignoredCategories.has(m.rule.category?.id) || /^(?:misspelling|typographical|style|register)$/.test(m.rule.issueType) || /MORFOLOGIK|HUNSPELL|SPELLING_RULE|WHITESPACE|UPPERCASE_SENTENCE_START|^PRONOUN_NOUN$|^THE_SUPERLATIVE$/.test(m.rule.id)) return []
    return [{ offset:m.offset,length:m.length,message:m.message.slice(0,2000),ruleId:m.rule.id,replacements:(Array.isArray(m.replacements)?m.replacements:[]).flatMap((r:any)=>typeof r.value==='string'?[r.value.slice(0,256)]:[]).slice(0,3) }]
  }) }
}

/** One private loopback process shared by app windows; text never reaches a cloud service. */
export class LocalGrammarEngine {
  private child?: ChildProcess
  private ready?: Promise<string>
  private idle?: ReturnType<typeof setTimeout>
  constructor(private readonly root: string) {}
  stop(): void { clearTimeout(this.idle); this.child?.kill(); this.child=undefined; this.ready=undefined }
  private start(): Promise<string> {
    if (this.ready) return this.ready
    this.ready = (async () => {
      const java = join(this.root,'runtime','bin',process.platform==='win32'?'java.exe':'java')
      if (!existsSync(java) || !existsSync(join(this.root,'engine','languagetool-server.jar'))) throw new Error('grammar.engineUnavailable')
      const port = await new Promise<number>((resolve,reject) => {
        const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=address&&typeof address!=='string'?address.port:0;server.close(error=>error?reject(error):resolve(port))})
      })
      const child=spawn(java,['-Xms32m','-Xmx768m','-XX:+UseSerialGC','-cp','languagetool-server.jar','org.languagetool.server.HTTPServer','--port',String(port),'--config',join(this.root,'server.properties')],{cwd:join(this.root,'engine'),stdio:'ignore',windowsHide:true})
      this.child=child
      let failed=false;child.on('error',()=>{failed=true});child.on('exit',()=>{failed=true;if(this.child===child){this.child=undefined;this.ready=undefined}})
      const endpoint=`http://127.0.0.1:${port}/v2`
      for(let i=0;i<160;i++) {
        if(failed || this.child!==child) throw new Error('grammar.startFailed')
        try { const response=await fetch(endpoint+'/languages',{signal:AbortSignal.timeout(500)});if(response.ok && Array.isArray(await response.json()))return endpoint } catch { /* Wait for the local Java server to bind its socket. */ }
        await new Promise(resolve=>setTimeout(resolve,125))
      }
      throw new Error('grammar.startFailed')
    })().catch(error=>{this.stop();throw error})
    return this.ready
  }
  async check(request: GrammarRequest): Promise<GrammarResponse> {
    if(!validGrammarRequest(request))throw new Error('grammar.invalidRequest')
    clearTimeout(this.idle)
    try {
      const endpoint=await this.start()
      const response=await fetch(endpoint+'/check',{method:'POST',body:new URLSearchParams({text:request.text,language:request.language||'auto',...(!request.language||request.language==='auto'?{preferredVariants:'en-US,de-DE,pt-BR'}:{})}),signal:AbortSignal.timeout(35000)})
      if(!response.ok)throw new Error('grammar.checkFailed')
      return grammarResponse(await response.json(),request.text)
    } catch(error) { throw error instanceof Error && /^grammar\./.test(error.message)?error:new Error('grammar.checkFailed') }
    finally {this.idle=setTimeout(()=>this.stop(),60000);this.idle.unref()}
  }
}
