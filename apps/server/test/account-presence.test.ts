import {basicDeck} from '../../../packages/basic-decks.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import {createDuelServer,loadCatalog} from '../server.ts';
import {LocalAccountStore} from '../account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import type {AccountActiveRoom} from '../../../packages/account-protocol.ts';
import type {ClientEvents,ServerEvents,Result,Session,RoomView} from '../../../packages/protocol.ts';

type Client=Socket<ServerEvents,ClientEvents>;
function ack<T>(fn:(cb:(r:Result<T>)=>void)=>void):Promise<T>{
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('ack timeout')),5000);fn(r=>{clearTimeout(timer);if(r.ok)resolve(r.data);else reject(new Error(r.error));});});
}
function nextChange(c:Client){return new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>{c.off('account:room-changed',changed);reject(new Error('presence timeout'));},5000);function changed(){clearTimeout(timeout);resolve();}c.once('account:room-changed',changed);});}
test('private active room presence follows persisted create, pause, resume and finish across devices',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth);
  const {http,io}=createDuelServer(catalog,{accounts:store,growth,botDelayMs:60000});
  http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const owner=await store.register('presence@example.test','test-password'),phoneLogin=await store.login('presence@example.test','test-password'),other=await store.register('other@example.test','test-password');
  const clients:Client[]=[];
  const socket=async(token?:string)=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  const get=async(token:string)=>{const r=await fetch(url+'/api/account/active-room',{headers:{Cookie:`duel_account=${token}`}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return (await r.json() as {room:AccountActiveRoom|null}).room;};
  try{
    const [pc,phone,foreign,guest]=await Promise.all([socket(owner.token),socket(phoneLogin.token),socket(other.token),socket()]);
    for(const c of [pc,phone,foreign])await ack<null>(cb=>c.emit('account:watch',cb));
    let foreignEvents=0,phoneEvents=0;foreign.on('account:room-changed',()=>foreignEvents++);guest.on('account:room-changed',()=>foreignEvents++);phone.on('account:room-changed',()=>phoneEvents++);
    assert.equal((await fetch(url+'/api/account/active-room')).status,401);assert.equal(await get(owner.token),null);
    const save=store.saveRoomSnapshot.bind(store);let entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
    store.saveRoomSnapshot=async snapshot=>{entered();await held;await save(snapshot);};
    const created=nextChange(phone),request=ack<Session>(cb=>pc.emit('room:ranked',{deck:basicDeck(catalog,'warrior')},cb));
    try{await started;assert.equal(await get(phoneLogin.token),null);assert.equal(phoneEvents,0);}finally{release();}
    const session=await request;await created;store.saveRoomSnapshot=save;
    const initial={mode:'ranked',status:'playing',connected:true,rank:1,resumeAllowed:true};
    assert.deepEqual(await get(phoneLogin.token),initial);assert.equal(await get(other.token),null);
    assert.ok((await store.loadRoomSnapshots()).some(r=>r.code===session.code));
    await ack<RoomView>(cb=>pc.emit('room:sync',cb));assert.deepEqual(await get(owner.token),initial);assert.equal(phoneEvents,1);
    const paused=nextChange(phone);await ack<null>(cb=>pc.emit('room:account-pause',cb));await paused;
    assert.deepEqual(await get(phoneLogin.token),{...initial,connected:false});
    const resumed=nextChange(pc);const moved=await ack<Session>(cb=>phone.emit('room:account-resume',{},cb));await resumed;assert.equal(moved.code,session.code);assert.deepEqual(await get(owner.token),initial);
    const view=await ack<RoomView>(cb=>phone.emit('room:sync',cb));
    const finished=nextChange(pc);await ack<RoomView>(cb=>phone.emit('room:action',{revision:view.state!.revision,action:{type:'concede'}},cb));await finished;
    assert.equal(await get(owner.token),null);assert.equal(await get(phoneLogin.token),null);assert.equal(foreignEvents,0);
    await ack<null>(cb=>phone.emit('room:leave',cb));
    const waiting=nextChange(phone),pvp=await ack<Session>(cb=>pc.emit('room:owned-create',{deck:basicDeck(catalog,'warrior')},cb));await waiting;
    assert.deepEqual(await get(phoneLogin.token),{mode:'pvp',status:'waiting',connected:true,resumeAllowed:true});assert.equal(await get(other.token),null);
    const joined=nextChange(phone);await ack<Session>(cb=>foreign.emit('room:owned-join',{code:pvp.code,deck:basicDeck(catalog,'mage')},cb));await joined;
    assert.deepEqual(await get(phoneLogin.token),{mode:'pvp',status:'playing',connected:true,resumeAllowed:true});
    assert.deepEqual(await get(other.token),{mode:'pvp',status:'playing',connected:true,resumeAllowed:true});
  }finally{clients.forEach(c=>c.disconnect());await io.close();store.close();}
});
