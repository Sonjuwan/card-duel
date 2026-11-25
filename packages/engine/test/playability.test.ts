import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, canAttackHero, canAttackMinion, cardChoiceReason, createCatalog, createGame, getPlayerView, heroPowerReason, legalPublicTargets, publicAttackTargets, publicCardCost, publicCardReason, starterDeck } from '../src/index.ts';
import type { GameState, HeroClass, Minion, PlayerId, Target } from '../src/index.ts';

const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.19.0.json',import.meta.url),'utf8')));
function ready(cls:HeroClass='warrior'){let s=createGame(catalog,[starterDeck(catalog,cls),starterDeck(catalog,'mage')],{seed:25,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[0].mana=10;return s;}
function onBoard(s:GameState,owner:PlayerId,id:string,extra:Partial<Minion>={}):Minion{const c=s.catalog[id];assert.ok(c.kind==='minion');const m={cardId:id,instanceId:`m${s.nextId++}`,health:c.health,maxHealth:c.health,attack:c.attack,attacksRemaining:1,keywords:[...(c.keywords??[])],...extra};s.players[owner].board.push(m);return m;}
function hand(s:GameState,id:string,discount?:number){const card={cardId:id,instanceId:`test${s.nextId++}`,costDiscount:discount};s.players[0].hand.push(card);return card;}
function agreesBlocked(s:GameState,id:string,target?:Target,choice?:number){const c=hand(s,id);const reason=publicCardReason(getPlayerView(s,0),0,c,s.catalog);assert.ok(reason,`Expected ${id} to be blocked`);assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target,choice}));}

test('public attack targets exclude stealth and require visible taunts',()=>{const s=ready(),guard=onBoard(s,1,'wolf',{keywords:['taunt']}),hidden=onBoard(s,1,'night_cat',{keywords:['taunt','stealth']}),normal=onBoard(s,1,'wisp');const v=getPlayerView(s,0);assert.deepEqual(publicAttackTargets(v,0),[{kind:'minion',instanceId:guard.instanceId}]);guard.keywords=[];assert.deepEqual(publicAttackTargets(getPlayerView(s,0),0),[{kind:'hero',player:1},{kind:'minion',instanceId:guard.instanceId},{kind:'minion',instanceId:normal.instanceId}]);assert.ok(!JSON.stringify(publicAttackTargets(getPlayerView(s,0),0)).includes(hidden.instanceId));});
test('public spell targets respect untargetability and stealth; battlecries may target untargetable minions',()=>{const s=ready(),dragon=onBoard(s,1,'faerie_drake'),hidden=onBoard(s,1,'night_cat'),own=onBoard(s,0,'faerie_drake');const v=getPlayerView(s,0);assert.deepEqual(legalPublicTargets(v,0,'anyMinion',s.catalog,true),[]);const targets=legalPublicTargets(v,0,'anyMinion',s.catalog);assert.ok(targets.some(t=>t.kind==='minion'&&t.instanceId===dragon.instanceId));assert.ok(targets.some(t=>t.kind==='minion'&&t.instanceId===own.instanceId));assert.ok(!targets.some(t=>t.kind==='minion'&&t.instanceId===hidden.instanceId));});
test('card blocker matches authoritative missing weapon and enemy count checks',()=>{const s=ready();agreesBlocked(s,'blade_burst');agreesBlocked(s,'weapon_hone');agreesBlocked(s,'twin_cleave');onBoard(s,1,'wolf');agreesBlocked(s,'double_volley');onBoard(s,1,'wisp');const c=hand(s,'double_volley');assert.equal(publicCardReason(getPlayerView(s,0),0,c,s.catalog),undefined);assert.doesNotThrow(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}));});
test('full board blocks summoned minion, control spell and summoning hero power',()=>{const s=ready('paladin'),foe=onBoard(s,1,'wolf');for(let i=0;i<7;i++)onBoard(s,0,'wisp');agreesBlocked(s,'wolf');agreesBlocked(s,'mind_claim',{kind:'minion',instanceId:foe.instanceId});assert.match(heroPowerReason(s.players[0])!,/최대 7/);assert.throws(()=>applyAction(s,0,{type:'heroPower'}),/최대 7/);});
test('shaman hero power disabled when all unique totems present, but reenabled after one disappears',()=>{const s=ready('shaman');for(const id of ['__stone_totem','__flame_totem','__healing_totem','__magic_totem'])onBoard(s,0,id);assert.match(heroPowerReason(s.players[0])!,/모든 종류/);assert.throws(()=>applyAction(s,0,{type:'heroPower'}),/모든 종류/);s.players[0].board.pop();assert.equal(heroPowerReason(s.players[0]),undefined);assert.doesNotThrow(()=>applyAction(s,0,{type:'heroPower'}));});
test('a choose-one spell is blocked only if every option is blocked',()=>{const s=ready('druid'),allBlocked=hand(s,'nature_choice'),mixed=hand(s,'nature_wave');const v=getPlayerView(s,0);assert.ok(publicCardReason(v,0,allBlocked,s.catalog));assert.equal(publicCardReason(v,0,mixed,s.catalog),undefined);assert.ok(cardChoiceReason(v,0,s.catalog.nature_wave,s.catalog,0));assert.equal(cardChoiceReason(v,0,s.catalog.nature_wave,s.catalog,1),undefined);assert.doesNotThrow(()=>applyAction(s,0,{type:'playCard',instanceId:mixed.instanceId,choice:1}));});
test('battlecry may be played without target if no legal minion exists',()=>{const s=ready(),c=hand(s,'beast_tamer');assert.equal(publicCardReason(getPlayerView(s,0),0,c,s.catalog),undefined);const heal=hand(s,'silencing_rune');assert.ok(publicCardReason(getPlayerView(s,0),0,heal,s.catalog));assert.doesNotThrow(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}));});
test('current cost and blocked mana reflect public aura, hand discount and live weapon',()=>{const s=ready();s.players[0].mana=2;onBoard(s,0,'venture_merc');const c=hand(s,'snow_brute',1),v=getPlayerView(s,0);assert.equal(publicCardCost(v,0,s.catalog.snow_brute,s.catalog,1),6);assert.match(publicCardReason(v,0,c,s.catalog)!,/마나/);assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}),/마나/);});
test('duplicate installed secret is disabled even when first-secret discount is active',()=>{const s=ready('mage');s.players[0].secrets.push({cardId:'ice_barrier',instanceId:'secret0'});s.players[0].nextSecretFree=true;agreesBlocked(s,'ice_barrier');});
test('frozen or naturally unable minions and frozen heroes never show attack-ready',()=>{const s=ready(),m=onBoard(s,0,'ancient_watcher');assert.equal(canAttackMinion(m,s.catalog),false);m.silenced=true;assert.equal(canAttackMinion(m,s.catalog),true);m.frozenThroughTurn=s.turn;assert.equal(canAttackMinion(m,s.catalog),false);s.players[0].weapon={attack:2,durability:1};assert.equal(canAttackHero(getPlayerView(s,0).self),true);s.players[0].heroFrozenThroughTurn=s.turn;assert.equal(canAttackHero(getPlayerView(s,0).self),false);});

test('shaman power spends two mana and summons the sole missing basic totem', () => {
  const state=ready('shaman');
  for(const id of ['__stone_totem','__flame_totem','__healing_totem'])onBoard(state,0,id);
  onBoard(state,1,'__magic_totem');
  const next=applyAction(state,0,{type:'heroPower'});
  assert.equal(next.players[0].mana,8);
  assert.equal(next.players[0].board.at(-1)?.cardId,'__magic_totem');
  assert.equal(next.players[0].board.at(-1)?.health,2);
  const totem=next.catalog.__magic_totem;
  assert.ok(totem.kind==='minion');
  assert.equal(totem.collectible,false);
  assert.equal(totem.spellDamage,1);
});

test('healing totem restores friendly minions only and stops when silenced', () => {
  for(const silenced of [false,true]){
    const state=ready('shaman');
    const totem=onBoard(state,0,'__healing_totem',{health:1,silenced});
    const friendly=onBoard(state,0,'wolf',{health:1});
    const enemy=onBoard(state,1,'wolf',{health:1});
    state.players[0].health=25;
    const next=applyAction(state,0,{type:'endTurn'});
    assert.equal(next.players[0].health,25);
    assert.equal(next.players[0].board.find(m=>m.instanceId===totem.instanceId)?.health,silenced?1:2);
    assert.equal(next.players[0].board.find(m=>m.instanceId===friendly.instanceId)?.health,silenced?1:2);
    assert.equal(next.players[1].board.find(m=>m.instanceId===enemy.instanceId)?.health,1);
  }
});
