import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AccountRequestError,requestAccount} from '../src/account-request.ts';

const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('authentication throttling reports a bounded wait without automatically retrying mutations',async()=>{
  for(const [raw,expected]of [['32',32],['0',1],['999999',86400],['invalid',undefined]] as const){
    let attempts=0;
    await assert.rejects(requestAccount('login','POST',{email:'test@example.test',password:'test-password'},{fetcher:async()=>{attempts++;return new Response(JSON.stringify({error:'잠시 기다려 주세요.'}),{status:429,headers:{'Retry-After':raw}});}}),error=>error instanceof AccountRequestError&&error.status===429&&error.retryAfterSeconds===expected&&(expected===undefined||error.message.includes(String(expected))));
    assert.equal(attempts,1);
  }
});
test('account-bound requests send only the expected identity, not credentials, and discovery stays unbound',async()=>{
  const fetcher:typeof fetch=async(url,init)=>{const headers=new Headers(init?.headers);assert.equal(headers.get('X-Card-Duel-Account'),url==='/api/account/me'?null:'account-a');assert.equal(headers.get('Authorization'),null);assert.equal(headers.get('Content-Type'),init?.method==='PUT'?'application/json':null);return response({ok:true});};
  await requestAccount('deck','PUT',{name:'test'},{fetcher,accountId:'account-a'});
  await requestAccount('export','GET',undefined,{fetcher,accountId:'account-a'});
  await requestAccount('me','GET',undefined,{fetcher});
});
test('account requests are bounded, same-origin, no cache or redirects and preserve typed HTTP errors',async()=>{
  let called=false;const fetcher:typeof fetch=async(url,init)=>{called=true;assert.equal(url,'/api/account/deck');assert.equal(init?.method,'PUT');assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');assert.ok(init?.signal);assert.equal(init?.body,'{"name":"test"}');return response({ok:true});};
  assert.deepEqual(await requestAccount('deck','PUT',{name:'test'},{fetcher}),{ok:true});assert.ok(called);
  await assert.rejects(requestAccount('me','GET',undefined,{fetcher:async()=>response({error:'로그인이 필요합니다.'},401)}),error=>error instanceof AccountRequestError&&error.status===401&&error.message==='로그인이 필요합니다.');
  await assert.rejects(requestAccount('deck','PUT',{}, {fetcher:async()=>response({error:'다른 기기의 변경'},409)}),error=>error instanceof AccountRequestError&&error.status===409&&error.message==='다른 기기의 변경');
});
test('proxy HTML, non-object payloads and network failures use localized safe errors',async()=>{
  await assert.rejects(requestAccount('me','GET',undefined,{fetcher:async()=>new Response('<html>INTERNAL_DEBUG</html>',{status:502})}),error=>error instanceof AccountRequestError&&error.status===502&&/응답/.test(error.message)&&!error.message.includes('INTERNAL_DEBUG'));
  await assert.rejects(requestAccount('me','GET',undefined,{fetcher:async()=>response(null)}),/형식/);
  await assert.rejects(requestAccount('me','GET',undefined,{fetcher:async()=>{throw new Error('raw network failure');}}),error=>error instanceof AccountRequestError&&error.status===0&&/연결/.test(error.message)&&!error.message.includes('raw network'));
});
test('timeout and cancellation abort pending account requests; mutation timeouts do not imply a failed write',async()=>{
  const stalled:typeof fetch=async(_url,init)=>new Promise<Response>((_resolve,reject)=>{const signal=init?.signal;if(signal?.aborted)reject(new Error('aborted'));else signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
  await assert.rejects(requestAccount('me','GET',undefined,{fetcher:stalled,timeoutMs:5}),/응답이 지연/);
  await assert.rejects(requestAccount('deck','PUT',{}, {fetcher:stalled,timeoutMs:5}),/반영 여부를 먼저 확인/);
  const external=new AbortController(),pending=requestAccount('me','GET',undefined,{fetcher:stalled,signal:external.signal});external.abort();await assert.rejects(pending,/취소/);
});
