import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog,createGame,applyAction,starterDeck,deckCards } from '../src/index.ts';
import type { GameState,HeroClass,PlayerId,Target } from '../src/index.ts';
const cards=JSON.parse(readFileSync(new URL('../../../data/cards/v0.8.0.json',import.meta.url),'utf8')),catalog=createCatalog(cards);
function ready(a:HeroClass='mage',b:HeroClass='mage'){let s=createGame(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],{seed:54,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});return s;}
function play(s:GameState,id:string,target?:Target){s.players[s.activePlayer].mana=10;const c={cardId:id,instanceId:`t${s.nextId++}`};s.players[s.activePlayer].hand.push(c);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target});}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
function m(s:GameState,p:PlayerId,id:string){return s.players[p].board.find(m=>m.cardId===id)!;}
function t(s:GameState,p:PlayerId,id:string):Target{return {kind:'minion',instanceId:m(s,p,id).instanceId};}
test('v0.8 has 135 playable cards and all ten audited mage basic analogues',()=>{
  assert.equal(cards.length,137);assert.equal(cards.filter((c:{collectible?:boolean})=>c.collectible!==false).length,135);
  const pool=deckCards(catalog,'mage');const basic:[string,number][]=[['starlight_barrage',1],['mirage_patrol',1],['mana_burst',2],['ice_shard',2],['arcane_notes',3],['winter_field',3],['flame_sphere',4],['sheep_hex',4],['glacial_construct',4],['flame_tide',7]];
  for(const [id,cost] of basic){const c=pool.find(x=>x.id===id);assert.ok(c&&c.class==='mage'&&c.rarity==='basic'&&c.cost===cost,id);}assert.ok(!pool.some(c=>c.id==='mirage_token'));
});
test('mirage summons two 0/2 taunts, and fills only available board space',()=>{
  let s=ready();s=play(s,'mirage_patrol');assert.deepEqual(s.players[0].board.map(x=>[x.attack,x.health,x.keywords]),[[0,2,['taunt']],[0,2,['taunt']]]);for(let i=0;i<4;i++)s=play(s,'recruit');s=play(s,'mirage_patrol');assert.equal(s.players[0].board.length,7);assert.equal(s.players[0].board.filter(c=>c.cardId==='mirage_token').length,3);
});
test('arcane burst and flame tide damage only enemy board with correct amounts',()=>{
  let s=ready();s=play(s,'guard');s=end(s);s=play(s,'golem');s=play(s,'scout');s=end(s);s=play(s,'mana_burst');assert.equal(s.players[1].board.length,1);assert.equal(m(s,1,'golem').health,5);s=play(s,'flame_tide');assert.equal(m(s,1,'golem').health,1);assert.equal(m(s,0,'guard').health,3);assert.equal(s.players[1].health,30);
});
test('arcane notes draws exactly two and pays three mana',()=>{let s=ready();const n=s.players[0].deck.length;s=play(s,'arcane_notes');assert.equal(s.players[0].deck.length,n-2);assert.equal(s.players[0].mana,7);});
test('audited single-target fire/frost spells allow friendly character and have correct damage',()=>{
  let s=ready();s=play(s,'flame_sphere',{kind:'hero',player:0});assert.equal(s.players[0].health,24);s=play(s,'ice_shard',{kind:'hero',player:1});assert.equal(s.players[1].health,27);assert.ok(s.players[1].heroFrozenThroughTurn!==undefined);
});
test('glacial minion freezes enemy hero after damage even if armor absorbs it',()=>{
  let s=ready('mage','warrior');s=play(s,'glacial_construct');s=end(s);s=play(s,'iron_axe');s.players[1].armor=4;s=end(s);s=applyAction(s,0,{type:'attack',attackerId:m(s,0,'glacial_construct').instanceId,target:{kind:'hero'}});assert.equal(s.players[1].health,30);assert.equal(s.players[1].armor,1);assert.ok(s.players[1].heroFrozenThroughTurn!==undefined);s=end(s);assert.throws(()=>applyAction(s,1,{type:'heroAttack',target:{kind:'hero'}}),/빙결/);
});
test('glacial retaliation freezes a surviving attacker for its next turn',()=>{
  let s=ready();s=play(s,'glacial_construct');s=end(s);s=play(s,'golem');s=end(end(s));const id=m(s,1,'golem').instanceId;s=applyAction(s,1,{type:'attack',attackerId:id,target:t(s,0,'glacial_construct')});assert.ok(m(s,1,'golem').frozenThroughTurn!==undefined);s=end(end(s));assert.throws(()=>applyAction(s,1,{type:'attack',attackerId:id,target:{kind:'hero'}}),/빙결/);
});
test('divine shield prevents freeze, and silence removes glacial combat effect',()=>{
  let s=ready();s=play(s,'glacial_construct');s=end(s);s=play(s,'crystal_sentinel');s=end(s);s=applyAction(s,0,{type:'attack',attackerId:m(s,0,'glacial_construct').instanceId,target:t(s,1,'crystal_sentinel')});assert.equal(m(s,1,'crystal_sentinel').health,2);assert.equal(m(s,1,'crystal_sentinel').frozenThroughTurn,undefined);s=end(s);s=play(s,'silencing_rune',t(s,0,'glacial_construct'));s=end(s);s=applyAction(s,0,{type:'attack',attackerId:m(s,0,'glacial_construct').instanceId,target:{kind:'hero'}});assert.equal(s.players[1].heroFrozenThroughTurn,undefined);
});
