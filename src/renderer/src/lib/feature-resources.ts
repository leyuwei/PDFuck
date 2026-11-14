import type { FeatureResourceRequest } from '../../../shared/resources'
export async function ensureFeatureResources(request:FeatureResourceRequest,signal?:AbortSignal):Promise<void>{
  signal?.throwIfAborted()
  const cancel=()=>window.desktop.cancelFeatureResources(request)
  signal?.addEventListener('abort',cancel,{once:true})
  try{const ready=await window.desktop.ensureFeatureResources(request);signal?.throwIfAborted();if(!ready)throw new Error('resources.canceled')}
  finally{signal?.removeEventListener('abort',cancel)}
}
