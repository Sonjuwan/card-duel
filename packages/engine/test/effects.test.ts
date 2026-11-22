import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog, createGame, applyAction, getPlayerView, validateDeck, HERO_CLASSES, HERO_POWERS, RuleError } from '../src/index.ts';
import type { GameState, PlayerId, HeroClass, CardInstance, Minion, Target, Keyword } from '../src/index.ts';

const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.2.0.json',import.meta.url),'utf8'));
const catalog=createCatalog(data);
const deckCards=data.slice(0,15).flatMap((c:{id:string})=>[c.id,c.id]);
function ready(first:HeroClass='mage',second:HeroClass='warrior',seed=42):GameState {
  let s=createGame(catalog,[{heroClass:first,cards:deckCards},{heroClass:second,cards:deckCards}],{seed,firstPlayer:0});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});
  s.players[0].mana=10;s.players[0].maxMana=10;return s;
}
function hand(s:GameState,id:PlayerId,cardId:string):CardInstance {const c={cardId,instanceId:`t${s.nextId++}`};s.players[id].hand.push(c);return c;}
function minion(s:GameState,id:PlayerId,cardId:string,stats?:{attack:number;health:number},keywords?:Keyword[]):Minion {
  const c=s.catalog[cardId];assert.ok(c?.kind==='minion');const a=stats?.attack??c.attack,h=stats?.health??c.health;
  const m:Minion={cardId,instanceId:`t${s.nextId++}`,attack:a,health:h,maxHealth:h,attacksRemaining:1,keywords:[...(keywords??c.keywords??[])]};s.players[id].board.push(m);return m;
}
function play(s:GameState,id:PlayerId,cardId:string,target?:Target,position?:number):GameState {return applyAction(s,id,{type:'playCard',instanceId:hand(s,id,cardId).instanceId,target,position});}
function target(m:Minion):Target{return{kind:'minion',instanceId:m.instanceId};}
function face(player:PlayerId):Target{return{kind:'hero',player};}
function reject(s:GameState,id:PlayerId,action:unknown,pattern:RegExp){const snap=structuredClone(s);assert.throws(()=>applyAction(s,id,action),(e:unknown)=>e instanceof RuleError&&pattern.test(e.message));assert.deepEqual(s,snap);}
function next(s:GameState):GameState {s=applyAction(s,s.activePlayer,{type:'endTurn'});s.players[s.activePlayer].mana=10;s.players[s.activePlayer].maxMana=10;return s;}

test('v0.2 data: all card kinds validated, all nine classes can build 30-card decks',()=>{
  assert.equal(data.length,46);
  for(const heroClass of HERO_CLASSES){const cards=data.filter((c:{class:string})=>c.class==='neutral'||c.class===heroClass).slice(-15).flatMap((c:{id:string})=>[c.id,c.id]);assert.doesNotThrow(()=>validateDeck({heroClass,cards},catalog));}
  assert.throws(()=>validateDeck({heroClass:'warrior',cards:['flame_sphere',...deckCards.slice(1)]},catalog),/다른 직업/);
});
test('schema rejects unknown effect, missing target rule, invalid summon reference and unsupported keyword',()=>{
  const spell={id:'bad',name:'bad',kind:'spell',cost:1,class:'neutral',rarity:'basic',description:''};
  for(const effects of [[{kind:'eval',code:'bad'}],[{kind:'damage',target:'chosen',amount:1}],[{kind:'summon',cardId:'bad',count:1}],[{kind:'heal',target:'friendlyHero',amount:-1}],[{kind:'damage',target:'eventAttacker',amount:2}]])assert.throws(()=>createCatalog([...data,{...spell,effects}]),RuleError);
  assert.throws(()=>createCatalog([{...data[0],keywords:['fake']}]),RuleError);
});
test('targeted spell validates missing and friendly target, damage and mana applied once',()=>{
  let s=ready();const c=hand(s,0,'flame_sphere');
  reject(s,0,{type:'playCard',instanceId:c.instanceId},/대상/);
  reject(s,0,{type:'playCard',instanceId:c.instanceId,target:face(0)},/선택할 수 없는/);
  s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:face(1)});assert.equal(s.players[1].health,24);assert.equal(s.players[0].mana,6);
  assert.ok(!s.players[0].hand.some(h=>h.instanceId===c.instanceId));
});
test('spell power amplifies damage, not hero power; target armor absorbs',()=>{
  let s=ready();minion(s,0,'fire_apprentice');s.players[1].armor=3;
  s=play(s,0,'flame_sphere',face(1));assert.equal(s.players[1].armor,0);assert.equal(s.players[1].health,26);
  s=applyAction(s,0,{type:'heroPower',target:face(1)});assert.equal(s.players[1].health,25);
});
test('heal cannot exceed max hero or minion health',()=>{
  let s=ready('priest');s.players[0].health=29;const m=minion(s,0,'guard');m.health=1;
  s=play(s,0,'holy_light',face(0));assert.equal(s.players[0].health,30);
  s=play(s,0,'holy_light',target(m));assert.equal(s.players[0].board[0].health,3);
});
test('battlecry heals and targeted battlecry uses chosen target; placement is validated',()=>{
  let s=ready();s.players[0].health=20;minion(s,0,'recruit');s=play(s,0,'field_medic',undefined,0);assert.equal(s.players[0].health,23);assert.equal(s.players[0].board[0].cardId,'field_medic');
  s=play(s,0,'archer',face(1));assert.equal(s.players[1].health,29);
  const c=hand(s,0,'recruit');reject(s,0,{type:'playCard',instanceId:c.instanceId,position:99},/배치/);
});
test('tribe synergies buff only beasts; conditional card draw requires existing beast',()=>{
  let s=ready();minion(s,0,'fox');minion(s,0,'guard');s=play(s,0,'beast_warden');
  assert.deepEqual(s.players[0].board.slice(0,2).map(m=>[m.attack,m.health,m.maxHealth]),[[3,2,2],[2,3,3]]);
  const count=s.players[0].deck.length;s=play(s,0,'forest_sage');assert.equal(s.players[0].deck.length,count-1);
  s=ready();const noBeast=s.players[0].deck.length;s=play(s,0,'forest_sage');assert.equal(s.players[0].deck.length,noBeast);
});
test('conditional spell damage applies only with beast present',()=>{
  let s=ready('hunter');s=play(s,0,'wild_arrow',face(1));assert.equal(s.players[1].health,27);
  minion(s,0,'fox');s=play(s,0,'wild_arrow',face(1));assert.equal(s.players[1].health,22);
});
test('deathrattle on simultaneous AoE removes all dead and draws/summons',()=>{
  let s=ready('shaman');minion(s,1,'courier');minion(s,1,'brood_guard',{attack:1,health:2});minion(s,1,'guard');
  const count=s.players[1].deck.length;s=play(s,0,'lightning_arc');
  assert.equal(s.players[1].deck.length,count-1);assert.deepEqual(s.players[1].board.map(m=>m.cardId),['fox','guard']);assert.equal(s.players[1].board[1].health,1);
});
test('destroy ignores divine shield, executes deathrattle once',()=>{
  let s=ready('priest');const m=minion(s,1,'courier',undefined,['divineShield']);const d=s.players[1].deck.length;
  s=play(s,0,'banishment',target(m));assert.equal(s.players[1].board.length,0);assert.equal(s.players[1].deck.length,d-1);
});
test('taunt blocks face and other minions; stealth taunt is not blocking',()=>{
  let s=ready();const a=minion(s,0,'guard'),b=minion(s,1,'shield_bearer'),c=minion(s,1,'fox');
  reject(s,0,{type:'attack',attackerId:a.instanceId,target:face(1)},/도발/);
  reject(s,0,{type:'attack',attackerId:a.instanceId,target:target(c)},/도발/);
  b.keywords=['taunt','stealth'];s=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:face(1)});assert.equal(s.players[1].health,28);
});
test('charge can attack on summon; windfury two attacks after turn start',()=>{
  let s=ready();s=play(s,0,'swift_horse');let m=s.players[0].board[0];assert.equal(m.attacksRemaining,1);
  s=applyAction(s,0,{type:'attack',attackerId:m.instanceId,target:face(1)});assert.equal(s.players[1].health,27);
  s=play(s,0,'twin_blades');s=next(next(s));m=s.players[0].board.find(m=>m.cardId==='twin_blades')!;assert.equal(m.attacksRemaining,2);
  for(let i=0;i<2;i++)s=applyAction(s,0,{type:'attack',attackerId:m.instanceId,target:face(1)});
  reject(s,0,{type:'attack',attackerId:m.instanceId,target:face(1)},/공격할 수 없는/);assert.equal(s.players[1].health,21);
});
test('divine shield absorbs damage once and blocks poison; next poison hit kills',()=>{
  let s=ready();const a=minion(s,0,'venom_snake',{attack:1,health:10}),b=minion(s,1,'crystal_sentinel',{attack:1,health:5});
  s=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:target(b)});assert.equal(s.players[1].board[0].health,5);assert.ok(!s.players[1].board[0].keywords?.includes('divineShield'));
  s=next(next(s));s=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:target(b)});assert.equal(s.players[1].board.length,0);
});
test('stealth blocks enemy targeted spells and attacks but AoE damages, attacking breaks stealth',()=>{
  let s=ready('shaman');const a=minion(s,0,'night_cat'),b=minion(s,1,'night_cat');
  reject(s,0,{type:'attack',attackerId:a.instanceId,target:target(b)},/은신/);
  const spell=hand(s,0,'flame_sphere');reject(s,0,{type:'playCard',instanceId:spell.instanceId,target:target(b)},/선택할 수 없는/);
  s=applyAction(s,0,{type:'attack',attackerId:a.instanceId,target:face(1)});assert.ok(!s.players[0].board[0].keywords?.includes('stealth'));
  s=play(s,0,'lightning_arc');assert.equal(s.players[1].board.length,0);
});
test('summon effect respects board limit and summoned minions cannot attack',()=>{
  let s=ready('paladin');for(let i=0;i<6;i++)minion(s,0,'recruit');s=play(s,0,'rally');assert.equal(s.players[0].board.length,7);assert.equal(s.players[0].board[6].cardId,'__squire');assert.equal(s.players[0].board[6].attacksRemaining,0);
  reject(s,0,{type:'heroPower'},/최대 7개/);
});
test('weapon equips, attacks simultaneously, durability falls, and breaks',()=>{
  let s=ready('warrior');s=play(s,0,'iron_axe');const m=minion(s,1,'guard');
  s=applyAction(s,0,{type:'heroAttack',target:target(m)});assert.equal(s.players[0].health,28);assert.equal(s.players[0].weapon?.durability,1);assert.equal(s.players[1].board.length,0);
  reject(s,0,{type:'heroAttack',target:face(1)},/영웅이 공격/);
  s=next(next(s));s=applyAction(s,0,{type:'heroAttack',target:face(1)});assert.equal(s.players[0].weapon,null);assert.equal(s.players[1].health,27);
});
test('weapon replacement, defending hero does not retaliate or consume durability',()=>{
  let s=ready('rogue');s=applyAction(s,0,{type:'heroPower'});s=play(s,0,'steel_dagger');assert.equal(s.players[0].weapon?.attack,2);
  s=next(s);const m=minion(s,1,'guard');s=applyAction(s,1,{type:'attack',attackerId:m.instanceId,target:face(0)});assert.equal(s.players[1].board[0].health,3);assert.equal(s.players[0].weapon?.durability,3);
});
test('secret hides identity and prevents duplicate; triggers once and kills attacker before damage',()=>{
  let s=ready('paladin');s=play(s,0,'retribution');const c=hand(s,0,'retribution');reject(s,0,{type:'playCard',instanceId:c.instanceId},/같은 비밀/);
  const own=getPlayerView(s,0),opponent=getPlayerView(s,1);assert.equal(own.self.secrets[0].cardId,'retribution');assert.equal(opponent.opponent.secretCount,1);assert.ok(!Object.hasOwn(opponent.opponent,'secrets'));assert.ok(!JSON.stringify(opponent).includes('retribution'));
  s=next(s);const a=minion(s,1,'guard');s=applyAction(s,1,{type:'attack',attackerId:a.instanceId,target:face(0)});assert.equal(s.players[0].health,30);assert.equal(s.players[1].board.length,0);assert.equal(s.players[0].secrets.length,0);
});
test('secret reacts to enemy minion, not friendly play or summon effect',()=>{
  let s=ready('hunter','paladin');s=play(s,0,'tripwire');s=play(s,0,'recruit');assert.equal(s.players[0].secrets.length,1);s=next(s);
  s=applyAction(s,1,{type:'heroPower'});assert.equal(s.players[0].secrets.length,1);
  s=play(s,1,'guard');assert.deepEqual(s.players[1].board.map(m=>m.cardId),['__squire']);assert.equal(s.players[0].secrets.length,0);
});
test('counter secret consumes opponent spell and mana without effect, once',()=>{
  let s=ready('mage','mage');s=play(s,0,'arcane_barrier');s=next(s);s=play(s,1,'flame_sphere',face(0));
  assert.equal(s.players[0].health,30);assert.equal(s.players[1].mana,6);assert.equal(s.players[0].secrets.length,0);
  s=play(s,1,'flame_sphere',face(0));assert.equal(s.players[0].health,24);
});
test('all 9 hero powers: mana costs, state effects, repeat blocked and reset',()=>{
  for(const cls of HERO_CLASSES){
    let s=ready(cls);s.players[0].health=25;const d=s.players[0].deck.length;const dest=cls==='mage'?face(1):cls==='priest'?face(0):undefined;
    s=applyAction(s,0,{type:'heroPower',target:dest});assert.equal(s.players[0].mana,8,cls);assert.equal(s.players[0].heroPowerUsed,true);
    switch(cls){case 'warrior':assert.equal(s.players[0].armor,2);break;case 'rogue':assert.deepEqual(s.players[0].weapon,{attack:1,durability:2});break;case 'paladin':assert.equal(s.players[0].board[0].cardId,'__squire');break;case 'shaman':assert.equal(s.players[0].board.length,1);break;case 'hunter':assert.equal(s.players[1].health,28);break;case 'druid':assert.equal(s.players[0].armor,1);assert.equal(s.players[0].heroAttack,1);break;case 'warlock':assert.equal(s.players[0].deck.length,d-1);assert.equal(s.players[0].health,23);break;case 'mage':assert.equal(s.players[1].health,29);break;case 'priest':assert.equal(s.players[0].health,27);break;}
    reject(s,0,{type:'heroPower',target:dest},/턴당 한 번/);s=next(next(s));assert.equal(s.players[0].heroPowerUsed,false);
  }
});
test('shaman totems are unique, four maximum types and healing totem end-turn trigger',()=>{
  let s=ready('shaman');const injured=minion(s,0,'guard');injured.health=1;
  for(let i=0;i<4;i++){s=applyAction(s,0,{type:'heroPower'});s=next(next(s));}
  assert.equal(new Set(s.players[0].board.slice(1).map(m=>m.cardId)).size,4);assert.ok(s.players[0].board[0].health>=2);reject(s,0,{type:'heroPower'},/모든 종류/);
});
test('druid attack persists only current turn; fatigue can be absorbed by armor',()=>{
  let s=ready('druid');s=applyAction(s,0,{type:'heroPower'});s=applyAction(s,0,{type:'heroAttack',target:face(1)});assert.equal(s.players[1].health,29);
  s=next(s);assert.equal(s.players[0].heroAttack,0);s.players[0].deck=[];s=next(s);assert.equal(s.players[0].armor,0);assert.equal(s.players[0].health,30);
});
test('coin now uses shared spell engine and counter secret can cancel it',()=>{
  let s=ready('mage','warrior');s=play(s,0,'arcane_barrier');s=next(s);const coin=s.players[1].hand.find(c=>c.cardId==='__coin')!;s.players[1].mana=2;
  s=applyAction(s,1,{type:'playCard',instanceId:coin.instanceId});assert.equal(s.players[1].mana,2);assert.equal(s.players[0].secrets.length,0);
});
