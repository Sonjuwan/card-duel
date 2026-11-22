import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog, createGame, applyAction, validateDeck } from '../src/index.ts';
import type { GameState, HeroClass, PlayerId, Minion, Target } from '../src/index.ts';
const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.3.0.json',import.meta.url),'utf8'));
const catalog=createCatalog(data), cards=data.slice(0,15).flatMap((c:{id:string})=>[c.id,c.id]);
function ready(cls:HeroClass='mage',other:HeroClass='warrior'):GameState{
  let s=createGame(catalog,[{heroClass:cls,cards},{heroClass:other,cards}],{seed:4,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[0].mana=10;s.players[0].maxMana=10;return s;
}
function card(s:GameState,id:PlayerId,cardId:string){const c={instanceId:`t${s.nextId++}`,cardId};s.players[id].hand.push(c);return c;}
function cast(s:GameState,id:PlayerId,cardId:string,target?:Target,position?:number){return applyAction(s,id,{type:'playCard',instanceId:card(s,id,cardId).instanceId,target,position});}
function m(s:GameState,id:PlayerId,cardId:string):Minion{const c=s.catalog[cardId];assert.ok(c?.kind==='minion');const x:Minion={instanceId:`t${s.nextId++}`,cardId,attack:c.attack,health:c.health,maxHealth:c.health,attacksRemaining:1,keywords:[...(c.keywords??[])]};s.players[id].board.push(x);return x;}
function t(x:Minion):Target{return {kind:'minion',instanceId:x.instanceId};}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
test('advanced catalog: 60 definitions, 59 collectible, noncollectible token rejected in deck',()=>{assert.equal(data.length,60);assert.equal(data.filter((c:{collectible?:boolean})=>c.collectible!==false).length,59);assert.throws(()=>validateDeck({heroClass:'mage',cards:['forest_sheep',...cards.slice(1)]},catalog),/토큰/);});
test('freeze prevents next attack and thaws at end of affected turn',()=>{
  let s=ready();const target=m(s,1,'guard');s=cast(s,0,'ice_shard',t(target));assert.equal(s.players[1].board[0].health,1);s=end(s);
  assert.throws(()=>applyAction(s,1,{type:'attack',attackerId:target.instanceId,target:{kind:'hero'}}),/빙결/);s=end(s);s=end(s);
  s=applyAction(s,1,{type:'attack',attackerId:target.instanceId,target:{kind:'hero'}});assert.equal(s.players[0].health,28);
});
test('hero freeze prevents weapon attack until thaw',()=>{
  let s=ready();s.players[1].weapon={attack:3,durability:2};s=cast(s,0,'ice_shard',{kind:'hero',player:1});s=end(s);
  assert.throws(()=>applyAction(s,1,{type:'heroAttack',target:{kind:'hero'}}),/빙결/);s=end(s);s=end(s);s=applyAction(s,1,{type:'heroAttack',target:{kind:'hero'}});assert.equal(s.players[0].health,27);
});
test('silence resets buffs and keywords, removes deathrattle and spell power',()=>{
  let s=ready('priest');const x=m(s,1,'courier');x.attack=5;x.health=5;x.maxHealth=5;x.keywords=['taunt','divineShield'];const count=s.players[1].deck.length;
  s=cast(s,0,'silencing_rune',t(x));assert.equal(s.players[1].board[0].attack,1);assert.equal(s.players[1].board[0].health,2);assert.deepEqual(s.players[1].board[0].keywords,[]);
  s=cast(s,0,'banishment',t(x));assert.equal(s.players[1].deck.length,count);assert.equal(s.players[1].board.length,0);
});
test('silenced spell power not counted',()=>{let s=ready();const x=m(s,0,'fire_apprentice');s=cast(s,0,'silencing_rune',t(x));s=cast(s,0,'flame_sphere',{kind:'hero',player:1});assert.equal(s.players[1].health,24);});
test('transform replaces identity/stats without deathrattle and clears buffs',()=>{
  let s=ready();const x=m(s,1,'brood_guard');x.attack=8;x.health=9;x.maxHealth=9;x.keywords=['taunt'];s=cast(s,0,'sheep_hex',t(x));
  const y=s.players[1].board[0];assert.equal(y.instanceId,x.instanceId);assert.equal(y.cardId,'forest_sheep');assert.deepEqual([y.attack,y.health,y.maxHealth],[1,1,1]);assert.deepEqual(y.keywords,[]);
  s=cast(s,0,'flame_sphere',t(y));assert.equal(s.players[1].board.length,0);
});
test('bounce removes minion without deathrattle, returns original card, full hand burns',()=>{
  let s=ready('rogue');const x=m(s,1,'courier'),count=s.players[1].deck.length;s=cast(s,0,'storm_retreat',t(x));assert.equal(s.players[1].board.length,0);assert.equal(s.players[1].deck.length,count);assert.ok(s.players[1].hand.some(c=>c.instanceId===x.instanceId));
  const y=m(s,1,'guard');while(s.players[1].hand.length<10)card(s,1,'fox');s=cast(s,0,'storm_retreat',t(y));assert.equal(s.players[1].hand.length,10);assert.ok(!s.players[1].hand.some(c=>c.instanceId===y.instanceId));
});
test('combo triggers only after another card this turn and resets next turn',()=>{
  let s=ready('rogue');s=cast(s,0,'twin_strike',{kind:'hero',player:1});assert.equal(s.players[1].health,28);
  s=cast(s,0,'twin_strike',{kind:'hero',player:1});assert.equal(s.players[1].health,24);s=end(end(s));s=cast(s,0,'twin_strike',{kind:'hero',player:1});assert.equal(s.players[1].health,22);
});
test('overload accumulates next-turn mana lock and then clears',()=>{
  let s=ready('shaman');const x=m(s,1,'guard');s=cast(s,0,'lightning_debt',t(x));assert.equal(s.players[0].pendingOverload,2);s=end(end(s));assert.equal(s.players[0].maxMana,10);assert.equal(s.players[0].mana,8);assert.equal(s.players[0].lockedMana,2);assert.equal(s.players[0].pendingOverload,0);s=end(end(s));assert.equal(s.players[0].mana,10);
});
test('empty mana crystal increases max mana but not current mana, capped at 10',()=>{
  let s=ready('druid');s.players[0].maxMana=3;s.players[0].mana=3;s=cast(s,0,'root_bloom');assert.equal(s.players[0].maxMana,4);assert.equal(s.players[0].mana,1);s=end(end(s));assert.equal(s.players[0].mana,5);
});
test('draw and deterministic random discard consume correct deck and hand counts',()=>{
  let s=ready('warlock');const n=s.players[0].hand.length, d=s.players[0].deck.length;const c=card(s,0,'dark_trade'), action={type:'playCard',instanceId:c.instanceId};const after=applyAction(s,0,action);assert.deepEqual(after,applyAction(s,0,action));assert.equal(after.players[0].hand.length,n+1);assert.equal(after.players[0].deck.length,d-2);
});
test('grant shield/charge to friendly minion and newly summoned can attack',()=>{
  let s=ready('warrior');s=cast(s,0,'guard');const x=s.players[0].board[0];assert.equal(x.attacksRemaining,0);s=cast(s,0,'battle_cry',t(x));assert.equal(s.players[0].board[0].attacksRemaining,1);s=cast(s,0,'light_guard',t(x));assert.ok(s.players[0].board[0].keywords?.includes('divineShield'));s=applyAction(s,0,{type:'attack',attackerId:x.instanceId,target:{kind:'hero'}});assert.equal(s.players[1].health,28);
});
test('adjacent battlecry respects selected board position',()=>{
  let s=ready();m(s,0,'fox');m(s,0,'guard');m(s,0,'recruit');s=cast(s,0,'banner_captain',undefined,1);
  assert.deepEqual(s.players[0].board.map(x=>[x.cardId,x.attack,x.health]),[['fox',3,2],['banner_captain',2,3],['guard',3,4],['recruit',1,2]]);
});
test('start-turn triggers draw an extra card; addCard generates without deck draw',()=>{
  let s=ready('hunter');s=cast(s,0,'morning_sage');const d=s.players[0].deck.length;s=end(end(s));assert.equal(s.players[0].deck.length,d-2);
  const d2=s.players[0].deck.length,hand=s.players[0].hand.length;s=cast(s,0,'animal_kit');assert.equal(s.players[0].hand.length,hand+1);assert.equal(s.players[0].deck.length,d2);assert.ok(s.players[0].hand.some(c=>c.cardId==='fox'));
});
