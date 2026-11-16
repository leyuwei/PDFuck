import {it,expect,vi} from 'vitest'
import {EventEmitter} from 'node:events'
const fake=vi.hoisted(()=>({close:vi.fn(async()=>{}),proxy:vi.fn(async()=>{})}))
vi.mock('electron',async()=>{const {EventEmitter}=await import('node:events');return{session:{fromPartition:()=>({closeAllConnections:fake.close,setProxy:fake.proxy})},net:{request:()=>{const request=new EventEmitter() as EventEmitter&{end():void;abort():void};request.abort=()=>{};request.end=()=>queueMicrotask(()=>{const response=Object.assign(new EventEmitter(),{statusCode:200,headers:{}});request.emit('response',response);queueMicrotask(()=>response.emit('end'))});return request}}}})
import {resourceTransport} from '../../../src/main/resource-network'
it('configures the shared download session once for concurrent resource and update requests',async()=>{
 const transport=resourceTransport({credentials:()=>({mode:'direct'})} as any),signal=new AbortController().signal
 const results=await Promise.all([transport('https://example.com/resource',{},signal),transport('https://example.com/update',{},signal)])
 expect(fake.close).toHaveBeenCalledTimes(1);expect(fake.proxy).toHaveBeenCalledTimes(1)
 for(const response of results){expect(response.status).toBe(200);response.close()}
})
