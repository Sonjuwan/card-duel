import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import {createDuelServer,loadCatalog} from '../server.ts';
import {LocalAccountStore,newProfile} from '../account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {practiceDeck} from '../../../packages/engine/src/index.ts';
import type {GameState} from '../../../packages/engine/src/index.ts';
import type {ClientEvents,ServerEvents,Result,RoomView,Session} from '../../../packages/protocol.ts';
import type {AccountRoomSnapshot} from '../rooms.ts';
import {RoomService} from '../rooms.ts';

type Client=Socket<ServerEvents,ClientEvents>;
const ack=<T>(fn:(cb:(r:Result<T>)=>void)=>void)=>new Promise<Result<T>>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('ack timeout')),5000);fn(r=>{clearTimeout(timer);resolve(r);});});
const success=<T>(r:Result<T>)=>{assert.ok(r.ok,r.ok?'':r.error);return r.data;};
const catalog=loadCatalog(),growth=buildGrowth(catalog);
test('all account room entry modes reject a different expected account before consuming the ticket',async()=>{
  const store=new LocalAccountStore(':memory:',growth),server=await open(store);
  try{
    const a=await store.register('socket-a@example.test','test-password'),b=await store.register('socket-b@example.test','test-password'),client=await server.client(a.token);
    const deck=practiceDeck(catalog,'warrior'),ticket='ab'.repeat(32),expectedAccountId=b.account.id;
    // Each request is issued sequentially to avoid the per-socket auth lock.
    const results=[await ack<Session>(cb=>client.emit('room:ranked',{deck,ticket,expectedAccountId},cb))];
    results.push(await ack<Session>(cb=>client.emit('room:developer-test',{deck,rank:1,ticket,expectedAccountId},cb)));
    results.push(await ack<Session>(cb=>client.emit('room:owned-create',{deck,ticket,expectedAccountId},cb)));
    results.push(await ack<Session>(cb=>client.emit('room:owned-join',{code:'ABC234',deck,ticket,expectedAccountId},cb)));
    results.push(await ack<Session>(cb=>client.emit('room:owned-match',{deck,ticket,expectedAccountId},cb)));
    results.push(await ack<Session>(cb=>client.emit('room:account-resume',{ticket,expectedAccountId},cb)));
    for(const result of results){assert.equal(result.ok,false);if(!result.ok)assert.equal(result.code,'accountChanged');}
    assert.equal((await store.loadRoomSnapshots()).length,0);
    const room=success(await ack<Session>(cb=>client.emit('room:ranked',{deck,ticket,expectedAccountId:a.account.id},cb)));
    assert.equal((await store.loadRoomSnapshots())[0].code,room.code);
  }finally{await server.close();store.close();}
});
async function open(store:LocalAccountStore,restoreRooms:AccountRoomSnapshot[]=[]){
  const server=createDuelServer(catalog,{accounts:store,growth,restoreRooms,botDelayMs:60000,sweepMs:20});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const addr=server.http.address();assert.ok(addr&&typeof addr==='object');const clients:Client[]=[];
  return {...server,client:async(token:string)=>{const c:Client=connect(`http://127.0.0.1:${addr.port}`,{forceNew:true,transports:['websocket'],extraHeaders:{Cookie:`duel_account=${token}`}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;},close:async()=>{clients.forEach(c=>c.disconnect());await server.io.close();await server.flush();}};
}
test('ranked room is durably stored before ack and restored from the same database on restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-room-'));const path=join(dir,'accounts.sqlite');let store=new LocalAccountStore(path,growth);let server=await open(store);
  try{
    const account=await store.register('restart@example.test','test-password'),client=await server.client(account.token);const session=success(await ack<Session>(cb=>client.emit('room:ranked',{deck:practiceDeck(catalog,'warrior')},cb)));
    const view=success(await ack<RoomView>(cb=>client.emit('room:action',{revision:0,action:{type:'mulligan',replace:[]}},cb)));
    success(await ack<null>(cb=>client.emit('room:account-pause',cb)));assert.equal((await ack<RoomView>(cb=>client.emit('room:sync',cb))).ok,false);
    const saved=(await store.loadRoomSnapshots())[0];assert.equal(saved.code,session.code);assert.equal(saved.room?.state?.revision,view.state?.revision);assert.ok(!Object.hasOwn(saved.room!.state!,'catalog'));assert.ok(!Object.hasOwn(saved.room!.members[0],'socketId'));
    await server.close();store.close();store=new LocalAccountStore(path,growth);server=await open(store,await store.loadRoomSnapshots());
    const mobileLogin=await store.login(account.account.email,'test-password'),mobile=await server.client(mobileLogin.token),restored=success(await ack<Session>(cb=>mobile.emit('room:account-resume',{},cb)));assert.equal(restored.code,session.code);
    const current=success(await ack<RoomView>(cb=>mobile.emit('room:sync',cb)));assert.deepEqual(current.state,view.state);assert.equal(current.ranked?.rank,1);
  }finally{await server.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test('pending ranked award survives restart and is applied exactly once when storage recovers',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-result-'));const path=join(dir,'accounts.sqlite');let store=new LocalAccountStore(path,growth);let server=await open(store);
  try{
    const account=await store.register('pending@example.test','test-password'),client=await server.client(account.token);const session=success(await ack<Session>(cb=>client.emit('room:ranked',{deck:practiceDeck(catalog,'mage')},cb)));
    // Simulate only reward ledger failure: room snapshots still succeed.
    store.recordMatch=async()=>{throw new Error('fixture: ledger temporarily unavailable');};
    const room=(server.rooms as unknown as {rooms:Map<string,{state:GameState}>}).rooms.get(session.code)!;
    room.state.phase='playing';room.state.activePlayer=0;room.state.players.forEach(p=>p.mulliganDone=true);room.state.players[0].mana=2;room.state.players[0].maxMana=2;room.state.players[1].health=1;
    const final=success(await ack<RoomView>(cb=>client.emit('room:action',{revision:room.state.revision,action:{type:'heroPower',target:{kind:'hero',player:1}}},cb)));assert.equal(final.ranked?.reward,'pending');
    const snapshots=await store.loadRoomSnapshots();assert.equal(snapshots[0].pending.length,1);assert.equal((await store.session(account.token))?.profile.xp,0);
    await server.close();store.close();store=new LocalAccountStore(path,growth);server=await open(store,await store.loadRoomSnapshots());
    const deadline=Date.now()+2000;while((await store.session(account.token))?.profile.xp!==30&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal((await store.session(account.token))?.profile.xp,30);await server.close();store.close();store=new LocalAccountStore(path,growth);server=await open(store,await store.loadRoomSnapshots());
    await new Promise(resolve=>setTimeout(resolve,60));assert.equal((await store.session(account.token))?.profile.xp,30);
  }finally{await server.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test('account game success waits for durable write and a catalogue-incompatible room does not revive',async()=>{
  const store=new LocalAccountStore(':memory:',growth),server=await open(store);
  try{
    const account=await store.register('wait@example.test','test-password'),client=await server.client(account.token);
    let release!:()=>void,entered!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
    const save=store.saveRoomSnapshot.bind(store);store.saveRoomSnapshot=async(snapshot)=>{entered();await held;await save(snapshot);};
    let finished=false;const request=ack<Session>(cb=>client.emit('room:ranked',{deck:practiceDeck(catalog,'warrior')},cb)).then(result=>{finished=true;return result;});
    await started;assert.equal(finished,false);assert.equal((await store.loadRoomSnapshots()).length,0);release();const room=success(await request);assert.equal((await store.loadRoomSnapshots())[0].code,room.code);
    const snapshot=(await store.loadRoomSnapshots())[0],differentVersion=new RoomService(catalog);
    assert.equal(differentVersion.restoreAccountSnapshot(snapshot,'0'.repeat(64)),false);assert.throws(()=>differentVersion.resumeAccount('phone',account.account.id),/이어할/);
  }finally{await server.close();store.close();}
});
test('PvP result keeps both independent account awards through a partial ledger outage and restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-pvp-history-')),path=join(dir,'accounts.sqlite');let store=new LocalAccountStore(path,growth);let server=await open(store);
  try{
    const [first,second]=await Promise.all([store.register('pvp-first@example.test','test-password'),store.register('pvp-second@example.test','test-password')]);
    const a=await server.client(first.token),b=await server.client(second.token),deck=practiceDeck(catalog,'warrior');
    const session=success(await ack<Session>(cb=>a.emit('room:owned-create',{deck},cb)));success(await ack<Session>(cb=>b.emit('room:owned-join',{code:session.code,deck},cb)));
    const record=store.recordMatch.bind(store);store.recordMatch=async(id,...args)=>{if(id===second.account.id)throw new Error('fixture: one account ledger temporarily unavailable');return record(id,...args);};
    success(await ack<null>(cb=>a.emit('room:leave',cb)));
    const deadline=Date.now()+2000;while(!(await store.session(first.token))?.profile.matchStats?.pvp.losses&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal((await store.session(first.token))?.profile.matchStats?.pvp.losses,1);assert.equal((await store.session(second.token))?.profile.matchStats?.pvp.wins,undefined);
    await server.close();store.close();store=new LocalAccountStore(path,growth);server=await open(store,await store.loadRoomSnapshots());
    const until=Date.now()+2000;while(!(await store.session(second.token))?.profile.matchStats?.pvp.wins&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
    const p1=(await store.session(first.token))?.profile,p2=(await store.session(second.token))?.profile;assert.equal(p1?.matchStats?.pvp.losses,1);assert.equal(p2?.matchStats?.pvp.wins,1);assert.equal(p1?.recentMatches?.[0].matchId,p2?.recentMatches?.[0].matchId);assert.equal(p1?.xp,0);assert.equal(p2?.xp,0);
  }finally{await server.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test('restore fails closed rather than discarding valid rooms when startup capacity is lower',()=>{
  let now=100000000;const source=new RoomService(catalog,{clock:()=>now}),hash='a'.repeat(64),deck=practiceDeck(catalog,'warrior');
  const account=(id:string)=>({id,email:id+'@example.test',role:'player' as const,profile:newProfile()});
  const first=source.createRanked('pc',{deck},account('first'),growth),second=source.createRanked('mobile',{deck},account('second'),growth);
  const a=source.accountSnapshot(first.code,hash)!,b=source.accountSnapshot(second.code,hash)!;
  const restored=new RoomService(catalog,{clock:()=>now,maxRooms:1});assert.equal(restored.restoreAccountSnapshot(a,hash),true);assert.throws(()=>restored.restoreAccountSnapshot(b,hash),/서버 한도/);
  const duplicate=new RoomService(catalog,{clock:()=>now});assert.equal(duplicate.restoreAccountSnapshot(a,hash),true);const reused=structuredClone(b);reused.room!.members[0]!.accountId='first';reused.room!.ranked!.accountId='first';assert.throws(()=>duplicate.restoreAccountSnapshot(reused,hash),/이미 이 계정/);
  now+=25*60*60*1000;const expired=new RoomService(catalog,{clock:()=>now,maxRooms:1});assert.equal(expired.restoreAccountSnapshot(a,hash),false);assert.equal(expired.restoreAccountSnapshot(b,hash),false);
});
test('duplicate or malformed stored awards stop restoration without double-counting',()=>{
  const hash='a'.repeat(64),award={matchId:'same-result',rank:1,heroClass:'warrior' as const,outcome:'win' as const,eligible:true},result={accountId:'fixture',code:'ABC234',award};
  const snapshot:AccountRoomSnapshot={schema:1,code:result.code,catalogHash:hash,room:null,pending:[result]};
  const rooms=new RoomService(catalog);assert.equal(rooms.restoreAccountSnapshot(snapshot,hash),false);
  assert.throws(()=>rooms.restoreAccountSnapshot({...snapshot,code:'XYZ234',pending:[{...result,code:'XYZ234'}]},hash),/Duplicate pending/);
  assert.throws(()=>new RoomService(catalog).restoreAccountSnapshot({...snapshot,pending:[{...result,award:{...award,rank:99}}]},hash),/Invalid pending/);
});
test('restored ranked battles retain generated hero-power minions and can summon them again',()=>{
  const hash='a'.repeat(64),account={id:'hero-token-player',email:'test@example.test',role:'player' as const,profile:newProfile()};
  for(const heroClass of ['paladin','shaman'] as const){
    const source=new RoomService(catalog),deck=practiceDeck(catalog,heroClass),session=source.createRanked('pc',{deck},account,growth);
    const stateOf=(service:RoomService)=>(service as unknown as {rooms:Map<string,{state:GameState}>}).rooms.get(session.code)!.state;
    const prepare=(state:GameState)=>{state.phase='playing';state.activePlayer=0;state.turn=4;state.players.forEach(player=>player.mulliganDone=true);state.players[0].mana=2;state.players[0].maxMana=2;state.players[0].heroPowerUsed=false;};
    prepare(stateOf(source));source.act('pc',{revision:stateOf(source).revision,action:{type:'heroPower'}});
    const generated=stateOf(source).players[0].board[0].cardId;assert.ok(generated.startsWith('__'));assert.ok(!catalog[generated]);
    const snapshot=source.accountSnapshot(session.code,hash)!,restored=new RoomService(catalog);assert.equal(restored.restoreAccountSnapshot(snapshot,hash),true);restored.resumeAccount('phone',account.id);
    assert.ok(stateOf(restored).catalog[generated]);assert.equal(stateOf(restored).players[0].board[0].cardId,generated);
    prepare(stateOf(restored));restored.act('phone',{revision:stateOf(restored).revision,action:{type:'heroPower'}});
    assert.equal(stateOf(restored).players[0].board.length,2);assert.equal(restored.view('phone').state?.self.board.length,2);
  }
});
test('corrupt stored battle metadata fails closed without partially inserting pending rewards',()=>{
  const hash='a'.repeat(64),source=new RoomService(catalog),account={id:'fixture',email:'test@example.test',role:'player' as const,profile:newProfile()},deck=practiceDeck(catalog,'warrior'),session=source.createRanked('pc',{deck},account,growth);
  const valid=source.accountSnapshot(session.code,hash)!;
  for(const corrupt of [
    (s:AccountRoomSnapshot)=>{s.room!.ranked!.accountId='foreign';},
    (s:AccountRoomSnapshot)=>{s.room!.members[0].token='bad';},
    (s:AccountRoomSnapshot)=>{s.room!.state!.players[0].hand[0].cardId='missing-card';},
    (s:AccountRoomSnapshot)=>{s.room!.state!.players[0].mana=NaN;},
    (s:AccountRoomSnapshot)=>{s.room!.developerTest={rank:1,deckPower:1,intelligence:1};},
    (s:AccountRoomSnapshot)=>{s.room!.bot!.difficulty=99 as never;}
  ]){
    const invalid=structuredClone(valid);corrupt(invalid);const restored=new RoomService(catalog);assert.throws(()=>restored.restoreAccountSnapshot(invalid,hash),/Invalid stored room/);assert.equal(restored.metrics().total,0);assert.deepEqual(restored.pendingRankedResults(),[]);
  }
  const invalidPending=structuredClone(valid);invalidPending.pending.push({accountId:account.id,code:session.code,award:{matchId:valid.room!.ranked!.matchId,rank:1,heroClass:'warrior',outcome:'win',eligible:true}});
  const restored=new RoomService(catalog);assert.throws(()=>restored.restoreAccountSnapshot(invalidPending,hash),/pending result relationship/);assert.equal(restored.metrics().total,0);assert.deepEqual(restored.pendingRankedResults(),[]);assert.equal(restored.restoreAccountSnapshot(valid,hash),true);
});
