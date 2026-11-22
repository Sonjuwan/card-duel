import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync,cpSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {LocalAccountStore} from '../../server/account-store.ts';
import {loadCatalog} from '../../server/server.ts';
import {loadGrowth} from '../../server/growth-store.ts';
import {runOnlineSmoke} from '../../cli/online-smoke.ts';
import {practiceDeck} from '../../../packages/engine/src/index.ts';
import type {AccountView,DeveloperStatus} from '../../../packages/account-protocol.ts';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {ClientEvents,ServerEvents,Result,Session,RoomView} from '../../../packages/protocol.ts';

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
type Client=Socket<ServerEvents,ClientEvents>;
const ack=<T>(send:(reply:(result:Result<T>)=>void)=>void)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('socket acknowledgement timed out')),5000);send(result=>{clearTimeout(timer);if(result.ok)resolve(result.data);else reject(new Error(result.error));});});
async function freePort(){const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const address=listener.address();assert.ok(address&&typeof address==='object');await new Promise<void>((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));return address.port;}
async function stop(child:ChildProcess){
  if(child.exitCode!==null||child.signalCode!==null)return;
  const exited=once(child,'exit');child.kill('SIGTERM');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const result=await Promise.race([exited,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('server shutdown timed out')),5000);})]);assert.deepEqual(result,[0,null]);}
  catch(error){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}throw error;}
  finally{if(timer)clearTimeout(timer);}
}
test('production entry starts from an existing database, keeps maintenance and account progress over graceful restarts',{timeout:45000},async()=>{
  const catalog=loadCatalog(),growth=loadGrowth(catalog),directory=mkdtempSync(join(tmpdir(),'duel-server-process-')),db=join(directory,'test.sqlite');
  const password='fixture-password',email='process-test@example.test';let account!:AccountView,originalToken='';
  const fixture=new LocalAccountStore(db,growth);
  try{
    const login=await fixture.register(email,password);originalToken=login.token;fixture.setRole(email,'developer');
    await fixture.updateDecks(login.account.id,login.account.profile.revision,[{name:'test deck',deck:practiceDeck(catalog,'warrior')}]);
    account=await fixture.recordMatch(login.account.id,{matchId:randomUUID(),rank:1,heroClass:'warrior',eligible:true,outcome:'win'},growth);
  }finally{fixture.close();}
  const root=fileURLToPath(new URL('../../../',import.meta.url)),port=await freePort(),url=`http://127.0.0.1:${port}`;
  let child:ChildProcess|undefined;
  const start=async()=>{
    const env={...process.env,PORT:String(port),CARD_DUEL_HOST:'127.0.0.1',CARD_DUEL_PUBLIC_DEPLOY:'0',CARD_DUEL_PUBLIC_ORIGIN:'',CARD_DUEL_ACCOUNT_BACKEND:'local',CARD_DUEL_ACCOUNT_DB:db,CARD_DUEL_MAINTENANCE:'1'};
    child=spawn(process.execPath,['apps/server/main.ts'],{cwd:root,env,stdio:['ignore','ignore','ignore']});
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
      if(child.exitCode!==null||child.signalCode!==null)throw new Error('production server exited before health check');
      try{if((await fetch(url+'/healthz',{signal:AbortSignal.timeout(500)})).ok)return;}catch{/* still starting */}
      await pause(50);
    }
    throw new Error('production server health check timed out');
  };
  const headers={Cookie:`duel_account=${originalToken}`};
  const socket=async(cookie=headers.Cookie)=>{const client:Client=connect(url,{forceNew:true,reconnection:false,transports:['websocket'],extraHeaders:{Cookie:cookie}});await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);});return client;};
  const status=async()=>{const res=await fetch(url+'/api/account/developer',{headers});assert.equal(res.status,200);return (await res.json() as DeveloperStatus).runtime!;};
  const toggle=async(enabled:boolean)=>{const res=await fetch(url+'/api/account/developer/maintenance',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({enabled})});assert.equal(res.status,200);};
  try{
    await start();assert.equal((await status()).readyForPatch,true);
    const smoke=await runOnlineSmoke(url,{email,password});assert.equal(typeof smoke.accountCheck==='object'?smoke.accountCheck.role:null,'developer');
    await toggle(false);
    const pc=await socket();let game!:Session,revision=0;
    try{game=await ack<Session>(reply=>pc.emit('room:ranked',{deck:practiceDeck(catalog,'warrior')},reply));const view=await ack<RoomView>(reply=>pc.emit('room:sync',reply));revision=view.state!.revision;await ack<null>(reply=>pc.emit('room:account-pause',reply));}finally{pc.disconnect();}
    await stop(child!);child=undefined;
    await start();assert.equal((await status()).maintenance,false);const me=await fetch(url+'/api/account/me',{headers});assert.equal(me.status,200);assert.deepEqual((await me.json() as AccountView).profile,account.profile);
    const active=await fetch(url+'/api/account/active-room',{headers});assert.equal(active.status,200);assert.deepEqual((await active.json()).room,{mode:'ranked',status:'playing',connected:false,rank:account.profile.rank,resumeAllowed:true});
    const login=await fetch(url+'/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(login.status,200);
    const phoneCookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(phoneCookie&&phoneCookie!==headers.Cookie);await login.body?.cancel();
    const phone=await socket(phoneCookie);
    try{
      const resumed=await ack<Session>(reply=>phone.emit('room:account-resume',{},reply));assert.equal(resumed.code,game.code);const view=await ack<RoomView>(reply=>phone.emit('room:sync',reply));assert.ok(view.state!.revision>=revision);
      const result=await ack<RoomView>(reply=>phone.emit('room:action',{revision:view.state!.revision,action:{type:'concede'}},reply));assert.equal(result.state?.phase,'finished');
      const until=Date.now()+5000;let reward=result.ranked?.reward;while(reward==='pending'&&Date.now()<until){await pause(20);reward=(await ack<RoomView>(reply=>phone.emit('room:sync',reply))).ranked?.reward;}assert.equal(reward,'notEligible');
      await ack<null>(reply=>phone.emit('room:leave',reply));
    }finally{phone.disconnect();const logout=await fetch(url+'/api/account/logout',{method:'POST',headers:{Cookie:phoneCookie,'Content-Type':'application/json'},body:'{}'});assert.equal(logout.status,200);}
    await toggle(true);const until=Date.now()+5000;while(!(await status()).readyForPatch&&Date.now()<until)await pause(20);assert.equal((await status()).readyForPatch,true);await stop(child!);child=undefined;
    await start();assert.equal((await status()).readyForPatch,true);
  }finally{if(child)await stop(child);rmSync(directory,{recursive:true,force:true});}
});

test('isolated production source upgrade and rollback apply new card and growth versions without losing earned account data',{timeout:45000},async()=>{
  const source=fileURLToPath(new URL('../../../',import.meta.url)),directory=mkdtempSync(join(tmpdir(),'duel-patch-process-')),root=join(directory,'source'),db=join(directory,'fixture.sqlite'),port=await freePort(),origin=`http://127.0.0.1:${port}`;
  const catalog=loadCatalog(),growth=loadGrowth(catalog),locked=growth.unlocks.at(-1)!.cardId,email='patch-process@example.test',password='fixture-password';
  let child:ChildProcess|undefined,token='';
  const start=async()=>{
    child=spawn(process.execPath,['apps/server/main.ts'],{cwd:root,env:{...process.env,PORT:String(port),CARD_DUEL_HOST:'127.0.0.1',CARD_DUEL_PUBLIC_DEPLOY:'0',CARD_DUEL_PUBLIC_ORIGIN:'',CARD_DUEL_ACCOUNT_BACKEND:'local',CARD_DUEL_ACCOUNT_DB:db,CARD_DUEL_MAINTENANCE:'1'},stdio:['ignore','ignore','ignore']});
    const deadline=Date.now()+10000;while(Date.now()<deadline){if(child.exitCode!==null||child.signalCode!==null)throw new Error('isolated server exited before health check');try{if((await fetch(origin+'/healthz',{signal:AbortSignal.timeout(500)})).ok)return;}catch{}await pause(50);}throw new Error('isolated server health check timed out');
  };
  const get=async<T>(path:string)=>{const result=await fetch(origin+path,{headers:{Cookie:`duel_account=${token}`}});assert.equal(result.status,200);return result.json() as Promise<T>;};
  type Version={version:string;catalogHash:string;growthHash:string};
  try{
    mkdirSync(join(root,'apps'),{recursive:true});mkdirSync(join(root,'data'),{recursive:true});
    for(const path of ['apps/server','packages','data/cards','data/progression','data/ai-release','package.json'])cpSync(join(source,path),join(root,path),{recursive:true});
    symlinkSync(join(source,'node_modules'),join(root,'node_modules'),'junction');
    // Only these copied files will be modified. The real card data, growth
    // configuration and AI training directory are never written by this test.
    const manifest=JSON.parse(readFileSync(join(root,'data/cards/active.json'),'utf8')) as {file:string},cardPath=join(root,'data/cards',manifest.file),growthPath=join(root,'data/progression/online.json'),versionPath=join(root,'package.json');
    const cardBytes=readFileSync(cardPath,'utf8'),growthBytes=readFileSync(growthPath,'utf8'),versionBytes=readFileSync(versionPath,'utf8');
    const store=new LocalAccountStore(db,growth);
    try{const registration=await store.register(email,password);token=registration.token;await store.updateDecks(registration.account.id,registration.account.profile.revision,[{name:'이전 패치 덱',deck:practiceDeck(catalog,'warrior')}]);await store.recordMatch(registration.account.id,{matchId:randomUUID(),rank:1,heroClass:'warrior',outcome:'win',eligible:true},growth);}finally{store.close();}
    await start();const initial=await get<AccountView>('/api/account/me'),old=await get<Version>('/api/version');assert.ok(initial.profile.xp>0);assert.ok(!initial.profile.ownedCards.includes(locked));
    await stop(child!);child=undefined;
    const cards=JSON.parse(cardBytes) as {id:string;name:string}[],target=cards.find(card=>card.id===locked)!;assert.ok(target);target.name+=' (시험 패치)';writeFileSync(cardPath,JSON.stringify(cards));
    const config=JSON.parse(growthBytes);config.cardPowerOverrides={...config.cardPowerOverrides,[locked]:1};writeFileSync(growthPath,JSON.stringify(config));
    const version=JSON.parse(versionBytes);version.version=old.version+'-fixture';writeFileSync(versionPath,JSON.stringify(version));
    await start();const newer=await get<Version>('/api/version'),upgraded=await get<AccountView>('/api/account/me');assert.equal(newer.version,version.version);assert.notEqual(newer.catalogHash,old.catalogHash);assert.notEqual(newer.growthHash,old.growthHash);
    const published=await get<{id:string;name:string}[]>('/api/catalog');assert.equal(published.find(card=>card.id===locked)?.name,target.name);
    assert.equal(upgraded.id,initial.id);assert.equal(upgraded.profile.xp,initial.profile.xp);assert.equal(upgraded.profile.rank,initial.profile.rank);assert.equal(upgraded.profile.questGames,initial.profile.questGames);assert.deepEqual(upgraded.profile.decks,initial.profile.decks);assert.deepEqual(upgraded.profile.recentMatches,initial.profile.recentMatches);assert.ok(upgraded.profile.ownedCards.includes(locked));
    await stop(child!);child=undefined;
    writeFileSync(cardPath,cardBytes);writeFileSync(growthPath,growthBytes);writeFileSync(versionPath,versionBytes);
    await start();assert.deepEqual(await get<Version>('/api/version'),old);const rolledBack=await get<AccountView>('/api/account/me');assert.deepEqual(rolledBack,upgraded);
    // A new device logs into the restored old version and sees precisely the
    // same permanent unlocks and progression, without copying a local save.
    const login=await fetch(origin+'/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(login.status,200);assert.deepEqual(await login.json(),rolledBack);
  }finally{if(child)await stop(child);rmSync(directory,{recursive:true,force:true});}
});
