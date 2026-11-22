import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {requestCatalog} from '../src/catalog-request.ts';
const body=JSON.stringify([{id:'fixture'}]),hash=createHash('sha256').update(body).digest('hex');
const response=(value=body,h=hash,type='application/json')=>new Response(value,{headers:{'Content-Type':type,'X-Card-Duel-Catalog':h}});
test('catalog bootstrap verifies exact SHA-256 bytes and avoids cache or redirects',async()=>{
  const fetcher:typeof fetch=async(url,options)=>{assert.equal(url,'/api/catalog');assert.equal(options?.cache,'no-store');assert.equal(options?.redirect,'error');assert.equal(options?.credentials,'same-origin');return response();};
  assert.deepEqual(await requestCatalog({fetcher}),{cards:[{id:'fixture'}],hash});
  await assert.rejects(requestCatalog({fetcher:async()=>response(body+' ')}),/최신 카드 정보/);
  // Private LAN contexts may not expose SubtleCrypto. The server handshake
  // still compares the reported catalog hash, and the engine validates cards.
  assert.deepEqual(await requestCatalog({fetcher,crypto:null}),{cards:[{id:'fixture'}],hash});
});
test('catalog bootstrap refuses missing headers, proxy HTML, empty data and network failures',async()=>{
  for(const fetcher of [async()=>response(body,''),async()=>response('<html>',hash,'text/html'),async()=>response('[]',createHash('sha256').update('[]').digest('hex')),async()=>new Response('',{status:503}),async()=>{throw new Error('proxy details');}] as const)await assert.rejects(requestCatalog({fetcher}),/최신 카드 정보/);
});
test('catalog bootstrap uses bounded timeout and permits a fresh retry',async()=>{
  const slow:typeof fetch=async(_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
  await assert.rejects(requestCatalog({fetcher:slow,timeoutMs:5}),/응답이 지연/);
  assert.equal((await requestCatalog({fetcher:async()=>response()})).hash,hash);
});
