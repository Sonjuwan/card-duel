import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalog,createGame,applyAction,starterDeck,deckCards,getPlayerView,rankBotActions} from '../src/index.ts';
import type {GameState,HeroClass,PlayerId,Target} from '../src/index.ts';
const cards=JSON.parse(readFileSync(new URL('../../../data/cards/v0.11.0.json',import.meta.url),'utf8')),catalog=createCatalog(cards);
function ready(a:HeroClass='mage',b:HeroClass='mage'){let s=createGame(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],{seed:54,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});return applyAction(s,1,{type:'mulligan',replace:[]});}
function play(s:GameState,id:string,target?:Target){s.players[s.activePlayer].mana=10;const c={cardId:id,instanceId:`t${s.nextId++}`};s.players[s.activePlayer].hand.push(c);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target});}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
function m(s:GameState,p:PlayerId,id:string){return s.players[p].board.find(m=>m.cardId===id)!;}
function t(s:GameState,p:PlayerId,id:string):Target{return {kind:'minion',instanceId:m(s,p,id).instanceId};}
test('new catalogue has 194 collectible cards and 80 additional audited class basic mappings',()=>{
  assert.equal(cards.length,201);assert.equal(cards.filter((c:{collectible?:boolean})=>c.collectible!==false).length,194);
  const mappings=[["fatal_finish","warrior",1],["blade_cyclone","warrior",1],["twin_cleave","warrior",2],["iron_axe","warrior",2],["champion_strike","warrior",2],["battle_cry","warrior",3],["shield_wall","warrior",3],["charge_officer","warrior",3],["vanguard_elite","warrior",4],["great_waraxe","warrior",5],["valor_blessing","paladin",1],["light_guard","paladin",1],["humbling_light","paladin",1],["dawn_mace","paladin",1],["restoring_ray","paladin",2],["judgment_hammer","paladin",4],["sovereign_blessing","paladin",4],["hallowed_ground","paladin",4],["healing_hammer","paladin",4],["crown_sentinel","paladin",7],["wild_growth","druid",0],["moon_spark","druid",0],["thorn_claw","druid",1],["wild_mark","druid",2],["root_bloom","druid",2],["verdant_touch","druid",3],["forest_roar","druid",3],["raking_storm","druid",4],["star_fall","druid",6],["ironwood_guardian","druid",8],["sacred_spark","priest",1],["mental_glimpse","priest",1],["healing_scholar","priest",1],["life_barrier","priest",1],["spirit_doubling","priest",2],["weakpoint_sentence","priest",2],["giant_sentence","priest",3],["mind_burst","priest",2],["radiant_wave","priest",5],["mind_claim","priest",10],["precise_stab","rogue",0],["weapon_hone","rogue",1],["night_strike","rogue",1],["storm_retreat","rogue",2],["needle_cut","rogue",2],["knife_fan","rogue",3],["silent_execution","rogue",5],["shadow_rapier","rogue",5],["smoke_escape","rogue",6],["rapid_mission","rogue",7],["ancestral_renewal","shaman",0],["totem_resilience","shaman",0],["frost_jolt","shaman",1],["stone_edge","shaman",1],["ember_totem","shaman",2],["wind_blessing","shaman",2],["toad_curse","shaman",3],["wind_oracle","shaman",4],["blood_ritual","shaman",5],["flame_spirit","shaman",6],["demon_pact","warlock",0],["soul_flame","warlock",0],["decay_mark","warlock",1],["life_thread","warlock",1],["void_sentinel","warlock",1],["tempting_fiend","warlock",2],["life_siphon","warlock",3],["shadow_lance","warlock",3],["infernal_blast","warlock",4],["abyssal_colossus","warlock",6],["prey_mark","hunter",0],["arcane_arrow","hunter",1],["forest_wolf","hunter",1],["wild_tracker","hunter",2],["companion_call","hunter",3],["wild_arrow","hunter",3],["double_volley","hunter",4],["beast_tamer","hunter",4],["tundra_beast","hunter",5],["tracking_trail","hunter",1]] as [string,HeroClass,number][];
  assert.equal(mappings.length,80);
  for(const [id,klass,cost] of mappings){const c=deckCards(catalog,klass).find(x=>x.id===id);assert.ok(c&&c.class===klass&&c.cost===cost&&c.rarity==='basic',id);}
});
test('cleave requires two enemies and hits distinct minions with spell damage',()=>{
  let s=ready('warrior');s=play(s,'fire_apprentice');s=end(s);s=play(s,'golem');s=end(s);
  assert.throws(()=>play(s,'twin_cleave'),/부족/);s=end(s);s=play(s,'golem');s=end(s);s=play(s,'twin_cleave');assert.deepEqual(s.players[1].board.map(x=>x.health),[3,3]);
});
test('swipe damage is primary plus one splash on other enemies, with spell power',()=>{
  let s=ready('druid');s=play(s,'fire_apprentice');s=end(s);s=play(s,'golem');s=play(s,'guard');s=end(s);s=play(s,'raking_storm',t(s,1,'golem'));assert.equal(m(s,1,'golem').health,1);assert.equal(m(s,1,'guard').health,1);assert.equal(s.players[1].health,28);assert.equal(m(s,0,'fire_apprentice').health,3);
});
test('divine spirit doubles current health without treating the bonus as healing',()=>{
  let s=ready('priest');s=play(s,'healing_scholar');s=play(s,'golem');m(s,0,'golem').health=3;const n=s.players[0].deck.length;s=play(s,'spirit_doubling',t(s,0,'golem'));assert.equal(m(s,0,'golem').health,6);assert.equal(m(s,0,'golem').maxHealth,9);assert.equal(s.players[0].deck.length,n);
});
test('wild growth grants an empty crystal below ten, or a nondeck draw spell at ten',()=>{
  let s=ready('druid');s.players[0].maxMana=9;s=play(s,'root_bloom');assert.equal(s.players[0].maxMana,10);assert.equal(s.players[0].mana,8);assert.ok(!s.players[0].hand.some(c=>c.cardId==='overflow_bloom'));
  s=play(s,'root_bloom');assert.ok(s.players[0].hand.some(c=>c.cardId==='overflow_bloom'));assert.ok(!deckCards(catalog,'druid').some(c=>c.id==='overflow_bloom'));
});
test('warsong grants charge only at summon with attack up to three',()=>{
  let s=ready('warrior');s=play(s,'charge_officer');assert.equal(m(s,0,'charge_officer').attacksRemaining,0);s=play(s,'golem');assert.equal(m(s,0,'golem').attacksRemaining,1);s=play(s,'ironwood_guardian');assert.equal(m(s,0,'ironwood_guardian').attacksRemaining,0);
});
test('savage roar temporary hero and minion attack expires at end of turn',()=>{
  let s=ready('druid');s=play(s,'guard');s=play(s,'forest_roar');assert.equal(s.players[0].heroAttack,2);assert.equal(m(s,0,'guard').attack,4);s=end(s);assert.equal(s.players[0].heroAttack,0);assert.equal(m(s,0,'guard').attack,2);
});
test('holy nova damages enemy and heals ally only; spell damage does not affect healing',()=>{
  let s=ready('priest');s=play(s,'fire_apprentice');s=play(s,'golem');m(s,0,'golem').health=1;s.players[0].health=25;s=end(s);s=play(s,'golem');s=end(s);s=play(s,'radiant_wave');assert.equal(s.players[0].health,27);assert.equal(s.players[1].health,27);assert.equal(m(s,0,'golem').health,3);assert.equal(m(s,1,'golem').health,3);
});
test('shadow word can target own minions and rejects wrong attack range',()=>{
  let s=ready('priest');s=play(s,'guard');s=play(s,'ironwood_guardian');assert.throws(()=>play(s,'weakpoint_sentence',t(s,0,'ironwood_guardian')),/대상/);s=play(s,'weakpoint_sentence',t(s,0,'guard'));assert.ok(!m(s,0,'guard'));s=play(s,'giant_sentence',t(s,0,'ironwood_guardian'));assert.equal(s.players[0].board.length,0);
});
test('shield block adds five armor and draws',()=>{let s=ready('warrior');const n=s.players[0].deck.length;s=play(s,'shield_wall');assert.equal(s.players[0].armor,5);assert.equal(s.players[0].deck.length,n-1);});
test('sacrifice can destroy a demon but not a non-demon',()=>{let s=ready('warlock');s=play(s,'guard');s=play(s,'void_sentinel');s.players[0].health=20;assert.throws(()=>play(s,'demon_pact',t(s,0,'guard')),/대상/);s=play(s,'demon_pact',t(s,0,'void_sentinel'));assert.equal(s.players[0].health,25);assert.ok(!m(s,0,'void_sentinel'));});
test('deferred destruction happens on caster next turn; silence removes mark',()=>{
  let s=ready('warlock');s=end(s);s=play(s,'golem');s=play(s,'guard');s=end(s);s=play(s,'decay_mark',t(s,1,'golem'));s=play(s,'decay_mark',t(s,1,'guard'));s=end(s);assert.ok(m(s,1,'golem'));s=play(s,'silencing_rune',t(s,1,'guard'));s=end(s);assert.ok(!m(s,1,'golem'));assert.ok(m(s,1,'guard'));
});
test('mortal coil draws only if targeted minion dies',()=>{let s=ready('warlock');s=end(s);s=play(s,'scout');s=play(s,'golem');s=end(s);const n=s.players[0].deck.length;s=play(s,'life_thread',t(s,1,'golem'));assert.equal(s.players[0].deck.length,n);s=play(s,'life_thread',t(s,1,'scout'));assert.equal(s.players[0].deck.length,n-1);});
test('kill command has beast bonus and applies spell damage exactly once',()=>{let s=ready('hunter');s=play(s,'fire_apprentice');s=play(s,'wild_arrow',{kind:'hero',player:1});assert.equal(s.players[1].health,26);s=play(s,'forest_wolf');s=play(s,'wild_arrow',{kind:'hero',player:1});assert.equal(s.players[1].health,20);});
test('animal companions may repeat, and cannot be used in decks',()=>{let s=ready('hunter');for(let i=0;i<4;i++)s=play(s,'companion_call');assert.equal(s.players[0].board.length,4);assert.ok(new Set(s.players[0].board.map(m=>m.cardId)).size<4);assert.ok(!deckCards(catalog,'hunter').some(c=>c.id.startsWith('companion_')&&c.id!=='companion_call'));});
test('rhino charge aura grants immediate attacks and removes them on silence without resetting used attacks',()=>{
  let s=ready('hunter');s=play(s,'forest_wolf');assert.equal(m(s,0,'forest_wolf').attacksRemaining,0);s=play(s,'tundra_beast');assert.equal(m(s,0,'forest_wolf').attacksRemaining,1);assert.equal(m(s,0,'tundra_beast').attacksRemaining,1);s=applyAction(s,0,{type:'attack',attackerId:m(s,0,'forest_wolf').instanceId,target:{kind:'hero'}});assert.equal(m(s,0,'forest_wolf').attacksRemaining,0);s=play(s,'silencing_rune',t(s,0,'tundra_beast'));assert.equal(m(s,0,'tundra_beast').attacksRemaining,0);assert.equal(m(s,0,'forest_wolf').attacksRemaining,0);
});
test('houndmaster requires friendly beast and grants stats and taunt',()=>{let s=ready('hunter');s=play(s,'guard');s=play(s,'forest_wolf');assert.throws(()=>play(s,'beast_tamer',t(s,0,'guard')),/대상/);s=play(s,'beast_tamer',t(s,0,'forest_wolf'));assert.equal(m(s,0,'forest_wolf').attack,3);assert.equal(m(s,0,'forest_wolf').health,3);assert.ok(m(s,0,'forest_wolf').keywords?.includes('taunt'));});
test('rockbiter can empower friendly hero, ancestral healing restores full health',()=>{let s=ready('shaman');s=play(s,'stone_edge',{kind:'hero',player:0});assert.equal(s.players[0].heroAttack,3);s=play(s,'golem');m(s,0,'golem').health=1;s=play(s,'ancestral_renewal',t(s,0,'golem'));assert.equal(m(s,0,'golem').health,6);assert.ok(m(s,0,'golem').keywords?.includes('taunt'));});
test('tracking only shares choices with owner; rejects forged ID and other actions; adds chosen and discards others',()=>{
  let s=ready('hunter');const top=s.players[0].deck.slice(0,3);s=play(s,'tracking_trail');assert.deepEqual(s.pendingChoice?.cards,top);
  const own=getPlayerView(s,0),enemy=getPlayerView(s,1);assert.deepEqual(own.self.pendingChoice,top);assert.equal(enemy.choicePending,true);assert.equal(enemy.self.pendingChoice,undefined);assert.ok(!JSON.stringify(enemy).includes(top[0].instanceId+'"'));
  assert.throws(()=>applyAction(s,1,{type:'chooseDeckCard',instanceId:top[0].instanceId}),/턴/);assert.throws(()=>end(s),/선택/);assert.throws(()=>applyAction(s,0,{type:'chooseDeckCard',instanceId:'forged'}),/선택/);
  for(const difficulty of [1,2,3,4,5] as const)assert.equal(rankBotActions(own,catalog,0,difficulty)[0].type,'chooseDeckCard');
  s=applyAction(s,0,{type:'chooseDeckCard',instanceId:top[1].instanceId});assert.equal(s.pendingChoice,undefined);assert.ok(s.players[0].hand.some(c=>c.instanceId===top[1].instanceId));for(const c of [top[0],top[2]])assert.ok(![...s.players[0].hand,...s.players[0].deck].some(x=>x.instanceId===c.instanceId));
});
test('tracking handles fewer than three cards, empty deck without fatigue, and concede',()=>{let s=ready('hunter');s.players[0].deck=s.players[0].deck.slice(0,1);s=play(s,'tracking_trail');assert.equal(s.pendingChoice?.cards.length,1);s=applyAction(s,0,{type:'chooseDeckCard',instanceId:s.pendingChoice!.cards[0].instanceId});s=play(s,'tracking_trail');assert.equal(s.pendingChoice,undefined);assert.equal(s.players[0].fatigue,0);s.players[0].deck=[{cardId:'guard',instanceId:'test'}];s=play(s,'tracking_trail');s=applyAction(s,0,{type:'concede'});assert.equal(s.pendingChoice,undefined);assert.equal(s.phase,'finished');});
