import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createDuelServer,loadCatalog} from '../../server/server.ts';
import {LocalAccountStore} from '../../server/account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {DEFAULT_BOT_WEIGHTS} from '../../../packages/engine/src/index.ts';
import {aiCatalogHash,readGameChampion} from '../../server/ai-profile-store.ts';
import {releaseIdentity} from '../../server/release-identity.ts';
import {runOnlineAcceptance} from '../../cli/online-acceptance.ts';

test('disposable account acceptance verifies live deck sync, resumed ranked XP and both PvP ledgers without revoking original sessions',{timeout:60000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),model=readGameChampion(aiCatalogHash(catalog)),expected=releaseIdentity(catalog,growth,model?.weights??DEFAULT_BOT_WEIGHTS,model?.promotions??0);
  const {http,io}=createDuelServer(catalog,{accounts:store,growth,botDelayMs:0,sweepMs:50});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const origin=`http://127.0.0.1:${addr.port}`;
  const a={email:'accept-a@example.test',password:'test-password'},b={email:'accept-b@example.test',password:'test-password'},first=await store.register(a.email,a.password),second=await store.register(b.email,b.password);
  const issued:string[]=[],login=store.login.bind(store);store.login=async(...args)=>{const value=await login(...args);issued.push(value.token);return value;};
  try{
    await assert.rejects(runOnlineAcceptance(origin,a,b,catalog,growth,expected),/명시적 동의/);
    await assert.rejects(runOnlineAcceptance(origin,a,a,catalog,growth,expected,true),/서로 다른/);assert.equal(issued.length,0);
    const result=await runOnlineAcceptance(origin,a,b,catalog,growth,expected,true);assert.equal(result.deckSynced,true);assert.equal(result.identityBound,true);assert.equal(result.resumedRanked,true);assert.ok(result.xp>0);assert.equal(result.questGames,1);assert.equal(result.pvpSettled,true);
    assert.equal(issued.length,3);for(const token of issued)assert.equal(await store.session(token),null);
    const afterA=await store.session(first.token),afterB=await store.session(second.token);assert.ok(afterA&&afterB);assert.equal(afterA.profile.decks.length,1);assert.equal(afterA.profile.xp,result.xp);assert.equal(afterB.profile.xp,0);assert.equal(afterA.profile.matchStats?.pvp.losses,1);assert.equal(afterB.profile.matchStats?.pvp.wins,1);
    await assert.rejects(runOnlineAcceptance(origin,a,b,catalog,growth,expected,true),/기존 진행 기록/);
    assert.deepEqual(await store.session(first.token),afterA);assert.deepEqual(await store.session(second.token),afterB);assert.equal(issued.length,6);for(const token of issued)assert.equal(await store.session(token),null);
  }finally{await io.close();store.close();}
});

test('acceptance preconditions fail closed with maintenance enabled or a developer test account',{timeout:30000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth),model=readGameChampion(aiCatalogHash(catalog)),expected=releaseIdentity(catalog,growth,model?.weights??DEFAULT_BOT_WEIGHTS,model?.promotions??0);
  const {http,io}=createDuelServer(catalog,{accounts:store,growth,maintenance:true});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const origin=`http://127.0.0.1:${addr.port}`;
  const a={email:'maint-a@example.test',password:'test-password'},b={email:'maint-b@example.test',password:'test-password'},first=await store.register(a.email,a.password),second=await store.register(b.email,b.password);
  try{
    await assert.rejects(runOnlineAcceptance(origin,a,b,catalog,growth,expected,true),/서버 점검 중/);
    assert.deepEqual(await store.session(first.token),first.account);assert.deepEqual(await store.session(second.token),second.account);
    store.setRole(b.email,'developer');await assert.rejects(runOnlineAcceptance(origin,a,b,catalog,growth,expected,true),/신규 폐기 가능/);
    assert.deepEqual(await store.session(first.token),first.account);assert.deepEqual((await store.session(second.token))?.profile,second.account.profile);
  }finally{await io.close();store.close();}
});
