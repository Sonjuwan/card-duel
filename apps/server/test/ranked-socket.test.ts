import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import {createDuelServer,loadCatalog} from '../server.ts';
import {LocalAccountStore} from '../account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {practiceDeck,validateDeck} from '../../../packages/engine/src/index.ts';
import type {GameState} from '../../../packages/engine/src/index.ts';
import type {ClientEvents,ServerEvents,Result,RoomView,Session} from '../../../packages/protocol.ts';
type Client=Socket<ServerEvents,ClientEvents>;
const ack=<T>(fn:(cb:(r:Result<T>)=>void)=>void)=>new Promise<Result<T>>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('ack timeout')),5000);fn(r=>{clearTimeout(timer);resolve(r);});});
const success=<T>(r:Result<T>)=>{assert.ok(r.ok,r.ok?'':r.error);return r.data;};
function waitReward(client:Client,reward:'saved'|'notEligible'){return new Promise<RoomView>((resolve,reject)=>{const timer=setTimeout(()=>{client.off('room:view',listener);reject(new Error('reward timeout'));},5000);function listener(view:RoomView){if(view.ranked?.reward!==reward)return;clearTimeout(timer);client.off('room:view',listener);resolve(view);}client.on('room:view',listener);});}

test('ranked socket authenticates account, enforces owned cards, ignores client difficulty, settles once and blocks other accounts from resume',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth);
  const {http,io,rooms}=createDuelServer(catalog,{accounts:store,growth,botDelayMs:10000});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const player=await store.register('ranked@example.test','test-password'),duplicate=await store.login('ranked@example.test','test-password'),other=await store.register('other@example.test','test-password');
  const clients:Client[]=[];const socket=async(token?:string)=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  try{
    const [guest,a,b,intruder]=await Promise.all([socket(),socket(player.token),socket(duplicate.token),socket(other.token)]);
    const deck=practiceDeck(catalog,'mage');assert.equal((await ack<Session>(cb=>guest.emit('room:ranked',{deck},cb))).ok,false);
    const locked=growth.unlocks.find(c=>{const card=catalog[c.cardId];return card.kind!=='coin'&&(card.class==='neutral'||card.class==='mage');})!;
    const illegal={...deck,cards:[...deck.cards.slice(1),locked.cardId]};validateDeck(illegal,catalog);assert.equal((await ack<Session>(cb=>a.emit('room:ranked',{deck:illegal},cb))).ok,false);
    const start=success(await ack<Session>(cb=>a.emit('room:ranked',{deck,...{difficulty:25,rank:25}},cb)));
    const initial=success(await ack<RoomView>(cb=>a.emit('room:sync',cb)));assert.equal(initial.ranked?.rank,1);assert.equal(initial.botDifficulty,1);assert.equal(initial.ranked?.deckPower,1);
    assert.equal((await ack<Session>(cb=>b.emit('room:ranked',{deck},cb))).ok,false);
    assert.equal((await ack<Session>(cb=>intruder.emit('room:resume',{code:start.code,token:start.token},cb))).ok,false);
    const restored=success(await ack<Session>(cb=>b.emit('room:resume',{code:start.code,token:start.token},cb)));assert.equal(restored.code,start.code);
    assert.equal((await ack<RoomView>(cb=>a.emit('room:sync',cb))).ok,false);
    // Narrow fixture: arrange a natural lethal mage hero power without waiting many turns.
    const room=(rooms as unknown as {rooms:Map<string,{state:GameState}>}).rooms.get(start.code)!;
    room.state.phase='playing';room.state.activePlayer=0;room.state.players.forEach(p=>p.mulliganDone=true);room.state.players[0].mana=2;room.state.players[0].maxMana=2;room.state.players[1].health=1;
    success(await ack<null>(cb=>a.emit('account:watch',cb)));const changed=new Promise<void>(resolve=>a.once('account:changed',()=>resolve()));
    const saved=waitReward(b,'saved');success(await ack<RoomView>(cb=>b.emit('room:action',{revision:room.state.revision,action:{type:'heroPower',target:{kind:'hero',player:1}}},cb)));const reward=await saved;assert.equal(reward.ranked?.rewardDetails?.xp,30);assert.equal(reward.ranked?.rewardDetails?.rankAfter,1);assert.ok(reward.ranked?.rewardDetails?.unlockedCards?.length);assert.equal(reward.ranked?.rewardDetails?.questAdvanced,false);await changed;
    const earned=await store.session(player.token);assert.equal(earned?.profile.xp,30);assert.equal(earned?.profile.rankWins,1);assert.equal(earned?.profile.questGames,0);assert.equal(earned?.profile.matchStats?.ranked.wins,1);assert.equal(earned?.profile.recentMatches?.[0].xp,30);
    success(await ack<RoomView>(cb=>b.emit('room:sync',cb)));assert.equal((await store.session(player.token))?.profile.xp,30);
    success(await ack<null>(cb=>b.emit('room:leave',cb)));
    const second=success(await ack<Session>(cb=>b.emit('room:ranked',{deck:practiceDeck(catalog,'warrior')},cb)));
    const noReward=waitReward(b,'notEligible');success(await ack<RoomView>(cb=>b.emit('room:action',{revision:0,action:{type:'concede'}},cb)));const denied=await noReward;assert.equal(denied.ranked?.rewardDetails?.xp,0);assert.deepEqual(denied.ranked?.rewardDetails?.unlockedCards,[]);
    assert.notEqual(second.code,start.code);assert.equal((await store.session(player.token))?.profile.xp,30);assert.equal((await store.session(player.token))?.profile.matchStats?.ranked.losses,1);assert.equal((await store.session(player.token))?.profile.recentMatches?.[0].xp,0);
  }finally{clients.forEach(c=>c.disconnect());await io.close();store.close();}
});
test('owned PvP separates guest rooms, matches two accounts, and transfers a live seat across devices',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth);
  const {http,io}=createDuelServer(catalog,{accounts:store,growth});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const users=await Promise.all([store.register('pvp1@example.test','test-password'),store.register('pvp2@example.test','test-password')]);const otherDevice=await store.login('pvp1@example.test','test-password');
  const clients:Client[]=[];const socket=async(token?:string)=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  const deck=practiceDeck(catalog,'warrior');
  try{
    const [a,b,phone,guest]=await Promise.all([socket(users[0].token),socket(users[1].token),socket(otherDevice.token),socket()]);
    const room=success(await ack<Session>(cb=>a.emit('room:owned-create',{deck},cb)));
    assert.equal((await ack<Session>(cb=>guest.emit('room:join',{code:room.code,deck},cb))).ok,false);
    assert.equal((await ack<Session>(cb=>phone.emit('room:owned-join',{code:room.code,deck},cb))).ok,false);
    const locked=growth.unlocks.find(c=>{const card=catalog[c.cardId];return card.kind!=='coin'&&(card.class==='neutral'||card.class==='warrior');})!;
    const illegal={...deck,cards:[...deck.cards.slice(1),locked.cardId]};assert.equal((await ack<Session>(cb=>b.emit('room:owned-join',{code:room.code,deck:illegal},cb))).ok,false);
    success(await ack<Session>(cb=>b.emit('room:owned-join',{code:room.code,deck},cb)));
    const before=success(await ack<RoomView>(cb=>a.emit('room:sync',cb)));assert.equal(before.ownedPvp,true);assert.equal(before.status,'playing');
    const transferred=success(await ack<Session>(cb=>phone.emit('room:account-resume',{},cb)));assert.equal(transferred.code,room.code);assert.notEqual(transferred.token,room.token);
    assert.deepEqual(success(await ack<RoomView>(cb=>phone.emit('room:sync',cb))).state,before.state);
    assert.equal((await ack<Session>(cb=>a.emit('room:resume',{code:room.code,token:room.token},cb))).ok,false);
    success(await ack<RoomView>(cb=>phone.emit('room:action',{revision:0,action:{type:'concede'}},cb)));
    success(await ack<null>(cb=>phone.emit('room:leave',cb)));success(await ack<null>(cb=>b.emit('room:leave',cb)));
    assert.equal((await store.session(users[0].token))?.profile.xp,0);assert.equal((await store.session(users[1].token))?.profile.xp,0);
    const loser=(await store.session(users[0].token))?.profile,winner=(await store.session(users[1].token))?.profile;assert.equal(loser?.matchStats?.pvp.losses,1);assert.equal(winner?.matchStats?.pvp.wins,1);assert.equal(loser?.recentMatches?.[0].matchId,winner?.recentMatches?.[0].matchId);assert.equal(winner?.recentMatches?.[0].xp,0);
    const first=success(await ack<Session>(cb=>a.emit('room:owned-match',{deck},cb))),second=success(await ack<Session>(cb=>b.emit('room:owned-match',{deck},cb)));
    assert.equal(first.code,second.code);assert.equal(success(await ack<RoomView>(cb=>b.emit('room:sync',cb))).status,'playing');
  }finally{clients.forEach(c=>c.disconnect());await io.close();store.close();}
});
test('developer-only trial uses actual configured tier with unowned cards, forbids player access and awards nothing',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),{http,io}=createDuelServer(catalog,{accounts:store,growth,botDelayMs:60000});
  http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const [dev,player]=await Promise.all([store.register('developer@example.test','test-password'),store.register('player@example.test','test-password')]);store.setRole(dev.account.email,'developer');
  const clients:Client[]=[];const socket=async(token?:string)=>{const c:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;};
  try{
    const [a,b,guest,phone]=await Promise.all([socket(dev.token),socket(player.token),socket(),socket(dev.token)]),base=practiceDeck(catalog,'mage');
    const locked=growth.unlocks.find(c=>{const card=catalog[c.cardId];return card.kind!=='coin'&&(card.class==='neutral'||card.class==='mage');})!;
    const deck={...base,cards:[...base.cards.slice(1),locked.cardId]},rank=25;
    assert.equal((await ack<Session>(cb=>guest.emit('room:developer-test',{deck,rank},cb))).ok,false);
    assert.equal((await ack<Session>(cb=>b.emit('room:developer-test',{deck,rank},cb))).ok,false);
    assert.equal((await ack<Session>(cb=>a.emit('room:developer-test',{deck,rank:26},cb))).ok,false);
    assert.equal((await ack<Session>(cb=>a.emit('room:ranked',{deck},cb))).ok,false);
    const session=success(await ack<Session>(cb=>a.emit('room:developer-test',{deck,rank},cb))),view=success(await ack<RoomView>(cb=>a.emit('room:sync',cb)));
    assert.deepEqual(view.developerTest,{rank,deckPower:growth.ranks[24].deckPower,intelligence:growth.ranks[24].intelligence});assert.equal(view.ranked,undefined);
    assert.equal((await ack<Session>(cb=>b.emit('room:resume',{code:session.code,token:session.token},cb))).ok,false);
    store.setRole(dev.account.email,'player');assert.equal((await ack<Session>(cb=>phone.emit('room:resume',{code:session.code,token:session.token},cb))).ok,false);assert.equal((await ack<Session>(cb=>phone.emit('room:account-resume',{},cb))).ok,false);
    store.setRole(dev.account.email,'developer');success(await ack<Session>(cb=>phone.emit('room:account-resume',{},cb)));
    const finished=success(await ack<RoomView>(cb=>phone.emit('room:action',{revision:view.state!.revision,action:{type:'concede'}},cb)));assert.equal(finished.state?.phase,'finished');assert.equal(finished.ranked,undefined);
    const profile=(await store.session(dev.token))?.profile;assert.equal(profile?.xp,0);assert.equal(profile?.rank,1);assert.equal(profile?.matchStats,undefined);assert.equal(profile?.questGames,0);
  }finally{clients.forEach(c=>c.disconnect());await io.close();store.close();}
});
