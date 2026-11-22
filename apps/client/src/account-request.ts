export class AccountRequestError extends Error{
  readonly status:number;
  readonly retryAfterSeconds?:number;
  constructor(status:number,message:string,retryAfterSeconds?:number){super(message);this.status=status;this.retryAfterSeconds=retryAfterSeconds;}
}
type RequestOptions={fetcher?:typeof fetch;timeoutMs?:number;signal?:AbortSignal;accountId?:string};
/** A bounded same-origin request. No raw proxy HTML, browser error text or
 * credential body is surfaced to the player. */
export async function requestAccount<T>(path:string,method='GET',body?:unknown,options:RequestOptions={}):Promise<T>{
  const controller=new AbortController(),external=options.signal,abort=()=>controller.abort();
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},options.timeoutMs??25000);
  if(external?.aborted)controller.abort();else external?.addEventListener('abort',abort,{once:true});
  let status=0;
  try{
    const headers=new Headers();if(options.accountId)headers.set('X-Card-Duel-Account',options.accountId);if(body!==undefined)headers.set('Content-Type','application/json');
    const res=await (options.fetcher??fetch)('/api/account/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});status=res.status;
    let data:unknown;try{data=await res.json();}catch{if(controller.signal.aborted)throw new Error('aborted');throw new AccountRequestError(status,'계정 서버의 응답을 확인할 수 없습니다. 잠시 후 다시 시도하세요.');}
    if(controller.signal.aborted)throw new Error('aborted');
    if(!data||typeof data!=='object'||Array.isArray(data))throw new AccountRequestError(status,'계정 서버의 응답 형식이 올바르지 않습니다.');
    if(!res.ok){const message=(data as {error?:unknown}).error,raw=res.headers.get('Retry-After'),seconds=status===429&&raw&&/^\d+$/.test(raw)?Math.min(86400,Math.max(1,Number(raw))):undefined;const detail=typeof message==='string'?message:'계정 요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.';throw new AccountRequestError(status,detail+(seconds&&Number.isFinite(seconds)?` (약 ${seconds}초 후 다시 시도)`:''),seconds);}
    return data as T;
  }catch(error){if(error instanceof AccountRequestError)throw error;const detail=method==='GET'?'연결을 확인하고 다시 시도하세요.':'요청 결과를 확인하지 못했습니다. 연결 복구 후 반영 여부를 먼저 확인하세요.';throw new AccountRequestError(status,external?.aborted?'계정 요청을 취소했습니다.':timedOut?`계정 서버 응답이 지연됩니다. ${detail}`:`계정 서버에 연결하지 못했습니다. ${detail}`);}
  finally{clearTimeout(timer);external?.removeEventListener('abort',abort);}
}
