import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog,createGame,applyAction,starterDeck,getPlayerView } from '../src/index.ts';
import type { GameState,HeroClass,PlayerId,Target } from '../src/index.ts';
const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.7.0.json',import.meta.url),'utf8')),catalog=createCatalog(data);
function ready(a:HeroClass='mage',b:HeroClass='priest'){let s=createGame(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],{seed:45,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});return s;}
function hand(s:GameState,id:string){const c={cardId:id,instanceId:`t${s.nextId++}`};s.players[s.activePlayer].hand.push(c);return c;}
function play(s:GameState,id:string,target?:Target){s.players[s.activePlayer].mana=10;const c=hand(s,id);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target});}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
function m(s:GameState,p:PlayerId,id:string){return s.players[p].board.find(m=>m.cardId===id)!;}
function t(s:GameState,p:PlayerId,id:string):Target{return {kind:'minion',instanceId:m(s,p,id).instanceId};}
test('v0.7 catalog contains 131 definitions, retains every earlier card unchanged',()=>{const old=JSON.parse(readFileSync(new URL('../../../data/cards/v0.6.0.json',import.meta.url),'utf8'));assert.equal(data.length,131);assert.equal(data.filter((c:{collectible?:boolean})=>c.collectible!==false).length,130);assert.deepEqual(data.slice(0,old.length),old);});
test('weapon heals before minion combat, does not heal when defending, breaks after last charge',()=>{
  let s=ready('paladin');s.players[0].health=3;s=play(s,'healing_hammer');s=end(s);s=play(s,'drake');s=end(s);s=applyAction(s,0,{type:'heroAttack',target:t(s,1,'drake')});assert.equal(s.players[0].health,1);assert.equal(s.players[1].board.length,0);assert.equal(s.players[0].weapon?.durability,1);s=end(end(s));s=applyAction(s,0,{type:'heroAttack',target:{kind:'hero',player:1}});assert.equal(s.players[0].health,3);assert.equal(s.players[1].health,26);assert.equal(s.players[0].weapon,null);
});
test('weapon may apply overload immediately and targets validated before equip',()=>{
  let s=ready('shaman');s=play(s,'storm_mace');assert.equal(s.players[0].pendingOverload,1);assert.equal(s.players[0].weapon?.durability,3);s=end(end(s));assert.equal(s.players[0].lockedMana,1);
  const c=hand(s,'ambush_dagger');s.players[0].mana=10;const before=structuredClone(s);assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}),/대상을 선택/);assert.deepEqual(s,before);s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:{kind:'hero',player:1}});assert.equal(s.players[1].health,29);assert.equal(s.players[0].weapon?.cardId,'ambush_dagger');
});
test('weapon battlecry combo works and can target friendly hero',()=>{
  let s=ready('rogue');s=play(s,'recruit');s=play(s,'ambush_dagger',{kind:'hero',player:0});assert.equal(s.players[0].health,28);assert.equal(s.players[0].weapon?.attack,2);
});
test('own secret reveal adds bow durability exactly once; enemy secret does not',()=>{
  let s=ready('hunter','mage');s=play(s,'hunter_bow');s=play(s,'tripwire');s=end(s);s=play(s,'guard');assert.equal(s.players[0].weapon?.durability,3);assert.equal(s.players[0].secrets.length,0);s=play(s,'arcane_barrier');s=end(s);s=play(s,'wild_arrow',{kind:'hero',player:1});assert.equal(s.players[1].secrets.length,0);assert.equal(s.players[0].weapon?.durability,3);
});
test('secrets are cast as spells and countered secrets never enter secret zone or leak identity',()=>{
  let s=ready('mage','hunter');s=play(s,'arcane_barrier');s=end(s);s=play(s,'spell_student');s=play(s,'tripwire');assert.equal(s.players[1].secrets.length,0);assert.equal(s.players[0].secrets.length,0);assert.equal(m(s,1,'spell_student').attack,1);assert.ok(!JSON.stringify(getPlayerView(s,0)).includes('tripwire'));
  s=play(s,'tripwire');assert.equal(s.players[1].secrets.length,1);assert.equal(m(s,1,'spell_student').attack,2);assert.ok(!JSON.stringify(getPlayerView(s,0)).includes('tripwire'));
});
test('missile spell damage increases missile count not damage per hit; no minion targets means face',()=>{
  let s=ready();s=play(s,'fire_apprentice');s=play(s,'starlight_barrage');assert.equal(s.players[1].health,26);
  s=play(s,'fire_apprentice');s=play(s,'starlight_barrage');assert.equal(s.players[1].health,21);
});
test('minion-only missiles reacquire after kill and stop when no targets remain',()=>{
  let s=ready('hunter');s=end(s);s=play(s,'scout');s=play(s,'fox');s=end(s);s=play(s,'ricochet_arrow');assert.equal(s.players[1].board.length,0);assert.equal(s.players[1].health,30);s=play(s,'ricochet_arrow');assert.equal(s.players[1].health,30);
});
test('bomber never chooses itself; deterministic total damage when only heroes exist',()=>{
  let s=ready();s=play(s,'chaos_bomber');assert.equal(m(s,0,'chaos_bomber').health,2);assert.equal(s.players[0].health+s.players[1].health,57);
});
test('chosen-survived effect draws only after damage target lives, shield counts as survival',()=>{
  let s=ready('warrior');s=play(s,'guard');s=play(s,'scout');s=play(s,'crystal_sentinel');let before=s.players[0].deck.length;
  s=play(s,'test_of_steel',t(s,0,'guard'));assert.equal(s.players[0].deck.length,--before);assert.equal(m(s,0,'guard').health,1);
  s=play(s,'test_of_steel',t(s,0,'scout'));assert.equal(s.players[0].deck.length,before);assert.equal(s.players[0].board.length,2);
  s=play(s,'test_of_steel',t(s,0,'crystal_sentinel'));assert.equal(s.players[0].deck.length,--before);assert.equal(m(s,0,'crystal_sentinel').health,2);
});
test('conditional effect cannot use survived test without minion target; weapon schema validates abilities',()=>{
  const w=data.find((c:{id:string})=>c.id==='healing_hammer'),spell=data.find((c:{id:string})=>c.id==='test_of_steel');assert.throws(()=>createCatalog([{...w,beforeAttack:[{kind:'heal',target:'chosen',amount:2}]}]),/chosen/);assert.throws(()=>createCatalog([{...spell,targetRule:'anyCharacter'}]),/효과 조건/);
});
test('temporary control gives immediate attack and returns to prior side before next turn',()=>{
  let s=ready('priest');s=end(s);s=play(s,'guard');s=end(s);const old=m(s,1,'guard').instanceId;s=play(s,'war_banner');
  s=play(s,'shadow_lease',t(s,1,'guard'));assert.equal(s.players[1].board.length,0);assert.equal(m(s,0,'guard').attack,3);assert.equal(m(s,0,'guard').returnController,1);assert.equal(m(s,0,'guard').originalOwner,1);
  s=applyAction(s,0,{type:'attack',attackerId:old,target:{kind:'hero',player:1}});assert.equal(s.players[1].health,27);s=end(s);assert.equal(s.players[0].board.length,1);assert.equal(m(s,1,'guard').instanceId,old);assert.equal(m(s,1,'guard').attack,2);assert.equal(m(s,1,'guard').returnController,undefined);assert.equal(m(s,1,'guard').attacksRemaining,1);
});
test('temporary minion that dies does not return; deathrattle belongs to controller',()=>{
  let s=ready('priest');s=end(s);s=play(s,'courier');s=play(s,'guard');s=end(s);s=play(s,'shadow_lease',t(s,1,'courier'));const n=s.players[0].deck.length;const a=m(s,0,'courier').instanceId;s=applyAction(s,0,{type:'attack',attackerId:a,target:t(s,1,'guard')});assert.equal(s.players[0].deck.length,n-1);s=end(s);assert.ok(!s.players[1].board.some(x=>x.instanceId===a));
});
test('bouncing a permanently controlled minion returns it to the current controller hand',()=>{
  let s=ready('priest');s=end(s);s=play(s,'guard');s=end(s);const id=m(s,1,'guard').instanceId;s=play(s,'mind_claim',t(s,1,'guard'));s=play(s,'storm_retreat',t(s,0,'guard'));assert.equal(s.players[0].board.length,0);assert.ok(s.players[0].hand.some(c=>c.instanceId===id));assert.ok(!s.players[1].hand.some(c=>c.instanceId===id));
});
test('temporary minion with full destination is destroyed and removed, not cloned',()=>{
  let s=ready('priest');s=end(s);for(let i=0;i<7;i++)s=play(s,'guard');s=end(s);s=play(s,'shadow_lease',t(s,1,'guard'));const id=m(s,0,'guard').instanceId;
  const existing=s.players[1].board[0];s.players[1].board.push({...structuredClone(existing),instanceId:`t${s.nextId++}`});s=end(s);assert.equal(s.players[1].board.length,7);assert.ok(!s.players.some(p=>p.board.some(m=>m.instanceId===id)));
});
test('random control needs at least four enemies, deterministic, cannot overfill friendly board',()=>{
  let s=ready();s=end(s);for(let i=0;i<3;i++)s=play(s,'guard');s=end(s);s=play(s,'crowd_recruiter');assert.equal(s.players[1].board.length,3);s=end(s);s=play(s,'night_cat');s=end(s);
  const c=hand(s,'crowd_recruiter');s.players[0].mana=10;const act={type:'playCard',instanceId:c.instanceId};const next=applyAction(s,0,act);assert.deepEqual(next,applyAction(s,0,act));assert.equal(next.players[1].board.length,3);assert.equal(next.players[0].board.length,3);
  s=next;s=end(s);s=play(s,'guard');s=end(s);for(let i=0;i<3;i++)s=play(s,'guard');s=play(s,'crowd_recruiter');assert.equal(s.players[0].board.length,7);assert.equal(s.players[1].board.length,4);
});
test('random destruction can hit stealth and safely does nothing on empty enemy board',()=>{
  let s=ready('hunter');s=play(s,'hidden_arrow');s=end(s);s=play(s,'night_cat');s=end(s);s=play(s,'hidden_arrow');assert.equal(s.players[1].board.length,0);
});
