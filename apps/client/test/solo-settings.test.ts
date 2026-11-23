import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck,DECK_STYLES,HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import {DEFAULT_SOLO_SETTINGS,parseSoloSettings,readSoloSettings,saveSoloSettings,resolveSolo,resultFromRoom,recordSoloResult,readSoloHistory,soloStats,soloHistoryPage} from '../src/solo-settings.ts';
import type {SoloResult} from '../src/solo-settings.ts';
const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8')));
const storage=()=>{const m=new Map<string,string>();return{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};};
test('history pages expose all stored results with balance and outcome filters without mutating history',()=>{
  const results:SoloResult[]=Array.from({length:100},(_,i)=>({code:`LOCAL-${i}`,date:'2026-11-22T00:00:00Z',heroClass:'mage',opponent:'warrior',difficulty:3,result:i%2?'win':'loss',turns:7,generation:0,catalogHash:i<50?'current':'previous'}));
  const codes=results.map(r=>r.code);const all=Array.from({length:10},(_,i)=>soloHistoryPage(results,'current','all','all',i).items).flat();assert.deepEqual(all.map(r=>r.code),codes);
  const filtered=soloHistoryPage(results,'current','previous','win',123);assert.equal(filtered.pages,3);assert.equal(filtered.page,2);assert.equal(filtered.items.length,5);assert.equal(filtered.stats.games,25);assert.equal(filtered.stats.wins,25);assert.ok(filtered.items.every(r=>r.catalogHash==='previous'));
  assert.equal(soloHistoryPage(results,'current','current','draw',-1).items.length,0);assert.equal(soloHistoryPage(results,'current','current','draw',9).page,0);assert.deepEqual(results.map(r=>r.code),codes);
});
test('settings roundtrip and corrupted individual preference recovery',()=>{
  const s=storage(),chosen={...DEFAULT_SOLO_SETTINGS,heroClass:'random' as const,difficulty:25 as const,style:'control' as const,first:'second' as const,deviceMode:'fast' as const};
  assert.equal(saveSoloSettings(chosen,s),true);assert.deepEqual(readSoloSettings(s),chosen);
  assert.deepEqual(parseSoloSettings({heroClass:'unknown',difficulty:26,style:'nope',first:0,engine:'cloud',deviceMode:'wrong'}),DEFAULT_SOLO_SETTINGS);
  assert.deepEqual(readSoloSettings({getItem(){throw Error('denied');},setItem(){throw Error('denied');}}),DEFAULT_SOLO_SETTINGS);
});
test('seeded random selection covers all classes and strategies and forced initiative is exact',()=>{
  const s={...DEFAULT_SOLO_SETTINGS,heroClass:'random' as const,style:'random' as const,first:'first' as const};
  const results=Array.from({length:500},(_,i)=>resolveSolo(s,i));
  assert.deepEqual(new Set(results.map(r=>r.heroClass)),new Set(HERO_CLASSES));assert.deepEqual(new Set(results.map(r=>r.style)),new Set(DECK_STYLES));
  for(const r of results)assert.equal(r.firstPlayer,0);
  assert.equal(resolveSolo({...s,first:'second'},73).firstPlayer,1);assert.equal(resolveSolo({...s,first:'random'},73).firstPlayer,undefined);
  assert.equal(resolveSolo({...s,style:'auto',difficulty:1},73).style,'starter');assert.equal(resolveSolo({...s,style:'auto',difficulty:3},73).style,'practice');
  assert.deepEqual(resolveSolo(s,73),resolveSolo(s,73));
});
test('only completed solo matches are recorded without hand or deck data, once per match and isolated by catalog',()=>{
  let game=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'warrior')],{seed:3});
  const room=():RoomView=>({code:'LOCAL-X',seat:0,mode:'bot',status:game.phase==='finished'?'finished':'playing',opponentConnected:true,state:getPlayerView(game,0),botDifficulty:17,botDeckStyle:'control'});
  assert.equal(resultFromRoom(room(),'first'),null);
  game=applyAction(game,0,{type:'mulligan',replace:[]});game=applyAction(game,1,{type:'mulligan',replace:[]});game=applyAction(game,1,{type:'concede'});
  assert.equal(resultFromRoom({...room(),mode:'human'},'first'),null);
  assert.equal(resultFromRoom({...room(),ranked:{rank:1,deckPower:1,intelligence:1,reward:'saved'}},'first'),null);
  const result=resultFromRoom({...room(),botDeckStyle:'control'},'first','2026-11-22T00:00:00Z')!;assert.equal(result.result,'win');assert.equal(result.opponent,'warrior');assert.equal('hand' in result,false);assert.equal('deck' in result,false);
  const s=storage();assert.equal(recordSoloResult(result,s).length,1);assert.equal(recordSoloResult(result,s).length,1);recordSoloResult({...result,code:'LOCAL-Y',catalogHash:'second',result:'loss'},s);
  assert.deepEqual(soloStats(readSoloHistory(s),'first'),{games:1,wins:1,losses:0,draws:0,winRate:100});assert.equal(soloStats(readSoloHistory(s)).winRate,50);
});
