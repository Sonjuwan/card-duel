import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createDuelServer,loadCatalog} from '../../server/server.ts';
import {LocalAccountStore} from '../../server/account-store.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {checkGameHeaders,patchReadiness,runOnlineSmoke,smokeOrigin} from '../../cli/online-smoke.ts';
import type {DeveloperRuntimeStatus} from '../../../packages/account-protocol.ts';
import project from '../../../package.json' with {type:'json'};
import {DEFAULT_BOT_WEIGHTS} from '../../../packages/engine/src/index.ts';
import {aiCatalogHash,readGameChampion,readChampion,AI_RELEASE_ROOT} from '../../server/ai-profile-store.ts';
import {releaseIdentity,publishedReleaseIdentity} from '../../server/release-identity.ts';

test('deployment smoke rejects unencrypted non-loopback origins, embedded credentials and paths',()=>{
  assert.equal(smokeOrigin('https://example.test'),'https://example.test');
  assert.equal(smokeOrigin('http://127.0.0.1:3000'),'http://127.0.0.1:3000');
  for(const url of ['http://example.test','http://192.168.0.10','https://example.test/','https://example.test?x=1','https://a:b@example.test'])assert.throws(()=>smokeOrigin(url));
});
test('deployment smoke rejects broad websocket CSP and missing HTTPS transport protection',()=>{
  const origin='https://example.test',csp="frame-ancestors 'none'; form-action 'self'; connect-src 'self' wss://example.test";
  const headers=new Headers({'content-type':'text/html','content-security-policy':csp,'cross-origin-resource-policy':'same-origin','x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000'});
  checkGameHeaders(headers,origin);
  headers.set('content-security-policy',csp+' wss:');assert.throws(()=>checkGameHeaders(headers,origin),/출처 보안/);
  headers.set('content-security-policy',csp);headers.delete('strict-transport-security');assert.throws(()=>checkGameHeaders(headers,origin),/HTTPS 강제/);
});
test('built deployment smoke verifies both account roles and cleans only its own sessions',{timeout:30000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),store=new LocalAccountStore(':memory:',growth);
  const model=readGameChampion(aiCatalogHash(catalog)),expected=releaseIdentity(catalog,growth,model?.weights??DEFAULT_BOT_WEIGHTS,model?.promotions??0);
  const {http,io}=createDuelServer(catalog,{accounts:store,growth});
  http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const password='test-password',player=await store.register('smoke-player@example.test',password),developer=await store.register('smoke-dev@example.test',password);
  store.setRole(developer.account.email,'developer');
  const issued:string[]=[],login=store.login.bind(store);store.login=async(email,password)=>{const result=await login(email,password);issued.push(result.token);return result;};
  try{
    const publicOnly=await runOnlineSmoke(url,undefined,project.version,90000,expected);assert.equal(publicOnly.version,project.version);assert.equal(publicOnly.collectibleCards,382);assert.equal(publicOnly.accountCheck,'not requested');assert.equal(publicOnly.releaseMatched,true);
    for(const account of [player,developer]){
      const before=await store.session(account.token),result=await runOnlineSmoke(url,{email:account.account.email,password});
      assert.deepEqual(result.accountCheck,{sessions:2,profilesMatch:true,role:before!.role,growthMatches:true,identityBound:true});
      assert.deepEqual(await store.session(account.token),before);
    }
    assert.equal(issued.length,4);for(const token of issued)assert.equal(await store.session(token),null);
    await assert.rejects(runOnlineSmoke(url,undefined,'99.99.99'),/버전 불일치/);
    const credentials={email:player.account.email,password};
    for(const [changed,message] of [[{catalogHash:'0'.repeat(64)},/카드 해시 불일치/],[{growthHash:'0'.repeat(64)},/성장 해시 불일치/],[{aiGeneration:expected.aiGeneration+1},/AI 세대 불일치/],[{aiWeightsHash:'0'.repeat(64)},/AI 가중치 불일치/]] as const){
      await assert.rejects(runOnlineSmoke(url,credentials,project.version,90000,{...expected,...changed}),message);
    }
    assert.equal(issued.length,4,'an unexpected release must be rejected before login');
    await assert.rejects(runOnlineSmoke(url,undefined,project.version,90000,expected,true),/테스트 개발자 계정/);
    await assert.rejects(runOnlineSmoke(url,credentials,project.version,90000,expected,true),/개발자 권한/);
    const devCredentials={email:developer.account.email,password};
    await assert.rejects(runOnlineSmoke(url,devCredentials,project.version,90000,expected,true),/점검 상태/);
    const enable=await fetch(url+'/api/account/developer/maintenance',{method:'POST',headers:{'Content-Type':'application/json',Cookie:`duel_account=${developer.token}`,Origin:url},body:JSON.stringify({enabled:true})});assert.equal(enable.status,200);
    const ready=await runOnlineSmoke(url,devCredentials,project.version,90000,expected,true);assert.equal(typeof ready.patchReadiness==='object'&&ready.patchReadiness.readyForPatch,true);
    assert.equal(issued.length,10);for(const token of issued)assert.equal(await store.session(token),null);
    assert.ok(await store.session(developer.token));assert.ok(await store.session(player.token));
  }finally{await io.close();store.close();}
});
test('release identity selects only published weights, not local training data',()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),published=readChampion(aiCatalogHash(catalog),AI_RELEASE_ROOT);
  assert.deepEqual(publishedReleaseIdentity(catalog,growth),releaseIdentity(catalog,growth,published?.weights??DEFAULT_BOT_WEIGHTS,published?.promotions??0));
  const altered=structuredClone(growth);altered.ranks[0].intelligence++;
  assert.notEqual(publishedReleaseIdentity(catalog,altered).growthHash,publishedReleaseIdentity(catalog,growth).growthHash);
});
test('patch readiness rejects incomplete status, pending games, writes, rewards and false ready flags',()=>{
  const ready:DeveloperRuntimeStatus={rooms:{total:0,playing:0,waiting:0,finished:0,account:0,accountPlaying:0,accountWaiting:0,ai:0},connectedSockets:0,pendingRoomWrites:0,failedRoomWrites:0,pendingResults:0,pendingCredentialChanges:0,pendingDeckChanges:0,uptimeSeconds:1,rssBytes:1,maintenance:true,maintenanceSaving:false,maintenanceSaved:true,readyForPatch:true};
  assert.equal(patchReadiness(ready).readyForPatch,true);
  assert.throws(()=>patchReadiness(undefined),/점검 상태/);
  for(const change of [{maintenance:false},{maintenanceSaved:false},{maintenanceSaving:true},{rooms:{...ready.rooms,accountPlaying:1}},{rooms:{...ready.rooms,accountWaiting:1}},{pendingRoomWrites:1},{failedRoomWrites:1},{pendingResults:1},{pendingCredentialChanges:1},{pendingDeckChanges:1},{readyForPatch:false}])assert.throws(()=>patchReadiness({...ready,...change}),/배포 준비 미완료/);
});
