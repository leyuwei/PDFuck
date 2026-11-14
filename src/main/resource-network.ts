import { net, session } from 'electron'
import { Readable } from 'node:stream'
import type { ResourceProxyStore } from './resource-proxy'
import { resourceError, type ResourceTransport } from './resource-download'

/** Downloads use an isolated session; proxy edits never alter PDF, AI or update networking. */
export function resourceTransport(store:ResourceProxyStore):ResourceTransport {
  let configured=''
  return async(url,headers,signal)=>{
    signal.throwIfAborted()
    const proxy=store.credentials(),connection=session.fromPartition('pdfuck-resource-downloads',{cache:false})
    const settings=JSON.stringify(proxy)
    if(configured!==settings){await connection.closeAllConnections();await connection.setProxy(proxy.mode==='manual'?{mode:'fixed_servers',proxyRules:proxy.url,proxyBypassRules:'<-loopback>'}:{mode:proxy.mode});configured=settings}
    return new Promise((resolve,reject)=>{
      const request=net.request({url,session:connection,redirect:'manual',headers}),body=new Readable({read(){}})
      let settled=false,redirects=0,authAttempts=0
      const abort=()=>{request.abort();body.destroy(signal.reason instanceof Error?signal.reason:resourceError('canceled'));if(!settled)reject(signal.reason)}
      const close=()=>{signal.removeEventListener('abort',abort);request.abort();if(!body.destroyed)body.destroy()}
      body.on('error',()=>{})
      request.on('redirect',(_status,_method,location)=>{try{if(++redirects>10||new URL(location).protocol!=='https:')throw Error();request.followRedirect()}catch{request.abort();reject(resourceError('network'))}})
      request.on('login',(info,callback)=>{
        const configured=proxy.mode==='manual'?new URL(proxy.url):undefined
        if(info.isProxy&&configured&&info.host===configured.hostname&&Number(info.port)===Number(configured.port||(configured.protocol==='https:'?443:80))&&proxy.username&&authAttempts++===0)callback(proxy.username,proxy.password||'')
        else {callback();request.abort();reject(resourceError('proxyAuth'));body.destroy(resourceError('proxyAuth'))}
      })
      request.on('error',()=>{const error=resourceError('network');if(!settled)reject(error);body.destroy(error)})
      request.on('response',response=>{
        const normalized:Record<string,string>={};for(const [key,value]of Object.entries(response.headers))normalized[key.toLowerCase()]=Array.isArray(value)?value[0]:value||''
        response.on('data',chunk=>body.push(chunk))
        response.on('end',()=>body.push(null));response.on('error',()=>body.destroy(resourceError('network')));response.on('aborted',()=>body.destroy(resourceError('network')))
        settled=true;resolve({status:response.statusCode,headers:normalized,body,close})
      })
      signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();else request.end()
    })
  }
}
