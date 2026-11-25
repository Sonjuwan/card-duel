import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog, validateDeck, createGame, starterDeck, getPlayerView, applyAction } from '../../../packages/engine/src/index.ts';
import type { Deck } from '../../../packages/engine/src/index.ts';
import { draftKey,readDraft,saveDraft,readDeveloperDraft,saveDeveloperDraft,mergeRoomView } from '../src/storage.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import {backupDeckLibrary,restoreDeckLibrary,decksKey,mergeDeckLibraries,saveNamedDeck,deleteNamedDeck,withDeckLibraryLock,changedDeckLibrary,deckLibraryAfterWriteFailure,checkedDeckLibrary,isDeckLibraryStorageEvent} from '../src/named-decks.ts';
import {soloSlotStorage,soloSlotDatabase,rememberSlot,readSelectedSlot,hasSlotLocalData,currentSoloNamespace} from '../src/solo-slots.ts';
import {readSoloSettings,saveSoloSettings,DEFAULT_SOLO_SETTINGS,recordSoloResult,readSoloHistory} from '../src/solo-settings.ts';
const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.19.0.json',import.meta.url),'utf8')));
function store(){const m=new Map<string,string>();return {get length(){return m.size;},key:(i:number)=>[...m.keys()][i]??null,getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};}
test('three local save slots preserve legacy data and isolate draft, deck, settings and history keys',()=>{
  const backing=store(),one=soloSlotStorage(1,backing),two=soloSlotStorage(2,backing),three=soloSlotStorage(3,backing);
  assert.equal(hasSlotLocalData(1,backing),false);assert.equal(hasSlotLocalData(2,backing),false);rememberSlot(3,backing);assert.equal(hasSlotLocalData(1,backing),false);rememberSlot(1,backing);
  const old:Deck={heroClass:'mage',cards:['wolf']},newer:Deck={heroClass:'priest',cards:[]};
  // Pre-slot v0.20 draft without migration marker, plus a separate slot's draft.
  backing.setItem(draftKey('before'),JSON.stringify(old));saveDraft(newer,'other',two);
  assert.equal(hasSlotLocalData(1,backing),true);assert.equal(hasSlotLocalData(2,backing),true);assert.equal(hasSlotLocalData(3,backing),false);
  assert.deepEqual(readDraft(catalog,'after',one),old);assert.deepEqual(readDraft(catalog,'after',two),newer);assert.notDeepEqual(readDraft(catalog,'after',three),old);
  assert.equal(backing.getItem(draftKey('before')),JSON.stringify(old));assert.ok(saveDeveloperDraft(newer,'after',three));assert.notDeepEqual(readDraft(catalog,'after',three),newer);
  const library=[{name:'원래 덱',deck:starterDeck(catalog,'mage')}];backing.setItem(decksKey,JSON.stringify(library));
  assert.deepEqual(backupDeckLibrary(one).decks,library);assert.deepEqual(backupDeckLibrary(two).decks,[]);restoreDeckLibrary(backupDeckLibrary(one),two);assert.deepEqual(backupDeckLibrary(two).decks,library);assert.deepEqual(backupDeckLibrary(three).decks,[]);
  saveSoloSettings({...DEFAULT_SOLO_SETTINGS,difficulty:25},two);assert.equal(readSoloSettings(one).difficulty,3);assert.equal(readSoloSettings(two).difficulty,25);
  recordSoloResult({code:'slot2',date:'2026-11-22T12:00:00Z',heroClass:'mage',opponent:'warrior',difficulty:3,result:'win',turns:12,generation:0,catalogHash:'test'},two);assert.equal(readSoloHistory(two).length,1);assert.equal(readSoloHistory(one).length,0);assert.equal(readSoloHistory(three).length,0);
  assert.equal(readSelectedSlot(backing),1);assert.ok(rememberSlot(3,backing));assert.equal(readSelectedSlot(backing),3);saveDraft(old,'held',two);assert.deepEqual(readDraft(catalog,'held',two),old);assert.notDeepEqual(readDraft(catalog,'held',three),old);
  assert.equal(soloSlotDatabase(1),'card-duel-solo-saves-v1');assert.equal(new Set([soloSlotDatabase(1),soloSlotDatabase(2),soloSlotDatabase(3)]).size,3);assert.throws(()=>soloSlotDatabase(4 as 1));
});
test('draft preserves a partial or intentionally empty deck across reload',()=>{const s=store(),d:Deck={heroClass:'priest',cards:['wolf','wolf']};assert.equal(saveDraft(d,'one',s),true);assert.deepEqual(readDraft(catalog,'one',s),d);d.cards=[];assert.equal(saveDraft(d,'one',s),true);assert.deepEqual(readDraft(catalog,'one',s),d);});
test('valid draft migrates to new balance hash; old snapshot remains isolated and unchanged',()=>{const s=store(),d:Deck={heroClass:'mage',cards:['wolf']};saveDraft(d,'old',s);const next=readDraft(catalog,'new',s);assert.deepEqual(next,d);next.cards.push('wisp');saveDraft(next,'new',s);assert.deepEqual(readDraft(catalog,'old',s),d);assert.deepEqual(readDraft(catalog,'new',s),next);assert.notEqual(draftKey('old'),draftKey('new'));});
test('developer draft cannot replace player deck or migrate into the next player patch',()=>{const s=store(),player:Deck={heroClass:'mage',cards:['wolf']},dev:Deck={heroClass:'priest',cards:[]};assert.ok(saveDraft(player,'old',s));assert.ok(saveDeveloperDraft(dev,'old',s));assert.deepEqual(readDeveloperDraft(catalog,'old',s),dev);assert.deepEqual(readDraft(catalog,'old',s),player);assert.deepEqual(readDraft(catalog,'new',s),player);});
test('legacy v0.20 storage without a marker recovers one unambiguous compatible draft',()=>{const s=store(),d:Deck={heroClass:'mage',cards:['wolf']};s.setItem(draftKey('old'),JSON.stringify(d));s.setItem('unrelated','unchanged');assert.deepEqual(readDraft(catalog,'new',s),d);assert.equal(s.getItem('unrelated'),'unchanged');s.setItem(draftKey('another'),JSON.stringify({heroClass:'priest',cards:[]}));validateDeck(readDraft(catalog,'new',s),catalog);assert.equal(s.getItem(draftKey('old')),JSON.stringify(d));});
test('incompatible old draft is never silently migrated or deleted',()=>{const s=store(),d:Deck={heroClass:'mage',cards:['golem','wolf']};saveDraft(d,'old',s);validateDeck(readDraft(catalog,'new',s),catalog);assert.equal(s.getItem(draftKey('old')),JSON.stringify(d));});
test('corrupt, oversized or illegal draft falls back to a legal deck',()=>{const s=store();for(const raw of ['{bad',JSON.stringify({heroClass:'mage',cards:['invalid']}),JSON.stringify({heroClass:'mage',cards:Array(31).fill('wolf')}),JSON.stringify({heroClass:'mage',cards:['wolf','wolf','wolf']})]){s.setItem(draftKey('bad'),raw);validateDeck(readDraft(catalog,'bad',s),catalog);}});
test('unavailable or denied storage cannot break the deck editor',()=>{const s={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};const d=readDraft(catalog,'one',s);validateDeck(d,catalog);assert.equal(saveDraft(d,'one',s),false);assert.equal(saveDraft(d,'one'),false);});
test('named deck backup preserves saved and obsolete card IDs without overwriting conflicts',()=>{
  const src=store(),dst=store(),one={name:'내 덱',deck:starterDeck(catalog,'mage')},other={name:'내 덱',deck:starterDeck(catalog,'warrior')};const old={name:'이전 패치',deck:{...one.deck,cards:[...one.deck.cards.slice(1),'future_missing_card']}};
  src.setItem(decksKey,JSON.stringify([one,old]));dst.setItem(decksKey,JSON.stringify([other]));const backup=backupDeckLibrary(src);assert.deepEqual(backup.decks,[one,old]);const imported=restoreDeckLibrary(backup,dst);assert.equal(imported.added,2);assert.equal(imported.renamed,1);assert.deepEqual(imported.decks[0],other);assert.deepEqual(imported.decks[1].deck,one.deck);assert.deepEqual(imported.decks[2],old);
  const repeat=restoreDeckLibrary(backup,dst);assert.equal(repeat.added,0);assert.equal(repeat.duplicates,2);assert.deepEqual(repeat.decks,imported.decks);
});
test('conflicting imported deck names preserve complete emoji when shortened to 40 UTF-16 units',()=>{
  const first={name:'🚀'.repeat(19)+'AB',deck:starterDeck(catalog,'warrior')};
  const second={name:first.name,deck:starterDeck(catalog,'mage')};
  assert.equal(first.name.length,40);
  const restored=mergeDeckLibraries([first],[second]);
  assert.equal(restored.renamed,1);assert.equal(restored.added,1);
  const name=restored.decks[1].name;
  assert.ok(name.endsWith(' (복원 2)'));
  assert.ok(name.length<=40);
  assert.equal(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(name),false,'no orphan low surrogate');
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u.test(name),false,'no orphan high surrogate');
  assert.ok(!name.includes('\uFFFD'),'restore has no replacement character');
  assert.deepEqual(restored.decks[0],first,'existing deck is untouched');
});
test('invalid deck backup, corrupted existing data, and full-capacity restore never overwrite records',()=>{
  const s=store(),entry={name:'기본',deck:starterDeck(catalog,'mage')},full=Array.from({length:20},(_,i)=>({...entry,name:`덱 ${i}`})),before=JSON.stringify(full);s.setItem(decksKey,before);
  const other=store();other.setItem(decksKey,JSON.stringify([entry]));const backup=backupDeckLibrary(other);
  assert.throws(()=>restoreDeckLibrary(backup,s),/최대 20/);assert.equal(s.getItem(decksKey),before);
  assert.throws(()=>restoreDeckLibrary({...backup,format:'other'},s),/지원하지/);assert.equal(s.getItem(decksKey),before);
  s.setItem(decksKey,'{broken');assert.throws(()=>restoreDeckLibrary(backup,s));assert.equal(s.getItem(decksKey),'{broken');
  assert.throws(()=>mergeDeckLibraries([entry,entry],[]),/손상/);
  const denied={getItem:()=>null,setItem(){throw Error('denied');}};assert.throws(()=>restoreDeckLibrary(backup,denied),/denied/);
});
test('normal deck save and delete preserve intervening unrelated changes and reject stale targets',()=>{
  const s=store(),original={name:'첫 덱',deck:starterDeck(catalog,'mage')},changed={...original,deck:starterDeck(catalog,'warrior')},another={name:'다른 탭',deck:starterDeck(catalog,'priest')};
  saveNamedDeck(original,null,s);saveNamedDeck(another,null,s);assert.deepEqual(saveNamedDeck(changed,original,s),[changed,another]);
  const current=s.getItem(decksKey);assert.throws(()=>saveNamedDeck(original,original,s),/다른 탭/);assert.throws(()=>saveNamedDeck(original,null,s),/다른 탭/);assert.throws(()=>deleteNamedDeck(original,s),/다른 탭/);assert.equal(s.getItem(decksKey),current);
  assert.deepEqual(deleteNamedDeck(changed,s),[another]);assert.throws(()=>deleteNamedDeck(changed,s),/다른 탭/);
});
test('failed deck write preserves last confirmed list when storage is blocked or corrupt',()=>{
  const s=store(),first={name:'보존할 덱',deck:starterDeck(catalog,'mage')},second={name:'외부에서 추가',deck:starterDeck(catalog,'hunter')};
  s.setItem(decksKey,JSON.stringify([first]));
  const last=[first],blocked={getItem(){throw Error('storage denied');},setItem(){throw Error('storage denied');}};
  assert.equal(deckLibraryAfterWriteFailure(last,blocked),last,'denied read preserves last good data');
  s.setItem(decksKey,'{broken');assert.equal(deckLibraryAfterWriteFailure(last,s),last,'corrupt bytes never erase the list');
  assert.equal(s.getItem(decksKey),'{broken','recovery does not modify storage');
  s.setItem(decksKey,JSON.stringify([first]));assert.equal(deckLibraryAfterWriteFailure(last,s),last,'unchanged data avoids rerender');
  s.setItem(decksKey,JSON.stringify([first,second]));assert.deepEqual(deckLibraryAfterWriteFailure(last,s),[first,second],'validated external changes remain visible');
  s.setItem(decksKey,JSON.stringify([]));assert.deepEqual(deckLibraryAfterWriteFailure(last,s),[],'a confirmed deletion is respected');
});
test('saved deck screen reports unreadable storage without pretending that saved decks vanished',()=>{
  const s=store(),entry={name:'검증된 덱',deck:starterDeck(catalog,'mage')},current=[entry];
  const denied={getItem(){throw Error('storage denied');},setItem(){throw Error('storage denied');}};
  const rejected=checkedDeckLibrary(current,denied);
  assert.equal(rejected.decks,current);assert.match(rejected.warning!,/확인할 수 없습니다/);
  s.setItem(decksKey,'{invalid');assert.equal(checkedDeckLibrary(current,s).decks,current);
  const second={name:'외부 추가',deck:starterDeck(catalog,'priest')};s.setItem(decksKey,JSON.stringify([entry,second]));
  const verified=checkedDeckLibrary(current,s);assert.equal(verified.warning,null);assert.deepEqual(verified.decks,[entry,second]);
  const again=checkedDeckLibrary(verified.decks,s);assert.equal(again.warning,null);assert.equal(again.decks,verified.decks);
  s.setItem(decksKey,'[]');assert.deepEqual(checkedDeckLibrary(current,s),{decks:[],warning:null});
});
test('other-tab deck refresh detects only valid content changes and never erases a malformed library',()=>{
  const s=store(),first={name:'첫 덱',deck:starterDeck(catalog,'mage')},second={name:'두 번째',deck:starterDeck(catalog,'priest')};
  assert.deepEqual(changedDeckLibrary([first],s),[],'a valid external deletion is visible');
  s.setItem(decksKey,JSON.stringify([first]));assert.equal(changedDeckLibrary([structuredClone(first)],s),null,'equal snapshots do not trigger a reset');
  s.setItem(decksKey,JSON.stringify([first,second]));assert.deepEqual(changedDeckLibrary([first],s),[first,second]);
  assert.deepEqual(changedDeckLibrary([second,first],s),[first,second],'reorder invalidates stale selected list positions');
  s.setItem(decksKey,'{broken');assert.throws(()=>changedDeckLibrary([first],s),/손상/);
  assert.equal(s.getItem(decksKey),'{broken','invalid external input is never rewritten');
  assert.equal(isDeckLibraryStorageEvent(decksKey),true);
  assert.equal(isDeckLibraryStorageEvent(`card-duel-slot-2:${decksKey}`),true);
  assert.equal(isDeckLibraryStorageEvent(null),true,'storage clear may affect the library');
  assert.equal(isDeckLibraryStorageEvent(`other-${decksKey}`),false);
  assert.equal(isDeckLibraryStorageEvent('card-duel-active-solo-slot-v1'),false);
});
test('deck mutation uses one exclusive lock and never falls back unlocked after rejection',async()=>{
  let queue=Promise.resolve<unknown>(null),calls=0,ran=0;
  const locks={request(name:string,options:LockOptions,callback:()=>unknown){assert.equal(name,'card-duel-deck-library-v1');assert.equal(options.mode,'exclusive');calls++;const run=queue.then(callback);queue=run.catch(()=>{});return run;}} as Pick<LockManager,'request'>;
  const s=store(),a={name:'A',deck:starterDeck(catalog,'mage')},b={name:'B',deck:starterDeck(catalog,'warrior')};
  await Promise.all([withDeckLibraryLock(()=>saveNamedDeck(a,null,s),locks),withDeckLibraryLock(()=>saveNamedDeck(b,null,s),locks)]);assert.equal(calls,2);assert.deepEqual(backupDeckLibrary(s).decks,[a,b]);
  const denied={request(){return Promise.reject(Error('lock denied'));}} as Pick<LockManager,'request'>;await assert.rejects(withDeckLibraryLock(()=>ran++,denied),/lock denied/);assert.equal(ran,0);
  const noApi=await withDeckLibraryLock(()=>42,undefined);assert.equal(noApi,42);
});
test('a delayed deck lock aborts without executing an unlocked write',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let ran=0;
  const blocked={request(_name:string,options:LockOptions){return new Promise((_,reject)=>options.signal!.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}} as Pick<LockManager,'request'>;
  const attempted=withDeckLibraryLock(()=>ran++,blocked);const rejected=assert.rejects(attempted,/잠시 후 다시/);t.mock.timers.tick(4000);await rejected;assert.equal(ran,0);
});
test('normal deck save and delete never overwrite malformed libraries or capacity overflow',()=>{
  const s=store(),one={name:'덱',deck:starterDeck(catalog,'warrior')},full=Array.from({length:20},(_,i)=>({...one,name:`덱 ${i}`}));
  for(const raw of ['{broken',JSON.stringify([one,one]),JSON.stringify([one,{name:'broken'}])]){s.setItem(decksKey,raw);assert.throws(()=>saveNamedDeck(one,null,s),/손상/);assert.throws(()=>deleteNamedDeck(one,s),/손상/);assert.equal(s.getItem(decksKey),raw);}
  s.setItem(decksKey,JSON.stringify(full));assert.throws(()=>saveNamedDeck(one,null,s),/최대 20/);assert.deepEqual(JSON.parse(s.getItem(decksKey)!),full);
});
test('room view merge cannot roll back a newer revision, but accepts connectivity changes and new rooms',()=>{let game=createGame(catalog,[starterDeck(catalog,'mage'),starterDeck(catalog,'warrior')],{seed:1});const initial:RoomView={code:'ABC234',seat:0,mode:'human',status:'playing',opponentConnected:true,state:getPlayerView(game,0)};game=applyAction(game,0,{type:'mulligan',replace:[]});const latest={...initial,state:getPlayerView(game,0)};assert.equal(mergeRoomView(latest,initial),latest);assert.equal(mergeRoomView(latest,{...initial,state:null}),latest);const disconnected={...latest,opponentConnected:false};assert.equal(mergeRoomView(latest,disconnected),disconnected);const newRoom={...initial,code:'DEF567'};assert.equal(mergeRoomView(latest,newRoom),newRoom);});
test('delayed pending or legacy acknowledgement keeps exact saved reward receipt',()=>{
  const pending:RoomView={code:'ABC234',seat:0,mode:'bot',status:'finished',opponentConnected:true,state:null,ranked:{rank:1,deckPower:1,intelligence:1,reward:'pending'}};
  const summary={xp:140,questAdvanced:true,questCompleted:true,questBonusXp:110,unlockedCards:['wolf'],rankAfter:2};
  const saved:RoomView={...pending,ranked:{...pending.ranked!,reward:'saved',rewardDetails:summary}};
  assert.deepEqual(mergeRoomView(saved,pending).ranked,saved.ranked);
  assert.deepEqual(mergeRoomView(saved,{...pending,ranked:{...pending.ranked!,reward:'saved'}}).ranked,saved.ranked);
});
test('delayed account PvP result cannot undo confirmed history settlement',()=>{const saved:RoomView={code:'ABC234',seat:0,mode:'human',status:'finished',opponentConnected:true,state:null,ownedPvp:true,pvpReward:'saved'};assert.equal(mergeRoomView(saved,{...saved,pvpReward:'pending'}).pvpReward,'saved');assert.equal(mergeRoomView(saved,{...saved,code:'ABC235',pvpReward:'pending'}).pvpReward,'pending');});

test('UI preview saves are isolated without altering or deleting live v0.298 storage',()=>{
  const backing=store();
  assert.equal(currentSoloNamespace('/card-duel/'),'main');
  assert.equal(currentSoloNamespace('/card-duel/ui-preview/'),'ui-preview');
  assert.equal(currentSoloNamespace('/card-duel/ui-preview/index.html'),'ui-preview');
  assert.equal(currentSoloNamespace('/another-ui-preview-copy/'),'main');
  const original=soloSlotStorage(1,backing,'main');
  const preview=soloSlotStorage(1,backing,'ui-preview');
  original.setItem('card-duel-saved-decks','original-live');
  preview.setItem('card-duel-saved-decks','preview-only');
  assert.equal(original.getItem('card-duel-saved-decks'),'original-live');
  assert.equal(preview.getItem('card-duel-saved-decks'),'preview-only');
  assert.equal(backing.getItem('card-duel-saved-decks'),'original-live');
  assert.equal(backing.getItem('card-duel-ui-preview-slot-1:card-duel-saved-decks'),'preview-only');
  assert.equal(original.length,1,'the main site cannot enumerate preview keys');
  assert.equal(preview.length,1,'the preview cannot enumerate main keys');
  assert.equal(hasSlotLocalData(1,backing,'main'),true);
  assert.equal(hasSlotLocalData(1,backing,'ui-preview'),true);
  assert.equal(hasSlotLocalData(2,backing,'ui-preview'),false);
  assert.equal(soloSlotDatabase(1,'main'),'card-duel-solo-saves-v1');
  assert.equal(soloSlotDatabase(1,'ui-preview'),'card-duel-solo-saves-v1-ui-preview');
  assert.equal(soloSlotDatabase(2,'ui-preview'),'card-duel-solo-saves-v1-slot-2-ui-preview');
  assert.ok(rememberSlot(2,backing,'ui-preview'));
  assert.equal(readSelectedSlot(backing,'ui-preview'),2);
  assert.equal(readSelectedSlot(backing,'main'),1);
  assert.ok(rememberSlot(3,backing,'main'));
  assert.equal(readSelectedSlot(backing,'main'),3);
  assert.equal(readSelectedSlot(backing,'ui-preview'),2);
  assert.equal(backing.getItem('card-duel-saved-decks'),'original-live','legacy data not migrated or overwritten');
});
