import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {ClientEvents,ServerEvents,Result,Session,RoomView} from '../../../packages/protocol.ts';
import {practiceDeck} from '../../../packages/engine/src/index.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {createDuelServer,loadCatalog} from '../server.ts';
import {LocalAccountStore} from '../account-store.ts';
type Client=Socket<ServerEvents,ClientEvents>;
const ack=<T>(send:(cb:(r:Result<T>)=>void)=>void)=>new Promise<Result<T>>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('socket timeout')),5000);send(r=>{clearTimeout(timeout);resolve(r);});});
const ok=<T>(r:Result<T>)=>{assert.ok(r.ok,r.ok?'':r.error);return r.data;};
const denied=(r:Result<unknown>,code:string)=>{assert.equal(r.ok,false);if(!r.ok)assert.equal(r.code,code);};
const nextExpired=(c:Client)=>new Promise<{code:string;reason:string}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('seat expiry timeout')),5000);c.once('room:expired',event=>{clearTimeout(timer);resolve(event);});});
async function setup(recheck:number){
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),{http,io,flush,rooms}=createDuelServer(catalog,{accounts:store,growth,botDelayMs:60000,accountRecheckMs:recheck});
  http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`,clients:Client[]=[];
  const client=async(token?:string)=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  const close=async()=>{clients.forEach(c=>c.disconnect());await io.close();await flush();store.close();};
  return{store,client,close,rooms,deck:practiceDeck(catalog,'warrior'),url};
}
test('externally revoked account session cannot act in an existing room, but another valid device can resume',{timeout:15000},async()=>{
  const {store,client,close,rooms,deck}=await setup(0);
  try{
    const owner=await store.register('recheck@example.test','test-password'),other=await store.login(owner.account.email,'test-password'),pc=await client(owner.token),phone=await client(other.token);
    const session=ok(await ack<Session>(cb=>pc.emit('room:ranked',{deck},cb))),before=ok(await ack<RoomView>(cb=>pc.emit('room:sync',cb)));
    // Simulate storage revocation outside the current HTTP server process.
    await store.logout(owner.token);const released=nextExpired(pc);
    denied(await ack<RoomView>(cb=>pc.emit('room:action',{revision:before.state!.revision,action:{type:'concede'}},cb)),'sessionInvalid');assert.equal((await released).code,session.code);assert.equal(rooms.accountRoomEntries(session.code).get(owner.account.id)?.connected,false);
    const moved=ok(await ack<Session>(cb=>phone.emit('room:account-resume',{},cb)));assert.equal(moved.code,session.code);
    const continued=ok(await ack<RoomView>(cb=>phone.emit('room:sync',cb)));assert.notEqual(continued.state?.phase,'finished');assert.equal(continued.state?.revision,before.state?.revision);assert.equal((await store.session(other.token))?.profile.xp,0);
  }finally{await close();}
});
test('developer demotion denies an existing trial, transient storage errors retain valid seats, guests remain available',{timeout:15000},async()=>{
  const {store,client,close,rooms,deck,url}=await setup(0);
  try{
    const dev=await store.register('recheck-dev@example.test','test-password');store.setRole(dev.account.email,'developer');const a=await client(dev.token);
    const started=ok(await ack<Session>(cb=>a.emit('room:developer-test',{deck,rank:25},cb)));
    const original=store.session.bind(store);store.session=async()=>{throw new Error('synthetic unavailable');};
    denied(await ack<RoomView>(cb=>a.emit('room:sync',cb)),'serverError');assert.equal(rooms.accountRoomEntries(started.code).get(dev.account.id)?.connected,true);
    store.session=original;ok(await ack<RoomView>(cb=>a.emit('room:sync',cb)));
    store.setRole(dev.account.email,'player');const released=nextExpired(a);denied(await ack<RoomView>(cb=>a.emit('room:sync',cb)),'sessionInvalid');await released;
    const active=await fetch(url+'/api/account/active-room',{headers:{Cookie:`duel_account=${dev.token}`}});assert.equal(active.status,200);assert.equal((await active.json()).room.resumeAllowed,false);
    assert.equal((await ack<Session>(cb=>a.emit('room:account-resume',{},cb))).ok,false);
    store.setRole(dev.account.email,'developer');ok(await ack<Session>(cb=>a.emit('room:account-resume',{},cb)));
    const guest=await client();ok(await ack<Session>(cb=>guest.emit('room:bot',{deck,heroClass:'mage',difficulty:1},cb)));ok(await ack<RoomView>(cb=>guest.emit('room:sync',cb)));
  }finally{await close();}
});
test('fresh verified room session avoids repeat backend fetches on ordinary syncs',{timeout:15000},async()=>{
  const {store,client,close,deck}=await setup(60000);
  try{
    const owner=await store.register('recheck-cache@example.test','test-password'),original=store.session.bind(store);let calls=0;
    store.session=async token=>{calls++;return original(token);};
    const a=await client(owner.token);ok(await ack<Session>(cb=>a.emit('room:ranked',{deck},cb)));assert.equal(calls,1);
    for(let i=0;i<4;i++)ok(await ack<RoomView>(cb=>a.emit('room:sync',cb)));
    assert.equal(calls,1);
  }finally{await close();}
});
