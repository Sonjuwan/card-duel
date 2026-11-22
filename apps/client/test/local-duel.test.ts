import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createCatalog,HERO_TOKENS,practiceDeck,rankBotActions,DEFAULT_BOT_WEIGHTS} from '../../../packages/engine/src/index.ts';
import type {LocalDuelInput,LocalResponse,LocalRequest} from '../src/local-duel.ts';
import {LocalDuel,publicSaveSummary} from '../src/local-duel.ts';
import {saveWriteAllowed,saveRemoveAllowed} from '../src/local-save-store.ts';
import type {Entry,LocalSaveStore} from '../src/local-save-store.ts';
import {attachLocalDuel} from '../src/local-duel-session.ts';
import type {LocalDuelScope} from '../src/local-duel-session.ts';
import {deviceBudget} from '../src/device-budget.ts';
import {parsePublicAiProfile} from '../src/local-profile.ts';

const catalog={...createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8'))),...Object.fromEntries(HERO_TOKENS.map(c=>[c.id,c]))};
const input:LocalDuelInput={catalog,deck:practiceDeck(catalog,'mage'),heroClass:'warrior',difficulty:3,seed:729,code:'LOCAL-TEST',style:'aggression',generation:4};
const hash='a'.repeat(64),savedInput={...input,catalogHash:hash,firstPlayer:0 as const};

test('checkpoint preserves mulligan, private deck order, RNG and AI configuration without exposing them',()=>{
  const duel=new LocalDuel(savedInput);duel.act(0,{type:'mulligan',replace:[duel.view().state!.self.hand[0].instanceId]});
  const saved=duel.checkpoint(1000)!;const restored=LocalDuel.restore(saved,catalog,hash,undefined,2000);
  assert.deepEqual(restored.checkpoint(1000),saved);assert.equal(restored.botReady(),true);
  const {state}=restored.view();assert.equal('rng' in state!,false);assert.equal('deck' in state!.opponent,false);assert.equal('hand' in state!.opponent,false);assert.equal('secrets' in state!.opponent,false);
  assert.equal('state' in publicSaveSummary(saved,hash),false);
  const contaminated=structuredClone(saved);Object.assign(contaminated.summary,{hidden:contaminated.state});assert.equal('hidden' in publicSaveSummary(contaminated,hash),false);
});
test('timed turn and private choice survive pausing and resolve on expiration',()=>{
  const duel=new LocalDuel(savedInput);duel.act(0,{type:'mulligan',replace:[]});duel.botStep();
  const saved=duel.checkpoint(1000)!;const p=saved.state.players[0];
  p.board.push({cardId:'nozdormu',instanceId:'time-dragon',attack:8,health:8,maxHealth:8,attacksRemaining:0});
  saved.state.pendingChoice={owner:0,cards:p.deck.splice(0,3)};saved.remainingMs=4200;
  const restored=LocalDuel.restore(saved,catalog,hash,undefined,10000);
  assert.equal(restored.turnDeadline(),14200);assert.equal(restored.checkpoint(12000)?.remainingMs,2200);
  assert.deepEqual(restored.view().state!.self.pendingChoice,saved.state.pendingChoice.cards);
  assert.equal(restored.expireTurn(14199),false);assert.equal(restored.expireTurn(14200),true);
  assert.equal(restored.view().state!.self.pendingChoice,undefined);assert.equal(restored.view().state!.activePlayer,1);
});
test('restore rejects corrupted or mismatched snapshots and does not mutate the source',()=>{
  const snapshot=new LocalDuel(savedInput).checkpoint()!;
  assert.throws(()=>LocalDuel.restore(snapshot,catalog,'b'.repeat(64)),/손상/);
  for(const mutate of [
    (s:typeof snapshot)=>{s.state.rng=-1;},(s:typeof snapshot)=>{s.summary.revision++;},
    (s:typeof snapshot)=>{s.state.players[0].hand[0].cardId='unknown';},
    (s:typeof snapshot)=>{s.state.players[0].deck[0].instanceId=s.state.players[0].hand[0].instanceId;},
    (s:typeof snapshot)=>{s.remainingMs=100;},(s:typeof snapshot)=>{s.input.seed=-1;},
  ]){const altered=structuredClone(snapshot);mutate(altered);assert.throws(()=>LocalDuel.restore(altered,catalog,hash),/손상|일치|올바르지/);}
  const copy=structuredClone(snapshot);LocalDuel.restore(snapshot,catalog,hash);assert.deepEqual(snapshot,copy);
});
test('save fencing rejects stale claims, older owners, and stale deletion even within the same match',()=>{
  const saved=new LocalDuel(savedInput).checkpoint(1000)!;const entry={hash,owner:'one',snapshot:saved};
  assert.equal(saveWriteAllowed(undefined,'one',true,null),true);assert.equal(saveWriteAllowed(entry,'two',true,null),false);
  assert.equal(saveWriteAllowed(entry,'two',true,saved.summary),true);assert.equal(saveWriteAllowed(entry,'two',true,undefined),false);
  const newer=structuredClone(entry);newer.owner='two';newer.snapshot.summary.savedAt=new Date(1001).toISOString();
  assert.equal(saveWriteAllowed(newer,'one',true,saved.summary),false);assert.equal(saveWriteAllowed(newer,'one',false),false);
  assert.equal(saveRemoveAllowed(newer,'one'),false);assert.equal(saveRemoveAllowed(newer,undefined,saved.summary),false);
  assert.equal(saveRemoveAllowed(newer,undefined,newer.snapshot.summary),true);assert.equal(saveRemoveAllowed(newer),false);
});
test('finished checkpoint can rematch with the same opponent settings and a new shuffle',()=>{
  const duel=new LocalDuel(savedInput);duel.act(0,{type:'mulligan',replace:[]});duel.botStep();duel.act(duel.view().state!.revision,{type:'concede'});
  const saved=duel.checkpoint()!,restored=LocalDuel.restore(saved,catalog,hash),rematch=restored.rematch('LOCAL-NEW',44).checkpoint()!;
  assert.equal(rematch.summary.code,'LOCAL-NEW');assert.equal(rematch.state.phase,'mulligan');assert.equal(rematch.input.deckSeed,saved.input.deckSeed);assert.deepEqual(rematch.input.deck,saved.input.deck);assert.equal(rematch.input.style,saved.input.style);assert.equal(rematch.input.seed,44);
});

test('worker protocol saves, resumes, fences older tabs, and never deletes a newer save',async t=>{
  let entry:Entry|undefined;
  const store:LocalSaveStore={async read(){return structuredClone(entry?.snapshot??null);},async write(snapshot,owner,claim,expected){if(!saveWriteAllowed(entry,owner,claim,expected))return false;entry={hash,owner,snapshot:structuredClone(snapshot)};return true;},async remove(_,owner,expected){if(!saveRemoveAllowed(entry,owner,expected))return false;entry=undefined;return true;}};
  const tab=(owner:string)=>{let receive:(m:LocalResponse)=>void=()=>{};const scope:LocalDuelScope={postMessage:m=>receive(m),onmessage:()=>{}};t.after(attachLocalDuel(scope,store,owner));return {send:(data:LocalRequest)=>new Promise<LocalResponse>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Worker command timeout')),3000);receive=m=>{clearTimeout(timeout);resolve(m);};scope.onmessage({data});})};};
  const a=tab('a'),b=tab('b'),lobby=tab('lobby');
  const initial=await a.send({type:'start',input:savedInput});assert.equal(initial.type,'view');assert.equal(initial.saveAvailable,true);const stale=initial.save!;
  assert.equal((await lobby.send({type:'inspectSave',catalogHash:hash})).type,'saveInfo');
  const resumed=await b.send({type:'resume',catalog,catalogHash:hash});assert.equal(resumed.type,'view');assert.equal(resumed.resumed,true);assert.equal(entry!.owner,'b');assert.deepEqual(resumed.view.state,initial.view.state);
  const conflict=await lobby.send({type:'discard',catalogHash:hash,expected:stale,requestId:1});assert.equal(conflict.type,'error');assert.equal(entry!.owner,'b');
  const old=await a.send({type:'act',requestId:2,revision:0,action:{type:'concede'}});assert.equal(old.type,'view');assert.equal(old.saveAvailable,false);assert.deepEqual(old.save,entry!.snapshot.summary);
  const left=await a.send({type:'discard',catalogHash:hash,requestId:3});assert.equal(left.type,'discarded');assert.equal(left.save?.code,stale.code);assert.equal(entry!.owner,'b');
  const paused=await b.send({type:'pause',requestId:4});assert.equal(paused.type,'paused');assert.equal(paused.save.code,stale.code);
  const c=tab('c');const again=await c.send({type:'resume',catalog,catalogHash:hash});assert.equal(again.type,'view');assert.equal(again.view.state!.phase,'mulligan');
  const finish=await c.send({type:'act',requestId:5,revision:again.view.state!.revision,action:{type:'concede'}});assert.equal(finish.type,'view');assert.equal(finish.view.status,'finished');
  const replay=await c.send({type:'rematch',code:'LOCAL-REPLAY',seed:74,requestId:6});assert.equal(replay.type,'view');assert.equal(replay.requestId,6);assert.equal(entry!.snapshot.summary.code,'LOCAL-REPLAY');
  const discard=await c.send({type:'discard',catalogHash:hash,requestId:7});assert.equal(discard.type,'discarded');assert.equal(discard.save,null);assert.equal(entry,undefined);
});

test('checkpoints round-trip through all nine classes and multiple turns without state drift',()=>{
  for(const [index,heroClass] of (['warrior','shaman','rogue','paladin','hunter','druid','warlock','mage','priest'] as const).entries()){
    let duel=new LocalDuel({...savedInput,deck:practiceDeck(catalog,heroClass),heroClass,seed:700+index,style:'legendary'});
    for(let step=0;step<80;step++){
      const now=Date.now(),snapshot=duel.checkpoint(now)!;duel=LocalDuel.restore(snapshot,catalog,hash,undefined,now);assert.deepEqual(duel.checkpoint(now),snapshot,`${heroClass} step ${step}`);
      const view=duel.view().state!;if(view.phase==='finished')break;
      if(duel.botReady())duel.botStep();else{let acted=false;for(const action of rankBotActions(view,catalog,0,3)){try{duel.act(view.revision,action);acted=true;break;}catch{}}assert.ok(acted,`${heroClass} step ${step}`);}
    }
  }
});

test('device AI budget respects performance modes and the 25 difficulty scale',()=>{
  const low=deviceBudget(25,'auto',{cores:2,memoryGb:2}),high=deviceBudget(25,'auto',{cores:8,memoryGb:8});
  assert.ok(low.nodeLimit<high.nodeLimit);assert.ok(low.deadlineMs<high.deadlineMs);
  assert.ok(deviceBudget(25,'fast').nodeLimit<deviceBudget(25,'strong').nodeLimit);
  assert.ok(deviceBudget(25,'strong').deadlineMs<=3000);
  assert.ok(deviceBudget(6).nodeLimit<deviceBudget(25).nodeLimit);
});
test('public AI profile validates the catalog, generation and all coefficients',()=>{
  const p={catalogHash:'abc',generation:4,weights:DEFAULT_BOT_WEIGHTS};
  assert.deepEqual(parsePublicAiProfile(p,'abc'),p);
  assert.equal(parsePublicAiProfile(p,'xyz'),null);
  assert.equal(parsePublicAiProfile({...p,generation:-1},'abc'),null);
  assert.equal(parsePublicAiProfile({...p,weights:{...p.weights,health:-4}},'abc'),null);
});
test('complete local match has legal revision ordering and no private opponent cards',()=>{
  const duel=new LocalDuel(input);
  const initial=duel.view();assert.equal(initial.botEngine,'device');assert.equal(initial.botTrainingGeneration,4);assert.equal(initial.botDeckStyle,'aggression');
  assert.throws(()=>duel.act(100,{type:'mulligan',replace:[]}),/오래된/);
  let steps=0;
  for(;steps<650;steps++){
    const view=duel.view().state!;
    assert.equal('hand' in view.opponent,false);assert.equal('deck' in view.opponent,false);assert.equal('secrets' in view.opponent,false);assert.equal('rng' in view,false);
    for(const h of view.self.hand)assert.match(h.instanceId,/^[a-f0-9]{32}$/);
    if(view.phase==='finished')break;
    if(duel.botReady())assert.equal(duel.botStep(),true);
    else{
      const candidates=rankBotActions(view,catalog,0,3);let success=false;
      for(const action of candidates){try{duel.act(view.revision,action);success=true;break;}catch{}}
      assert.ok(success,`No legal action at revision ${view.revision}`);
    }
    assert.ok(duel.view().state!.revision>view.revision);
  }
  assert.equal(duel.view().status,'finished',`steps=${steps}`);assert.ok(steps>5);
});
test('solo initiative and replay deck seed are independent of fresh shuffle seed',()=>{
  const first=new LocalDuel({...input,firstPlayer:0,deckSeed:55}),second=new LocalDuel({...input,firstPlayer:1,deckSeed:55,seed:721});
  assert.equal(first.view().state?.firstPlayer,0);assert.equal(second.view().state?.firstPlayer,1);
  assert.equal(first.view().botDeckStyle,second.view().botDeckStyle);
  assert.notDeepEqual(first.view().state?.self.hand.map(h=>h.instanceId),second.view().state?.self.hand.map(h=>h.instanceId));
});
test('instant local AI pacing preserves rules and does not require animation delay',()=>{const duel=new LocalDuel({...input,animationSpeed:'instant'});assert.equal(duel.view().animationSpeed,'instant');assert.equal(duel.botDelay(),35);const rev=duel.view().state!.revision;duel.act(rev,{type:'mulligan',replace:[]});assert.equal(duel.botStep(),true);assert.equal(duel.view().state?.phase,'playing');assert.equal(duel.botDelay(),35);});
test('actual worker receives commands and emits a redacted playable match',{timeout:10000},async t=>{
  const worker=new Worker(new URL('./node-local-worker-harness.ts',import.meta.url),{workerData:{url:new URL('../src/local-duel.worker.ts',import.meta.url).href}});
  t.after(async()=>{await worker.terminate();});
  function next(predicate:(m:LocalResponse)=>boolean){return new Promise<LocalResponse>((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(Error('Worker response timeout'));},4000);
    const receive=(m:LocalResponse)=>{if(m.type==='error'){cleanup();reject(Error(m.error));}else if(predicate(m)){cleanup();resolve(m);}};
    const fail=(e:Error)=>{cleanup();reject(e);};
    const cleanup=()=>{clearTimeout(timer);worker.off('message',receive);worker.off('error',fail);};
    worker.on('message',receive);worker.on('error',fail);
  });}
  const start=next(m=>m.type==='view');worker.postMessage({type:'start',input} satisfies LocalRequest);
  const started=await start;assert.equal(started.type,'view');assert.equal(started.view.state!.phase,'mulligan');
  const playing=next(m=>m.type==='view'&&m.view.state?.phase==='playing');
  worker.postMessage({type:'act',requestId:1,revision:started.view.state!.revision,action:{type:'mulligan',replace:[]}} satisfies LocalRequest);
  const ready=await playing;assert.equal(ready.type,'view');assert.equal('hand' in ready.view.state!.opponent,false);
  const finished=next(m=>m.type==='view'&&m.view.status==='finished');worker.postMessage({type:'act',requestId:2,revision:ready.view.state!.revision,action:{type:'concede'}} satisfies LocalRequest);
  assert.equal((await finished).type,'view');
});
