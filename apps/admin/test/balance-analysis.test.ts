import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {CardStore} from '../../server/card-store.ts';
import {createCatalog} from '../../../packages/engine/src/index.ts';
import {analyzeBalance,compareBalanceMatches,parseBalanceConfig} from '../balance-analysis.ts';
import {createAdminServer} from '../admin-server.ts';
import type {LabStatus} from '../balance-lab.ts';

const store=new CardStore();
test('balance analysis describes all deck cards, cost peer group and stat change without mutation',()=>{
  const base=store.read(),before=JSON.stringify(base.catalog),draft=structuredClone(base.cards),wolf=draft.find(c=>c.id==='wolf');assert.ok(wolf?.kind==='minion');wolf.attack+=3;
  const data=analyzeBalance(base.catalog,createCatalog(draft));assert.equal(data.rows.length,382);assert.equal(data.classes.reduce((n,c)=>n+c.count,0),382);assert.equal(data.classes.reduce((n,c)=>n+c.curve.reduce((x,y)=>x+y,0),0),382);
  const row=data.rows.find(c=>c.id===wolf.id)!;assert.ok(row.changed&&row.oldScore!==null&&row.score>row.oldScore);assert.ok(row.peerCount>0);assert.equal(JSON.stringify(base.catalog),before);
});
test('same catalog yields identical paired results, and all card metrics have a valid denominator',{timeout:20000},()=>{
  const base=store.read(),cfg=parseBalanceConfig({pairs:2,seed:77,level:6,focus:'wolf'},base.catalog,base.catalog);
  let count=0;const out=compareBalanceMatches(base.catalog,base.catalog,cfg,r=>{assert.equal(r.completedPairs,++count);});
  assert.equal(out.completedPairs,2);assert.equal(out.original.matches,4);assert.deepEqual(out.original,out.draft);assert.equal(out.changedOutcomes,0);assert.equal(out.pairedPilotGain,0);assert.equal(out.pilotTies,2);assert.ok(out.original.cards.wolf.deckGames>=4);
  for(const c of Object.values(out.original.cards)){assert.ok(c.playedWins+c.playedDraws<=c.playedGames);assert.ok(c.plays>=c.playedGames);assert.ok(c.playedGames<=8);}
  assert.equal(Object.values(out.original.classes).reduce((n,c)=>n+c.games,0),out.original.finished*2);
});
test('configuration bounds, focus legality and cancelled pair boundary',()=>{
  const base=store.read();for(const invalid of [{pairs:55},{pairs:1.5},{seed:-1},{level:25},{focus:'__coin'},{focus:'missing_card'}])assert.throws(()=>parseBalanceConfig(invalid,base.catalog,base.catalog));
  const result=compareBalanceMatches(base.catalog,base.catalog,{pairs:4,seed:0,level:6},undefined,()=>true);assert.equal(result.completedPairs,0);
});
test('new card focus tests a replacement without changing original deck catalog',{timeout:20000},()=>{
  const base=store.read(),wolf=base.cards.find(c=>c.id==='wolf');assert.ok(wolf?.kind==='minion');
  const draft=createCatalog([...base.cards,{...wolf,id:'custom_wolf',name:'새 늑대',attack:wolf.attack+2}]);
  const cfg=parseBalanceConfig({pairs:1,level:6,seed:90,focus:'custom_wolf'},base.catalog,draft);assert.equal(cfg.newFocus,true);
  const r=compareBalanceMatches(base.catalog,draft,cfg);assert.equal(r.original.cards.custom_wolf,undefined);assert.equal(r.draft.cards.custom_wolf.deckGames,2);assert.equal(r.completedPairs,1);assert.equal(base.catalog.custom_wolf,undefined);
});
test('read-only HTTP lab runs in background, preserves frozen draft, and cancels safely',{timeout:30000},async()=>{
  const base=store.read(),versionList=store.list(),server=createAdminServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  const send=(route:string,data:unknown,origin=url)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
  const status=async()=>await (await fetch(url+'/api/lab/status')).json() as LabStatus|null;
  try{
    assert.equal(await status(),null);const draft=structuredClone(base.cards);draft.find(c=>c.id==='wolf')!.cost++;
    const payload={baseVersion:base.version,cards:draft,pairs:1,seed:231,level:6,focus:'wolf'};
    assert.equal((await send('/api/lab/start',payload,'https://example.invalid')).status,403);
    assert.equal((await send('/api/lab/start',{...payload,pairs:55})).status,400);
    assert.equal((await send('/api/analysis',payload)).status,200);
    const started=await send('/api/lab/start',payload);assert.equal(started.status,202);const active=await started.json() as LabStatus;assert.equal(active.state,'running');assert.deepEqual(active.changedIds,['wolf']);
    assert.equal((await send('/api/lab/start',payload)).status,400);assert.equal((await send('/api/lab/cancel',{id:'wrong'})).status,400);
    let complete=await status();for(let i=0;complete?.state==='running'&&i<120;i++){await pause(100);complete=await status();}
    assert.equal(complete?.state,'complete',complete?.error);assert.equal(complete?.result?.completedPairs,1);assert.equal(complete?.result?.draft.matches,2);
    const second=await (await send('/api/lab/start',{...payload,pairs:54,level:18})).json() as LabStatus;const stopped=await (await send('/api/lab/cancel',{id:second.id})).json() as LabStatus;assert.equal(stopped.state,'cancelled');await pause(25);assert.equal((await status())?.state,'cancelled');
    assert.equal(store.read().version,base.version);assert.deepEqual(store.list(),versionList);assert.deepEqual(store.read().cards,base.cards);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
