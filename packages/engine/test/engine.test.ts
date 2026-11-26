import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, createCatalog, createGame, getPlayerView, validateDeck, RuleError } from '../src/index.ts';
import type { CardInstance, Deck, GameState, Minion, PlayerId } from '../src/index.ts';

const data = JSON.parse(readFileSync(new URL('../../../data/cards/v0.1.0.json', import.meta.url), 'utf8'));
const catalog = createCatalog(data);
const deck: Deck = { heroClass: 'warrior', cards: data.flatMap((c: {id:string}) => [c.id,c.id]) };
function newGame(firstPlayer: PlayerId = 0, seed = 42) {
  return createGame(catalog, [deck, {...deck, heroClass: 'mage'}], {seed, firstPlayer});
}
function ready(firstPlayer: PlayerId = 0) {
  let s = newGame(firstPlayer);
  s = applyAction(s, 0, {type:'mulligan', replace:[]});
  return applyAction(s, 1, {type:'mulligan', replace:[]});
}
function addHand(s: GameState, id: PlayerId, cardId: string): CardInstance {
  const c = {instanceId:`t${s.nextId++}`,cardId}; s.players[id].hand.push(c); return c;
}
function addMinion(s: GameState, id: PlayerId, attack: number, health: number): Minion {
  const m: Minion = {instanceId:`t${s.nextId++}`,cardId:'recruit',attack,health,maxHealth:health,attacksRemaining:1}; s.players[id].board.push(m); return m;
}
function rejects(s: GameState, id: PlayerId, action: unknown, message: RegExp) {
  const before = structuredClone(s);
  assert.throws(() => applyAction(s,id,action), (e: unknown) => e instanceof RuleError && message.test(e.message));
  assert.deepEqual(s,before);
}
test('catalog: custom JSON validates, rejects duplicate IDs, rarities and invalid stats', () => {
  assert.equal(Object.keys(catalog).length,16);
  assert.throws(() => createCatalog([data[0],data[0]]),RuleError);
  assert.throws(() => createCatalog([{...data[0],health:0}]),RuleError);
  assert.throws(() => createCatalog([{...data[0],rarity:'mythic'}]),RuleError);
  assert.doesNotThrow(() => createCatalog([{...data[0],rarity:'legendary'}]));
  assert.throws(() => createCatalog([{...data[0],description:'미구현 효과'}]),RuleError);
});
test('catalog rejects misspelled or inapplicable card mechanics instead of silently ignoring them',()=>{
  const minion=data.find((c:{kind:string})=>c.kind==='minion'),spell={id:'test_spell',name:'Test',kind:'spell',class:'neutral',rarity:'basic',cost:1,description:'Draw',effects:[{kind:'draw',amount:1}]};
  assert.throws(()=>createCatalog([{...minion,healthBonus:9}]),/지원하지 않는 카드 필드.*healthBonus/);
  assert.throws(()=>createCatalog([{...spell,attack:8}]),/지원하지 않는 카드 필드.*attack/);
  assert.throws(()=>createCatalog([{...minion,effects:[{kind:'draw',amount:1}]}]),/지원하지 않는 카드 필드.*effects/);
  assert.throws(()=>createCatalog([{...spell,effects:[{kind:'draw',amount:1,target:'enemyHero'}]}]),/지원하지 않는 효과 필드.*target/);
  assert.throws(()=>createCatalog([{...spell,effects:[{kind:'draw',amount:1,condition:{kind:'combo',count:3}}]}]),/지원하지 않는 효과 조건 필드.*count/);
});
test('deck: 30 cards, at most two copies, valid IDs and class', () => {
  assert.doesNotThrow(() => validateDeck(deck,catalog));
  assert.throws(() => validateDeck({...deck,cards:deck.cards.slice(1)},catalog),/30장/);
  assert.throws(() => validateDeck({...deck,cards:Array(30).fill('recruit')},catalog),/최대 2장/);
  assert.throws(() => validateDeck({...deck,cards:['missing',...deck.cards.slice(1)]},catalog),/존재하지/);
  assert.throws(() => validateDeck({...deck,cards:['__coin',...deck.cards.slice(1)]},catalog),/동전/);
  const c = createCatalog([{...data[0],class:'mage'},...data.slice(1)]);
  assert.throws(() => validateDeck(deck,c),/다른 직업/);
});
test('initial state: health 30, initial 3/4 cards, seeded repeatability', () => {
  const s = newGame(); assert.equal(s.phase,'mulligan');
  assert.deepEqual(s.players.map(p=>p.health),[30,30]);
  assert.deepEqual(s.players.map(p=>p.hand.length),[3,4]);
  assert.deepEqual(s,newGame());
  assert.notDeepEqual(s.players[0].deck,newGame(0,88).players[0].deck);
});
test('mulligan: set aside selected cards until replacements drawn; no card lost', () => {
  const s = newGame(), replaced = s.players[0].hand.map(c=>c.instanceId);
  const next = applyAction(s,0,{type:'mulligan',replace:replaced});
  const p = next.players[0]; assert.equal(p.hand.length,3);
  assert.ok(p.hand.every(c=>!replaced.includes(c.instanceId)));
  assert.ok(replaced.every(id=>p.deck.some(c=>c.instanceId===id)));
  assert.equal(new Set([...p.hand,...p.deck].map(c=>c.instanceId)).size,30);
  rejects(next,0,{type:'mulligan',replace:[]},/이미 완료/);
});
test('mulligan: foreign, duplicate and malformed IDs rejected; normal action blocked', () => {
  const s = newGame(), id = s.players[0].hand[0].instanceId;
  rejects(s,0,{type:'mulligan',replace:[id,id]},/한 번씩/);
  rejects(s,0,{type:'mulligan',replace:[s.players[1].hand[0].instanceId]},/자신의 손패/);
  rejects(s,0,{type:'mulligan',replace:null},/목록/);
  rejects(s,0,{type:'endTurn'},/멀리건/);
});
test('both mulligans start first turn, grant second player coin, draw one card', () => {
  const s = ready(1);
  assert.equal(s.activePlayer,1); assert.equal(s.turn,1); assert.equal(s.phase,'playing');
  assert.deepEqual(s.players.map(p=>p.hand.length),[5,4]);
  assert.ok(s.players[0].hand.some(c=>c.cardId==='__coin'));
  assert.deepEqual(s.players.map(p=>p.mana),[0,1]);
});
test('turn order, refill, mana cap and one draw per turn', () => {
  let s = ready();
  rejects(s,1,{type:'endTurn'},/자신의 턴/);
  for(let i=0;i<23;i++) {
    const next = 1-s.activePlayer as PlayerId, count=s.players[next].deck.length;
    s = applyAction(s,s.activePlayer,{type:'endTurn'});
    assert.equal(s.activePlayer,next); assert.equal(s.players[next].deck.length,count-1);
    assert.equal(s.players[next].mana,s.players[next].maxMana);
  }
  assert.deepEqual(s.players.map(p=>p.maxMana),[10,10]);
});
test('coin: temporary mana, capped at ten, disappears and cannot replay', () => {
  let s = applyAction(ready(),0,{type:'endTurn'});
  const coin=s.players[1].hand.find(c=>c.cardId==='__coin')!;
  s=applyAction(s,1,{type:'playCard',instanceId:coin.instanceId});
  assert.equal(s.players[1].mana,2); assert.equal(s.players[1].maxMana,1);
  rejects(s,1,{type:'playCard',instanceId:coin.instanceId},/손패/);
  s=applyAction(s,1,{type:'endTurn'}); s=applyAction(s,0,{type:'endTurn'});
  assert.equal(s.players[1].mana,2);
  const capped=addHand(s,1,'__coin'); s.players[1].mana=10;
  s=applyAction(s,1,{type:'playCard',instanceId:capped.instanceId}); assert.equal(s.players[1].mana,10);
});
test('play minion consumes mana and hand, leaves original state unchanged, summoning sickness', () => {
  let s=ready(); const c=addHand(s,0,'recruit'); const prev=structuredClone(s);
  const after=applyAction(s,0,{type:'playCard',instanceId:c.instanceId});
  assert.deepEqual(s,prev); s=after;
  assert.equal(s.players[0].mana,0); assert.equal(s.players[0].board[0].health,2);
  assert.ok(!s.players[0].hand.some(h=>h.instanceId===c.instanceId));
  rejects(s,0,{type:'attack',attackerId:c.instanceId,target:{kind:'hero'}},/공격할 수 없는/);
  s=applyAction(s,0,{type:'endTurn'}); s=applyAction(s,1,{type:'endTurn'});
  assert.equal(s.players[0].board[0].attacksRemaining,1);
});
test('play validation: insufficient mana, foreign hand, board cap', () => {
  const s=ready(), costly=addHand(s,0,'wyrm');
  rejects(s,0,{type:'playCard',instanceId:costly.instanceId},/마나/);
  rejects(s,0,{type:'playCard',instanceId:s.players[1].hand[0].instanceId},/손패/);
  const c=addHand(s,0,'recruit'); for(let i=0;i<7;i++) addMinion(s,0,1,1);
  rejects(s,0,{type:'playCard',instanceId:c.instanceId},/최대 7개/);
});
test('minion combat: simultaneous damage, both dead removed', () => {
  const s=ready(), a=addMinion(s,0,3,2), b=addMinion(s,1,2,3);
  const next=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:{kind:'minion',instanceId:b.instanceId}});
  assert.equal(next.players[0].board.length,0); assert.equal(next.players[1].board.length,0);
});
test('minion combat: survivors retain health, one attack per turn', () => {
  const s=ready(), a=addMinion(s,0,2,5), b=addMinion(s,1,1,5);
  const next=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:{kind:'minion',instanceId:b.instanceId}});
  assert.equal(next.players[0].board[0].health,4); assert.equal(next.players[1].board[0].health,3);
  rejects(next,0,{type:'attack',attackerId:a.instanceId,target:{kind:'hero'}},/공격할 수 없는/);
});
test('attack validation: own target, opponent attacker, zero attack, bogus target', () => {
  const s=ready(), a=addMinion(s,0,2,3), b=addMinion(s,1,2,3), z=addMinion(s,0,0,1);
  rejects(s,0,{type:'attack',attackerId:a.instanceId,target:{kind:'minion',instanceId:a.instanceId}},/상대 전장/);
  rejects(s,0,{type:'attack',attackerId:b.instanceId,target:{kind:'hero'}},/공격할 수 없는/);
  rejects(s,0,{type:'attack',attackerId:z.instanceId,target:{kind:'hero'}},/공격할 수 없는/);
  rejects(s,0,{type:'attack',attackerId:a.instanceId,target:null},/공격 대상/);
});
test('hero attack: no counterdamage, lethal resolves win and locks game', () => {
  const s=ready(), a=addMinion(s,0,4,2); s.players[1].health=4;
  const next=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:{kind:'hero'}});
  assert.equal(next.players[1].health,0); assert.equal(next.players[0].board[0].health,2);
  assert.equal(next.phase,'finished'); assert.equal(next.winner,0); assert.equal(next.reason,'health');
  rejects(next,0,{type:'endTurn'},/종료/);
});
test('fatigue: 1 then 2 then 3 damage, lethal resolves win', () => {
  let s=ready(); s.players[1].deck=[]; s.players[1].health=6;
  for(const remaining of [5,3,0]) {
    s=applyAction(s,0,{type:'endTurn'}); assert.equal(s.players[1].health,remaining);
    if(s.phase==='playing') s=applyAction(s,1,{type:'endTurn'});
  }
  assert.equal(s.winner,0); assert.equal(s.reason,'fatigue'); assert.equal(s.players[1].fatigue,3);
});
test('full hand burns draw; deck still decreases, no fatigue', () => {
  const s=ready(); while(s.players[1].hand.length<10) addHand(s,1,'recruit');
  const d=s.players[1].deck.length;
  const next=applyAction(s,0,{type:'endTurn'});
  assert.equal(next.players[1].hand.length,10); assert.equal(next.players[1].deck.length,d-1); assert.equal(next.players[1].fatigue,0);
});
test('concede outside own turn and during mulligan', () => {
  for(const s of [ready(),newGame()]) { const next=applyAction(s,1,{type:'concede'}); assert.equal(next.winner,0); assert.equal(next.reason,'concede'); }
});
test('player view exposes own hand, counts only for both decks and opponent hand, no RNG', () => {
  const s=ready(), view=getPlayerView(s,0);
  assert.deepEqual(view.self.hand,s.players[0].hand);
  assert.equal(view.opponent.handCount,s.players[1].hand.length);
  assert.equal(view.self.deckCount,s.players[0].deck.length);
  assert.equal(Object.hasOwn(view.opponent,'hand'),false); assert.equal(Object.hasOwn(view.self,'deck'),false); assert.equal(Object.hasOwn(view.opponent,'deck'),false);
  assert.equal(Object.hasOwn(view,'rng'),false); assert.equal(Object.hasOwn(view,'catalog'),false);
  const serialized=JSON.stringify(view); for(const c of [...s.players[1].hand,...s.players[0].deck,...s.players[1].deck]) assert.ok(!serialized.includes(`\"${c.instanceId}\"`));
  view.self.hand.pop(); assert.equal(s.players[0].hand.length,4);
});
test('public history preserves order and isolates views from engine records', () => {
  const s=ready();
  s.history=[
    {turn:2,player:0,message:'first public event'},
    {turn:2,player:1,message:'second public event'}
  ];
  const first=getPlayerView(s,0), second=getPlayerView(s,1);
  assert.deepEqual(first.history,s.history);
  first.history[0].message='changed by client';
  first.history.reverse();
  assert.deepEqual(second.history,s.history);
  assert.equal(s.history[0].message,'first public event');
});
test('bad actor, unknown action and malformed action rejected', () => {
  const s=ready(); rejects(s,2 as PlayerId,{type:'endTurn'},/플레이어/);
  rejects(s,0,{type:'cheat', mana:999},/지원하지/); rejects(s,0,null,/잘못된 행동/);
});
test('card catalog snapshot stays stable during balance edits; revision increments only on success', () => {
  const custom=createCatalog(data), s=createGame(custom,[deck,deck],{seed:1});
  const recruit=custom.recruit; if(recruit.kind==='minion') recruit.attack=99;
  const saved=s.catalog.recruit; assert.ok(saved.kind==='minion' && saved.attack===1);
  assert.equal(s.revision,0); assert.equal(applyAction(s,0,{type:'mulligan',replace:[]}).revision,1);
});
