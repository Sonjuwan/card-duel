import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {CardStore} from '../../server/card-store.ts';
import {GrowthConfigStore,loadGrowth} from '../../server/growth-store.ts';
import {createAdminServer} from '../admin-server.ts';
import {createDuelServer} from '../../server/server.ts';
import {newProfile} from '../../server/account-store.ts';
import {syncOwned} from '../../../packages/progression.ts';
import type {GrowthSimulation} from '../../../packages/progression-simulation.ts';
import type {RankedDeckAudit} from '../../../packages/progression-audit.ts';

test('growth editor validates without writing; save backs up old config and never edits the catalog',()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-growth-'));
  try{
    const path=join(dir,'online.json'),original='{"schemaVersion":1,"rankTuning":{},"cardPowerOverrides":{}}';writeFileSync(path,original);
    const cardStore=new CardStore(),{catalog,version}=cardStore.read(),cardBytes=readFileSync(join(cardStore.dir,version)),store=new GrowthConfigStore(path),before=store.read(catalog),id=before.growth.unlocks.at(-1)!.cardId;
    const config={schemaVersion:1,cardPowerOverrides:{[id]:1},rankTuning:{'1':{deckPower:2,intelligence:3}}};
    const draft=store.check(before.baseHash,config,catalog);assert.ok(draft.growth.starterIds.includes(id));assert.ok(syncOwned(newProfile(),draft.growth).ownedCards.includes(id));assert.ok(!draft.growth.unlocks.some(c=>c.cardId===id));
    assert.equal(readFileSync(path,'utf8'),original);assert.deepEqual(readdirSync(dir),['online.json']);
    assert.throws(()=>store.save(before.baseHash,{...config,unexpected:true},catalog),/잘못된/);
    assert.throws(()=>store.save(before.baseHash,{...config,cardPowerOverrides:{[before.growth.starterIds[0]]:2}},catalog),/Invalid/);
    assert.throws(()=>store.save(before.baseHash,{...config,rankTuning:{'1':{deckPower:2,intelligence:26}}},catalog),/Invalid/);
    assert.deepEqual(readdirSync(dir),['online.json']);
    const saved=store.save(before.baseHash,config,catalog);assert.equal(readFileSync(join(dir,'history',saved.backup),'utf8'),original);assert.deepEqual(loadGrowth(catalog,path),draft.growth);
    assert.notEqual(saved.baseHash,before.baseHash);assert.throws(()=>store.save(before.baseHash,config,catalog),/변경/);
    assert.deepEqual(store.listHistory(),[saved.backup]);const activeBytes=readFileSync(path,'utf8');
    const restoredDraft=store.previewHistory(saved.baseHash,saved.backup,catalog);assert.deepEqual(restoredDraft.growth,before.growth);assert.equal(readFileSync(path,'utf8'),activeBytes);
    assert.throws(()=>store.previewHistory(saved.baseHash,'../online.json',catalog),/백업/);assert.throws(()=>store.previewHistory(before.baseHash,saved.backup,catalog),/변경/);
    const restored=store.save(saved.baseHash,restoredDraft.config,catalog);assert.deepEqual(restored.growth,before.growth);assert.equal(store.listHistory().length,2);assert.equal(readFileSync(join(dir,'history',restored.backup),'utf8'),activeBytes);
    assert.deepEqual(readFileSync(join(cardStore.dir,version)),cardBytes);assert.equal(cardStore.read().version,version);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('developer growth HTTP tools require a local origin and exact card/config version; public game has no editor', {timeout:15000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-growth-http-')),path=join(dir,'online.json');writeFileSync(path,'{"schemaVersion":1,"rankTuning":{},"cardPowerOverrides":{}}');
  const cards=new CardStore(),store=new GrowthConfigStore(path),admin=createAdminServer(cards,store),game=createDuelServer(cards.read().catalog);
  admin.listen(0,'127.0.0.1');game.http.listen(0,'127.0.0.1');await Promise.all([once(admin,'listening'),once(game.http,'listening')]);
  const addr=admin.address(),gaddr=game.http.address();assert.ok(addr&&typeof addr==='object'&&gaddr&&typeof gaddr==='object');const url=`http://127.0.0.1:${addr.port}`,gameUrl=`http://127.0.0.1:${gaddr.port}`;
  try{
    const page=await fetch(url+'/growth');assert.equal(page.status,200);assert.match(await page.text(),/성장 및 랭크 AI 개발자 설정/);assert.match(page.headers.get('content-security-policy')??'',/script-src 'self'/);assert.equal((await fetch(url+'/growth.js')).status,200);
    const initial=await (await fetch(url+'/api/growth')).json() as ReturnType<GrowthConfigStore['read']>&{cardVersion:string;cards:unknown[];forecast:GrowthSimulation[];deckAudit:RankedDeckAudit};assert.equal(initial.cards.length,382);assert.equal(initial.growth.ranks.length,25);assert.equal(initial.forecast.length,6);assert.ok(initial.forecast.every(r=>r.rank25At!==null&&r.allCardsAt!==null));assert.equal(initial.deckAudit.checked,900);assert.equal(initial.deckAudit.increased,864);
    const id=initial.growth.unlocks[0].cardId,config={...initial.config,cardPowerOverrides:{[id]:3}};const input={baseHash:initial.baseHash,cardVersion:initial.cardVersion,config};
    const send=(route:string,body:unknown=input,origin=url)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
    assert.equal((await send('/api/growth/save',input,'https://example.invalid')).status,403);
    assert.equal((await send('/api/growth/save',{...input,cardVersion:'stale'})).status,400);
    const validated=await send('/api/growth/validate');assert.equal(validated.status,200);const preview=await validated.json() as {forecast:GrowthSimulation[];deckAudit:RankedDeckAudit};assert.equal(preview.forecast.length,6);assert.equal(preview.deckAudit.checked,900);assert.equal(store.read(cards.read().catalog).baseHash,initial.baseHash);
    const savedResponse=await send('/api/growth/save');assert.equal(savedResponse.status,200);const saved=await savedResponse.json();assert.equal(saved.history.length,1);assert.equal((await send('/api/growth/save')).status,400);
    const historical=await send('/api/growth/history-preview',{baseHash:saved.baseHash,cardVersion:initial.cardVersion,backup:saved.backup});assert.equal(historical.status,200);assert.deepEqual((await historical.json()).growth,initial.growth);assert.equal(store.read(cards.read().catalog).baseHash,saved.baseHash);
    assert.equal((await send('/api/growth/history-preview',{baseHash:saved.baseHash,cardVersion:initial.cardVersion,backup:'../online.json'})).status,400);
    assert.notEqual((await fetch(gameUrl+'/growth.js')).status,200);assert.equal((await fetch(gameUrl+'/api/growth/save',{method:'POST'})).status,405);
  }finally{await new Promise<void>(resolve=>admin.close(()=>resolve()));await game.io.close();rmSync(dir,{recursive:true,force:true});}
});
test('a card patch or rollback that conflicts with existing power overrides is rejected before any file changes',{timeout:15000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-growth-patch-')),cardDir=join(dir,'cards');mkdirSync(cardDir);
  const original=new CardStore(),active=original.read(),old=original.read('v0.3.0.json');
  for(const name of [active.version,old.version])copyFileSync(join(original.dir,name),join(cardDir,name));
  writeFileSync(join(cardDir,'active.json'),JSON.stringify({file:active.version}));
  const cards=new CardStore(cardDir),path=join(dir,'growth.json'),store=new GrowthConfigStore(path);
  const id=syncOwned(newProfile(),loadGrowth(active.catalog)).ownedCards; // identify a nonstarter card absent in the old catalog
  const pick=active.cards.find(c=>!old.catalog[c.id]&&!id.includes(c.id)&&c.collectible!==false&&!active.cards.some(other=>other.id!==c.id&&JSON.stringify(other).includes(c.id)))!;
  assert.ok(pick);
  const config={schemaVersion:1,cardPowerOverrides:{[pick.id]:3},rankTuning:{}};
  writeFileSync(path,JSON.stringify(config));const baseHash=store.read(active.catalog).baseHash;
  const server=createAdminServer(cards,store);server.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const send=(route:string,data:unknown)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify(data)});
  try{
    const draft={baseVersion:active.version,cards:active.cards.filter(c=>c.id!==pick.id)},before=cards.list();
    for(const route of ['/api/validate','/api/save']){const res=await send(route,draft);assert.equal(res.status,400);assert.match(await res.text(),/성장 설정이 호환되지/);}
    const rollback=await send('/api/activate',{baseVersion:active.version,version:old.version});assert.equal(rollback.status,400);
    assert.equal(cards.read().version,active.version);assert.deepEqual(cards.list(),before);assert.equal(store.read(active.catalog).baseHash,baseHash);
    const fixed=await send('/api/growth/save',{baseHash,cardVersion:active.version,config:{...config,cardPowerOverrides:{}}});assert.equal(fixed.status,200);
    const checked=await send('/api/validate',draft);assert.equal(checked.status,200);assert.equal((await checked.json()).rankedDecks,225);
    const valid=await send('/api/save',draft);assert.equal(valid.status,200);assert.equal(cards.read().catalog[pick.id],undefined);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
