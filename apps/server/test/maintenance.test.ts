import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {ClientEvents,ServerEvents,Result,RoomView,Session} from '../../../packages/protocol.ts';
import type {DeveloperStatus} from '../../../packages/account-protocol.ts';
import {basicDeck} from '../../../packages/basic-decks.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {createDuelServer,loadCatalog} from '../server.ts';
import {AccountError,LocalAccountStore} from '../account-store.ts';
import type {AccountBackend} from '../account-store.ts';

type Client=Socket<ServerEvents,ClientEvents>;
const ack=<T>(fn:(cb:(r:Result<T>)=>void)=>void)=>new Promise<Result<T>>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('ack timeout')),5000);fn(r=>{clearTimeout(timer);resolve(r);});});
const success=<T>(r:Result<T>)=>{assert.ok(r.ok,r.ok?'':r.error);return r.data;};
test('maintenance is developer-only, blocks new account matches and preserves existing mobile resume and settlement',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),{http,io,flush}=createDuelServer(catalog,{accounts:store,growth,botDelayMs:60000,sweepMs:20});
  http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const users=await Promise.all(['dev','ranked','pvp-a','pvp-b','fresh','waiting'].map(name=>store.register(name+'@example.test','test-password')));
  const [dev,ranked,pvpA,pvpB,fresh,waiting]=users;store.setRole(dev.account.email,'developer');const phone=await store.login(ranked.account.email,'test-password');
  const clients:Client[]=[];const socket=async(token?:string)=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  const toggle=(token:string,enabled:unknown,origin=url)=>fetch(url+'/api/account/developer/maintenance',{method:'POST',headers:{'Content-Type':'application/json',Cookie:`duel_account=${token}`,Origin:origin},body:JSON.stringify({enabled})});
  const status=async()=>{const res=await fetch(url+'/api/account/developer',{headers:{Cookie:`duel_account=${dev.token}`}});assert.equal(res.status,200);return (await res.json() as DeveloperStatus).runtime!;};
  try{
    const [d,a,m,p1,p2,n,w,g]=await Promise.all([socket(dev.token),socket(ranked.token),socket(phone.token),socket(pvpA.token),socket(pvpB.token),socket(fresh.token),socket(waiting.token),socket()]);
    const deck=basicDeck(catalog,'warrior'),rank=success(await ack<Session>(cb=>a.emit('room:ranked',{deck},cb)));
    const pvp=success(await ack<Session>(cb=>p1.emit('room:owned-create',{deck},cb)));success(await ack<Session>(cb=>p2.emit('room:owned-join',{code:pvp.code,deck},cb)));
    const waitRoom=success(await ack<Session>(cb=>w.emit('room:owned-create',{deck},cb)));
    assert.equal((await toggle(fresh.token,true)).status,403);assert.equal((await toggle(dev.token,'yes')).status,400);assert.equal((await toggle(dev.token,true,'https://evil.example')).status,403);
    const notice=new Promise<boolean>(resolve=>n.once('server:maintenance',resolve));assert.equal((await toggle(dev.token,true)).status,200);assert.equal(await notice,true);
    let metrics=await status();assert.equal(metrics.maintenance,true);assert.equal(metrics.readyForPatch,false);assert.equal(metrics.rooms.accountPlaying,2);assert.equal(metrics.rooms.accountWaiting,1);
    for(const blocked of [await ack<Session>(cb=>n.emit('room:ranked',{deck},cb)),await ack<Session>(cb=>n.emit('room:owned-create',{deck},cb)),await ack<Session>(cb=>n.emit('room:owned-match',{deck},cb)),await ack<Session>(cb=>n.emit('room:owned-join',{code:waitRoom.code,deck},cb)),await ack<Session>(cb=>d.emit('room:developer-test',{deck,rank:25},cb))]){assert.equal(blocked.ok,false);if(!blocked.ok)assert.match(blocked.error,/점검/);}
    success(await ack<Session>(cb=>g.emit('room:bot',{deck,heroClass:'mage',difficulty:1},cb))); // guest practice stays available
    const resumed=success(await ack<Session>(cb=>m.emit('room:account-resume',{},cb)));assert.equal(resumed.code,rank.code);
    const existing=success(await ack<RoomView>(cb=>m.emit('room:sync',cb)));success(await ack<RoomView>(cb=>m.emit('room:action',{revision:existing.state!.revision,action:{type:'concede'}},cb)));
    success(await ack<null>(cb=>p1.emit('room:leave',cb)));success(await ack<null>(cb=>w.emit('room:leave',cb)));
    const until=Date.now()+4000;while(!(metrics=await status()).readyForPatch&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(metrics.readyForPatch,true);assert.equal(metrics.pendingResults,0);assert.equal((await store.session(ranked.token))?.profile.matchStats?.ranked.losses,1);assert.equal((await store.session(pvpA.token))?.profile.matchStats?.pvp.losses,1);assert.equal((await store.session(pvpB.token))?.profile.matchStats?.pvp.wins,1);
    const off=new Promise<boolean>(resolve=>n.once('server:maintenance',resolve));assert.equal((await toggle(dev.token,false)).status,200);assert.equal(await off,false);assert.equal((await status()).readyForPatch,false);
    success(await ack<Session>(cb=>n.emit('room:ranked',{deck},cb)));
  }finally{clients.forEach(c=>c.disconnect());await io.close();await flush();store.close();}
});
test('maintenance persists across server restart, fails closed and never reports readiness on failed writes',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth);
  const dev=await store.register('persist-dev@example.test','test-password'),player=await store.register('persist-player@example.test','test-password');
  store.setRole(dev.account.email,'developer');
  const open=async()=>{const server=createDuelServer(catalog,{accounts:store,growth,maintenance:await store.initializeMaintenance(false)});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const address=server.http.address();assert.ok(address&&typeof address==='object');return{...server,url:`http://127.0.0.1:${address.port}`};};
  let server=await open();const clients:Client[]=[];
  const close=async()=>{clients.splice(0).forEach(c=>c.disconnect());await server.io.close();await server.flush();};
  const status=async()=>{const res=await fetch(server.url+'/api/account/developer',{headers:{Cookie:`duel_account=${dev.token}`}});assert.equal(res.status,200);return (await res.json() as DeveloperStatus).runtime!;};
  const toggle=(enabled:boolean)=>fetch(server.url+'/api/account/developer/maintenance',{method:'POST',headers:{'Content-Type':'application/json',Cookie:`duel_account=${dev.token}`},body:JSON.stringify({enabled})});
  const set=store.setMaintenance.bind(store);
  try{
    const client:Client=connect(server.url,{forceNew:true,transports:['websocket'],extraHeaders:{Cookie:`duel_account=${player.token}`}});clients.push(client);await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);});
    let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
    store.setMaintenance=async()=>{entered();await held;throw new Error('synthetic write failure');};
    const pending=toggle(true);
    try{
      await started;const state=await status();assert.equal(state.maintenance,true);assert.equal(state.maintenanceSaving,true);assert.equal(state.readyForPatch,false);
      assert.equal((await toggle(false)).status,409);
      assert.equal((await ack<Session>(cb=>client.emit('room:ranked',{deck:basicDeck(catalog,'mage')},cb))).ok,false);
    }finally{release();}
    assert.equal((await pending).status,503);let state=await status();assert.equal(state.maintenance,true);assert.equal(state.maintenanceSaved,false);assert.equal(state.readyForPatch,false);
    assert.equal(await store.initializeMaintenance(true),false);
    store.setMaintenance=set;assert.equal((await toggle(true)).status,200);state=await status();assert.equal(state.maintenanceSaved,true);assert.equal(state.readyForPatch,true);
    await close();server=await open();assert.equal((await status()).readyForPatch,true);
    store.setMaintenance=async()=>{throw new Error('synthetic retry failure');};assert.equal((await toggle(false)).status,503);assert.equal((await status()).maintenance,true);assert.equal(await store.initializeMaintenance(false),true);
    store.setMaintenance=set;assert.equal((await toggle(false)).status,200);assert.equal(await store.initializeMaintenance(true),false);
    await close();server=await open();state=await status();assert.equal(state.maintenance,false);assert.equal(state.maintenanceSaved,true);
  }finally{store.setMaintenance=set;await close();store.close();}
});

test('patch maintenance drains in-flight credential changes and blocks new password or recovery completion while allowing login',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),backend:AccountBackend=store;
  let recoverCalls=0;Object.assign(backend,{emailRecovery:true,requestPasswordRecovery:async()=>{},completePasswordRecovery:async()=>{recoverCalls++;throw new AccountError(401,'fixture recovery failure');}});
  const {http,io}=createDuelServer(catalog,{accounts:backend,growth});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const password='test-password',dev=await store.register('credential-dev@example.test',password),player=await store.register('credential-player@example.test',password),other=await store.register('credential-other@example.test',password);store.setRole(dev.account.email,'developer');
  const post=(path:string,body:unknown,token?:string)=>fetch(url+'/api/account/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:url,...(token?{Cookie:`duel_account=${token}`}:{})},body:JSON.stringify(body)});
  const status=async()=>{const result=await fetch(url+'/api/account/developer',{headers:{Cookie:`duel_account=${dev.token}`}});assert.equal(result.status,200);return (await result.json() as DeveloperStatus).runtime!;};
  const change=store.changePassword.bind(store);let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);store.changePassword=async(...args)=>{entered();await held;return change(...args);};
  const newPassword='new-password',request={currentPassword:password,newPassword},recovery={email:other.account.email,code:'123456',newPassword};
  try{
    const pending=post('password',request,player.token);await started;assert.equal((await status()).pendingCredentialChanges,1);
    assert.equal((await post('developer/maintenance',{enabled:true},dev.token)).status,200);const waiting=await status();assert.equal(waiting.maintenance,true);assert.equal(waiting.pendingCredentialChanges,1);assert.equal(waiting.readyForPatch,false);
    assert.equal((await post('password',request,other.token)).status,503);assert.equal((await post('recovery-complete',recovery)).status,503);assert.equal(recoverCalls,0);assert.equal((await status()).pendingCredentialChanges,1);
    assert.equal((await post('login',{email:other.account.email,password})).status,200);assert.equal((await post('register',{email:'new-during-maintenance@example.test',password})).status,201);
    release();assert.equal((await pending).status,200);assert.equal(await store.session(player.token),null);const ready=await status();assert.equal(ready.pendingCredentialChanges,0);assert.equal(ready.readyForPatch,true);
    assert.equal((await post('developer/maintenance',{enabled:false},dev.token)).status,200);assert.equal((await post('recovery-complete',recovery)).status,401);assert.equal(recoverCalls,1);assert.equal((await status()).pendingCredentialChanges,0);
    assert.ok(await store.login(player.account.email,newPassword));assert.ok(await store.session(other.token));
  }finally{release();store.changePassword=change;await io.close();store.close();}
});

test('patch maintenance drains already accepted deck saves and rejects new edits through both API versions',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),{http,io}=createDuelServer(catalog,{accounts:store,growth});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const dev=await store.register('deck-dev@example.test','test-password'),player=await store.register('deck-player@example.test','test-password');store.setRole(dev.account.email,'developer');
  const deck=basicDeck(catalog,'warrior'),call=(path:string,method:string,body:unknown,token:string)=>fetch(url+'/api/account/'+path,{method,headers:{'Content-Type':'application/json',Origin:url,Cookie:`duel_account=${token}`},body:JSON.stringify(body)});
  const status=async()=>{const response=await fetch(url+'/api/account/developer',{headers:{Cookie:`duel_account=${dev.token}`}});assert.equal(response.status,200);return (await response.json() as DeveloperStatus).runtime!;};
  const update=store.updateDecks.bind(store);let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);store.updateDecks=async(...args)=>{entered();await held;return update(...args);};
  try{
    const accepted=call('deck','PUT',{name:'before',expected:null,deck},player.token);await started;assert.equal((await status()).pendingDeckChanges,1);
    assert.equal((await call('developer/maintenance','POST',{enabled:true},dev.token)).status,200);const waiting=await status();assert.equal(waiting.pendingDeckChanges,1);assert.equal(waiting.readyForPatch,false);
    assert.equal((await call('deck','PUT',{name:'during',expected:null,deck},player.token)).status,503);assert.equal((await call('decks','PUT',{revision:0,decks:[{name:'legacy',deck}]},player.token)).status,503);
    release();assert.equal((await accepted).status,200);const ready=await status();assert.equal(ready.pendingDeckChanges,0);assert.equal(ready.readyForPatch,true);assert.deepEqual((await store.session(player.token))?.profile.decks,[{name:'before',deck}]);
    assert.equal((await call('deck','PUT',{name:'before',expected:deck,deck:null},player.token)).status,503);assert.equal((await call('developer/maintenance','POST',{enabled:false},dev.token)).status,200);
    assert.equal((await call('deck','PUT',{name:'after',expected:null,deck},player.token)).status,200);assert.deepEqual((await store.session(player.token))?.profile.decks,[{name:'before',deck},{name:'after',deck}]);assert.equal((await status()).pendingDeckChanges,0);
  }finally{release();store.updateDecks=update;await io.close();store.close();}
});
