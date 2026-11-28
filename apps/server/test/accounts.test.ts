import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountError,LocalAccountStore} from '../account-store.ts';
import type {AccountBackend} from '../account-store.ts';
import {createDuelServer,loadCatalog} from '../server.ts';
import {practiceDeck,validateDeck,repairDeck} from '../../../packages/engine/src/index.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {ClientEvents,ServerEvents,Result} from '../../../packages/protocol.ts';

const credentials={email:'player@example.test',password:'long-password'};
test('pre-progression stored profiles gain missing rank wins while corrupt history is not overwritten',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-legacy-profile-')),path=join(dir,'accounts.sqlite'),catalog=loadCatalog(),growth=buildGrowth(catalog);
  const oldStore=new LocalAccountStore(path),db=new DatabaseSync(path);let current:LocalAccountStore|undefined;
  try{
    const first=await oldStore.register(credentials.email,credentials.password),deck=practiceDeck(catalog,'mage');
    await oldStore.updateDecks(first.account.id,0,[{name:'이전 덱',deck}]);
    const before=db.prepare('SELECT profile FROM accounts WHERE id=?').get(first.account.id) as {profile:string};const legacy=JSON.parse(before.profile);delete legacy.rankWins;
    db.prepare('UPDATE accounts SET profile=? WHERE id=?').run(JSON.stringify(legacy),first.account.id);
    current=new LocalAccountStore(path,growth);const restored=await current.session(first.token);assert.equal(restored?.profile.rankWins,0);assert.equal(restored?.profile.decks[0].name,'이전 덱');assert.equal(restored?.profile.ownedCards.length,growth.starterIds.length);
    const row=db.prepare('SELECT profile,revision FROM accounts WHERE id=?').get(first.account.id) as {profile:string;revision:number};const invalid=JSON.stringify({...JSON.parse(row.profile),matchStats:{ranked:{wins:-1,losses:0,draws:0},pvp:{wins:0,losses:0,draws:0}}});
    db.prepare('UPDATE accounts SET profile=? WHERE id=?').run(invalid,first.account.id);
    await assert.rejects(current.session(first.token),{status:503});await assert.rejects(current.updateDecks(first.account.id,row.revision,[]),{status:503});
    assert.equal((db.prepare('SELECT profile FROM accounts WHERE id=?').get(first.account.id) as {profile:string}).profile,invalid);
    const server=createDuelServer(catalog,{accounts:current,growth});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const address=server.http.address();assert.ok(address&&typeof address==='object');
    try{
      const logout=(id:string)=>fetch(`http://127.0.0.1:${address.port}/api/account/logout`,{method:'POST',headers:{Cookie:`duel_account=${first.token}`,'Content-Type':'application/json','X-Card-Duel-Account':id},body:'{}'});
      assert.equal((await logout('wrong-account')).status,409);assert.equal((await logout(first.account.id)).status,200);assert.equal(await current.sessionOwner(first.token),null);
    }finally{await server.io.close();await server.flush();}
  }finally{current?.close();db.close();oldStore.close();rmSync(dir,{recursive:true,force:true});}
});
test('stale account HTTP requests cannot read, mutate or log out a different cookie account',async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth);
  const a=await store.register('old-tab@example.test','test-password'),b=await store.register('new-tab@example.test','test-password');
  const server=createDuelServer(catalog,{accounts:store,growth});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const address=server.http.address();assert.ok(address&&typeof address==='object');
  const call=(path:string,method='GET',body?:unknown,expected?:string)=>fetch(`http://127.0.0.1:${address.port}/api/account/${path}`,{method,headers:{Cookie:`duel_account=${b.token}`,...(expected===undefined?{}:{'X-Card-Duel-Account':expected}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    const deck=practiceDeck(catalog,'mage'),change={name:'test',expected:null,deck};
    for(const [path,method,body]of [['me','GET',undefined],['growth','GET',undefined],['active-room','GET',undefined],['export','GET',undefined],['developer','GET',undefined],['deck','PUT',change],['decks','PUT',{revision:0,decks:[{name:'test',deck}]}],['password','POST',{currentPassword:'test-password',newPassword:'changed-password'}],['developer/maintenance','POST',{enabled:true}],['logout','POST',{}]] as const){
      const res=await call(path,method,body,a.account.id);assert.equal(res.status,409,path);assert.equal(res.headers.get('set-cookie'),null);assert.match((await res.json()).error,/계정이 변경/);
    }
    assert.deepEqual((await store.session(b.token))?.profile,b.account.profile);assert.deepEqual((await store.session(a.token))?.profile,a.account.profile);
    assert.equal((await call('me')).status,200);assert.equal((await call('deck','PUT',change,b.account.id)).status,200);
    assert.equal((await store.session(b.token))?.profile.decks.length,1);assert.equal((await store.session(a.token))?.profile.decks.length,0);
    assert.equal((await call('logout','POST',{},b.account.id)).status,200);assert.equal(await store.session(b.token),null);assert.ok(await store.session(a.token));
  }finally{await server.io.close();await server.flush();store.close();}
});
test('pending email confirmation does not issue a game session or grant account mode',async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),backend:AccountBackend=store;
  const register=backend.register.bind(backend);backend.register=async()=>({verificationRequired:true});
  const {http,io}=createDuelServer(catalog,{accounts:backend,growth});http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}/api/account/`;
  const signup=()=>fetch(url+'register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
  try{
    const pending=await signup();assert.equal(pending.status,202);assert.equal(pending.headers.get('set-cookie'),null);assert.deepEqual(await pending.json(),{verificationRequired:true});assert.equal((await fetch(url+'me')).status,401);
    await assert.rejects(store.login(credentials.email,credentials.password),/이메일 또는 비밀번호/);
    backend.register=register;const verified=await signup();assert.equal(verified.status,201);assert.match(verified.headers.get('set-cookie')??'',/^duel_account=/);const profile=await verified.json();assert.equal(profile.role,'player');assert.equal(profile.profile.xp,0);
  }finally{await io.close();store.close();}
});
test('a patch grants new ownership on login and subsequent rollback cannot revoke that card',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-patch-ownership-')),path=join(dir,'accounts.db'),catalog=loadCatalog(),original=buildGrowth(catalog),card=original.unlocks.at(-1)!.cardId;
  let store=new LocalAccountStore(path,original);try{
    const first=await store.register(credentials.email,credentials.password);assert.ok(!first.account.profile.ownedCards.includes(card));store.close();
    store=new LocalAccountStore(path,buildGrowth(catalog,{[card]:1}));const granted=await store.session(first.token);assert.ok(granted?.profile.ownedCards.includes(card));assert.equal(granted?.profile.revision,1);store.close();
    store=new LocalAccountStore(path,original);const rolledBack=await store.session(first.token);assert.ok(rolledBack?.profile.ownedCards.includes(card));assert.equal(rolledBack?.profile.revision,1);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('local accounts persist through restart; sessions are independent and role is operator controlled',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-accounts-'));const path=join(dir,'accounts.db');
  let store=new LocalAccountStore(path);
  try{
    const first=await store.register(credentials.email,credentials.password);assert.equal(first.account.role,'player');
    assert.equal(statSync(path).mode&0o777,0o600);
    assert.equal(first.account.profile.xp,0);assert.equal(first.account.profile.rank,1);
    await assert.rejects(store.register('PLAYER@example.test',credentials.password),/등록/);
    await assert.rejects(store.login(credentials.email,'wrong-password'),/일치/);
    const second=await store.login(credentials.email,credentials.password);assert.notEqual(first.token,second.token);assert.equal(first.account.id,second.account.id);
    store.close();store=new LocalAccountStore(path);
    assert.equal((await store.session(first.token))?.id,first.account.id);
    store.setRole(credentials.email,'developer');assert.equal((await store.session(second.token))?.role,'developer');
    await store.logout(first.token);assert.equal(await store.session(first.token),null);assert.ok(await store.session(second.token));
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('account HTTP protects roles and progress; devices share decks and reject stale writes',async()=>{
  const catalog=loadCatalog();const store=new LocalAccountStore(':memory:');
  const {http,io}=createDuelServer(catalog,{accounts:store});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}/api/account/`;
  const call=(path:string,method='GET',body?:unknown,cookie?:string,origin?:string)=>fetch(url+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const getCookie=(res:Response)=>{const c=res.headers.get('set-cookie');assert.ok(c);assert.match(c,/HttpOnly; SameSite=Strict/);return c.split(';')[0];};
  try{
    assert.equal((await call('me')).status,401);
    assert.equal((await call('export')).status,401);
    assert.equal((await call('register','POST',credentials,undefined,'https://evil.example')).status,403);
    const r=await call('register','POST',{...credentials,role:'developer',xp:99999});assert.equal(r.status,201);const c1=getCookie(r);const first=await r.json();assert.equal(first.role,'player');assert.equal(first.profile.xp,0);assert.ok(!('password_hash'in first));
    assert.equal((await call('developer','GET',undefined,c1)).status,403);
    const l=await call('login','POST',credentials);assert.equal(l.status,200);const c2=getCookie(l);assert.notEqual(c1,c2);assert.equal((await l.json()).id,first.id);
    const deck=practiceDeck(catalog,'mage');const update={revision:0,decks:[{name:'동기화 덱',deck}],xp:1234,rank:25,role:'developer'};
    const saved=await call('decks','PUT',update,c1);assert.equal(saved.status,200);const profile=(await saved.json()).profile;assert.equal(profile.revision,1);assert.equal(profile.xp,0);assert.equal(profile.rank,1);
    const other=await call('me','GET',undefined,c2);assert.deepEqual((await other.json()).profile.decks,update.decks);
    const exported=await call('export','GET',undefined,c2);assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition')??'',/attachment/);assert.equal(exported.headers.get('cache-control'),'no-store');const contents=await exported.json();assert.equal(contents.schemaVersion,1);assert.deepEqual(contents.profile,profile);assert.deepEqual(Object.keys(contents).sort(),['exportedAt','gameVersion','profile','schemaVersion']);assert.ok(!JSON.stringify(contents).includes(credentials.email));assert.ok(!JSON.stringify(contents).includes(credentials.password));assert.equal((await call('export','POST',{profile:{xp:99999}},c2)).status,404);
    const unrelated=await call('register','POST',{email:'separate@example.test',password:credentials.password});assert.equal(unrelated.status,201);const unrelatedCookie=getCookie(unrelated);assert.deepEqual((await (await call('export','GET',undefined,unrelatedCookie)).json()).profile.decks,[]);
    assert.equal((await call('decks','PUT',update,c2)).status,409);
    assert.equal((await call('decks','PUT',{revision:1,decks:[{name:'bad',deck:{heroClass:'mage',cards:['fake']}}]},c2)).status,400);
    assert.equal((await call('decks','PUT',{revision:1,decks:[]},c2,'https://evil.example')).status,403);
    assert.equal((await call('decks','PUT',{revision:1,decks:[]},c2)).status,200);
    assert.equal((await call('logout','POST',{},c1)).status,200);assert.equal((await call('me','GET',undefined,c1)).status,401);assert.equal((await call('me','GET',undefined,c2)).status,200);
    store.setRole(credentials.email,'developer');const dev=await call('developer','GET',undefined,c2);assert.equal(dev.status,200);const status=await dev.json();assert.equal(status.runtime.rooms.total,0);assert.equal(status.runtime.connectedSockets,0);assert.ok(status.runtime.rssBytes>0);assert.equal(status.runtime.pendingResults,0);assert.equal((await call('developer','GET',undefined,unrelatedCookie)).status,403);
  }finally{await io.close();store.close();}
});
test('single-deck edits merge independent device saves and XP; stale same-name writes or deletes are rejected',{timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),{http,io}=createDuelServer(catalog,{accounts:store,growth});
  http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const origin=`http://127.0.0.1:${addr.port}`;
  const pc=await store.register(credentials.email,credentials.password),mobile=await store.login(credentials.email,credentials.password),other=await store.register('other-deck@example.test',credentials.password);
  const mage=practiceDeck(catalog,'mage'),warrior=practiceDeck(catalog,'warrior'),put=(token:string,body:unknown)=>fetch(origin+'/api/account/deck',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:`duel_account=${token}`,Origin:origin},body:JSON.stringify(body)});
  const update=store.updateDecks.bind(store);let entered!:()=>void,release!:()=>void,hold=true;const pending=new Promise<void>(resolve=>entered=resolve),resume=new Promise<void>(resolve=>release=resolve);
  store.updateDecks=async(...args)=>{if(hold&&args[2].some(item=>item.name==='PC 덱')){hold=false;entered();await resume;}return update(...args);};
  try{
    const a=put(pc.token,{name:'PC 덱',expected:null,deck:mage});await pending;
    const b=await put(mobile.token,{name:'모바일 덱',expected:null,deck:warrior});assert.equal(b.status,200);
    const earned=await store.recordMatch(pc.account.id,{matchId:'parallel-xp',rank:1,heroClass:'mage',outcome:'win',eligible:true},growth);assert.ok(earned.profile.xp>0);
    release();assert.equal((await a).status,200);
    let profile=(await store.session(mobile.token))!.profile;assert.equal(profile.xp,earned.profile.xp);assert.deepEqual(profile.decks,[{name:'모바일 덱',deck:warrior},{name:'PC 덱',deck:mage}]);
    assert.equal((await put(pc.token,{name:'PC 덱',expected:mage,deck:warrior})).status,200);
    assert.equal((await put(mobile.token,{name:'PC 덱',expected:mage,deck:null})).status,409);
    assert.equal((await put(mobile.token,{name:'PC 덱',expected:mage,deck:mage})).status,409);
    assert.equal((await put(mobile.token,{name:'PC 덱',expected:null,deck:mage})).status,409);
    profile=(await store.session(pc.token))!.profile;assert.deepEqual(profile.decks.find(item=>item.name==='PC 덱')?.deck,warrior);
    assert.equal((await put(pc.token,{name:'PC 덱',expected:mage,deck:warrior})).status,200);assert.equal((await store.session(pc.token))!.profile.revision,profile.revision,'lost acknowledgement retry does not increment revision');
    assert.equal((await put(mobile.token,{name:'PC 덱',expected:warrior,deck:null})).status,200);
    assert.equal((await put(mobile.token,{name:'PC 덱',expected:warrior,deck:null})).status,200);
    assert.deepEqual((await store.session(pc.token))!.profile.decks,[{name:'모바일 덱',deck:warrior}]);
    assert.equal((await put(mobile.token,{name:'bad',expected:null,deck:{...mage,cards:['fake']}})).status,400);
    assert.equal((await put(mobile.token,{name:'bad',expected:null,deck:null})).status,400);
    assert.equal((await put('',{name:'unauthorized',expected:null,deck:mage})).status,401);
    assert.deepEqual((await store.session(other.token))!.profile.decks,[]);
    profile=(await store.session(pc.token))!.profile;
    await store.updateDecks(pc.account.id,profile.revision,[...profile.decks,...Array.from({length:19},(_,i)=>({name:`추가 ${i}`,deck:mage}))]);
    assert.equal((await put(pc.token,{name:'21번째',expected:null,deck:mage})).status,400);
    assert.equal((await store.session(pc.token))!.profile.decks.length,20);
  }finally{release();store.updateDecks=update;await io.close();store.close();}
});
test('password change verifies the old password and revokes all device sessions without removing progress',async()=>{
  const store=new LocalAccountStore(':memory:');try{
    const first=await store.register(credentials.email,credentials.password),second=await store.login(credentials.email,credentials.password);
    const deck=practiceDeck(loadCatalog(),'mage');await store.updateDecks(first.account.id,0,[{name:'preserve',deck}]);
    await assert.rejects(store.changePassword(first.account.id,credentials.email,'wrong-password','new-password'),/일치하지/);
    assert.ok(await store.session(first.token));await assert.rejects(store.changePassword(first.account.id,credentials.email,credentials.password,'tiny'),/8자/);
    await store.changePassword(first.account.id,credentials.email,credentials.password,'new-password');
    assert.equal(await store.session(first.token),null);assert.equal(await store.session(second.token),null);await assert.rejects(store.login(credentials.email,credentials.password),/일치/);
    const logged=await store.login(credentials.email,'new-password');assert.equal(logged.account.id,first.account.id);assert.deepEqual(logged.account.profile.decks,[{name:'preserve',deck}]);
  }finally{store.close();}
});
test('account watch automatically notifies both devices but not other accounts or unauthenticated sockets', {timeout:15000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),{http,io}=createDuelServer(catalog,{accounts:store,growth});
  http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const a=await store.register(credentials.email,credentials.password),b=await store.login(credentials.email,credentials.password),other=await store.register('other@example.test',credentials.password);
  type Client=Socket<ServerEvents,ClientEvents>;const clients:Client[]=[];
  const open=async(token?:string)=>{const client:Client=connect(url,{forceNew:true,transports:['websocket'],extraHeaders:token?{Cookie:`duel_account=${token}`}:{}});clients.push(client);await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);});return client;};
  const watch=(client:Client)=>new Promise<Result<null>>((resolve,reject)=>client.timeout(3000).emit('account:watch',(error,result)=>error?reject(error):resolve(result)));
  try{
    const [pc,phone,third,guest]=await Promise.all([open(a.token),open(b.token),open(other.token),open()]);
    assert.equal((await watch(pc)).ok,true);assert.equal((await watch(phone)).ok,true);assert.equal((await watch(third)).ok,true);assert.equal((await watch(guest)).ok,false);
    let foreign=0;third.on('account:changed',()=>foreign++);guest.on('account:changed',()=>foreign++);
    const changed=(client:Client)=>new Promise<void>(resolve=>client.once('account:changed',resolve));const received=Promise.all([changed(pc),changed(phone)]);
    const deck=practiceDeck(catalog,'mage'),response=await fetch(url+'/api/account/decks',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:`duel_account=${a.token}`},body:JSON.stringify({revision:a.account.profile.revision,decks:[{name:'자동 동기화',deck}]})});assert.equal(response.status,200);await received;
    assert.equal((await store.session(b.token))?.profile.decks[0].name,'자동 동기화');assert.equal(foreign,0);
    const disconnected=new Promise<void>(resolve=>phone.once('disconnect',()=>resolve()));const logout=await fetch(url+'/api/account/logout',{method:'POST',headers:{'Content-Type':'application/json',Cookie:`duel_account=${b.token}`},body:'{}'});assert.equal(logout.status,200);await disconnected;assert.equal(phone.connected,false);assert.equal(pc.connected,true);
    const replacement=await store.login(credentials.email,credentials.password),anotherPhone=await open(replacement.token);assert.equal((await watch(anotherPhone)).ok,true);
    const unverified=await store.login(credentials.email,credentials.password),slowSocket=await open(unverified.token);
    const originalSession=store.session.bind(store);let entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
    store.session=async token=>{const value=await originalSession(token);if(token===unverified.token&&value){entered();await held;}return value;};
    const slowWatch=watch(slowSocket);await started;
    const changePassword=store.changePassword.bind(store);store.changePassword=async(...args)=>{await changePassword(...args);throw new AccountError(503,'변경 결과를 확인할 수 없습니다.');};
    const revoked=Promise.all([pc,anotherPhone].map(client=>new Promise<void>(resolve=>client.once('disconnect',()=>resolve()))));
    const partial=await fetch(url+'/api/account/password',{method:'POST',headers:{'Content-Type':'application/json',Cookie:`duel_account=${a.token}`},body:JSON.stringify({currentPassword:credentials.password,newPassword:'new-password'})});
    assert.equal(partial.status,503);await revoked;assert.equal(pc.connected,false);assert.equal(anotherPhone.connected,false);assert.equal(third.connected,true);assert.equal(guest.connected,true);
    release();const delayed=await slowWatch;assert.equal(delayed.ok,false);if(!delayed.ok)assert.equal(delayed.code,'serverError');assert.equal((await watch(slowSocket)).ok,false);
    assert.equal(await store.session(a.token),null);assert.equal(await store.session(replacement.token),null);
    assert.equal((await store.login(credentials.email,'new-password')).account.profile.decks[0].name,'자동 동기화');
  }finally{clients.forEach(client=>client.disconnect());await io.close();store.close();}
});
test('a patch preserves incompatible historic account decks while permitting new legal saves and explicit repair',async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),base=practiceDeck(catalog,'mage'),retired=growth.unlocks.find(({cardId})=>{const card=catalog[cardId];return card.kind!=='coin'&&card.class==='neutral'&&!base.cards.includes(cardId);})!.cardId;
  const legacy={name:'이전 덱',deck:{...base,cards:[...base.cards.slice(1),retired]}};validateDeck(legacy.deck,catalog);
  const patched={...catalog};delete patched[retired];const repaired=repairDeck(patched,legacy.deck);assert.deepEqual(repaired.discarded,[retired]);assert.equal(repaired.deck.cards.length,29);
  const store=new LocalAccountStore(':memory:'),account=await store.register(credentials.email,credentials.password);await store.updateDecks(account.account.id,0,[legacy]);
  const {http,io}=createDuelServer(patched,{accounts:store});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');
  const put=(revision:number,decks:unknown)=>fetch(`http://127.0.0.1:${addr.port}/api/account/decks`,{method:'PUT',headers:{'Content-Type':'application/json',Cookie:`duel_account=${account.token}`},body:JSON.stringify({revision,decks})});
  try{
    const current={name:'새 덱',deck:practiceDeck(patched,'mage')};assert.equal((await put(1,[legacy,current])).status,200);
    assert.deepEqual((await store.session(account.token))?.profile.decks,[legacy,current]);
    assert.equal((await put(2,[{...legacy,name:'불법 복제'},current])).status,400);
    const one=(name:string,expected:typeof base|null,deck:typeof base|null)=>fetch(`http://127.0.0.1:${addr.port}/api/account/deck`,{method:'PUT',headers:{'Content-Type':'application/json',Cookie:`duel_account=${account.token}`},body:JSON.stringify({name,expected,deck})});
    assert.equal((await one('불법 복제',null,legacy.deck)).status,400);
    assert.equal((await one(legacy.name,legacy.deck,null)).status,200);assert.deepEqual((await store.session(account.token))?.profile.decks,[current]);
  }finally{await io.close();store.close();}
});
