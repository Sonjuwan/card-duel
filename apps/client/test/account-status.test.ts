import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {DeveloperRuntimeStatus} from '../../../packages/account-protocol.ts';
import {cardTierProgress,decodeAccountView,decodeAccountExport,decodeActivePresence,decodeDeveloperStatus,decodeGrowthView,developerPatchLabel,presenceState} from '../src/account-status.ts';
import {RANKS,rankedQuestBonus,rankedXpReward} from '../../../packages/progression.ts';
import {HERO_CLASSES} from '../../../packages/engine/src/index.ts';

const runtime:DeveloperRuntimeStatus={rooms:{total:0,playing:0,waiting:0,finished:0,account:0,accountPlaying:0,accountWaiting:0,ai:0},connectedSockets:0,pendingRoomWrites:0,failedRoomWrites:0,pendingResults:0,pendingCredentialChanges:0,pendingDeckChanges:0,uptimeSeconds:1,rssBytes:1,maintenance:true,maintenanceSaving:false,maintenanceSaved:true,readyForPatch:true};
test('developer ready display never claims a stale or disconnected snapshot is ready',()=>{
  assert.match(developerPatchLabel(runtime,true,true,1000,1001),/최근 조회 시 준비 완료/);
  assert.match(developerPatchLabel(runtime,true,true,1000,16001),/재확인 필요/);
  assert.match(developerPatchLabel(runtime,false,true,1000,1001),/연결 끊김/);
  assert.match(developerPatchLabel(runtime,true,false,1000,1001),/꺼짐/);
  assert.match(developerPatchLabel(runtime,true,true,1000,1001,true),/재확인 필요/);
  assert.match(developerPatchLabel({...runtime,maintenance:false},true,true,1000,1001),/재확인 필요/);
  assert.match(developerPatchLabel({...runtime,maintenanceSaved:false},true,true,1000,1001),/저장 대기/);
  assert.match(developerPatchLabel({...runtime,pendingResults:1},true,true,1000,1001),/종료 대기/);
  assert.match(developerPatchLabel({...runtime,pendingCredentialChanges:1},true,true,1000,1001),/비밀번호 변경/);
  assert.match(developerPatchLabel({...runtime,pendingDeckChanges:1},true,true,1000,1001),/덱 저장/);
  assert.match(developerPatchLabel({...runtime,rooms:{...runtime.rooms,accountPlaying:1}},true,true,1000,1001),/종료 대기/);
  assert.match(developerPatchLabel(undefined,true,true,1000,1001),/재확인 필요/);
});
test('25 card tiers count permanent ownership rather than recomputing ownership from XP',()=>{
  const growth={ranks:[],starterIds:['base'],unlocks:[{cardId:'a',power:2,xp:10},{cardId:'b',power:2,xp:20},{cardId:'patch',power:25,xp:999}],questOrder:[],questLength:10,winsPerRank:3};
  const tiers=cardTierProgress(growth,new Set(['base','a','patch','retired']),12);assert.equal(tiers.length,25);
  assert.deepEqual(tiers[0],{power:1,total:1,owned:1,nextXp:null});assert.deepEqual(tiers[1],{power:2,total:2,owned:1,nextXp:8});assert.deepEqual(tiers[2],{power:3,total:0,owned:0,nextXp:null});assert.deepEqual(tiers[24],{power:25,total:1,owned:1,nextXp:null});
  assert.equal(tiers.reduce((sum,tier)=>sum+tier.owned,0),3);
});
test('displayed ranked and quest XP are the same formulas as server awards and rise at all 25 ranks',()=>{
  assert.equal(rankedXpReward(1,'win'),30);assert.equal(rankedXpReward(1,'loss'),15);assert.equal(rankedXpReward(1,'draw'),21);assert.equal(rankedXpReward(25,'win'),270);assert.equal(rankedQuestBonus(1),110);assert.equal(rankedQuestBonus(25),350);
  for(let rank=2;rank<=25;rank++){for(const outcome of ['win','loss','draw'] as const)assert.ok(rankedXpReward(rank,outcome)>rankedXpReward(rank-1,outcome));assert.ok(rankedQuestBonus(rank)>rankedQuestBonus(rank-1));}
});
test('presence requires the current account and sync epoch before enabling match actions',()=>{
  const room=decodeActivePresence({room:{mode:'ranked',status:'playing',connected:false,rank:25,resumeAllowed:true}});
  assert.equal(presenceState('A:1',null),'loading');
  assert.equal(presenceState('A:2',{key:'A:1',room:null}),'loading');
  assert.equal(presenceState('B:1',{key:'A:1',room}),'loading');
  assert.equal(presenceState('A:1',{key:'A:1',room:null,failed:true}),'error');
  assert.equal(presenceState('A:1',{key:'A:1',room:null}),'ready');
  assert.equal(presenceState('A:1',{key:'A:1',room}),'ready');
});
test('malformed active-room payloads never count as confirmed idle',()=>{
  assert.equal(decodeActivePresence({room:null}),null);
  assert.deepEqual(decodeActivePresence({room:{mode:'pvp',status:'waiting',connected:true,resumeAllowed:true}}),{mode:'pvp',status:'waiting',connected:true,resumeAllowed:true});
  for(const payload of [null,{}, {room:false},{room:{}},{room:{mode:'ranked',status:'playing',connected:false,resumeAllowed:true}},{room:{mode:'pvp',status:'waiting',connected:true,resumeAllowed:true,rank:25}}])assert.throws(()=>decodeActivePresence(payload),/대전 상태 응답/);
});
test('account views reject malformed successful payloads without replacing usable progress',()=>{
  const profile={revision:2,xp:30,rank:1,rankWins:1,questGames:1,ownedCards:['historic_card'],decks:[]};
  const valid={id:'fixture',email:'user@example.test',role:'player',profile};
  assert.deepEqual(decodeAccountView(valid),valid);
  for(const payload of [{},{...valid,profile:null},{...valid,role:'admin'},{...valid,profile:{...profile,xp:-1}},{...valid,profile:{...profile,rank:99}},{...valid,profile:{...profile,recentMatches:{}}},{...valid,profile:{...profile,decks:[{}]}}])assert.throws(()=>decodeAccountView(payload),/계정 정보 응답/);
});
test('account and export share historical deck and match validation without accepting corrupt counters',()=>{
  const profile={revision:3,xp:30,rank:1,rankWins:1,questGames:1,ownedCards:['historic_card'],decks:[{name:'과거 덱',deck:{heroClass:'historic_class',cards:['retired_card']}}],recentMatches:[{matchId:'fixture',mode:'ranked',rank:1,heroClass:'historic_class',outcome:'win',completedAt:1,xp:30,questAdvanced:true,eligible:true}],matchStats:{ranked:{wins:1,losses:0,draws:0},pvp:{wins:0,losses:0,draws:0}}};
  const account={id:'fixture',email:'user@example.test',role:'player',profile},exported={schemaVersion:1,gameVersion:'0.85.0',exportedAt:'2026-11-22T00:00:00.000Z',profile};
  assert.deepEqual(decodeAccountView(account),account);assert.deepEqual(decodeAccountExport(exported),exported);
  for(const bad of [{...profile,ownedCards:['duplicate','duplicate']},{...profile,rankWins:4},{...profile,decks:[profile.decks[0],profile.decks[0]]},{...profile,recentMatches:[{...profile.recentMatches[0],eligible:'yes'}]},{...profile,matchStats:{...profile.matchStats,ranked:{wins:-1,losses:0,draws:0}}}]){
    assert.throws(()=>decodeAccountView({...account,profile:bad}),/계정 정보 응답/);assert.throws(()=>decodeAccountExport({...exported,profile:bad}),/성장 기록 응답/);
  }
  assert.throws(()=>decodeAccountExport({...exported,token:'unexpected'}),/성장 기록 응답/);
});
test('growth data validates all rank, card and quest ordering while preserving explicit custom tuning',()=>{
  const ranks=RANKS.map(r=>({...r,minimumXp:r.rank-1}));
  ranks[1].deckPower=1;ranks[1].intelligence=1;
  const valid={ranks,starterIds:['base'],unlocks:[{cardId:'a',power:2,xp:14},{cardId:'b',power:2,xp:28}],questOrder:[...HERO_CLASSES],questLength:10,winsPerRank:3};
  assert.deepEqual(decodeGrowthView(valid),valid);
  for(const bad of [{},{...valid,ranks:ranks.slice(1)},{...valid,ranks:[ranks[1],ranks[0],...ranks.slice(2)]},{...valid,unlocks:[...valid.unlocks,{cardId:'base',power:3,xp:40}]},{...valid,unlocks:[...valid.unlocks].reverse()},{...valid,questOrder:[...HERO_CLASSES].reverse()}])assert.throws(()=>decodeGrowthView(bad),/성장 정보 응답/);
});
test('malformed developer runtime never qualifies as usable deployment readiness evidence',()=>{
  const valid={role:'developer',version:'0.81.0',collectible:382,rankCount:25,growthHash:'a'.repeat(64),runtime};
  assert.deepEqual(decodeDeveloperStatus(valid),valid);
  for(const bad of [{...valid,role:'player'},{...valid,runtime:{...runtime,rooms:null}},{...valid,runtime:{...runtime,pendingDeckChanges:undefined}},{...valid,runtime:{...runtime,readyForPatch:'true'}},{...valid,growthHash:'broken'}])assert.throws(()=>decodeDeveloperStatus(bad),/운영 상태 응답/);
});
