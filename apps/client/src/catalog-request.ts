type CatalogOptions={fetcher?:typeof fetch;timeoutMs?:number;crypto?:SubtleCrypto|null};
/** Load only the current server catalog, never an old cached fallback for
 * online play. Secure browsers also verify the actual response bytes. */
export async function requestCatalog(options:CatalogOptions={}):Promise<{cards:unknown[];hash:string}>{
  const controller=new AbortController();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},options.timeoutMs??25000);
  try{
    const response=await (options.fetcher??fetch)('/api/catalog',{cache:'no-store',credentials:'same-origin',redirect:'error',signal:controller.signal});
    if(!response.ok||!response.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error('invalid response');
    const hash=response.headers.get('x-card-duel-catalog')??'',body=await response.text();
    if(!/^[0-9a-f]{64}$/.test(hash))throw Error('invalid catalog hash');
    const subtle=options.crypto===undefined?globalThis.crypto?.subtle:options.crypto;
    if(subtle){const digest=await subtle.digest('SHA-256',new TextEncoder().encode(body));if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==hash)throw Error('catalog mismatch');}
    const cards:unknown=JSON.parse(body);
    if(!Array.isArray(cards)||!cards.length)throw Error('invalid catalog');
    if(controller.signal.aborted)throw Error('aborted');
    return {cards,hash};
  }catch{throw new Error(timedOut?'게임 서버 응답이 지연됩니다. 서버가 시작되는 중일 수 있습니다. 잠시 후 다시 시도하세요.':'최신 카드 정보를 확인할 수 없습니다. 연결을 확인하고 다시 시도하세요.');}
  finally{clearTimeout(timer);}
}
