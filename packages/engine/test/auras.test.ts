import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog,createGame,applyAction,starterDeck,getPlayerView } from '../src/index.ts';
import type { GameState,HeroClass,PlayerId,Target } from '../src/index.ts';
const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.4.0.json',import.meta.url),'utf8')),catalog=createCatalog(data);
function ready(a:HeroClass='mage',b:HeroClass='mage'):GameState{let s=createGame(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],{seed:3,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[0].mana=10;s.players[0].maxMana=10;return s;}
function play(s:GameState,cardId:string,target?:Target,position?:number){const id=s.activePlayer,c={cardId,instanceId:`t${s.nextId++}`};s.players[id].hand.push(c);s.players[id].mana=10;return applyAction(s,id,{type:'playCard',instanceId:c.instanceId,target,position});}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
function t(s:GameState,id:PlayerId,cardId:string):Target{return{kind:'minion',instanceId:s.players[id].board.find(x=>x.cardId===cardId)!.instanceId};}
test('v0.4 data: 90 definitions and 89 deck-eligible cards',()=>{assert.equal(data.length,90);assert.equal(data.filter((c:{collectible?:boolean})=>c.collectible!==false).length,89);});
test('continuous attack aura applies to other allies and is removed without removing permanent buff',()=>{
  let s=ready();s=play(s,'fox');s=play(s,'war_banner');assert.equal(s.players[0].board[0].attack,3);assert.equal(s.players[0].board[1].attack,2);
  s=play(s,'forest_blessing');assert.equal(s.players[0].board[0].attack,4);s=play(s,'silencing_rune',t(s,0,'war_banner'));assert.equal(s.players[0].board[0].attack,3);assert.equal(s.players[0].board[1].attack,2);
});
test('adjacent aura updates when new minion inserted and source bounces',()=>{
  let s=ready();s=play(s,'fox');s=play(s,'guard');s=play(s,'pack_wolf',undefined,1);
  assert.deepEqual(s.players[0].board.map(x=>x.attack),[3,2,3]);s=play(s,'recruit',undefined,1);assert.deepEqual(s.players[0].board.map(x=>x.attack),[2,2,2,3]);
  s=play(s,'storm_retreat',t(s,0,'pack_wolf'));assert.deepEqual(s.players[0].board.map(x=>x.attack),[2,1,2]);
});
test('tribe aura affects only matching minions, stacks, and updates on transform',()=>{
  let s=ready();s=play(s,'reef_scout');s=play(s,'guard');s=play(s,'tide_leader');s=play(s,'tide_leader');
  assert.deepEqual(s.players[0].board.map(x=>[x.attack,x.health]),[[3,4],[2,3],[3,4],[3,4]]);
  s=play(s,'sheep_hex',t(s,0,'reef_scout'));assert.deepEqual([s.players[0].board[0].attack,s.players[0].board[0].health],[1,1]);
});
test('loss of health aura can kill injured ally and resolve its deathrattle',()=>{
  let s=ready();s=play(s,'courier');s=play(s,'sanctum_guard');assert.equal(s.players[0].board[0].health,3);s.players[0].board[0].health=1;
  const count=s.players[0].deck.length;s=play(s,'silencing_rune',t(s,0,'sanctum_guard'));assert.deepEqual(s.players[0].board.map(x=>x.cardId),['sanctum_guard']);assert.equal(s.players[0].deck.length,count-1);
});
test('summon trigger fires on both played and effect-summoned minions, not itself',()=>{
  let s=ready('paladin');s=play(s,'recruit_trainer');assert.equal(s.players[0].board[0].attack,2);
  s=play(s,'fox');s=play(s,'rally');assert.deepEqual(s.players[0].board.map(x=>x.attack),[2,3,2,2]);
});
test('tribe summon trigger draws only after matching beast',()=>{
  let s=ready('hunter');s=play(s,'wild_tracker');const n=s.players[0].deck.length;s=play(s,'guard');assert.equal(s.players[0].deck.length,n);s=play(s,'fox');assert.equal(s.players[0].deck.length,n-1);
});
test('spell trigger grows only on own resolved spell; countered spell no trigger',()=>{
  let s=ready();s=play(s,'spell_student');s=play(s,'flame_sphere',{kind:'hero',player:1});assert.equal(s.players[0].board[0].attack,2);
  s=end(s);s=play(s,'arcane_barrier');s=play(s,'flame_sphere',{kind:'hero',player:0});assert.equal(s.players[0].board[0].attack,2);s=end(s);s=play(s,'flame_sphere',{kind:'hero',player:1});assert.equal(s.players[0].board[0].attack,2);
});
test('self damage trigger applies after combat but divine shield prevents reaction',()=>{
  let s=ready();s=play(s,'street_brawler');s=play(s,'light_guard',t(s,0,'street_brawler'));s=end(s);
  s=play(s,'archer',t(s,0,'street_brawler'));assert.equal(s.players[0].board[0].attack,2);s=play(s,'archer',t(s,0,'street_brawler'));assert.equal(s.players[0].board[0].attack,3);
});
test('death watchers trigger once per dead minion including simultaneous kills, silenced watchers stop',()=>{
  let s=ready();s=play(s,'battle_watcher');s=play(s,'scout');s=play(s,'fox');s=play(s,'siege_strike');assert.deepEqual(s.players[0].board.map(x=>[x.cardId,x.attack,x.health]),[['battle_watcher',4,1]]);
  s=play(s,'silencing_rune',t(s,0,'battle_watcher'));s=play(s,'holy_light',t(s,0,'battle_watcher'));s=play(s,'fox');s=play(s,'siege_strike');assert.deepEqual(s.players[0].board.map(x=>[x.cardId,x.attack,x.health]),[['battle_watcher',2,1]]);
});
test('simultaneous lethal AoE resolves draw and removes dead minions',()=>{
  let s=ready('warlock');s=play(s,'fox');s.players[0].health=2;s.players[1].health=2;s=play(s,'dark_tempest');assert.equal(s.phase,'finished');assert.equal(s.winner,null);assert.equal(s.players[0].board.length,0);assert.deepEqual(s.players.map(p=>p.health),[0,0]);
});
test('public log hides secret names until activation',()=>{
  let s=ready('mage');s=play(s,'arcane_barrier');assert.ok(getPlayerView(s,1).history.every(x=>!x.message.includes('마력 차단막')));s=end(s);s=play(s,'flame_sphere',{kind:'hero',player:0});assert.ok(getPlayerView(s,1).history.some(x=>x.message.includes('비밀 발동: 마력 차단막')));
});
