import {once} from 'node:events';
import assert from 'node:assert/strict';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {Action} from '../../packages/engine/src/index.ts';
import {getHeroPower,heroPowerReason,legalPublicTargets,practiceDeck} from '../../packages/engine/src/index.ts';
import type {HeroClass} from '../../packages/engine/src/index.ts';
import {snapshotBattleCatalog} from '../../packages/engine/src/catalog-snapshot.ts';
import type {ClientEvents,ServerEvents,Result,RoomView,Session} from '../../packages/protocol.ts';
import {createDuelServer,loadCatalog} from '../server/server.ts';
import {LocalAccountStore} from '../server/account-store.ts';
import {loadGrowth} from '../server/growth-store.ts';
import {WorkerBotExecutor} from '../server/bot-executor.ts';
import {mergeRoomView} from '../client/src/storage.ts';

type Client=Socket<ServerEvents,ClientEvents>;
const count=Number(process.argv[2]??6),rounds=Number(process.argv[3]??3);
if(process.argv.length>4||!Number.isInteger(count)||count<2||count>12||!Number.isInteger(rounds)||rounds<1||rounds>8){console.error('사용법: npm run online:load -- [2~12 AI 동시 경기] [1~8 AI 진행 라운드]');process.exit(1);}
const catalog=loadCatalog(),growth=loadGrowth(catalog),store=new LocalAccountStore(':memory:',growth),executor=new WorkerBotExecutor(catalog);
const battleCatalog=snapshotBattleCatalog(catalog);
const {http,io,flush}=createDuelServer(catalog,{accounts:store,growth,botExecutor:executor,botDelayMs:0,sweepMs:50});
const clients:Client[]=[],latest=new Map<Client,RoomView>(),ackTimes:number[]=[],httpTimes:number[]=[];
let queuePeak=0,aiHeroPowers=0,pvpHeroPowers=0,heroTokenViews=0;
const loadClasses:HeroClass[]=['paladin','shaman','mage','warrior','priest','hunter','druid','rogue','warlock'];
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function wait<T>(fn:()=>T|undefined,timeout=40000):Promise<T>{const until=Date.now()+timeout;while(Date.now()<until){const value=fn();if(value!==undefined)return value;await delay(20);}throw new Error('load test wait timeout');}
const ack=<T>(fn:(cb:(r:Result<T>)=>void)=>void)=>new Promise<Result<T>>((resolve,reject)=>{const start=performance.now(),timer=setTimeout(()=>reject(new Error('socket ack timeout')),10000);fn(r=>{clearTimeout(timer);ackTimes.push(performance.now()-start);resolve(r);});});
const success=<T>(r:Result<T>)=>{assert.ok(r.ok,r.ok?'':r.error);return r.data;};
const current=(client:Client)=>latest.get(client);
function saveView(client:Client,view:RoomView){latest.set(client,mergeRoomView(current(client)??null,view));}
async function sync(client:Client){const view=success(await ack<RoomView>(cb=>client.emit('room:sync',cb)));saveView(client,view);return view;}
async function act(client:Client,action:Action){for(let retry=0;retry<10;retry++){const view=current(client)??await sync(client);const result=await ack<RoomView>(cb=>client.emit('room:action',{revision:view.state!.revision,action},cb));if(result.ok){saveView(client,result.data);return result.data;}if(result.code!=='staleRevision'&&result.code!=='rateLimit')throw new Error(result.error);await delay(20);await sync(client);}throw new Error('action retry limit');}
async function open(url:string,index:number,developer=false){
  const login=await store.register(`load-${index}@example.test`,'test-password');if(developer)store.setRole(login.account.email,'developer');
  const client:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:{Cookie:`duel_account=${login.token}`}});clients.push(client);client.on('room:view',view=>saveView(client,view));
  await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);});return {client,token:login.token,id:login.account.id,developer,index};
}
function observeTokens(view:RoomView){if(view.state?.self.board.some(m=>m.cardId.startsWith('__'))||view.state?.opponent.board.some(m=>m.cardId.startsWith('__')))heroTokenViews++;}
async function usePower(client:Client,view:RoomView):Promise<RoomView|undefined>{
  const s=view.state;if(!s||s.phase!=='playing'||s.activePlayer!==view.seat||s.choicePending||heroPowerReason(s.self))return;
  const power=getHeroPower(s.self);let action:Action={type:'heroPower'};
  if(power.targetRule){const targets=legalPublicTargets(s,view.seat,power.targetRule,battleCatalog,true),preferred=s.self.heroClass==='priest'?view.seat:1-view.seat;const target=targets.find(t=>t.kind==='hero'&&t.player===preferred)??targets[0];if(!target)return;action={type:'heroPower',target};}
  const result=await act(client,action);observeTokens(result);return result;
}
async function aiMatch(user:Awaited<ReturnType<typeof open>>){
  const {client,developer,id,index}=user,deck=practiceDeck(catalog,loadClasses[index%loadClasses.length]);
  if(developer)success(await ack<Session>(cb=>client.emit('room:developer-test',{rank:25,deck,expectedAccountId:id},cb)));else success(await ack<Session>(cb=>client.emit('room:ranked',{deck,expectedAccountId:id},cb)));
  await sync(client);await act(client,{type:'mulligan',replace:[]});
  let next=await wait(()=>{const v=current(client);return v?.state?.phase==='playing'&&v.state.activePlayer===0?v:undefined;});
  assert.equal(next.botDifficulty,developer?25:1);
  for(let round=0;round<rounds&&next.status!=='finished';round++){
    const powered=await usePower(client,next);if(powered){aiHeroPowers++;next=powered;if(next.status==='finished')break;}
    const first=next;await act(client,{type:'endTurn'});
    next=await wait(()=>{const v=current(client);return v?.state&&v.state.revision>first.state!.revision&&(v.state.phase==='finished'||v.state.phase==='playing'&&v.state.activePlayer===0)?v:undefined;});
    assert.ok(next.state!.turn>first.state!.turn||next.state?.phase==='finished');
  }
  if(next.status!=='finished')await act(client,{type:'concede'});
  if(!developer)await wait(()=>{const v=current(client);return v?.ranked?.reward!==undefined&&v.ranked.reward!=='pending'?v:undefined;});
  const final=await store.session(user.token);assert.ok(final);if(developer)assert.equal(final.profile.matchStats?.ranked.losses,undefined);else assert.equal((final.profile.matchStats?.ranked.losses??0)+(final.profile.matchStats?.ranked.wins??0)+(final.profile.matchStats?.ranked.draws??0),1);
}
async function pvpMatch(a:Awaited<ReturnType<typeof open>>,b:Awaited<ReturnType<typeof open>>){
  const deck=practiceDeck(catalog,'paladin'),opponent=practiceDeck(catalog,'shaman'),session=success(await ack<Session>(cb=>a.client.emit('room:owned-create',{deck,expectedAccountId:a.id},cb)));
  success(await ack<Session>(cb=>b.client.emit('room:owned-join',{code:session.code,deck:opponent,expectedAccountId:b.id},cb)));
  await sync(a.client);await sync(b.client);await act(a.client,{type:'mulligan',replace:[]});await sync(b.client);await act(b.client,{type:'mulligan',replace:[]});
  for(let turn=0;turn<4;turn++){
    const ready=await sync(a.client);assert.equal(ready.state?.phase,'playing');const active=ready.state!.activePlayer===ready.seat?a.client:b.client;
    const own=await sync(active);if(await usePower(active,own))pvpHeroPowers++;await act(active,{type:'endTurn'});await sync(a.client);await sync(b.client);
  }
  assert.equal(pvpHeroPowers,2,'both human-controlled classes used their hero power');
  assert.ok(current(a.client)?.state?.self.board.some(m=>m.cardId==='__squire'));assert.ok(current(a.client)?.state?.opponent.board.some(m=>m.cardId.endsWith('_totem')));
  assert.equal(current(a.client)?.state?.revision,current(b.client)?.state?.revision);await act(a.client,{type:'concede'});
  await wait(()=>current(a.client)?.pvpReward==='saved'&&current(b.client)?.pvpReward==='saved'?true:undefined);
  const [before,after]=await Promise.all([store.session(a.token),store.session(b.token)]);assert.equal(before?.profile.matchStats?.pvp.losses,1);assert.equal(after?.profile.matchStats?.pvp.wins,1);assert.equal(before?.profile.xp,0);assert.equal(after?.profile.xp,0);
}
function summarize(values:number[]){const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,p95Ms:Math.round(sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0),maxMs:Math.round(sorted.at(-1)??0)};}
http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`,start=performance.now();
const monitor=setInterval(()=>{queuePeak=Math.max(queuePeak,executor.stats().queued);},5);
try{
  const users=await Promise.all(Array.from({length:count+2},(_,i)=>open(url,i,i<count&&i%2===0)));
  const a=users[count],b=users[count+1];
  let aiFinished=false;
  const results=await Promise.all([Promise.all(users.slice(0,count).map(aiMatch)).finally(()=>{aiFinished=true;}),pvpMatch(a,b),(async()=>{for(let i=0;(i<20||!aiFinished)&&i<500;i++){const clock=performance.now();const response=await fetch(url+'/api/account/me',{headers:{Cookie:`duel_account=${a.token}`,'X-Card-Duel-Account':a.id}});assert.equal(response.status,200);assert.equal((await response.json()).id,a.id);httpTimes.push(performance.now()-clock);await delay(50);}})()]);
  const developer=await fetch(url+'/api/account/developer',{headers:{Cookie:`duel_account=${users[0].token}`,'X-Card-Duel-Account':users[0].id}});assert.equal(developer.status,200);const runtime=(await developer.json()).runtime;assert.equal(runtime.rooms.total,count+1);assert.equal(runtime.failedRoomWrites,0);assert.equal(runtime.pendingResults,0);
  assert.ok(results);console.log(JSON.stringify({aiGames:count,level25Games:Math.ceil(count/2),humanClasses:[...new Set(users.slice(0,count).map(x=>loadClasses[x.index%loadClasses.length]))],rounds,pvpGames:1,aiHeroPowers,pvpHeroPowers,heroTokenViews,connectedClients:clients.length,aiQueuePeak:queuePeak,socketAck:summarize(ackTimes),http:summarize(httpTimes),durationMs:Math.round(performance.now()-start),rssMiB:Math.round(process.memoryUsage.rss()/1024/1024),note:'local synthetic fixture, not production capacity or AI strength'},null,2));
}finally{clearInterval(monitor);clients.forEach(client=>client.disconnect());await io.close();await flush();await executor.close();store.close();}
