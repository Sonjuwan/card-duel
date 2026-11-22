import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {Action} from '../../../packages/engine/src/index.ts';
import {applyAction,createGame,getPlayerView,practiceDeck,rankBotActions} from '../../../packages/engine/src/index.ts';
import type {ClientEvents,ServerEvents,Result,RoomView,Session} from '../../../packages/protocol.ts';
import {WorkerBotExecutor} from '../bot-executor.ts';
import type {BotExecutor,BotJob} from '../bot-executor.ts';
import {createDuelServer,loadCatalog} from '../server.ts';

const catalog=loadCatalog();
test('raw collectible catalogue and real worker handle paladin and shaman hero-power tokens',async()=>{
  assert.equal(catalog.__squire,undefined);
  let game=createGame(catalog,[practiceDeck(catalog,'paladin'),practiceDeck(catalog,'shaman')],{seed:123,firstPlayer:0});
  game=applyAction(game,0,{type:'mulligan',replace:[]});game=applyAction(game,1,{type:'mulligan',replace:[]});
  game.players[0].mana=game.players[0].maxMana=2;game=applyAction(game,0,{type:'heroPower'});game=applyAction(game,0,{type:'endTurn'});
  game.players[1].mana=game.players[1].maxMana=2;game=applyAction(game,1,{type:'heroPower'});
  assert.ok(game.players[0].board.some(m=>m.cardId==='__squire'));assert.ok(game.players[1].board.some(m=>m.cardId.endsWith('_totem')));
  game.players[1].mana=2;game.players[1].heroPowerUsed=false;
  const view=getPlayerView(game,1),expected=rankBotActions(view,game.catalog,1,3);
  assert.deepEqual(rankBotActions(view,catalog,1,3),expected);assert.ok(expected.some(a=>a.type==='heroPower'));
  const executor=new WorkerBotExecutor(catalog,1);try{
    const actions=await executor.run({view,difficulty:3});assert.deepEqual(actions,expected);
    assert.ok(actions.length);assert.doesNotThrow(()=>applyAction(game,1,actions[0]));
  }finally{await executor.close();}
});
test('real bot worker computes identical projected-view mulligan actions and bounds queued tasks',async()=>{
  const executor=new WorkerBotExecutor(catalog,1);
  try{
    const game=createGame(catalog,[practiceDeck(catalog,'warrior'),practiceDeck(catalog,'mage')],{seed:123});const view=getPlayerView(game,1),job:BotJob={view,difficulty:25};
    const pending=executor.run(job);await assert.rejects(executor.run(job),/queue full/);
    assert.deepEqual(await pending,rankBotActions(view,catalog,1,25,{deadlineMs:1500}));
    assert.deepEqual(await executor.run({...job,difficulty:1}),rankBotActions(view,catalog,1,1,{deadlineMs:1500}));
  }finally{await executor.close();}
  await assert.rejects(executor.run({view:getPlayerView(createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'mage')],{seed:321}),1),difficulty:1}),/closed/);
});

test('AI can replay an actual bounced hero-power token from hand using the worker catalogue',async()=>{
  let game=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'paladin')],{seed:124,firstPlayer:1});
  game=applyAction(game,0,{type:'mulligan',replace:[]});game=applyAction(game,1,{type:'mulligan',replace:[]});
  game.players[1].mana=game.players[1].maxMana=2;game=applyAction(game,1,{type:'heroPower'});
  const token=game.players[1].board.find(m=>m.cardId==='__squire')!;
  game.players[1].hand.push({cardId:'dream',instanceId:'fixture-dream'});
  game=applyAction(game,1,{type:'playCard',instanceId:'fixture-dream',target:{kind:'minion',instanceId:token.instanceId}});
  assert.ok(game.players[1].hand.some(c=>c.instanceId===token.instanceId&&c.cardId==='__squire'));
  game.players[1].mana=1;const view=getPlayerView(game,1),executor=new WorkerBotExecutor(catalog,1);
  try{const actions=await executor.run({view,difficulty:3});const replay=actions.find(a=>a.type==='playCard'&&a.instanceId===token.instanceId);assert.ok(replay);const next=applyAction(game,1,replay);assert.ok(next.players[1].board.some(m=>m.cardId==='__squire'));}finally{await executor.close();}
});

test('cancelling queued and active AI work releases capacity and starts a fresh worker safely',async()=>{
  const game=createGame(catalog,[practiceDeck(catalog,'warrior'),practiceDeck(catalog,'mage')],{seed:128}),job:BotJob={view:getPlayerView(game,1),difficulty:25};
  const executor=new WorkerBotExecutor(catalog,2);try{
    const active=new AbortController(),queued=new AbortController();
    const a=assert.rejects(executor.run(job,active.signal),/cancelled/),b=assert.rejects(executor.run(job,queued.signal),/cancelled/);
    queued.abort();await b;active.abort();await a;
    await assert.rejects(executor.run(job,active.signal),/cancelled/);
    assert.ok((await executor.run(job)).length);
  }finally{await executor.close();}
});
test('queue wait time is bounded even when the current worker is still computing',async()=>{
  const game=createGame(catalog,[practiceDeck(catalog,'warrior'),practiceDeck(catalog,'mage')],{seed:129}),job:BotJob={view:getPlayerView(game,1),difficulty:25};
  const executor=new WorkerBotExecutor(catalog,2,6000,1);try{
    const active=executor.run(job);await assert.rejects(executor.run(job),/queue timed out/);assert.ok((await active).length);assert.ok((await executor.run(job)).length);
  }finally{await executor.close();}
});
test('waiting for an AI worker never blocks another live socket; stale response after concede is discarded',{timeout:15000},async()=>{
  let entered!:(job:BotJob)=>void,release!:(actions:Action[])=>void,signal:AbortSignal|undefined;const started=new Promise<BotJob>(resolve=>{entered=resolve;});
  const held=new Promise<Action[]>(resolve=>{release=resolve;});const runner:BotExecutor={run:async(job,abort)=>{signal=abort;entered(job);return held;},close:async()=>{release([{type:'mulligan',replace:[]}]);}};
  const {http,io}=createDuelServer(catalog,{botExecutor:runner,botDelayMs:0});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  type Client=Socket<ServerEvents,ClientEvents>;const clients:Client[]=[];const open=async()=>{const socket:Client=connect(url,{forceNew:true,transports:['websocket']});clients.push(socket);await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const ack=<T>(fn:(cb:(result:Result<T>)=>void)=>void)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('ack timeout')),2500);fn(r=>{clearTimeout(timer);if(r.ok)resolve(r.data);else reject(new Error(r.error));});});
  try{
    const [a,b]=await Promise.all([open(),open()]),deck=practiceDeck(catalog,'mage');await ack<Session>(cb=>a.emit('room:bot',{deck,heroClass:'warrior',difficulty:25},cb));
    const played=await ack<RoomView>(cb=>a.emit('room:action',{revision:0,action:{type:'mulligan',replace:[]}},cb));const job=await started;assert.equal(job.difficulty,25);assert.equal(job.view.self.heroClass,'warrior');
    const other=await ack<Session>(cb=>b.emit('room:create',deck,cb));assert.equal((await ack<RoomView>(cb=>b.emit('room:sync',cb))).code,other.code);
    const finished=await ack<RoomView>(cb=>a.emit('room:action',{revision:played.state!.revision,action:{type:'concede'}},cb));assert.equal(finished.state?.phase,'finished');assert.equal(signal?.aborted,true);
    release([{type:'mulligan',replace:[]}]);await new Promise(resolve=>setTimeout(resolve,30));const current=await ack<RoomView>(cb=>a.emit('room:sync',cb));assert.deepEqual(current.state,finished.state);
  }finally{clients.forEach(c=>c.disconnect());release([{type:'mulligan',replace:[]}]);await io.close();}
});
