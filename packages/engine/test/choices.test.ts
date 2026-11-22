import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog,createGame,applyAction,starterDeck,getPlayerView } from '../src/index.ts';
import type { GameState,HeroClass,PlayerId,Target } from '../src/index.ts';
const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.5.0.json',import.meta.url),'utf8')),catalog=createCatalog(data);
function ready(a:HeroClass='druid',b:HeroClass='mage'){let s=createGame(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],{seed:22,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[0].mana=10;s.players[0].maxMana=10;return s;}
function hand(s:GameState,id:string){const c={cardId:id,instanceId:`t${s.nextId++}`};s.players[s.activePlayer].hand.push(c);s.players[s.activePlayer].mana=10;return c;}
function play(s:GameState,id:string,target?:Target,choice?:number){const c=hand(s,id);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target,choice});}
function t(s:GameState,who:PlayerId,cardId:string):Target{return{kind:'minion',instanceId:s.players[who].board.find(m=>m.cardId===cardId)!.instanceId};}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
test('v0.5 catalog contains 106 definitions, 105 collectible',()=>{assert.equal(data.length,106);assert.equal(data.filter((c:{collectible?:boolean})=>c.collectible!==false).length,105);});
test('choose-one spell requires valid choice and per-choice targeting',()=>{
  let s=ready();const c=hand(s,'nature_choice');const before=structuredClone(s);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}),/효과를 선택/);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,choice:99}),/효과를 선택/);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,choice:0}),/대상/);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,choice:1,target:{kind:'hero'}}),/필요 없는/);assert.deepEqual(s,before);
  s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,choice:0,target:{kind:'hero',player:1}});assert.equal(s.players[1].health,27);const n=s.players[0].deck.length;s=play(s,'nature_choice',undefined,1);assert.equal(s.players[0].deck.length,n-1);assert.equal(s.players[1].health,27);
});
test('choose-one minion resolves selected effect only',()=>{
  let s=ready();s=play(s,'ancient_warden',undefined,0);assert.equal(s.players[0].board[0].attack,2);assert.ok(s.players[0].board[0].keywords?.includes('taunt'));
  s=play(s,'ancient_warden',undefined,1);assert.equal(s.players[0].board[1].attack,4);assert.ok(!s.players[0].board[1].keywords?.includes('taunt'));
});
test('permanent control moves card, recalculates aura, cannot attack until next turn',()=>{
  let s=ready('priest');s=play(s,'war_banner');s=end(s);s=play(s,'fox');s=end(s);const old=s.players[1].board[0].instanceId;
  s=play(s,'mind_claim',t(s,1,'fox'));assert.equal(s.players[1].board.length,0);const x=s.players[0].board[1];assert.equal(x.instanceId,old);assert.equal(x.attack,3);assert.equal(x.attacksRemaining,0);
  s=end(end(s));assert.equal(s.players[0].board[1].attacksRemaining,1);
});
test('control fails cleanly on full board',()=>{
  let s=ready('priest');for(let i=0;i<7;i++)s=play(s,'recruit');s=end(s);s=play(s,'fox');s=end(s);const c=hand(s,'mind_claim'),snapshot=structuredClone(s);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:t(s,1,'fox')}),/가득 차/);assert.deepEqual(s,snapshot);
});
test('copy hidden enemy cards creates new instances, does not expose original IDs or mutate enemy zone',()=>{
  let s=ready('priest');const deckBefore=structuredClone(s.players[1].deck),handBefore=structuredClone(s.players[1].hand),ownIds=new Set(s.players[0].hand.map(c=>c.instanceId));
  s=play(s,'thought_echo');assert.deepEqual(s.players[1].deck,deckBefore);const copied=s.players[0].hand.filter(c=>!ownIds.has(c.instanceId));assert.equal(copied.length,2);for(const c of copied){assert.ok(deckBefore.some(d=>d.cardId===c.cardId));assert.ok(!deckBefore.some(d=>d.instanceId===c.instanceId));assert.ok(!JSON.stringify(getPlayerView(s,1)).includes(c.instanceId));}
  s=play(s,'steal_plan');assert.deepEqual(s.players[1].hand,handBefore);
});
test('temporary attack expires after end turn and permanent aura remains',()=>{
  let s=ready('warrior');s=play(s,'fox');s=play(s,'war_banner');s=play(s,'final_stand');assert.equal(s.players[0].board[0].attack,5);assert.equal(s.players[0].board[1].attack,4);
  s=end(s);assert.equal(s.players[0].board[0].attack,3);assert.equal(s.players[0].board[1].attack,2);
});
test('grant windfury after one attack grants one extra attack',()=>{
  let s=ready('shaman');s=play(s,'fox');s=end(end(s));const x=s.players[0].board[0];s=applyAction(s,0,{type:'attack',attackerId:x.instanceId,target:{kind:'hero'}});assert.equal(s.players[0].board[0].attacksRemaining,0);
  s=play(s,'wind_blessing',t(s,0,'fox'));assert.equal(s.players[0].board[0].attacksRemaining,1);s=applyAction(s,0,{type:'attack',attackerId:x.instanceId,target:{kind:'hero'}});assert.equal(s.players[1].health,26);
});
test('set attack clears temporary/permanent attack modifiers while keeping current aura',()=>{
  let s=ready('paladin');s=end(s);s=play(s,'wolf');s=play(s,'war_banner');s=play(s,'final_stand');assert.equal(s.players[1].board[0].attack,6);s=end(s);
  s=play(s,'humbling_light',t(s,1,'wolf'));assert.equal(s.players[1].board[0].attack,2);
});
test('weapon destruction and heal trigger only on actual healing',()=>{
  let s=ready('priest','rogue');s=play(s,'healing_scholar');s=play(s,'guard');s=end(s);s.players[1].mana=10;s=applyAction(s,1,{type:'heroPower'});assert.equal(s.players[1].weapon?.durability,2);
  s=end(s);s=play(s,'rust_collector');assert.equal(s.players[1].weapon,null);const n=s.players[0].deck.length;s=play(s,'holy_light',t(s,0,'guard'));assert.equal(s.players[0].deck.length,n);
  s.players[0].board.find(x=>x.cardId==='guard')!.health=1;s=play(s,'holy_light',t(s,0,'guard'));assert.equal(s.players[0].deck.length,n-1);
});
