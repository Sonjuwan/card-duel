import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { io as connect } from 'socket.io-client';
import { privateBindHost } from '../config.ts';
import { createDuelServer,loadCatalog } from '../server.ts';
import {websocketSource,gameSecurityHeaders} from '../security-headers.ts';
import {LocalAccountStore} from '../account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';

test('listen configuration accepts private interfaces but refuses wildcard and public addresses',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.5','172.16.0.1','172.31.0.1','100.64.0.3','100.127.255.254'])assert.ok(privateBindHost(ip),ip);
  for(const ip of ['0.0.0.0','8.8.8.8','172.32.0.1','100.128.0.1','localhost','::','foo'])assert.equal(privateBindHost(ip),false,ip);
});
test('websocket CSP allows only the exact browser origin, never injected or broad sources',()=>{
  assert.equal(websocketSource(undefined,'127.0.0.1:4173'),'ws://127.0.0.1:4173');
  assert.equal(websocketSource('','127.0.0.1:4173'),'ws://127.0.0.1:4173');
  assert.equal(websocketSource(undefined,'192.168.1.5:5173'),'ws://192.168.1.5:5173');
  assert.equal(websocketSource(undefined,'[::1]:4173'),'ws://[::1]:4173');
  assert.equal(websocketSource('https://duel.example.invalid','evil.example.invalid'),'wss://duel.example.invalid');
  for(const host of ['example.test;script-src','evil.test,other.test','evil.test/path','user@evil.test','evil.test#anchor','evil.test:99999','*','evil.test%3B',''])assert.equal(websocketSource(undefined,host),'',host);
  assert.equal(gameSecurityHeaders(undefined,'localhost:4173')['Strict-Transport-Security'],undefined);
  assert.equal(gameSecurityHeaders('https://duel.example.invalid')['Strict-Transport-Security'],'max-age=31536000');
});
test('game HTTP exposes only card catalog and safe static paths, with security headers',async()=>{
  const {http,io}=createDuelServer(loadCatalog('v0.8.0.json'));http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  try{
    const result=await fetch(`${url}/api/catalog`);assert.equal(result.status,200);assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.match(result.headers.get('content-security-policy')??'',/frame-ancestors 'none'/);assert.match(result.headers.get('content-security-policy')??'',/img-src 'self';/);assert.equal(result.headers.get('cache-control'),'no-store');const cards=await result.json() as {id:string}[];assert.equal(cards.length,137);assert.ok(cards.some(c=>c.id==='glacial_construct'));
    assert.match(result.headers.get('content-security-policy')??'',/worker-src 'self'/);
    assert.ok(result.headers.get('content-security-policy')?.includes("connect-src 'self' ws://127.0.0.1:"+address.port+';'));
    assert.equal(result.headers.get('cross-origin-resource-policy'),'same-origin');assert.equal(result.headers.get('strict-transport-security'),null);
    const profile=await fetch(`${url}/api/ai-profile`);assert.equal(profile.status,200);const model=await profile.json();assert.deepEqual(Object.keys(model).sort(),['catalogHash','generation','weights']);assert.equal(model.catalogHash,result.headers.get('x-card-duel-catalog'));assert.equal(Object.keys(model.weights).length,19);assert.equal(await (await fetch(`${url}/api/ai-profile`,{method:'HEAD'})).text(),'');
    assert.equal((await fetch(`${url}/api/cards`)).status,404);assert.equal((await fetch(`${url}/api/save`,{method:'POST'})).status,405);assert.equal((await fetch(`${url}/assets/%2e%2e%2fpackage.json`)).status,404);
  }finally{await io.close();}
});
test('public HTTPS account boundary rejects foreign origins, ambiguous cookies, invalid bodies and repeated normalized login attempts',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),trustedOrigin='https://duel.example.invalid';
  const {http,io}=createDuelServer(catalog,{accounts:store,growth,trustedOrigin});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const origin='http://127.0.0.1:'+addr.port;
  const credentials={email:'public@example.test',password:'sample-test-password'};
  const post=(path:string,body:string,headers:Record<string,string>={})=>fetch(origin+'/api/account/'+path,{method:'POST',headers:{Origin:trustedOrigin,'Content-Type':'application/json',...headers},body});
  const account=(cookie:string,headers:Record<string,string>={})=>fetch(origin+'/api/account/me',{headers:{Origin:trustedOrigin,Cookie:cookie,...headers}});
  try{
    const registered=await post('register',JSON.stringify(credentials));assert.equal(registered.status,201);
    assert.equal(registered.headers.get('cache-control'),'no-store');assert.equal(registered.headers.get('strict-transport-security'),'max-age=31536000');
    assert.equal(registered.headers.get('cross-origin-resource-policy'),'same-origin');
    assert.ok(registered.headers.get('content-security-policy')?.includes("connect-src 'self' wss://duel.example.invalid;"));
    assert.ok(registered.headers.get('content-security-policy')?.includes("form-action 'self'"));
    const cookie=registered.headers.get('set-cookie')??'';assert.match(cookie,/^duel_account=[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=604800; Secure$/);
    const session=cookie.split(';')[0];assert.equal((await account(session)).status,200);
    assert.equal((await account(session+'; '+session)).status,401);
    assert.equal((await account(session,{Origin:'https://wrong.example.invalid'})).status,403);
    assert.equal((await account(session,{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await post('login',JSON.stringify(credentials),{Origin:origin})).status,403);
    assert.equal((await post('login','{')).status,400);
    assert.equal((await post('login',JSON.stringify(credentials),{'Content-Type':'text/plain'})).status,415);
    assert.equal((await post('login',JSON.stringify({email:credentials.email,password:'x'.repeat(33000)}))).status,413);
    // Registration consumed one slot. The same normalized identity cannot
    // evade its remaining seven attempts by changing case, spaces or XFF.
    for(let i=0;i<7;i++){const result=await post('login',JSON.stringify({email:i%2?' PUBLIC@example.TEST ':credentials.email,password:'wrong-password'}),{'X-Forwarded-For':'198.51.100.'+(i+1)});assert.equal(result.status,401);}
    const denied=await post('login',JSON.stringify(credentials),{'X-Forwarded-For':'198.51.100.99'});assert.equal(denied.status,429);assert.equal(denied.headers.get('set-cookie'),null);
    const retry=Number(denied.headers.get('retry-after'));assert.ok(Number.isInteger(retry)&&retry>=1&&retry<=60);
    assert.equal((await account(session)).status,200);
    assert.equal((await post('register',JSON.stringify({email:'other-public@example.test',password:credentials.password}))).status,201);
  }finally{await io.close();store.close();}
});
test('WebSocket accepts the local origin without a proxy, but requires exact configured proxy origin when set',{timeout:10000},async()=>{
  const catalog=loadCatalog('v0.7.0.json');assert.throws(()=>createDuelServer(catalog,{trustedOrigin:'https://invalid.example/path'}),/정확한/);
  const {http,io}=createDuelServer(catalog,{trustedOrigin:'https://duel.example.invalid'});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  async function tryConnect(origin:string,accepted:boolean){const client=connect(url,{forceNew:true,reconnection:false,transports:['websocket'],extraHeaders:{Origin:origin},timeout:2000});try{const result=await new Promise<boolean>((resolve)=>{client.once('connect',()=>resolve(true));client.once('connect_error',()=>resolve(false));});assert.equal(result,accepted,origin);}finally{client.disconnect();}}
  try{await tryConnect(url,false);await tryConnect('https://duel.example.invalid',true);await tryConnect('https://evil.example.invalid',false);await tryConnect('ftp://127.0.0.1:'+addr.port,false);}finally{await io.close();}
  const local=createDuelServer(catalog);local.http.listen(0,'127.0.0.1');await once(local.http,'listening');const localAddr=local.http.address();assert.ok(localAddr&&typeof localAddr==='object');const origin=`http://127.0.0.1:${localAddr.port}`;
  const client=connect(origin,{forceNew:true,reconnection:false,transports:['websocket'],extraHeaders:{Origin:origin},timeout:2000});try{assert.equal(await new Promise<boolean>(resolve=>{client.once('connect',()=>resolve(true));client.once('connect_error',()=>resolve(false));}),true);}finally{client.disconnect();await local.io.close();}
});
test('catalogue hash matches HTTP and real socket handshake, changes when balance snapshot changes',{timeout:10000},async()=>{
  async function check(version:string){const {http,io}=createDuelServer(loadCatalog(version));http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
    const client=connect(url,{autoConnect:false,forceNew:true,transports:['websocket']});
    try{
      const response=await fetch(url+'/api/catalog'),data=await response.text(),hash=response.headers.get('x-card-duel-catalog');assert.equal(hash,createHash('sha256').update(data).digest('hex'));
      const head=await fetch(url+'/api/catalog',{method:'HEAD'});assert.equal(head.headers.get('x-card-duel-catalog'),hash);assert.equal(await head.text(),'');
      const handshake=new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('catalog handshake timeout')),2000);client.once('server:catalog',v=>{clearTimeout(timer);resolve(v);});});client.connect();assert.equal(await handshake,hash);return hash;
    }finally{client.disconnect();await io.close();}
  }
  assert.notEqual(await check('v0.18.0.json'),await check('v0.19.0.json'));
});
