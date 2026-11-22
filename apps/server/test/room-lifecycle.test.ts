import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import {RoomService,RoomError} from '../rooms.ts';
import {createDuelServer,loadCatalog} from '../server.ts';
import {starterDeck} from '../../../packages/engine/src/index.ts';
import type {GameState} from '../../../packages/engine/src/index.ts';
import type {ClientEvents,ServerEvents,Result,Session,RoomView} from '../../../packages/protocol.ts';
const catalog=loadCatalog(),deck=starterDeck(catalog,'mage');
test('a human disconnect pauses combat and preserves the exact Nozdormu turn time',()=>{
  let now=1000;const r=new RoomService(catalog,{clock:()=>now,reconnectGraceMs:10000});const a=r.create('a',deck),b=r.join('b',{code:a.code,deck});
  r.act('a',{revision:0,action:{type:'mulligan',replace:[]}});r.act('b',{revision:1,action:{type:'mulligan',replace:[]}});
  const state=(r as unknown as {rooms:Map<string,{state:GameState}>}).rooms.get(a.code)!.state,actor=state.activePlayer,actorSocket=actor===0?'a':'b',enemySocket=actor===0?'b':'a',enemySession=actor===0?b:a;
  state.players[actor].mana=10;state.players[actor].maxMana=10;state.players[actor].hand.push({cardId:'nozdormu',instanceId:'clock-test'});
  r.act(actorSocket,{revision:2,action:{type:'playCard',instanceId:'clock-test'}});assert.equal(r.turnDeadline(a.code),16000);
  now=5000;r.disconnect(enemySocket);assert.equal(r.turnDeadline(a.code),undefined);assert.equal(r.view(actorSocket).opponentReconnectDeadlineMs,15000);assert.equal(r.view(actorSocket).state?.revision,3);
  assert.throws(()=>r.act(actorSocket,{revision:3,action:{type:'endTurn'}}),(e:unknown)=>e instanceof RoomError&&e.code==='opponentDisconnected');
  now=8000;assert.equal(r.expireTurn(a.code),false);assert.equal(r.sweep().changed.length,0);r.resume('new',enemySession);assert.equal(r.turnDeadline(a.code),19000);assert.equal(r.view(actorSocket).opponentReconnectDeadlineMs,undefined);
  now=19000;assert.equal(r.expireTurn(a.code),true);assert.equal(r.view(actorSocket).state?.revision,4);
});
test('an absent player forfeits after grace; waiting and finished rooms release capacity',()=>{
  let now=10;const r=new RoomService(catalog,{clock:()=>now,reconnectGraceMs:1000,waitingTtlMs:3000,finishedTtlMs:5000,maxRooms:1});
  const a=r.create('a',deck);assert.throws(()=>r.create('z',deck),/한도/);now=3010;const wait=r.sweep();assert.equal(wait.expired[0].socketId,'a');assert.deepEqual(wait.removed,[a.code]);
  const next=r.create('a',deck),b=r.join('b',{code:next.code,deck});r.disconnect('b');now=4009;assert.equal(r.sweep().changed.length,0);now=4010;assert.deepEqual(r.sweep().changed,[next.code]);assert.equal(r.view('a').state?.winner,0);assert.equal(r.view('a').status,'finished');assert.throws(()=>r.resume('new',b),/권한/);
  now=9010;const finished=r.sweep();assert.deepEqual(finished.removed,[next.code]);assert.equal(finished.expired[0].socketId,'a');assert.equal(r.view(r.create('a',deck).seat===0?'a':'wrong').status,'waiting');
});
test('double disconnect expires without phantom win, ticket is secret and retry rebinds rather than creating duplicate rooms',()=>{
  let now=100;const r=new RoomService(catalog,{clock:()=>now,reconnectGraceMs:1000,maxRooms:1}),ticket='a'.repeat(64);
  assert.throws(()=>r.withTicket('a','bad',()=>r.create('a',deck)),/요청 번호/);
  const a=r.withTicket('a',ticket,()=>r.create('a',deck)),same=r.withTicket('a2',ticket,()=>{throw Error('must not create again');});assert.deepEqual(a,same);assert.equal(r.takeReplacements()[0].socketId,'a');assert.throws(()=>r.view('a'),/먼저 방/);
  assert.throws(()=>r.recover('x',{ticket:'b'.repeat(64)}),(e:unknown)=>e instanceof RoomError&&e.code==='ticketExpired');
  const b=r.join('b',{code:a.code,deck});r.disconnect('a2');r.disconnect('b');now=1100;const sweep=r.sweep();assert.deepEqual(sweep.changed,[]);assert.deepEqual(sweep.removed,[a.code]);assert.throws(()=>r.resume('x',b),/만료/);assert.throws(()=>r.recover('x',{ticket}),/만료/);r.create('x',deck);
});
type Client=Socket<ServerEvents,ClientEvents>;
function ack<T>(fn:(cb:(r:Result<T>)=>void)=>void):Promise<T>{return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('ack timeout')),4000);fn(r=>{clearTimeout(t);if(r.ok)resolve(r.data);else reject(Error(r.error));});});}
function view(client:Client,predicate:(v:RoomView)=>boolean){return new Promise<RoomView>((resolve,reject)=>{const timer=setTimeout(()=>{client.off('room:view',listener);reject(Error('view timeout'));},5000);const listener=(v:RoomView)=>{if(predicate(v)){clearTimeout(timer);client.off('room:view',listener);resolve(v);}};client.on('room:view',listener);});}
test('actual socket recovers a lost create acknowledgement and invalidates an older connection; remaining opponent wins after timeout',{timeout:15000},async()=>{
  const {http,io}=createDuelServer(catalog,{roomOptions:{reconnectGraceMs:2000},sweepMs:50});http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const clients:Client[]=[];const connectOne=async()=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],reconnection:false});clients.push(c);await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('connect timeout')),4000);c.once('connect',()=>{clearTimeout(timer);resolve();});});return c;};
  try{const a=await connectOne(),b=await connectOne(),ticket='c'.repeat(64),waiting=view(a,v=>v.status==='waiting');a.emit('room:create',{deck,ticket},()=>{/* simulate lost acknowledgement */});const created=await waiting;a.disconnect();
    const c=await connectOne(),restored=await ack<Session>(cb=>c.emit('room:recover',{ticket},cb));assert.equal(restored.code,created.code);assert.equal(restored.seat,0);
    const joined=await ack<Session>(cb=>b.emit('room:join',{code:restored.code,deck},cb));assert.equal(joined.seat,1);
    const d=await connectOne(),replaced=new Promise<{code:string;reason:string}>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('replacement timeout')),4000);c.once('room:expired',event=>{clearTimeout(timer);resolve(event);});});await ack<Session>(cb=>d.emit('room:resume',restored,cb));const event=await replaced;assert.equal(event.code,restored.code);
    const state=await ack<RoomView>(cb=>d.emit('room:sync',cb));assert.equal(state.state?.phase,'mulligan');assert.equal(state.state?.self.hand.length,state.state?.self.handCount);assert.ok(!Object.hasOwn(state.state!.opponent,'hand'));
    const pause=view(d,v=>!v.opponentConnected),done=view(d,v=>v.status==='finished');b.disconnect();const paused=await pause;assert.ok(paused.opponentReconnectDeadlineMs);const finished=await done;assert.equal(finished.state?.winner,0);assert.equal(finished.state?.phase,'finished');
  }finally{for(const c of clients)c.disconnect();await io.close();}
});
