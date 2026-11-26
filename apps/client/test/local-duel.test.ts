import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createCatalog,HERO_TOKENS,practiceDeck,rankBotActions,DEFAULT_BOT_WEIGHTS} from '../../../packages/engine/src/index.ts';
import type {LocalDuelInput,LocalResponse,LocalRequest} from '../src/local-duel.ts';
import {LocalDuel,publicSaveSummary} from '../src/local-duel.ts';
import {saveWriteAllowed,saveRemoveAllowed,IndexedLocalSaveStore,slotOverview,otherActiveRankedSave,rankedClaimAllowedAcrossVersions} from '../src/local-save-store.ts';
import type {Entry,LocalSaveStore} from '../src/local-save-store.ts';
import {attachLocalDuel} from '../src/local-duel-session.ts';
import type {LocalDuelScope} from '../src/local-duel-session.ts';
import {deviceBudget} from '../src/device-budget.ts';
import {parsePublicAiProfile} from '../src/local-profile.ts';
import {createOfflineRankedInput,createOfflineDeveloperInput,offlineGrowth,offlineRankProgress,readOfflineGrowth,settleOfflineRanked,createGrowthBackup,decodeGrowthBackup,canRestoreGrowth} from '../src/offline-growth.ts';
import type {OfflineGrowthRecord} from '../src/offline-growth.ts';
import {canReplaceRankedSave,activeRankedSave} from '../src/local-save-store.ts';
import {rankedBotDeck,rankInfo,ownedDeck,questStatus,recommendedOwnedDeck,rankedXpReward,rankedQuestBonus} from '../../../packages/progression.ts';
import {createSlotBackup,decodeSlotBackup,growthBackupPart,deckBackupPart,prepareSlotRestore} from '../src/slot-backup.ts';
import {parseDeckBackup,mergeDeckLibraries,decksKey} from '../src/named-decks.ts';
import type {DeckLibraryBackup} from '../src/named-decks.ts';

const catalog={...createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8'))),...Object.fromEntries(HERO_TOKENS.map(c=>[c.id,c]))};
const input:LocalDuelInput={catalog,deck:practiceDeck(catalog,'mage'),heroClass:'warrior',difficulty:3,seed:729,code:'LOCAL-TEST',style:'aggression',generation:4};
const hash='a'.repeat(64),savedInput={...input,catalogHash:hash,firstPlayer:0 as const};

test('developer free battles use the exact selected deck and reject class mismatches',()=>{
  const opponent=practiceDeck(catalog,'warrior');
  const duel=new LocalDuel({...savedInput,developerFree:true,developerOpponentDeck:opponent});
  const snapshot=duel.checkpoint()!;
  const cards=[...snapshot.state.players[1].deck,...snapshot.state.players[1].hand].map(card=>card.cardId);
  assert.deepEqual(cards.sort(),[...opponent.cards].sort());
  const restored=LocalDuel.restore(snapshot,catalog,hash);
  restored.forfeit();
  assert.deepEqual(restored.rematch('free-rematch',144).checkpoint()!.input.developerOpponentDeck,opponent);
  assert.throws(()=>new LocalDuel({...savedInput,developerFree:true,developerOpponentDeck:savedInput.deck}),/상대 AI 직업/);
  assert.throws(()=>new LocalDuel({...savedInput,developerOpponentDeck:opponent}),/상대 AI 직업/);
});

test('rank progress reports wins and XP independently without changing stored growth',()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),threshold=rankInfo(2,growth.ranks).minimumXp??0;
  const profile={...initial.profile,rankWins:1,xp:Math.max(0,threshold-15)},before=structuredClone(profile),progress=offlineRankProgress(profile,growth);assert.equal(progress.complete,false);if(progress.complete)throw Error('unexpected maximum rank');
  assert.equal(progress.next.rank,2);assert.equal(progress.winsRemaining,growth.winsPerRank-1);assert.equal(progress.xpRemaining,Math.min(15,threshold));assert.deepEqual(profile,before);
  const xpReady=offlineRankProgress({...profile,xp:threshold+100},growth);if(xpReady.complete)throw Error('unexpected maximum rank');assert.equal(xpReady.xpRemaining,0);assert.equal(xpReady.xpBarValue,xpReady.xpBarMax);assert.ok(xpReady.winsRemaining>0);
  const ready=offlineRankProgress({...profile,xp:threshold,rankWins:growth.winsPerRank},growth);if(ready.complete)throw Error('unexpected maximum rank');assert.equal(ready.winsRemaining,0);assert.equal(ready.xpRemaining,0);
  assert.deepEqual(offlineRankProgress({...profile,rank:25},growth),{complete:true});
});

test('portable combined backup independently restores validated growth and named decks, preserves old backup formats',()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),ranked=createOfflineRankedInput(savedInput,initial,growth),record=settleOfflineRanked(initial,growth,ranked.ranked!,{matchId:ranked.code,rank:1,heroClass:'mage',opponentClass:'warrior',mode:'ranked',outcome:'win',eligible:true,completedAt:10,turns:12});
  const timestamp='2026-11-22T12:00:00Z',progress=createGrowthBackup(record,growth,timestamp),decks:DeckLibraryBackup={format:'card-duel-saved-decks',schema:1,exportedAt:timestamp,decks:[{name:'마법사',deck:savedInput.deck}]};
  const bundle=createSlotBackup(2,progress,decks,growth,timestamp),wire=JSON.parse(JSON.stringify(bundle));assert.equal(decodeSlotBackup(wire,growth).sourceSlot,2);assert.deepEqual(decodeGrowthBackup(growthBackupPart(wire,growth),growth),record);assert.deepEqual(parseDeckBackup(deckBackupPart(wire,growth)),decks.decks);
  assert.equal(canRestoreGrowth(initial),true);assert.equal(canRestoreGrowth(record),false);
  const current=[{name:'마법사',deck:practiceDeck(catalog,'warrior')}],merged=mergeDeckLibraries(current,parseDeckBackup(deckBackupPart(wire,growth)));assert.equal(merged.decks.length,2);assert.deepEqual(merged.decks[0],current[0]);assert.equal(merged.renamed,1);
  assert.equal(growthBackupPart(progress,growth),progress);assert.equal(deckBackupPart(decks,growth),decks);
  assert.throws(()=>growthBackupPart({...wire,decks:{}},growth));assert.throws(()=>deckBackupPart({...wire,growth:{}},growth));assert.throws(()=>decodeSlotBackup({...wire,sourceSlot:99},growth));assert.throws(()=>decodeSlotBackup({...wire,schema:2},growth));assert.equal('state' in bundle,false);
});

test('combined restore preflights without writes, then adds only decks after growth and preserves intervening records',()=>{
  const growth=offlineGrowth(catalog),record=readOfflineGrowth(undefined,growth),stamp='2026-11-22T12:00:00Z';
  const named={name:'마법사',deck:savedInput.deck},other={name:'마법사',deck:practiceDeck(catalog,'warrior')};
  const bundle=createSlotBackup(2,createGrowthBackup(record,growth,stamp),{format:'card-duel-saved-decks',schema:1,exportedAt:stamp,decks:[named]},growth,stamp);
  let value:string|null=null,writes=0,denied=false;const store={getItem:(key:string)=>{assert.equal(key,decksKey);return value;},setItem:(key:string,next:string)=>{assert.equal(key,decksKey);if(denied)throw Error('write denied');value=next;writes++;}};
  const staged=prepareSlotRestore(bundle,growth,store);assert.equal(staged.sourceSlot,2);assert.equal(staged.preview.added,1);assert.equal(writes,0);assert.deepEqual(decodeGrowthBackup(staged.growth,growth),record);
  // A different tab changes its deck list while the growth transaction runs.
  value=JSON.stringify([other]);denied=true;assert.throws(()=>staged.restoreDecks(),/write denied/);assert.equal(value,JSON.stringify([other]));assert.equal(writes,0);
  denied=false;const result=staged.restoreDecks();assert.equal(result.renamed,1);assert.equal(result.added,1);assert.deepEqual(result.decks[0],other);assert.deepEqual(result.decks[1].deck,named.deck);assert.equal(writes,1);
  assert.equal(staged.restoreDecks().added,0);assert.equal(writes,1,'repeat is idempotent');
  value=JSON.stringify(Array.from({length:20},(_,i)=>({name:`existing ${i}`,deck:other.deck})));const before=value;
  assert.throws(()=>prepareSlotRestore(bundle,growth,store),/최대 20/);assert.equal(value,before);assert.equal(writes,1);
  assert.throws(()=>prepareSlotRestore({...bundle,growth:{}},growth,store));assert.equal(writes,1);
});

test('slot overview is read-only, distinguishes existing/old-version saves and never returns private state',async()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),checkpoint=new LocalDuel(savedInput).checkpoint()!,entry:Entry={hash,owner:'test',snapshot:checkpoint};
  const preview=slotOverview(initial,entry,2,hash,growth);assert.equal(preview.initialized,true);assert.equal(preview.rank,1);assert.equal(preview.otherSaves,1);assert.deepEqual(preview.save,checkpoint.summary);assert.equal('state' in preview,false);assert.equal('state' in preview.save!,false);
  assert.equal(slotOverview(undefined,undefined,0,hash,growth).initialized,false);assert.equal(slotOverview(undefined,undefined,1,hash,growth).otherSaves,1);assert.throws(()=>slotOverview(undefined,entry,0,hash,growth));assert.throws(()=>slotOverview({schema:99},undefined,0,hash,growth));
  const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB'),modes:string[]=[],names:string[]=[],matchReads:string[]=[];
  const oldHash='c'.repeat(64),oldEntry={...entry,hash:oldHash,snapshot:new LocalDuel({...savedInput,catalogHash:oldHash}).checkpoint()!};
  const records=new Map<string,{record:unknown;entry?:Entry;entries:Entry[]}>([['card-duel-solo-saves-v1',{record:initial,entry,entries:[entry,oldEntry]}],['card-duel-solo-saves-v1-slot-2',{record:undefined,entries:[]}]]);
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(name:string){names.push(name);const data=records.get(name)!;const request={onsuccess:()=>{},result:{transaction(_stores:unknown,mode:string){modes.push(mode);const tx={oncomplete:()=>{},objectStore(store:string){return store==='matches'?{get:()=>{matchReads.push('get');return {result:data.entry};},getAll:()=>{matchReads.push('getAll');return {result:data.entries};}}:{get:()=>({result:data.record})};}};queueMicrotask(()=>tx.oncomplete());return tx;}}};queueMicrotask(()=>request.onsuccess());return request;}}});
  try{assert.deepEqual(await new IndexedLocalSaveStore(1).inspectSlot(hash,growth),preview);assert.deepEqual(await new IndexedLocalSaveStore(2).inspectSlot(hash,growth),slotOverview(undefined,undefined,0,hash,growth));assert.deepEqual(names,['card-duel-solo-saves-v1','card-duel-solo-saves-v1-slot-2']);assert.deepEqual(modes,['readonly','readonly']);assert.deepEqual(matchReads,['getAll','getAll']);}finally{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}
});

test('IndexedDB retries a failed or blocked open and closes superseded connections',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
  const requests:any[]=[],connections:any[]=[];let closes=0;
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(name:string){assert.equal(name,'card-duel-solo-saves-v1-slot-2');const db={close(){closes++;},transaction(){const tx={oncomplete:()=>{},objectStore:()=>({get:()=>({result:undefined})})};queueMicrotask(()=>tx.oncomplete());return tx;}};connections.push(db);const request:any={error:Error('temporary failure'),result:db};requests.push(request);queueMicrotask(()=>{if(requests.length===1)request.onerror();else if(requests.length===2)request.onblocked();else request.onsuccess();});return request;}}});
  try{
    const store=new IndexedLocalSaveStore(2);await assert.rejects(store.read(hash),/temporary failure/);await assert.rejects(store.read(hash),/다른 탭/);
    assert.equal(await store.read(hash),null);requests[1].onsuccess();assert.equal(closes,1);
    assert.equal(await store.read(hash),null);assert.equal(requests.length,3);
    connections[2].onversionchange();assert.equal(closes,2);assert.equal(await store.read(hash),null);assert.equal(requests.length,4);
    connections[3].onclose();assert.equal(await store.read(hash),null);assert.equal(requests.length,5);
  }finally{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}
});

test('a corrupt existing IndexedDB entry is not reported as an empty save or a valid slot preview',async()=>{
  const growth=offlineGrowth(catalog),snapshot=new LocalDuel(savedInput).checkpoint()!,valid:Entry={hash,owner:'tab',snapshot};
  const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');let current:unknown;
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){const request={onsuccess:()=>{},result:{transaction(){const tx={oncomplete:()=>{},objectStore:()=>({get:()=>({result:current})})};queueMicrotask(()=>tx.oncomplete());return tx;}}};queueMicrotask(()=>request.onsuccess());return request;}}});
  try{const store=new IndexedLocalSaveStore(1);assert.equal(await store.read(hash),null);current=valid;assert.deepEqual(await store.read(hash),snapshot);
    for(const corrupt of [null,{hash,owner:'tab'}, {...valid,hash:'b'.repeat(64)},{...valid,snapshot:{...snapshot,state:{...snapshot.state,revision:snapshot.state.revision+1}}}]){
      current=corrupt;await assert.rejects(store.read(hash),/손상|일치/);assert.throws(()=>slotOverview(undefined,corrupt as Entry,1,hash,growth),/손상|일치/);
    }
    current=valid;assert.deepEqual(await store.read(hash),snapshot);
  }finally{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}
});

test('card version changes cannot create a second active ranked game, while old saves remain resumable',async t=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),oldHash='b'.repeat(64),oldInput=createOfflineRankedInput({...savedInput,catalogHash:oldHash,code:'old'},initial,growth),old=new LocalDuel(oldInput),oldEntry:Entry={hash:oldHash,owner:'tab',snapshot:old.checkpoint()!};
  const next=new LocalDuel(createOfflineRankedInput({...savedInput,code:'next'},initial,growth)).checkpoint()!;
  assert.equal(otherActiveRankedSave([oldEntry],hash),true);assert.equal(rankedClaimAllowedAcrossVersions([oldEntry],undefined,next),false);assert.equal(rankedClaimAllowedAcrossVersions([oldEntry],oldEntry,oldEntry.snapshot),true);
  old.act(old.view().state!.revision,{type:'concede'});assert.equal(rankedClaimAllowedAcrossVersions([{...oldEntry,snapshot:old.checkpoint()!}],undefined,next),true);
  let writeCalls=0;const store:LocalSaveStore={async read(){return null;},async write(){writeCalls++;return true;},async remove(){return false;},async readGrowth(){return initial;},async inspectSlot(){return slotOverview(initial,undefined,1,hash,growth,true);}};
  let receive:(response:LocalResponse)=>void=()=>{};const scope:LocalDuelScope={postMessage:response=>receive(response),onmessage:()=>{}};t.after(attachLocalDuel(scope,store,'tab'));
  const result=new Promise<LocalResponse>(resolve=>{receive=resolve;});scope.onmessage({data:{type:'start',input:savedInput,ranked:true}});const reply=await result;assert.equal(reply.type,'error');if(reply.type==='error')assert.match(reply.error,/이전 카드 버전/);assert.equal(writeCalls,0);
});

test('malformed checkpoint metadata fails closed instead of being mistaken for a replaceable practice save',()=>{
  const snapshot=new LocalDuel(savedInput).checkpoint()!,entry={hash,owner:'tab',snapshot},other=new LocalDuel({...savedInput,code:'new'}).checkpoint()!;
  assert.equal(activeRankedSave(entry),false);assert.equal(canReplaceRankedSave(entry,other),true);
  for(const corrupt of [{...entry,snapshot:{...snapshot,input:undefined}},{...entry,snapshot:{...snapshot,state:{...snapshot.state,revision:snapshot.state.revision+1}}},{...entry,hash:'b'.repeat(64)}] as Entry[]){
    assert.throws(()=>activeRankedSave(corrupt),/손상|일치/);assert.throws(()=>canReplaceRankedSave(corrupt,other),/손상|일치/);
    assert.throws(()=>otherActiveRankedSave([corrupt],'d'.repeat(64)),/손상|일치/);
  }
});

test('new ranked claim rechecks old-version active saves inside the write transaction',async()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),oldHash='b'.repeat(64),old=new LocalDuel(createOfflineRankedInput({...savedInput,catalogHash:oldHash,code:'old-race'},initial,growth)),next=new LocalDuel(createOfflineRankedInput({...savedInput,code:'new-race'},initial,growth)).checkpoint()!;
  let entries:Entry[]=[{hash:oldHash,owner:'previous-tab',snapshot:old.checkpoint()!}],writes=0,growthReads=0,checks=0;
  const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
  const request=(result:unknown)=>{const r={result,onsuccess:()=>{}};queueMicrotask(()=>r.onsuccess());return r;};
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){const r={onsuccess:()=>{},result:{transaction(_stores:unknown,mode:string){assert.equal(mode,'readwrite');const tx={oncomplete:()=>{},objectStore(name:string){return name==='matches'?{get:()=>request(undefined),getAll:()=>{checks++;return request(entries);},put:()=>writes++}:{get:()=>{growthReads++;return request(initial);},put:()=>writes++};}};setImmediate(()=>tx.oncomplete());return tx;}}};queueMicrotask(()=>r.onsuccess());return r;}}});
  try{const store=new IndexedLocalSaveStore(1);assert.equal(await store.write(next,'new-tab',true,null,{growth}),false);assert.equal(checks,1);assert.equal(growthReads,0);assert.equal(writes,0);
    old.act(old.view().state!.revision,{type:'concede'});entries=[{...entries[0],snapshot:old.checkpoint()!}];assert.equal(await store.write(next,'new-tab',true,null,{growth}),true);assert.equal(checks,2);assert.equal(growthReads,1);assert.equal(writes,2);
  }finally{if(original)Object.defineProperty(globalThis,'indexedDB',original);else Reflect.deleteProperty(globalThis,'indexedDB');}
});

test('actual workers bind exactly one slot database; invalid initial selection never falls back to legacy',{timeout:10000},async()=>{
  for(const slot of [1,2,3,4]){
    const worker=new Worker(new URL('./node-local-worker-harness.ts',import.meta.url),{workerData:{url:new URL('../src/local-duel.worker.ts',import.meta.url).href,inspectDatabase:true}});
    try{
      const seen:Record<string,unknown>[]=[];const completion=new Promise<void>(resolve=>worker.on('message',message=>{seen.push(message);if(seen.filter(m=>m.type==='saveInfo'||m.type==='error').length===2)resolve();}));
      if(slot!==1)worker.postMessage({type:'selectSlot',slot});
      worker.postMessage({type:'inspectSave',catalogHash:hash});worker.postMessage({type:'selectSlot',slot:1});
      await completion;
      const opened=seen.filter(m=>m.type==='databaseOpened');
      if(slot===4){assert.equal(opened.length,0);assert.ok(seen.every(m=>m.type==='error'));}
      else {assert.deepEqual(opened,[{type:'databaseOpened',name:slot===1?'card-duel-solo-saves-v1':`card-duel-solo-saves-v1-slot-${slot}`,version:2}]);}
    }finally{await worker.terminate();}
  }
});

test('offline ranked matches use the actual tier deck and intelligence, never practice settings',()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth);assert.equal(initial.profile.rank,1);assert.equal(initial.profile.xp,0);
  assert.ok(initial.profile.ownedCards.length<growth.starterIds.length+growth.unlocks.length);
  for(const tier of growth.ranks){const record={...initial,profile:{...initial.profile,rank:tier.rank}},ranked=createOfflineRankedInput({...savedInput,difficulty:25,style:'legendary',deviceMode:'fast'},record,growth),duel=new LocalDuel(ranked),checkpoint=duel.checkpoint()!;
    assert.equal(duel.view().ranked?.rank,tier.rank);assert.equal(duel.view().botDifficulty,tier.intelligence);assert.equal(ranked.firstPlayer,undefined);assert.equal(ranked.deviceMode,'auto');
    assert.deepEqual(ranked.ranked!.opponentDeck,rankedBotDeck(catalog,growth,ranked.heroClass,tier.deckPower,ranked.deckSeed!));
    assert.deepEqual(LocalDuel.restore(checkpoint,catalog,hash).checkpoint(Date.parse(checkpoint.summary.savedAt)),checkpoint);
  }
  const locked=growth.unlocks.find(c=>catalog[c.cardId].kind!=='coin'&&['mage','neutral'].includes((catalog[c.cardId] as {class?:string}).class??''))!;
  const illegal={...savedInput.deck,cards:[...savedInput.deck.cards.slice(1),locked.cardId]};assert.throws(()=>createOfflineRankedInput({...savedInput,deck:illegal},initial,growth));
  const ranked=createOfflineRankedInput(savedInput,initial,growth),entry={hash,owner:'x',snapshot:new LocalDuel(ranked).checkpoint()!};assert.ok(activeRankedSave(entry));assert.equal(canReplaceRankedSave(entry,new LocalDuel({...savedInput,code:'other'}).checkpoint()!),false);
});
test('developer tier test uses identical ranked opponents with no reward and restores its test identity',()=>{
  const growth=offlineGrowth(catalog),input=createOfflineDeveloperInput(savedInput,growth,25),duel=new LocalDuel(input);assert.equal(duel.view().developerTest?.rank,25);assert.equal(duel.view().ranked,undefined);assert.equal(duel.view().botDifficulty,25);assert.deepEqual(input.developerTest!.opponentDeck,rankedBotDeck(catalog,growth,input.heroClass,25,input.deckSeed!));
  duel.act(0,{type:'concede'});assert.equal(duel.rankedAward(),undefined);const restored=LocalDuel.restore(duel.checkpoint()!,catalog,hash);assert.equal(restored.view().developerTest?.rank,25);assert.equal(restored.rankedAward(),undefined);assert.throws(()=>createOfflineDeveloperInput(savedInput,growth,26),/1~25/);
});

test('experimental ladder is explicitly developer-only, preserves its checkpoint and never grants ranked XP',()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),normal=createOfflineDeveloperInput(savedInput,growth,12),experimental=createOfflineDeveloperInput(savedInput,growth,12,true);
  assert.deepEqual(normal.developerTest?.opponentDeck,experimental.developerTest?.opponentDeck);assert.equal(normal.developerTest?.experiment,undefined);assert.equal(experimental.developerTest?.experiment,'mixture-v1');
  const duel=new LocalDuel(experimental),first=duel.view();assert.equal(first.developerTest?.experiment,'mixture-v1');assert.equal(first.ranked,undefined);
  duel.act(first.state!.revision,{type:'mulligan',replace:[]});assert.ok(duel.botStep());
  const saved=duel.checkpoint()!;assert.equal(saved.summary.testExperiment,'mixture-v1');assert.equal(publicSaveSummary(saved,hash).testExperiment,'mixture-v1');
  const restored=LocalDuel.restore(saved,catalog,hash);assert.equal(restored.view().developerTest?.experiment,'mixture-v1');assert.equal(restored.view().ranked,undefined);
  restored.act(restored.view().state!.revision,{type:'concede'});assert.equal(restored.rankedAward(),undefined);assert.equal(restored.rematch('another-experiment',33).view().developerTest?.experiment,'mixture-v1');
  assert.throws(()=>publicSaveSummary({...saved,summary:{...saved.summary,testExperiment:undefined}},hash),/랭크 경기/);
  const ranked=createOfflineRankedInput(savedInput,initial,growth);assert.equal(ranked.developerTest,undefined);assert.throws(()=>new LocalDuel({...ranked,ranked:{...ranked.ranked!,experiment:'mixture-v1'} as typeof ranked.ranked}),/개발자 시험/);
});

test('offline ledger preserves old receipts, guards duplicate settlement and carries ownership across patches',()=>{
  const growth=offlineGrowth(catalog);let record=readOfflineGrowth(undefined,growth);let oldest:ReturnType<typeof createOfflineRankedInput>['ranked'];
  for(let i=0;i<45;i++){const ranked=createOfflineRankedInput({...savedInput,code:`offline-${i}`,deck:practiceDeck(catalog,'warrior')},record,growth);const context=ranked.ranked!;if(i===0)oldest=context;
    record=settleOfflineRanked(record,growth,context,{matchId:ranked.code,rank:context.rank,heroClass:'warrior',mode:'ranked',outcome:'win',eligible:true,completedAt:i,turns:12});
  }
  assert.equal(record.profile.revision,45);assert.equal(record.profile.recentMatches?.length,30);assert.equal(record.settledMatchIds.length,45);assert.ok(record.profile.rank>1);assert.ok(record.profile.xp>0);
  const duplicate={matchId:'offline-0',rank:oldest!.rank,heroClass:'warrior' as const,mode:'ranked' as const,outcome:'win' as const,eligible:true};assert.equal(settleOfflineRanked(record,growth,oldest!,duplicate),record);
  assert.throws(()=>settleOfflineRanked(record,growth,oldest!,{...duplicate,matchId:'new-but-stale'}),/변경/);
  const patched=readOfflineGrowth(structuredClone(record),{...growth,unlocks:growth.unlocks.map(c=>({...c,xp:c.xp+99999}))});assert.deepEqual(patched.profile.ownedCards,record.profile.ownedCards);
  assert.throws(()=>readOfflineGrowth({...record,settledMatchIds:[]},growth),/원장/);
  ownedDeck(practiceDeck(catalog,'mage'),catalog,record.profile);assert.equal(rankInfo(record.profile.rank,growth.ranks).rank,record.profile.rank);
});

test('144 synthetic offline ranked results reach the complete ladder, cycle nine quests, and survive backup reloads',()=>{
  const growth=offlineGrowth(catalog);let record=readOfflineGrowth(undefined,growth),expectedXp=0,allCardsAt=0;
  const visited=new Set<number>(),questClasses=new Set<string>();let first:ReturnType<typeof createOfflineRankedInput>['ranked'];
  for(let i=0;i<144;i++){
    const profile=record.profile,quest=questStatus(profile.questGames),outcome=i%2===0?'win':'loss';
    const deck=recommendedOwnedDeck(catalog,growth,quest.heroClass,profile,i+1),ranked=createOfflineRankedInput({...savedInput,seed:i+1,code:`full-growth-${i}`,deck},record,growth),context=ranked.ranked!;
    if(i===0)first=context;visited.add(context.rank);questClasses.add(quest.heroClass);
    expectedXp+=rankedXpReward(context.rank,outcome)+(quest.games===9?rankedQuestBonus(context.rank):0);
    record=settleOfflineRanked(record,growth,context,{matchId:ranked.code,rank:context.rank,heroClass:quest.heroClass,mode:'ranked',outcome,eligible:true,completedAt:i,turns:12});
    assert.equal(record.profile.xp,expectedXp);assert.equal(record.profile.questGames,i+1);assert.ok(record.profile.rank>=profile.rank&&record.profile.rank<=profile.rank+1);assert.ok(profile.ownedCards.every(id=>record.profile.ownedCards.includes(id)));
    if(!allCardsAt&&record.profile.ownedCards.length===382)allCardsAt=i+1;
    if((i+1)%30===0)record=decodeGrowthBackup(JSON.parse(JSON.stringify(createGrowthBackup(record,growth))),growth);
  }
  assert.equal(visited.size,25);assert.equal(questClasses.size,9);assert.equal(record.profile.rank,25);assert.equal(record.profile.ownedCards.length,382);assert.ok(allCardsAt>0&&allCardsAt<144);
  assert.equal(record.profile.matchStats?.ranked.wins,72);assert.equal(record.profile.matchStats?.ranked.losses,72);assert.equal(questStatus(record.profile.questGames).completed,14);assert.equal(record.profile.revision,144);assert.equal(record.settledMatchIds.length,144);
  assert.equal(settleOfflineRanked(record,growth,first!,{matchId:'full-growth-0',rank:1,heroClass:'warrior',mode:'ranked',outcome:'win',eligible:true}),record);
});

test('offline ranked worker saves results with checkpoint and cannot grant the same early concession twice',async t=>{
  let entry:Entry|undefined,record:OfflineGrowthRecord|undefined;
  const store:LocalSaveStore={async read(){return structuredClone(entry?.snapshot??null);},async readGrowth(growth){return readOfflineGrowth(structuredClone(record),growth);},async write(snapshot,owner,claim,expected,ranked){if(!saveWriteAllowed(entry,owner,claim,expected)||!canReplaceRankedSave(entry,snapshot))return false;if(ranked){record=readOfflineGrowth(record,ranked.growth);if(ranked.award)record=settleOfflineRanked(record,ranked.growth,snapshot.input.ranked!,ranked.award);}entry={hash,owner,snapshot:structuredClone(snapshot)};return true;},async remove(_,owner,expected){if(!saveRemoveAllowed(entry,owner,expected)||activeRankedSave(entry))return false;entry=undefined;return true;}};
  const tab=(owner:string)=>{let receive:(m:LocalResponse)=>void=()=>{};const scope:LocalDuelScope={postMessage:m=>receive(m),onmessage:()=>{}};t.after(attachLocalDuel(scope,store,owner));return {send:(data:LocalRequest)=>new Promise<LocalResponse>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Worker command timeout')),3000);receive=m=>{clearTimeout(timeout);resolve(m);};scope.onmessage({data});})};};
  const a=tab('ranked-a'),b=tab('ranked-b');const started=await a.send({type:'start',input:savedInput,ranked:true});assert.equal(started.type,'view');assert.equal(started.view.ranked?.rank,1);assert.equal(started.save?.rank,1);
  const forbidden=await b.send({type:'start',input:{...savedInput,code:'forbidden'},ranked:true,developerExperiment:true});assert.equal(forbidden.type,'error');
  const blocked=await b.send({type:'start',input:{...savedInput,code:'other'},ranked:true,replaceSave:started.save});assert.equal(blocked.type,'error');
  const result=await a.send({type:'act',requestId:1,revision:0,action:{type:'concede'}});assert.equal(result.type,'view');assert.equal(result.view.ranked?.reward,'notEligible');assert.equal(result.profile?.xp,0);assert.equal(result.profile?.matchStats?.ranked.losses,1);assert.equal(record?.settledMatchIds.length,1);
  const resumed=await b.send({type:'resume',catalog,catalogHash:hash});assert.equal(resumed.type,'view');assert.equal(resumed.view.ranked?.reward,'notEligible');assert.equal(resumed.profile?.matchStats?.ranked.losses,1);assert.equal(record?.settledMatchIds.length,1);
});

test('a real completed offline ranked match feeds the same XP and unlock rules, and a backup restores only a fresh profile',()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth),ranked=createOfflineRankedInput({...savedInput,deck:practiceDeck(catalog,'warrior')},initial,growth),duel=new LocalDuel(ranked);
  let steps=0;for(;steps<650;steps++){const s=duel.view().state!;if(s.phase==='finished')break;if(duel.botReady()){assert.ok(duel.botStep());continue;}let acted=false;for(const action of rankBotActions(s,catalog,0,3)){try{duel.act(s.revision,action);acted=true;break;}catch{}}assert.ok(acted);}
  const award=duel.rankedAward();assert.ok(award&&award.eligible&&steps>5);const record=settleOfflineRanked(initial,growth,ranked.ranked!,award);assert.ok(record.profile.xp>0);assert.equal(record.profile.questGames,1);
  assert.equal(canRestoreGrowth(initial),true);assert.equal(canRestoreGrowth(record),false);const backup=createGrowthBackup(record,growth);assert.deepEqual(decodeGrowthBackup(JSON.parse(JSON.stringify(backup)),growth),record);
  assert.throws(()=>decodeGrowthBackup({...backup,format:'online-account'},growth),/지원하지/);assert.throws(()=>decodeGrowthBackup({...backup,record:{...record,settledMatchIds:['unrelated']}},growth),/원장/);
});

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

test('fresh practice save can recover a transient initial IndexedDB outage without replacing another match',async t=>{
  let entry:Entry|undefined,unavailable=true,claims=0;
  const store:LocalSaveStore={
    async read(){return structuredClone(entry?.snapshot??null);},
    async write(snapshot,owner,claim,expected){
      claims++;
      if(unavailable)throw Error('IndexedDB temporarily unavailable');
      if(!saveWriteAllowed(entry,owner,claim,expected))return false;
      entry={hash,owner,snapshot:structuredClone(snapshot)};return true;
    },
    async remove(){return false;}
  };
  let receive:(message:LocalResponse)=>void=()=>{};
  const scope:LocalDuelScope={postMessage:message=>receive(message),onmessage:()=>{}};
  t.after(attachLocalDuel(scope,store,'new-match-tab'));
  const send=(data:LocalRequest)=>new Promise<LocalResponse>(resolve=>{receive=resolve;scope.onmessage({data});});
  const started=await send({type:'start',input:{...savedInput,code:'PRACTICE-RECOVER'},replaceSave:null});
  assert.equal(started.type,'view');assert.equal(started.saveAvailable,false);
  assert.equal(started.saveRetryable,true,'a transient first claim must be offered as retryable');
  assert.equal(await store.read(hash),null);
  // Gameplay does not need to restart; the original exact no-save claim can
  // recover after the browser grants IndexedDB access again.
  unavailable=false;
  const saved=await send({type:'retrySave',requestId:1});
  assert.equal(saved.type,'view');assert.equal(saved.saveAvailable,true);assert.equal(saved.saveRetryable,false);
  assert.equal(entry?.snapshot.summary.code,'PRACTICE-RECOVER');assert.equal(claims,2);
});
test('continuing a game after its first save fails recovers through the next Pause, without state rollback',async t=>{
  let entry:Entry|undefined,unavailable=true,writes=0;
  const store:LocalSaveStore={
    async read(){return structuredClone(entry?.snapshot??null);},
    async write(snapshot,owner,claim,expected){
      writes++;if(unavailable)throw Error('write blocked');
      if(!saveWriteAllowed(entry,owner,claim,expected))return false;
      entry={hash,owner,snapshot:structuredClone(snapshot)};return true;
    },
    async remove(){return false;}
  };
  let receive:(message:LocalResponse)=>void=()=>{};
  const scope:LocalDuelScope={postMessage:message=>receive(message),onmessage:()=>{}};
  t.after(attachLocalDuel(scope,store,'offline-tab'));
  const send=(data:LocalRequest)=>new Promise<LocalResponse>(resolve=>{receive=resolve;scope.onmessage({data});});
  const initial=await send({type:'start',input:{...savedInput,code:'START-RECOVERY'},replaceSave:null});
  assert.equal(initial.type,'view');assert.equal(initial.saveRetryable,true);
  const changed=await send({type:'act',requestId:1,revision:0,action:{type:'mulligan',replace:[]}});
  assert.equal(changed.type,'view');assert.equal(changed.saveRetryable,true);
  assert.ok(changed.type==='view'&&changed.view.state!.revision>0);
  assert.equal(await store.read(hash),null);
  unavailable=false;
  const paused=await send({type:'pause',requestId:2});
  assert.equal(paused.type,'paused');assert.equal(entry?.snapshot.summary.code,'START-RECOVERY');
  assert.equal(entry?.snapshot.summary.revision,changed.type==='view'?changed.view.state!.revision:-1);
  assert.equal(writes,3,'initial, action, and recovered fenced Pause claim');
  const resumed=await send({type:'resume',catalog,catalogHash:hash,expectedCode:'START-RECOVERY'});
  assert.equal(resumed.type,'view');assert.equal(resumed.resumed,true);
  assert.equal(resumed.view.state?.revision,entry?.snapshot.summary.revision);
});

test('failed initial save retry never overwrites a newer save from a second tab',async t=>{
  let entry:Entry|undefined,unavailable=true,claims=0;
  const store:LocalSaveStore={
    async read(){return structuredClone(entry?.snapshot??null);},
    async write(snapshot,owner,claim,expected){
      claims++;
      if(unavailable)throw Error('IndexedDB blocked');
      if(!saveWriteAllowed(entry,owner,claim,expected))return false;
      entry={hash,owner,snapshot:structuredClone(snapshot)};return true;
    },
    async remove(){return false;}
  };
  let receive:(message:LocalResponse)=>void=()=>{};
  const scope:LocalDuelScope={postMessage:message=>receive(message),onmessage:()=>{}};
  t.after(attachLocalDuel(scope,store,'stale-tab'));
  const send=(data:LocalRequest)=>new Promise<LocalResponse>(resolve=>{receive=resolve;scope.onmessage({data});});
  assert.equal((await send({type:'start',input:{...savedInput,code:'UNSAVED-OLD'},replaceSave:null})).saveRetryable,true);
  entry={hash,owner:'new-tab',snapshot:new LocalDuel({...savedInput,code:'NEWER-SAFE'}).checkpoint()!};
  unavailable=false;
  const rejected=await send({type:'retrySave',requestId:2});
  assert.equal(rejected.type,'error');assert.equal(rejected.saveRetryable,false);
  assert.equal(entry.owner,'new-tab');assert.equal(entry.snapshot.summary.code,'NEWER-SAFE');
  assert.equal((await send({type:'retrySave',requestId:3})).type,'error');
  assert.equal(claims,2,'a rejected claim never loops or overwrites the newer tab');
});

test('worker can retry a transient save failure but cannot reclaim a stolen checkpoint',async t=>{
  let entry:Entry|undefined,fail=false,attempts=0;
  const store:LocalSaveStore={async read(){return structuredClone(entry?.snapshot??null);},async write(snapshot,owner,claim,expected){attempts++;if(fail)throw Error('temporary storage error');if(!saveWriteAllowed(entry,owner,claim,expected))return false;entry={hash,owner,snapshot:structuredClone(snapshot)};return true;},async remove(){return false;}};
  let receive:(m:LocalResponse)=>void=()=>{};const scope:LocalDuelScope={postMessage:m=>receive(m),onmessage:()=>{}};t.after(attachLocalDuel(scope,store,'original'));
  const send=(data:LocalRequest)=>new Promise<LocalResponse>(resolve=>{receive=resolve;scope.onmessage({data});});
  assert.equal((await send({type:'start',input:savedInput})).type,'view');fail=true;
  const failed=await send({type:'act',requestId:1,revision:0,action:{type:'concede'}});assert.equal(failed.type,'view');assert.equal(failed.saveAvailable,false);assert.equal(entry!.snapshot.summary.phase,'mulligan');
  fail=false;const saved=await send({type:'pause',requestId:2});assert.equal(saved.type,'paused');assert.equal(entry!.snapshot.summary.phase,'finished');assert.equal(attempts,3);
  assert.equal((await send({type:'resume',catalog,catalogHash:hash})).type,'view');fail=true;
  assert.equal((await send({type:'pause',requestId:3})).type,'error');entry!.owner='new-tab';fail=false;
  assert.equal((await send({type:'pause',requestId:4})).type,'error');assert.equal(entry!.owner,'new-tab');const count=attempts;
  assert.equal((await send({type:'pause',requestId:5})).type,'error');assert.equal(attempts,count);
});

test('retry save in place preserves the match and revision, is idempotent, and never reclaims a stolen save',async t=>{
  let entry:Entry|undefined,fail=false,attempts=0;
  const store:LocalSaveStore={async read(){return structuredClone(entry?.snapshot??null);},async write(snapshot,owner,claim,expected){attempts++;if(fail)throw Error('temporary storage error');if(!saveWriteAllowed(entry,owner,claim,expected))return false;entry={hash,owner,snapshot:structuredClone(snapshot)};return true;},async remove(){return false;}};
  let receive:(m:LocalResponse)=>void=()=>{};const scope:LocalDuelScope={postMessage:m=>receive(m),onmessage:()=>{}};t.after(attachLocalDuel(scope,store,'original'));
  const send=(data:LocalRequest)=>new Promise<LocalResponse>(resolve=>{receive=resolve;scope.onmessage({data});});
  await send({type:'start',input:savedInput});fail=true;
  const failed=await send({type:'act',requestId:1,revision:0,action:{type:'concede'}});assert.equal(failed.type,'view');assert.equal(failed.saveRetryable,true);assert.equal(failed.saveAvailable,false);
  const again=await send({type:'retrySave',requestId:2});assert.equal(again.type,'error');assert.equal(again.saveRetryable,true);
  fail=false;const recovered=await send({type:'retrySave',requestId:3});assert.equal(recovered.type,'view');assert.equal(recovered.requestId,3);assert.equal(recovered.saveAvailable,true);assert.equal(recovered.saveRetryable,false);assert.deepEqual(recovered.view.state,failed.view.state);assert.equal(recovered.view.code,failed.view.code);assert.equal(entry!.snapshot.summary.phase,'finished');
  const count=attempts;const duplicate=await send({type:'retrySave',requestId:4});assert.equal(duplicate.type,'view');assert.equal(attempts,count);
  // Simulate another tab changing ownership during a later transient failure.
  fail=true;assert.equal((await send({type:'pause',requestId:5})).type,'error');entry!.owner='new-tab';fail=false;
  const stolen=await send({type:'retrySave',requestId:6});assert.equal(stolen.type,'error');assert.equal(stolen.saveRetryable,false);assert.equal(entry!.owner,'new-tab');const fenced=attempts;
  assert.equal((await send({type:'retrySave',requestId:7})).type,'error');assert.equal(attempts,fenced);
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


test('exit while playing records a loss, and app relaunch settles an abandoned ranked save exactly once',async t=>{
  let entry:Entry|undefined,record:OfflineGrowthRecord|undefined;
  const store:LocalSaveStore={
    async read(){return structuredClone(entry?.snapshot??null);},
    async readGrowth(growth){return readOfflineGrowth(structuredClone(record),growth);},
    async write(snapshot,owner,claim,expected,ranked){
      if(!saveWriteAllowed(entry,owner,claim,expected)||!canReplaceRankedSave(entry,snapshot))return false;
      if(ranked){record=readOfflineGrowth(record,ranked.growth);if(ranked.award)record=settleOfflineRanked(record,ranked.growth,snapshot.input.ranked!,ranked.award);}
      entry={hash,owner,snapshot:structuredClone(snapshot)};return true;
    },
    async remove(_,owner,expected){if(!saveRemoveAllowed(entry,owner,expected)||activeRankedSave(entry))return false;entry=undefined;return true;}
  };
  const tab=(owner:string)=>{let receive:(m:LocalResponse)=>void=()=>{};const scope:LocalDuelScope={postMessage:m=>receive(m),onmessage:()=>{}};t.after(attachLocalDuel(scope,store,owner));return {send:(data:LocalRequest)=>new Promise<LocalResponse>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker timed out')),3000);receive=m=>{clearTimeout(timer);resolve(m);};scope.onmessage({data});})};};
  const first=tab('first');
  const started=await first.send({type:'start',input:savedInput,ranked:true});assert.equal(started.type,'view');assert.equal(entry?.snapshot.summary.phase,'mulligan');
  const exited=await first.send({type:'forfeit',requestId:1});assert.equal(exited.type,'forfeited');
  assert.equal(entry?.snapshot.summary.phase,'finished');assert.equal(entry?.snapshot.state.winner,1);assert.equal(entry?.snapshot.state.reason,'concede');
  assert.equal(record?.profile.matchStats?.ranked.losses,1);assert.equal(record?.profile.xp,0);
  const rerun=tab('reload'),existing=await rerun.send({type:'inspectSave',catalogHash:hash,catalog,settleAbandoned:true});assert.equal(existing.type,'saveInfo');assert.equal(existing.save?.phase,'finished');
  assert.equal(record?.profile.matchStats?.ranked.losses,1,'already settled results are never awarded twice');
  // Start another game and simulate the browser being killed without notifying the old worker.
  const second=await rerun.send({type:'start',input:{...savedInput,code:'abandoned-later'},ranked:true,replaceSave:existing.save});assert.equal(second.type,'view');
  assert.equal(entry?.snapshot.summary.phase,'mulligan');
  const reboot=tab('after-browser-close'),settled=await reboot.send({type:'inspectSave',catalogHash:hash,catalog,settleAbandoned:true});
  assert.equal(settled.type,'saveInfo');assert.equal(settled.save?.phase,'finished');
  assert.equal(entry?.snapshot.state.winner,1);assert.equal(entry?.snapshot.state.reason,'concede');
  assert.equal(record?.profile.matchStats?.ranked.losses,2);
  const check=await reboot.send({type:'inspectSave',catalogHash:hash,catalog,settleAbandoned:true});assert.equal(check.type,'saveInfo');
  assert.equal(record?.profile.matchStats?.ranked.losses,2,'restart must not count a second loss');
});


test('long growth ledger retains every match ID and rejects duplicate or missing recent IDs',()=>{
  const growth=offlineGrowth(catalog),initial=readOfflineGrowth(undefined,growth);
  const ranked=createOfflineRankedInput(savedInput,initial,growth);
  const record=settleOfflineRanked(initial,growth,ranked.ranked!,{matchId:ranked.code,rank:1,heroClass:'mage',opponentClass:'warrior',mode:'ranked',outcome:'win',eligible:true,completedAt:10,turns:12});
  const ids=[...Array.from({length:10000},(_,i)=>'historical-'+i),ranked.code];
  const long:OfflineGrowthRecord={...record,settledMatchIds:ids,profile:{...record.profile,revision:ids.length,matchStats:{...record.profile.matchStats!,ranked:{wins:1,losses:10000,draws:0}}}};
  const result=readOfflineGrowth(long,growth);
  assert.deepEqual(result.settledMatchIds,ids);assert.notEqual(result.settledMatchIds,ids);
  assert.throws(()=>readOfflineGrowth({...long,settledMatchIds:[...ids.slice(0,-1),ids[0]]},growth),/손상/);
  assert.throws(()=>readOfflineGrowth({...long,settledMatchIds:[...ids.slice(0,-1),'missing-recent']},growth),/원장/);
});
