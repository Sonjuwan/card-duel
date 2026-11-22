import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog,createGame,applyAction,starterDeck,currentCost,targetMatchesRule } from '../src/index.ts';
import type { GameState,HeroClass,PlayerId,Target } from '../src/index.ts';
const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.6.0.json',import.meta.url),'utf8')),catalog=createCatalog(data);
function ready(a:HeroClass='mage',b:HeroClass='priest'){let s=createGame(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],{seed:32,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});return s;}
function hand(s:GameState,id:string){const c={cardId:id,instanceId:`t${s.nextId++}`};s.players[s.activePlayer].hand.push(c);return c;}
function play(s:GameState,id:string,target?:Target){s.players[s.activePlayer].mana=10;const c=hand(s,id);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target});}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
function m(s:GameState,p:PlayerId,id:string){return s.players[p].board.find(m=>m.cardId===id)!;}
function t(s:GameState,p:PlayerId,id:string):Target{return {kind:'minion',instanceId:m(s,p,id).instanceId};}
function price(s:GameState,id:string,p:PlayerId=0){return currentCost(s.catalog[id],s.catalog,p,[s.players[0].board,s.players[1].board],s.players[p].weapon);}
test('v0.6 catalog adds 12 definitions and preserves all earlier cards',()=>{
  const old=JSON.parse(readFileSync(new URL('../../../data/cards/v0.5.0.json',import.meta.url),'utf8'));
  assert.equal(data.length,118);assert.equal(data.filter((c:{collectible?:boolean})=>c.collectible!==false).length,117);assert.deepEqual(data.slice(0,old.length),old);
});
test('enrage applies once when damaged, vanishes when healed, and reapplies',()=>{
  let s=ready();s=play(s,'scarred_rager');s=play(s,'archer',{kind:'hero',player:1});s=end(s);
  s=play(s,'archer',t(s,0,'scarred_rager'));assert.equal(m(s,0,'scarred_rager').attack,5);
  s=play(s,'archer',t(s,0,'scarred_rager'));assert.equal(m(s,0,'scarred_rager').attack,5);
  s=play(s,'holy_light',t(s,0,'scarred_rager'));assert.equal(m(s,0,'scarred_rager').attack,2);
  s=play(s,'archer',t(s,0,'scarred_rager'));assert.equal(m(s,0,'scarred_rager').attack,5);
});
test('enrage and aura attack stack; silence removes enrage',()=>{
  let s=ready();s=play(s,'scarred_rager');s=play(s,'war_banner');s=end(s);s=play(s,'archer',t(s,0,'scarred_rager'));
  assert.equal(m(s,0,'scarred_rager').attack,6);s=play(s,'silencing_rune',t(s,0,'scarred_rager'));assert.equal(m(s,0,'scarred_rager').attack,3);
});
test('simultaneous combat retaliates using pre-combat attack, next attack uses enrage',()=>{
  let s=ready();s=play(s,'scarred_rager');s=end(s);s=play(s,'recruit');s=end(s);
  s=applyAction(s,0,{type:'attack',attackerId:m(s,0,'scarred_rager').instanceId,target:t(s,1,'recruit')});assert.equal(s.players[1].board.length,0);assert.equal(m(s,0,'scarred_rager').health,2);assert.equal(m(s,0,'scarred_rager').attack,5);
});
test('damaged-only target rejects healthy enemy and own minions; validates before spending mana',()=>{
  let s=ready('warrior');s=play(s,'guard');s=end(s);s=play(s,'guard');s=end(s);s.players[0].mana=10;const c=hand(s,'fatal_finish');const snap=structuredClone(s);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:t(s,1,'guard')}),/선택할 수 없는/);assert.deepEqual(s,snap);
  s=play(s,'archer',t(s,1,'guard'));assert.ok(targetMatchesRule('enemyDamagedMinion',0,1,m(s,1,'guard')));assert.ok(!targetMatchesRule('enemyDamagedMinion',0,0,m(s,0,'guard')));
  s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:t(s,1,'guard')});assert.equal(s.players[1].board.length,0);
});
test('undamaged-only target allows either owner, rejects damaged target and enemy stealth',()=>{
  let s=ready('rogue');s=play(s,'guard');s=end(s);s=play(s,'guard');s=play(s,'night_cat');s=end(s);const c=hand(s,'precise_stab');
  assert.ok(!targetMatchesRule('undamagedMinion',0,1,m(s,1,'night_cat')));s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:t(s,1,'guard')});assert.equal(m(s,1,'guard').health,1);const c2=hand(s,'precise_stab');assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c2.instanceId,target:t(s,1,'guard')}),/선택할 수 없는/);
});
test('threshold targets use current attack including aura; 4-attack minion excluded from both',()=>{
  let s=ready('priest');s=end(s);s=play(s,'swordsman');s=play(s,'golem');s=play(s,'raider');s=play(s,'war_banner');s=end(s);
  assert.equal(m(s,1,'swordsman').attack,4);assert.ok(!targetMatchesRule('lowAttackEnemyMinion',0,1,m(s,1,'swordsman')));assert.ok(!targetMatchesRule('highAttackEnemyMinion',0,1,m(s,1,'swordsman')));
  s=play(s,'weakpoint_sentence',t(s,1,'war_banner'));assert.ok(m(s,1,'swordsman').attack===3);s=play(s,'weakpoint_sentence',t(s,1,'swordsman'));s=play(s,'giant_sentence',t(s,1,'raider'));assert.equal(s.players[1].board.length,1);
});
test('weapon enhancement requires equipped weapon for spell, optional minion battlecry',()=>{
  let s=ready('rogue');const c=hand(s,'weapon_hone');s.players[0].mana=10;const old=structuredClone(s);assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}),/무기가 없습니다/);assert.deepEqual(s,old);
  s=play(s,'forge_keeper');assert.equal(s.players[0].weapon,null);s=applyAction(s,0,{type:'heroPower'});assert.equal(s.players[0].weapon?.attack,1);
  s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId});assert.equal(s.players[0].weapon?.attack,3);s=play(s,'forge_keeper');assert.equal(s.players[0].weapon?.durability,3);
});
test('weapon cost reduction uses real weapon attack, reaches zero, updates after weapon destroyed',()=>{
  let s=ready('rogue');s.players[0].mana=10;s=applyAction(s,0,{type:'heroPower'});assert.equal(price(s,'blade_raider'),3);s=play(s,'weapon_hone');assert.equal(price(s,'blade_raider'),1);s=play(s,'weapon_hone');assert.equal(price(s,'blade_raider'),0);
  const c=hand(s,'blade_raider');s.players[0].mana=0;s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId});assert.equal(s.players[0].mana,0);s=end(s);s=play(s,'rust_collector');assert.equal(price(s,'blade_raider'),4);
});
test('spell discount stacks, also applies to secrets and coin, but not opponent or minions',()=>{
  let s=ready();s=play(s,'spell_tutor');s=play(s,'spell_tutor');assert.equal(price(s,'flame_sphere'),2);assert.equal(price(s,'arcane_barrier'),1);assert.equal(price(s,'__coin'),0);assert.equal(price(s,'fox'),1);assert.equal(price(s,'flame_sphere',1),4);
  const c=hand(s,'flame_sphere');s.players[0].mana=2;s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:{kind:'hero',player:1}});assert.equal(s.players[0].mana,0);assert.equal(s.players[1].health,24);
  s=end(s);s=play(s,'silencing_rune',t(s,0,'spell_tutor'));assert.equal(price(s,'flame_sphere'),3);s=play(s,'banishment',{kind:'minion',instanceId:s.players[0].board.find(m=>m.cardId==='spell_tutor'&&!m.silenced)!.instanceId});assert.equal(price(s,'flame_sphere'),4);
});
test('both-player tax stacks with beast discount, actual payment matches current public price',()=>{
  let s=ready('hunter');s=play(s,'beast_whisperer');assert.equal(price(s,'fox'),0);s=end(s);s=play(s,'tax_collector');assert.equal(price(s,'fox',1),2);assert.equal(price(s,'fox'),1);assert.equal(price(s,'guard'),3);s=end(s);s.players[0].mana=0;const c=hand(s,'fox');assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}),/마나가 부족/);s.players[0].mana=1;s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId});assert.equal(s.players[0].mana,0);
});
test('schema rejects invalid enrage, cost aura and weapon modifier',()=>{
  const r=data.find((c:{id:string})=>c.id==='scarred_rager'),a=data.find((c:{id:string})=>c.id==='spell_tutor'),w=data.find((c:{id:string})=>c.id==='weapon_hone');
  assert.throws(()=>createCatalog([{...r,enrageAttack:-1}]),/격노/);assert.throws(()=>createCatalog([{...a,costAuras:[{kind:'spell',side:'both',amount:0}]}]),/비용/);assert.throws(()=>createCatalog([{...w,effects:[{kind:'buffWeapon',attack:0,durability:0}]}]),/무기 강화/);
});
