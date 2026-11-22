import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { CardStore } from '../../server/card-store.ts';
import { createAdminServer } from '../admin-server.ts';
import { createDuelServer } from '../../server/server.ts';
import { HERO_CLASSES, practiceDeck, validateDeck } from '../../../packages/engine/src/index.ts';
function fixture(){const dir=mkdtempSync(join(tmpdir(),'card-duel-test-'));for(const name of ['v0.1.0.json','v0.3.0.json'])copyFileSync(new URL(`../../../data/cards/${name}`,import.meta.url),join(dir,name));writeFileSync(join(dir,'active.json'),'{"file":"v0.3.0.json"}');return{dir,store:new CardStore(dir)};}
test('all shipped historical snapshots remain readable, comparable and usable with nine legal practice decks',()=>{
  const store=new CardStore(),active=store.read().version,manifest=readFileSync(join(store.dir,'active.json'));const versions=store.list().filter(v=>v.startsWith('v'));
  assert.ok(versions.length>=19);assert.ok(versions.includes('v0.1.0.json'));assert.ok(versions.includes('v0.20.0.json'));assert.ok(versions.includes('v0.21.0.json'));
  for(const version of versions){const bytes=readFileSync(join(store.dir,version));const {catalog}=store.read(version);for(const cls of HERO_CLASSES)validateDeck(practiceDeck(catalog,cls),catalog);assert.equal(store.compareVersions(version,active).from,version);assert.deepEqual(readFileSync(join(store.dir,version)),bytes);}
  assert.deepEqual(readFileSync(join(store.dir,'active.json')),manifest);
});
test('v0.21 balance editing preserves the overload card-play event and previous bytes',()=>{
  const {dir,store}=fixture();try{const name='v0.21.0.json';copyFileSync(new URL(`../../../data/cards/${name}`,import.meta.url),join(dir,name));store.activate('v0.3.0.json',name);const old=readFileSync(join(dir,name)),base=store.read();const card=base.cards.find(c=>c.id==='storm_elemental');assert.ok(card?.kind==='minion');assert.ok(JSON.stringify(card).includes('friendlyOverloadCardPlayed'));card.cost++;const version=store.save(base.version,base.cards);assert.deepEqual(store.read().catalog.storm_elemental,card);assert.deepEqual(readFileSync(join(dir,name)),old);assert.equal(store.compareVersions(name,version).changed.length,1);store.activate(version,name);assert.deepEqual(readFileSync(join(dir,name)),old);}
  finally{rmSync(dir,{recursive:true,force:true});}
});
test('epic rarity, extended giant cost and new effect fields round-trip in independent balance snapshot',()=>{
  const {dir,store}=fixture();try{
    for(const name of ['v0.21.0.json','v0.22.0.json'])copyFileSync(new URL(`../../../data/cards/${name}`,import.meta.url),join(dir,name));
    store.activate('v0.3.0.json','v0.22.0.json');const old=readFileSync(join(dir,'v0.22.0.json')),base=store.read();
    const giant=base.cards.find(c=>c.id==='molten_giant'),sight=base.cards.find(c=>c.id==='far_sight'),sword=base.cards.find(c=>c.id==='sword_of_justice');
    assert.ok(giant?.kind==='minion'&&sight?.kind==='spell'&&sight.effects?.[0].kind==='drawDiscounted'&&sword?.kind==='weapon'&&sword.friendlySummon);
    giant.cost=19;sight.effects[0].amount=2;sword.durability=4;
    assert.deepEqual(store.checkDraft(base.version,base.cards),{total:374,collectible:346});
    const version=store.save(base.version,base.cards);assert.deepEqual(store.read().catalog.molten_giant,giant);assert.deepEqual(store.read().catalog.far_sight,sight);assert.deepEqual(store.read().catalog.sword_of_justice,sword);
    assert.deepEqual(readFileSync(join(dir,'v0.22.0.json')),old);assert.equal(store.compareVersions(base.version,version).changed.length,3);
    const diff=store.compareVersions('v0.21.0.json','v0.22.0.json');assert.equal(diff.added.length,42);assert.equal(diff.removed.length,0);assert.equal(diff.changed.length,0);
    store.activate(version,'v0.22.0.json');assert.deepEqual(readFileSync(join(dir,'v0.22.0.json')),old);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('balance save creates separate version, preserves original bytes, and rollback works',()=>{
  const {dir,store}=fixture();try{
    const old=readFileSync(join(dir,'v0.3.0.json'));const base=store.read();const recruit=base.cards.find(c=>c.id==='recruit')!;assert.ok(recruit.kind==='minion');recruit.attack=4;
    const version=store.save(base.version,base.cards);assert.match(version,/^balance-/);assert.equal(store.read().version,version);assert.deepEqual(readFileSync(join(dir,'v0.3.0.json')),old);
    const changed=store.read().catalog.recruit;assert.ok(changed.kind==='minion'&&changed.attack===4);assert.throws(()=>store.save(base.version,base.cards),/버전이 변경/);
    store.activate(version,'v0.3.0.json');const reverted=store.read().catalog.recruit;assert.ok(reverted.kind==='minion'&&reverted.attack===1);assert.ok(store.list().includes(version));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid balance or traversal cannot change active version or create snapshot',()=>{
  const {dir,store}=fixture();try{const base=store.read(),versions=store.list();base.cards[0].cost=-1;assert.throws(()=>store.save(base.version,base.cards),/비용/);assert.equal(store.read().version,base.version);assert.deepEqual(store.list(),versions);assert.throws(()=>store.activate(base.version,'../active.json'),/파일 이름/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('latest balance snapshot round-trips new effect schemas without changing prior JSON',()=>{
  const {dir,store}=fixture();try{
    copyFileSync(new URL('../../../data/cards/v0.8.0.json',import.meta.url),join(dir,'v0.8.0.json'));
    store.activate('v0.3.0.json','v0.8.0.json');const previous=readFileSync(join(dir,'v0.8.0.json'));
    const base=store.read();assert.equal(base.cards.length,137);const tutor=base.cards.find(c=>c.id==='spell_tutor');assert.ok(tutor?.kind==='minion'&&tutor.costAuras);tutor.costAuras[0].amount=-2;
    const hammer=base.cards.find(c=>c.id==='healing_hammer');assert.ok(hammer?.kind==='weapon'&&hammer.beforeAttack);hammer.beforeAttack=[{kind:'heal',target:'friendlyHero',amount:3}];
    const glacial=base.cards.find(c=>c.id==='glacial_construct');assert.ok(glacial?.kind==='minion'&&glacial.freezeOnCombatDamage);glacial.health=5;
    const version=store.save(base.version,base.cards);const loaded=store.read();assert.equal(loaded.version,version);assert.deepEqual(loaded.catalog.spell_tutor,tutor);assert.deepEqual(loaded.catalog.healing_hammer,hammer);assert.deepEqual(loaded.catalog.glacial_construct,glacial);assert.deepEqual(readFileSync(join(dir,'v0.8.0.json')),previous);
    store.activate(version,'v0.8.0.json');assert.deepEqual(readFileSync(join(dir,'v0.8.0.json')),previous);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('admin HTTP API validates origin, saves versions, and game server keeps loaded catalog',{timeout:10000},async()=>{
  const {dir,store}=fixture();const admin=createAdminServer(store),game=createDuelServer(store.read().catalog);admin.listen(0,'127.0.0.1');game.http.listen(0,'127.0.0.1');await Promise.all([once(admin,'listening'),once(game.http,'listening')]);
  const addr=admin.address(),gameAddr=game.http.address();assert.ok(addr&&typeof addr==='object'&&gameAddr&&typeof gameAddr==='object');const url=`http://127.0.0.1:${addr.port}`,g=`http://127.0.0.1:${gameAddr.port}`;
  try{
    const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/카드 밸런스 편집기/);
    const base=await (await fetch(`${url}/api/cards`)).json() as {version:string;cards:{id:string;cost:number}[]};assert.equal(base.cards.length,60);
    const rejected=await fetch(`${url}/api/save`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:JSON.stringify({baseVersion:base.version,cards:base.cards})});assert.equal(rejected.status,403);
    base.cards.find(c=>c.id==='recruit')!.cost=2;const saved=await fetch(`${url}/api/save`,{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({baseVersion:base.version,cards:base.cards})});assert.equal(saved.status,200);assert.equal(store.read().catalog.recruit.cost,2);
    const publicCards=await (await fetch(`${g}/api/catalog`)).json() as {id:string;cost:number}[];assert.equal(publicCards.find(c=>c.id==='recruit')?.cost,1);assert.equal((await fetch(`${g}/api/save`,{method:'POST'})).status,405);
    const stale=await fetch(`${url}/api/save`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseVersion:base.version,cards:base.cards})});assert.equal(stale.status,400);
  }finally{await new Promise<void>(resolve=>admin.close(()=>resolve()));await game.io.close();rmSync(dir,{recursive:true,force:true});}
});
test('active 332-card snapshot validates without saving, rejects bad effect values, and saves/restores independently',{timeout:10000},async()=>{
  const {dir,store}=fixture();copyFileSync(new URL('../../../data/cards/v0.18.0.json',import.meta.url),join(dir,'v0.18.0.json'));store.activate('v0.3.0.json','v0.18.0.json');
  const admin=createAdminServer(store);admin.listen(0,'127.0.0.1');await once(admin,'listening');const addr=admin.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  try{
    const base=store.read(),old=readFileSync(join(dir,base.version)),versions=store.list();const flame=base.cards.find(c=>c.id==='flame_sphere');assert.ok(flame?.kind==='spell'&&flame.effects?.[0]?.kind==='damage');flame.effects[0].amount=7;
    const send=(route:string,body:unknown,origin=url)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
    const data={baseVersion:base.version,cards:base.cards};const check=await send('/api/validate',data);assert.equal(check.status,200);assert.deepEqual(await check.json(),{total:332,collectible:308,rankedDecks:225});assert.deepEqual(store.list(),versions);assert.equal(store.read().version,base.version);
    flame.effects[0].amount=-1;assert.equal((await send('/api/validate',data)).status,400);assert.equal((await send('/api/save',data)).status,400);assert.deepEqual(store.list(),versions);flame.effects[0].amount=7;
    assert.equal((await send('/api/validate',data,'https://example.invalid')).status,403);const saved=await send('/api/save',data);assert.equal(saved.status,200);const version=store.read().version;assert.notEqual(version,base.version);assert.deepEqual(store.read().catalog.flame_sphere,flame);
    assert.deepEqual(readFileSync(join(dir,base.version)),old);assert.equal((await send('/api/validate',data)).status,400);store.activate(version,base.version);assert.deepEqual(readFileSync(join(dir,base.version)),old);assert.ok(store.list().includes(version));
  }finally{await new Promise<void>(resolve=>admin.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
test('custom card can be cloned, validated and saved without overwriting original; version comparison is read only',{timeout:10000},async()=>{
  const {dir,store}=fixture();for(const version of ['v0.18.0.json','v0.19.0.json'])copyFileSync(new URL(`../../../data/cards/${version}`,import.meta.url),join(dir,version));
  store.activate('v0.3.0.json','v0.19.0.json');const base=store.read(),old=readFileSync(join(dir,base.version));
  const source=base.cards.find(c=>c.id==='wolf')!;assert.ok(source.kind==='minion');
  const newCard={...structuredClone(source),id:'my_custom_wolf',name:'내 늑대',attack:4,health:3,cost:3};base.cards.push(newCard);
  assert.deepEqual(store.checkDraft(base.version,base.cards),{total:333,collectible:309});
  const duplicate=[...base.cards,newCard];assert.throws(()=>store.checkDraft(base.version,duplicate),/my_custom_wolf/);
  const version=store.save(base.version,base.cards);assert.deepEqual(store.read().catalog.my_custom_wolf,newCard);assert.deepEqual(store.read().catalog.wolf,source);
  const admin=createAdminServer(store);admin.listen(0,'127.0.0.1');await once(admin,'listening');const addr=admin.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  try{
    const versions=store.list();const compare=(from:string,to:string)=>fetch(url+'/api/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to})});
    const response=await compare('v0.19.0.json',version);assert.equal(response.status,200);const diff=await response.json() as ReturnType<CardStore['compareVersions']>;assert.deepEqual(diff.added,[{id:newCard.id,name:newCard.name}]);assert.deepEqual(diff.removed,[]);assert.deepEqual(diff.changed,[]);
    const oldDiff=store.compareVersions('v0.18.0.json','v0.19.0.json');assert.deepEqual(oldDiff.changed.map(c=>c.id).sort(),['cold_seer','hunter_bow']);assert.equal((await compare('../active.json',version)).status,400);
    assert.deepEqual(store.list(),versions);assert.equal(store.read().version,version);assert.deepEqual(readFileSync(join(dir,base.version)),old);store.activate(version,base.version);assert.equal(store.read().catalog.my_custom_wolf,undefined);assert.ok(store.list().includes(version));
  }finally{await new Promise<void>(resolve=>admin.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
