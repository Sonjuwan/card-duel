import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseAccountStore} from '../supabase-accounts.ts';
import {allowedGameBind} from '../config.ts';
import {newProfile} from '../account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {loadCatalog} from '../server.ts';
import type {AccountRoomSnapshot} from '../rooms.ts';

test('public bind requires explicit HTTPS, managed backend and opt-in',()=>{
  assert.ok(allowedGameBind('127.0.0.1',undefined,undefined,undefined));
  assert.ok(allowedGameBind('0.0.0.0','supabase','https://game.example','1'));
  for(const [backend,origin,flag] of [['local','https://game.example','1'],['supabase','http://game.example','1'],['supabase','https://game.example/path','1'],['supabase','https://game.example',undefined]])assert.equal(allowedGameBind('0.0.0.0',backend,origin,flag),false);
});
test('cloud adapter uses provider auth, preserves profile at simultaneous logins and guards revision',async()=>{
  const id='12345678-1111-2222-3333-123456789000',email='test@example.com';
  let row:{id:string;email:string;role:string;profile:ReturnType<typeof newProfile>;revision:number}|undefined;
  const sessions=new Map<string,{account_id:string;expires_at:string}>(),snapshots=new Map<string,AccountRoomSnapshot>(),ledger=new Set<string>();let verified=false,providerPassword='test-password',maintenance:boolean|undefined;
  const response=(value:unknown,status=200)=>new Response(status===204||value===undefined?null:JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(input.toString());const headers=new Headers(init?.headers);const method=init?.method;const body=init?.body?JSON.parse(String(init.body)):undefined;
    if(url.pathname.startsWith('/auth/')){
      assert.equal(headers.get('apikey'),'sb_publishable_test');
      if(url.pathname.endsWith('/user')){assert.equal(method,'PUT');assert.equal(headers.get('authorization'),'Bearer provider-token');if(body.current_password!==undefined)assert.equal(body.current_password,providerPassword);providerPassword=body.password;return response({id,email});}
      if(url.pathname.endsWith('/recover'))return response({});
      if(url.pathname.endsWith('/verify')){assert.equal(body.type,'recovery');return body.email===email&&body.token==='123456'?response({access_token:'provider-token',user:{id,email}}):response({error:'invalid'},400);}
      assert.equal(body.email,email);if(body.password!==providerPassword)return response({error:'invalid'},400);
      if(!verified)return response({id,email});return response({access_token:'provider-token',user:{id,email}});
    }
    assert.equal(headers.get('apikey'),'sb_secret_test');
    if(url.pathname.endsWith('/duel_accounts')){
      if(method==='POST'){assert.match(headers.get('prefer')??'',/ignore-duplicates/);row??=body;return response(undefined,201);}
      if(method==='PATCH'){if(!row||url.searchParams.get('revision')!==`eq.${row.revision}`)return response([]);row={...row,...body};return response([row]);}
      return response(row?[row]:[]);
    }
    if(url.pathname.endsWith('/duel_sessions')){
      if(method==='POST'){assert.match(body.token_hash,/^[0-9a-f]{64}$/);sessions.set(body.token_hash,{account_id:body.account_id,expires_at:body.expires_at});return response(undefined,201);}
      const key=url.searchParams.get('token_hash')?.slice(3)??'';
      if(method==='DELETE'){if(url.searchParams.get('account_id')===`eq.${id}`){for(const [token,s]of sessions)if(s.account_id===id)sessions.delete(token);}else sessions.delete(key);return response(null,204);}
      return response(sessions.has(key)?[sessions.get(key)]:[]);
    }
    if(url.pathname.endsWith('/duel_record_match')){
      if(!row)return response([]);if(ledger.has(body.p_match))return response([row]);if(row.revision!==body.p_revision)return response([]);
      ledger.add(body.p_match);row={...row,profile:body.p_profile,revision:row.revision+1};return response([row]);
    }
    if(url.pathname.endsWith('/duel_account_rooms')){
      if(method==='POST'){snapshots.set(body.code,body.snapshot);return response(undefined,201);}
      if(method==='DELETE'){snapshots.delete(url.searchParams.get('code')?.slice(3)??'');return response(null,204);}
      const cursor=url.searchParams.get('code')?.slice(3)??'';
      return response([...snapshots.values()].filter(snapshot=>snapshot.code>cursor).sort((a,b)=>a.code.localeCompare(b.code)).slice(0,Number(url.searchParams.get('limit')??100)).map(snapshot=>({code:snapshot.code,snapshot})));
    }
    if(url.pathname.endsWith('/duel_runtime_settings')){
      if(method==='POST'){assert.equal(body.id,1);if(headers.get('prefer')?.includes('merge-duplicates'))maintenance=body.maintenance;else maintenance??=body.maintenance;return response(undefined,201);}
      return response(maintenance===undefined?[]:[{maintenance}]);
    }
    throw new Error('unexpected endpoint');
  };
  const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'sb_publishable_test',secretKey:'sb_secret_test',fetcher,emailRecovery:true});
  assert.equal(await store.initializeMaintenance(true),true);await store.setMaintenance(false);assert.equal(await store.initializeMaintenance(true),false);await store.setMaintenance(true);assert.equal(await store.initializeMaintenance(false),true);
  assert.deepEqual(await store.register(email,'test-password'),{verificationRequired:true});assert.equal(row,undefined);assert.equal(sessions.size,0);verified=true;
  const first=await store.login(email,'test-password');assert.equal(first.account.role,'player');assert.ok(!sessions.has(first.token));
  await store.updateDecks(id,0,[]);const second=await store.login(email,'test-password');assert.equal(second.account.profile.revision,1);
  await assert.rejects(store.updateDecks(id,0,[]),/다른 기기/);assert.equal((await store.session(first.token))?.profile.revision,1);
  await store.logout(first.token);assert.equal(await store.session(first.token),null);assert.ok(await store.session(second.token));
  const growth=buildGrowth(loadCatalog()),award={matchId:'12345678-aaaa-bbbb-cccc-123456789000',rank:1,heroClass:'warrior' as const,outcome:'win' as const,eligible:true};
  assert.equal((await store.recordMatch(id,award,growth)).profile.xp,30);assert.equal((await store.recordMatch(id,award,growth)).profile.xp,30);assert.equal(ledger.size,1);
  const snapshot:AccountRoomSnapshot={schema:1,code:'ABC234',catalogHash:'a'.repeat(64),room:null,pending:[{accountId:id,code:'ABC234',award}]};
  await store.saveRoomSnapshot(snapshot);assert.deepEqual(await store.loadRoomSnapshots(),[snapshot]);await store.deleteRoomSnapshot(snapshot.code);assert.deepEqual(await store.loadRoomSnapshots(),[]);
  await store.changePassword(id,email,'test-password','new-password');assert.equal(await store.session(second.token),null);await assert.rejects(store.login(email,'test-password'),/로그인/);const changed=await store.login(email,'new-password');assert.equal(changed.account.profile.xp,30);
  await store.requestPasswordRecovery(email);await assert.rejects(store.completePasswordRecovery(email,'999999','reset-password'),/인증 코드/);assert.ok(await store.session(changed.token));
  assert.equal(await store.completePasswordRecovery(email,'123456','reset-password'),id);assert.equal(await store.session(changed.token),null);assert.equal((await store.login(email,'reset-password')).account.profile.xp,30);
  const initial=buildGrowth(loadCatalog()),card=initial.unlocks.at(-1)!.cardId;const patched=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'sb_publishable_test',secretKey:'sb_secret_test',fetcher,growth:buildGrowth(loadCatalog(),{[card]:1})});
  const granted=await patched.login(email,'reset-password');assert.ok(granted.account.profile.ownedCards.includes(card));assert.ok((await store.session(granted.token))?.profile.ownedCards.includes(card));
});
test('cloud room restoration drains all pages even with a smaller provider cap and fails closed on invalid rows',async()=>{
  const alphabet='23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',code=(value:number)=>{let result='';for(let i=0;i<6;i++){result=alphabet[value%alphabet.length]+result;value=Math.floor(value/alphabet.length);}return result;};
  const snapshots=Array.from({length:235},(_,i):AccountRoomSnapshot=>({schema:1,code:code(i),catalogHash:'a'.repeat(64),room:null,pending:[]}));
  let calls=0,mode:'normal'|'duplicate'|'mismatch'|'html'='normal';
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(input.toString()),headers=new Headers(init?.headers);assert.equal(headers.get('apikey'),'server-key');assert.equal(init?.method,'GET');assert.equal(url.searchParams.get('order'),'code.asc');assert.equal(url.searchParams.get('limit'),'100');calls++;
    const cursor=url.searchParams.get('code')?.slice(3)??'';
    if(mode==='html')return new Response('<html>proxy error</html>');
    let rows=snapshots.filter(snapshot=>snapshot.code>cursor).slice(0,37).map(snapshot=>({code:snapshot.code,snapshot}));
    if(rows.length&&mode==='duplicate')rows=[rows[0],rows[0]];
    if(rows.length&&mode==='mismatch')rows[0]={...rows[0],code:'ZZZZZZ'};
    return Response.json(rows);
  };
  const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',fetcher});
  assert.deepEqual(await store.loadRoomSnapshots(),snapshots);assert.equal(calls,8,'seven short data pages plus one empty page');
  for(const invalid of ['duplicate','mismatch'] as const){mode=invalid;await assert.rejects(store.loadRoomSnapshots(),/중복 또는 식별자/);}
  mode='html';await assert.rejects(store.loadRoomSnapshots(),/저장소 응답/);
});
test('cloud authentication does not treat malformed successful responses as pending signups',async()=>{
  for(const payload of ['<html>proxy</html>','null','[]','{}','{"user":{"id":"invalid"}}']){
    const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',fetcher:async()=>new Response(payload)});
    await assert.rejects(store.register('sample@example.test','test-password'),/인증 서버 응답/);
  }
});
test('provider auth throttling retains retry status and wait for login, password and email recovery',async()=>{
  const email='test@example.test',id='12345678-1111-2222-3333-123456789000';
  for(const [raw,seconds]of [['45',45],['0',1],['999999',86400],['nonsense',60]] as const){
    const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',emailRecovery:true,fetcher:async()=>new Response('{}',{status:429,headers:{'Retry-After':raw}})});
    for(const action of [()=>store.login(email,'test-password'),()=>store.register(email,'test-password'),()=>store.changePassword(id,email,'test-password','new-password'),()=>store.requestPasswordRecovery(email),()=>store.completePasswordRecovery(email,'123456','new-password')])await assert.rejects(action(),{status:429,retryAfterSeconds:seconds});
  }
});
test('cloud password and recovery notify connected devices even when provider change or session-delete acknowledgement fails',async()=>{
  const email='test@example.test',id='12345678-1111-2222-3333-123456789000';
  for(const recovery of [false,true])for(const failDelete of [false,true]){
    const events:string[]=[];
    const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',emailRecovery:true,fetcher:async(input,init)=>{
      const path=new URL(input.toString()).pathname;
      if(path.endsWith('/token')||path.endsWith('/verify')){events.push('verified');return Response.json({access_token:'provider-token',user:{id,email}});}
      if(path.endsWith('/duel_sessions')){assert.equal(init?.method,'DELETE');events.push('delete');return new Response(null,{status:failDelete?503:204});}
      if(path.endsWith('/user')){events.push('provider');return new Response('{}',{status:503});}
      throw Error('unexpected endpoint');
    }});
    const revoked=(accountId:string)=>{assert.equal(accountId,id);events.push('disconnect');};
    const pending=recovery?store.completePasswordRecovery(email,'123456','new-password',revoked):store.changePassword(id,email,'test-password','new-password',revoked);
    await assert.rejects(pending,{status:503});
    assert.deepEqual(events,failDelete?['verified','delete','disconnect']:['verified','delete','disconnect','provider']);
  }
});
test('cloud session lookup cannot return an account read before an intervening logout',async()=>{
  const id='12345678-1111-2222-3333-123456789000',token='a'.repeat(64);let active=true,entered!:()=>void,release!:()=>void;
  const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
  const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',fetcher:async(input,init)=>{
    const path=new URL(input.toString()).pathname;
    if(path.endsWith('/duel_sessions')){if(init?.method==='DELETE'){active=false;return new Response(null,{status:204});}return Response.json(active?[{account_id:id,expires_at:new Date(Date.now()+60000).toISOString()}]:[]);}
    if(path.endsWith('/duel_accounts')){entered();await held;return Response.json([{id,email:'test@example.test',role:'player',profile:newProfile(),revision:0}]);}
    throw Error('unexpected endpoint');
  }});
  const pending=store.session(token);await started;await store.logout(token);release();
  await assert.rejects(pending,{status:503});assert.equal(await store.session(token),null);
});
test('pending cloud signup accepts bare and nested provider user without touching game storage',async()=>{
  const user={id:'12345678-1111-2222-3333-123456789000',email:'sample@example.test'};
  for(const payload of [user,{user}]){
    let calls=0;
    const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',fetcher:async(input)=>{assert.ok(input.toString().endsWith('/auth/v1/signup'));calls++;return Response.json(payload);}});
    assert.deepEqual(await store.register(user.email,'test-password'),{verificationRequired:true});assert.equal(calls,1);
  }
  const foreign={...user,email:'other@example.test'};
  const mismatch=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',fetcher:async()=>Response.json(foreign)});
  await assert.rejects(mismatch.register(user.email,'test-password'),/인증 서버 응답/);
});
test('malformed cloud session and account rows are temporary storage failures, not missing sessions',async()=>{
  const accountId='12345678-1111-2222-3333-123456789000',session={account_id:accountId,expires_at:new Date(Date.now()+86400000).toISOString()};
  let sessions:unknown=[],accounts:unknown=[];
  const store=new SupabaseAccountStore({url:'https://test.supabase.co',publicKey:'public-key',secretKey:'server-key',fetcher:async input=>Response.json(input.toString().includes('/duel_sessions?')?sessions:accounts)});
  const token='a'.repeat(64);
  assert.equal(await store.session(token),null);
  for(const bad of [{},null,[null],[{}],[{...session,expires_at:'bad'}],[session,session]]){sessions=bad;await assert.rejects(store.session(token),{status:503});}
  sessions=[{...session,expires_at:new Date(0).toISOString()}];assert.equal(await store.session(token),null);
  sessions=[session];assert.equal(await store.session(token),null);
  for(const bad of [{},[{id:'wrong'}],[{id:accountId,role:'player',profile:{}}]]){accounts=bad;await assert.rejects(store.session(token),{status:503});}
  accounts=[{id:accountId,email:'sample@example.test',role:'player',profile:newProfile(),revision:0}];
  assert.equal((await store.session(token))?.id,accountId);
  const legacy:Partial<ReturnType<typeof newProfile>>=newProfile();delete legacy.rankWins;
  accounts=[{id:accountId,email:'sample@example.test',role:'player',profile:legacy,revision:10}];const compatible=await store.session(token);assert.equal(compatible?.profile.rankWins,0);assert.equal(compatible?.profile.revision,10);
  for(const profile of [{...newProfile(),rankWins:null},{...newProfile(),decks:[{name:'bad',deck:{heroClass:'mage',cards:[null]}}]},{...newProfile(),matchStats:{ranked:{wins:0,losses:0,draws:0}}},{...newProfile(),ownedCards:['duplicate','duplicate']}]){
    accounts=[{id:accountId,email:'sample@example.test',role:'player',profile,revision:10}];await assert.rejects(store.session(token),{status:503});
  }
});
