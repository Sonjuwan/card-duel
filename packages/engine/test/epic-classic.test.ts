import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,practiceDeck,deckCards,HERO_CLASSES,getPlayerView,publicCardCost,publicCardReason,publicAttackTargets,legalPublicTargets,hasKeyword,getHeroPower,candidates,validateDeck,manaCurve,rankBotActions} from '../src/index.ts';
import type {GameState,HeroClass,PlayerId,Minion,Target} from '../src/index.ts';

const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.22.0.json',import.meta.url),'utf8'));
const catalog=createCatalog(data);
function ready(hero:HeroClass='mage',enemy:HeroClass='warrior'):GameState{
  let s=createGame(catalog,[practiceDeck(catalog,hero),practiceDeck(catalog,enemy)],{seed:459,firstPlayer:0});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});
  for(const p of s.players){p.maxMana=10;p.mana=10;p.hand=[];}
  return s;
}
function hold(s:GameState,id:string,owner=s.activePlayer){const c={cardId:id,instanceId:'test-card-'+s.nextId++};s.players[owner].hand.push(c);return c;}
function play(s:GameState,id:string,target?:Target,choice?:number,refill=true):GameState{
  if(refill)s.players[s.activePlayer].mana=10;const c=hold(s,id);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target,choice});
}
function end(s:GameState){return applyAction(s,s.activePlayer,{type:'endTurn'});}
function m(s:GameState,owner:PlayerId,id:string){const found=s.players[owner].board.find(m=>m.cardId===id);assert.ok(found,id);return found;}
function place(s:GameState,owner:PlayerId,id:string,extra:Partial<Minion>={}):Minion{
  const d=s.catalog[id];assert.ok(d.kind==='minion');const a:Minion={instanceId:'fixture-'+s.nextId++,cardId:id,originalOwner:owner,attack:d.attack,health:d.health,maxHealth:d.health,attacksRemaining:1,keywords:[...(d.keywords??[])],enteredOrder:s.nextEntryOrder??1,...extra};s.nextEntryOrder=(s.nextEntryOrder??1)+1;s.players[owner].board.push(a);return a;
}
const target=(m:Minion):Target=>({kind:'minion',instanceId:m.instanceId});
const h=(player:PlayerId):Target=>({kind:'hero',player});
const hit=(s:GameState,a:Minion,t:Target)=>applyAction(s,s.activePlayer,{type:'attack',attackerId:a.instanceId,target:t});
const heroHit=(s:GameState,t:Target)=>applyAction(s,s.activePlayer,{type:'heroAttack',target:t});
const price=(s:GameState,id:string,discount?:number)=>publicCardCost(getPlayerView(s,s.activePlayer),s.activePlayer,s.catalog[id],s.catalog,discount);

test('June 2014 epic roster: 38 deck cards, 27 class and 11 neutral; 346 collectible overall',()=>{
  const epics=data.filter((c:{rarity:string})=>c.rarity==='epic');
  const deck=data.filter((c:{collectible?:boolean})=>c.collectible!==false);
  assert.equal(epics.length,38);assert.equal(deck.length,346);assert.equal(data.length,374);
  assert.equal(epics.filter((c:{class:string})=>c.class==='neutral').length,11);
  for(const cls of HERO_CLASSES){assert.equal(epics.filter((c:{class:string})=>c.class===cls).length,3);assert.equal(deckCards(catalog,cls).length,154);}
  const historical=JSON.parse(readFileSync(new URL('../../../data/cards/v0.21.0.json',import.meta.url),'utf8'));assert.deepEqual(data.slice(0,historical.length),historical);
  for(const token of ['force_treant','epic_snake_token','spellbender_token','shadow_of_nothing'])assert.equal(catalog[token].kind!=='coin'&&catalog[token].collectible,false);
});
test('Brawl leaves only one randomly selected original minion',()=>{
  for(let seed=0;seed<12;seed++){let s=ready();s.rng=seed*123456;for(const who of [0,1] as const)for(const id of ['wisp','wolf','ogre'])place(s,who,id);s=play(s,'brawl');assert.equal(s.players[0].board.length+s.players[1].board.length,1);}
});
test('Brawl requires two minions, but killed minions still fire deathrattles',()=>{
  let s=ready();place(s,0,'wisp');const card=hold(s,'brawl');assert.match(publicCardReason(getPlayerView(s,0),0,card,s.catalog)!,/2개/);
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:card.instanceId}),/2개/);
  place(s,0,'harvest_golem');place(s,1,'harvest_golem');s=play(s,'brawl');
  assert.ok([...s.players[0].board,...s.players[1].board].some(m=>m.cardId==='broken_golem'));
});
test('Shield Slam uses armor, does not consume it, and may target friend or foe',()=>{
  let s=ready();s.players[0].armor=4;const enemy=place(s,1,'ogre');s=play(s,'shield_slam',target(enemy));assert.equal(m(s,1,'ogre').health,3);assert.equal(s.players[0].armor,4);
  const friend=place(s,0,'wolf');s=play(s,'shield_slam',target(friend));assert.ok(!s.players[0].board.some(m=>m.cardId==='wolf'));
});
test('Gorehowl loses attack on minion hits but durability on a hero hit',()=>{
  let s=ready('warrior');s=play(s,'gorehowl');const foe=place(s,1,'ogre');s=heroHit(s,target(foe));assert.equal(s.players[0].weapon?.attack,6);assert.equal(s.players[0].weapon?.durability,1);assert.equal(s.players[0].health,24);
  s=end(end(s));s=heroHit(s,h(1));assert.equal(s.players[1].health,24);assert.equal(s.players[0].weapon,null);
});
test('Far Sight discounts exactly one drawn instance; public enemy view has no hand details',()=>{
  let s=ready('shaman');s.players[0].deck.unshift({cardId:'ogre',instanceId:'discounted-ogre'});const original=hold(s,'ogre');
  s=play(s,'far_sight');const drawn=s.players[0].hand.find(c=>c.instanceId==='discounted-ogre');assert.equal(drawn?.costDiscount,3);assert.equal(price(s,'ogre',drawn?.costDiscount),3);assert.equal(price(s,'ogre'),6);
  assert.equal(s.players[0].hand.find(c=>c.instanceId===original.instanceId)?.costDiscount,undefined);assert.ok(!JSON.stringify(getPlayerView(s,1).opponent).includes('discounted-ogre'));
});
test('Doomhammer grants two hero attacks, loses two durability, applies overload next turn',()=>{
  let s=ready('shaman');s=play(s,'doomhammer');assert.equal(s.players[0].pendingOverload,2);assert.equal(s.players[0].heroAttacksRemaining,2);
  s=heroHit(s,h(1));s=heroHit(s,h(1));assert.equal(s.players[1].health,26);assert.equal(s.players[0].weapon?.durability,6);
  assert.throws(()=>heroHit(s,h(1)),/공격/);s=end(end(s));assert.equal(s.players[0].lockedMana,2);assert.equal(s.players[0].mana,8);assert.equal(s.players[0].heroAttacksRemaining,2);
});
test('Doomhammer grants only a remaining second attack when equipped after attacking',()=>{
  let s=ready('shaman');s=play(s,'iron_axe');s=heroHit(s,h(1));s=play(s,'doomhammer');assert.equal(s.players[0].heroAttacksRemaining,1);
  s=heroHit(s,h(1));s=play(s,'iron_axe');assert.equal(s.players[0].heroAttacksRemaining,0);
});
test('Earth Elemental is original 5-cost 7/8 taunt with three overload',()=>{
  let s=ready();s=play(s,'earth_elemental');const golem=m(s,0,'earth_elemental');assert.deepEqual([golem.attack,golem.health],[7,8]);assert.ok(hasKeyword(golem,'taunt'));assert.equal(s.players[0].pendingOverload,3);
});
test('Preparation applies to exactly the next spell or secret; not minions or weapons',()=>{
  let s=ready('rogue');s=play(s,'preparation');assert.equal(price(s,'flame_sphere'),1);assert.equal(price(s,'ogre'),6);
  s=play(s,'wisp',undefined,undefined,false);assert.equal(s.players[0].nextSpellDiscount,3);
  s=play(s,'flame_sphere',h(1),undefined,false);assert.equal(s.players[0].mana,9);assert.equal(s.players[0].nextSpellDiscount,undefined);assert.equal(price(s,'flame_sphere'),4);
  s=play(s,'preparation');assert.equal(price(s,'ice_block'),0);s=play(s,'ice_block',undefined,undefined,false);assert.equal(s.players[0].nextSpellDiscount,undefined);
});
test('Preparation expires at end turn and repeated Preparation does not stack',()=>{
  let s=ready();s=play(s,'preparation');s=play(s,'preparation');assert.equal(s.players[0].nextSpellDiscount,3);s=end(s);assert.equal(s.players[0].nextSpellDiscount,undefined);
});
test('Patient Assassin cannot be enemy targeted while hidden; its combat damage kills large minions',()=>{
  let s=ready();s=play(s,'patient_assassin');s=end(s);const foe=place(s,1,'ogre');
  assert.ok(!legalPublicTargets(getPlayerView(s,1),1,'anyMinion',s.catalog,true).some(t=>t.kind==='minion'&&t.instanceId===m(s,0,'patient_assassin').instanceId));
  s=end(s);s=hit(s,m(s,0,'patient_assassin'),target(foe));assert.ok(!s.players[1].board.some(m=>m.cardId==='ogre'));assert.ok(!s.players[0].board.some(m=>m.cardId==='patient_assassin'));
});
test('Kidnapper requires combo to bounce; without combo it enters without target',()=>{
  let s=ready();const foe=place(s,1,'ogre');s=play(s,'kidnapper');assert.equal(s.players[1].board.length,1);
  s=play(s,'kidnapper',target(foe));assert.equal(s.players[1].board.length,0);assert.ok(s.players[1].hand.some(c=>c.cardId==='ogre'));
});
test('Lay on Hands heals chosen character and draws exactly three cards',()=>{
  let s=ready();s.players[0].health=11;const n=s.players[0].deck.length;s=play(s,'lay_on_hands',h(0));assert.equal(s.players[0].health,19);assert.equal(s.players[0].deck.length,n-3);
});
test('Avenging Wrath deals eight single hits; with no opposing minions they all hit hero',()=>{
  const s=play(ready(),'avenging_wrath');assert.equal(s.players[1].health,22);
});
test('Sword of Justice buffs each played or summoned friendly minion and consumes durability',()=>{
  let s=ready();s=play(s,'sword_of_justice');s=play(s,'wisp');assert.deepEqual([m(s,0,'wisp').attack,m(s,0,'wisp').health],[2,2]);assert.equal(s.players[0].weapon?.durability,4);
  s=play(s,'force_of_nature');assert.equal(s.players[0].weapon?.durability,1);assert.ok(s.players[0].board.filter(m=>m.cardId==='force_treant').every(m=>m.attack===3&&m.health===3));
});
test('Sword of Justice cannot buff extra simultaneous summons after its last durability',()=>{
  let s=ready();s=play(s,'sword_of_justice');s.players[0].weapon!.durability=1;s=play(s,'force_of_nature');
  assert.equal(s.players[0].weapon,null);assert.deepEqual(s.players[0].board.map(m=>m.attack),[3,2,2]);
});
test('Bestial Wrath protects targeted friendly beast and loses temporary attack at end turn',()=>{
  let s=ready('hunter');const beast=place(s,0,'wolf'),foe=place(s,1,'ogre');s=play(s,'bestial_wrath',target(beast));assert.equal(m(s,0,'wolf').attack,5);assert.ok(m(s,0,'wolf').immuneThisTurn);
  s=hit(s,m(s,0,'wolf'),target(foe));assert.equal(m(s,0,'wolf').health,2);assert.equal(m(s,1,'ogre').health,2);s=end(s);assert.equal(m(s,0,'wolf').attack,3);assert.equal(m(s,0,'wolf').immuneThisTurn,undefined);
});
test('Snake Trap triggers only when friendly minion is attacked and summons three beasts',()=>{
  let s=ready('hunter');s=play(s,'snake_trap');const friend=place(s,0,'ogre');s=end(s);const a=place(s,1,'wolf');s=hit(s,a,h(0));assert.equal(s.players[0].secrets.length,1);
  const b=place(s,1,'wolf');s=hit(s,b,target(friend));assert.equal(s.players[0].secrets.length,0);const snakes=s.players[0].board.filter(m=>m.cardId==='epic_snake_token');assert.equal(snakes.length,3);assert.ok(snakes.every(m=>m.attack===1&&m.health===1));
});
test('Snake Trap respects board maximum and also triggers on an opposing hero attack',()=>{
  let s=ready();s=play(s,'snake_trap');for(let i=0;i<6;i++)place(s,0,'ogre');s=end(s);s=play(s,'iron_axe');s=heroHit(s,target(m(s,0,'ogre')));assert.equal(s.players[0].board.length,7);assert.equal(s.players[0].secrets.length,0);
});
test('Gladiator Longbow prevents retaliation only while attacking; spends normal durability',()=>{
  let s=ready('hunter');s=play(s,'gladiators_longbow');const foe=place(s,1,'ogre');s=heroHit(s,target(foe));assert.equal(s.players[0].health,30);assert.equal(s.players[0].weapon?.durability,1);assert.equal(s.players[0].heroImmuneThisTurn,undefined);
  s=end(s);s=play(s,'flame_sphere',h(0));assert.equal(s.players[0].health,24);
});
test('June 2014 Longbow does not prevent the earlier Explosive Trap secret damage',()=>{
  let s=ready();s=play(s,'fire_trap');s=end(s);s=play(s,'gladiators_longbow');s=heroHit(s,h(0));
  assert.equal(s.players[1].health,28);assert.equal(s.players[0].health,25);
});
test('Sword of Justice buffs a battlecry-summoned minion before its parent',()=>{
  let s=ready();s=play(s,'sword_of_justice');s.players[0].weapon!.durability=1;s=play(s,'reef_guard');
  assert.equal(m(s,0,'reef_token').attack,2);assert.equal(m(s,0,'reef_guard').attack,2);assert.equal(s.players[0].weapon,null);
});
test('Force of Nature original tokens charge immediately, attack and die at end of turn',()=>{
  let s=play(ready('druid'),'force_of_nature');assert.equal(s.players[0].board.length,3);
  for(const tree of [...s.players[0].board]){assert.ok(hasKeyword(tree,'charge'));s=hit(s,tree,h(1));}
  assert.equal(s.players[1].health,24);s=end(s);assert.equal(s.players[0].board.length,0);
});
test('Force of Nature summons only into available spaces; cannot cast when board is full',()=>{
  let s=ready();for(let i=0;i<6;i++)place(s,0,'wisp');s=play(s,'force_of_nature');assert.equal(s.players[0].board.length,7);
  const c=hold(s,'force_of_nature');s.players[0].mana=10;assert.match(publicCardReason(getPlayerView(s,0),0,c,s.catalog)!,/가득/);assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId}),/가득/);
});
test('Ancient of Lore original choices draw two or heal five',()=>{
  let s=ready();const before=s.players[0].deck.length;s=play(s,'ancient_of_lore',undefined,0);assert.equal(s.players[0].deck.length,before-2);s.players[0].health=15;s=play(s,'ancient_of_lore',h(0),1);assert.equal(s.players[0].health,20);
});
test('Ancient of War original choices become 10/5 or 5/10 taunt',()=>{
  let s=ready();s=play(s,'ancient_of_war',undefined,0);s=play(s,'ancient_of_war',undefined,1);const a=s.players[0].board.filter(m=>m.cardId==='ancient_of_war');assert.deepEqual(a.map(m=>[m.attack,m.health,hasKeyword(m,'taunt')]),[[10,5,false],[5,10,true]]);
});
test('Twisting Nether destroys both sides; deathrattle tokens still summon',()=>{
  let s=ready();place(s,0,'ogre');place(s,1,'harvest_golem');s=play(s,'twisting_nether');assert.equal(s.players[0].board.length,0);assert.deepEqual(s.players[1].board.map(m=>m.cardId),['broken_golem']);
});
test('Bane of Doom original six demon pool; summons only when chosen target dies',()=>{
  const permitted=new Set(['blood_imp','void_sentinel','imp_scout','abyssal_colossus','tempting_fiend','fel_guard']);
  for(let seed=0;seed<8;seed++){let s=ready();s.rng=seed*39879;const victim=place(s,1,'wisp');s=play(s,'bane_of_doom',target(victim));assert.equal(s.players[0].board.length,1);assert.ok(permitted.has(s.players[0].board[0].cardId));}
  let s=ready();const foe=place(s,1,'ogre');s=play(s,'bane_of_doom',target(foe));assert.equal(s.players[0].board.length,0);assert.equal(m(s,1,'ogre').health,5);
});
test('Pit Lord damages its own hero rather than summoning opponent damage',()=>{
  const s=play(ready('warlock'),'pit_lord');assert.equal(s.players[0].health,25);assert.equal(s.players[1].health,30);assert.equal(m(s,0,'pit_lord').health,6);
});
test('Pyroblast is ten mana and ten damage, including a legal own hero target',()=>{
  let s=play(ready(),'pyroblast',h(1));assert.equal(s.players[1].health,20);assert.equal(s.players[0].mana,0);s=play(s,'pyroblast',h(0));assert.equal(s.players[0].health,20);
});
test('Ice Block prevents lethal damage before armor or health is deducted and prevents further targeting that turn',()=>{
  let s=ready();s=play(s,'ice_block');s.players[0].health=5;s.players[0].armor=1;s=end(s);
  s=play(s,'flame_sphere',h(0));assert.equal(s.phase,'playing');assert.equal(s.players[0].health,5);assert.equal(s.players[0].armor,1);assert.ok(s.players[0].heroImmuneThisTurn);assert.equal(s.players[0].secrets.length,0);
  assert.ok(!publicAttackTargets(getPlayerView(s,1),1).some(t=>t.kind==='hero'));assert.ok(!legalPublicTargets(getPlayerView(s,1),1,'anyCharacter',s.catalog,true).some(t=>t.kind==='hero'&&t.player===0));
  s=play(s,'avenging_wrath');assert.equal(s.players[0].health,5);s=end(s);assert.equal(s.players[0].heroImmuneThisTurn,undefined);
});
test('Ice Block does not trigger on nonlethal damage, or own-turn self damage',()=>{
  let s=ready();s=play(s,'ice_block');s=end(s);s=play(s,'flame_sphere',h(0));assert.equal(s.players[0].health,24);assert.equal(s.players[0].secrets.length,1);s=end(s);
  s.players[0].health=2;s=play(s,'pit_lord');assert.equal(s.phase,'finished');assert.equal(s.winner,1);
});
test('Spellbender redirects targeted minion spells, including a spell with attack restriction',()=>{
  let s=ready();s=play(s,'spellbender');const foe=place(s,0,'ogre',{attack:7});s=end(s);s=play(s,'giant_sentence',target(foe));assert.ok(s.players[0].board.some(m=>m.cardId==='ogre'));assert.ok(!s.players[0].board.some(m=>m.cardId==='spellbender_token'));assert.equal(s.players[0].secrets.length,0);
});
test('Spellbender ignores hero-target spells or untargeted missiles; redirects buffs on own minion',()=>{
  let s=ready();s=play(s,'spellbender');s=end(s);s=play(s,'flame_sphere',h(0));s=play(s,'avenging_wrath');assert.equal(s.players[0].secrets.length,1);
  const foe=place(s,1,'wolf');s=play(s,'valor_blessing',target(foe));assert.equal(m(s,1,'wolf').attack,3);assert.ok(m(s,0,'spellbender_token').attack>1);
});
test('Counterspell before Spellbender cancels spell without wasting Spellbender',()=>{
  let s=ready();s=play(s,'arcane_barrier');s=play(s,'spellbender');const friend=place(s,0,'ogre');s=end(s);s=play(s,'flame_sphere',target(friend));assert.equal(m(s,0,'ogre').health,7);assert.deepEqual(s.players[0].secrets.map(c=>c.cardId),['spellbender']);
});
test('Shadowform replaces healing with damage 2, then damage 3, resetting power only on upgrade',()=>{
  let s=ready('priest');s.players[0].heroPowerUsed=true;s=play(s,'shadowform');assert.equal(s.players[0].heroPowerUsed,false);assert.equal(getHeroPower(s.players[0]).name,'정신의 쐐기');
  s=applyAction(s,0,{type:'heroPower',target:h(1)});assert.equal(s.players[1].health,28);s=play(s,'shadowform');assert.equal(getHeroPower(s.players[0]).name,'정신 분쇄');s=applyAction(s,0,{type:'heroPower',target:h(1)});assert.equal(s.players[1].health,25);
  s=play(s,'shadowform');assert.equal(s.players[0].heroPowerUsed,true);assert.equal(getPlayerView(s,1).opponent.shadowformLevel,2);
});
test('Cabal Shadow Priest controls only enemy minions with <=2 current attack',()=>{
  let s=ready();const small=place(s,1,'recruit'),big=place(s,1,'wolf');const c=hold(s,'cabal_shadow_priest');
  assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:target(big)}),/대상/);
  s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:target(small)});assert.ok(s.players[0].board.some(m=>m.instanceId===small.instanceId));assert.ok(s.players[1].board.some(m=>m.instanceId===big.instanceId));
});
test('Mindgames summons an enemy deck minion without removing it or performing its battlecry',()=>{
  let s=ready();s.players[1].deck=[{cardId:'pit_lord',instanceId:'private-deck-card'},{cardId:'flame_sphere',instanceId:'private-spell'}];
  s=play(s,'mindgames');assert.equal(m(s,0,'pit_lord').health,6);assert.equal(s.players[0].health,30);assert.equal(s.players[1].deck.length,2);assert.ok(!JSON.stringify(getPlayerView(s,0)).includes('private-deck-card'));
});
test('Mindgames summons 0/1 Shadow of Nothing if opponent deck has no minions',()=>{
  let s=ready();s.players[1].deck=[{cardId:'flame_sphere',instanceId:'spell-only'}];s=play(s,'mindgames');assert.deepEqual([m(s,0,'shadow_of_nothing').attack,m(s,0,'shadow_of_nothing').health],[0,1]);
});
test('Doomsayer destroys all minions at start of owner turn, not on opponent turn',()=>{
  let s=ready();s=play(s,'doomsayer');place(s,0,'ogre');place(s,1,'ogre');s=end(s);assert.equal(s.players[0].board.length,2);s=end(s);assert.equal(s.players[0].board.length+s.players[1].board.length,0);
});
test('Big Game Hunter targets any minion with attack >=7; attack 6 is not enough',()=>{
  let s=ready();const six=place(s,1,'ogre'),seven=place(s,1,'ogre',{attack:7});const card=hold(s,'big_game_hunter');assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:card.instanceId,target:target(six)}),/대상/);
  s=applyAction(s,0,{type:'playCard',instanceId:card.instanceId,target:target(seven)});assert.ok(s.players[1].board.some(m=>m.instanceId===six.instanceId));assert.ok(!s.players[1].board.some(m=>m.instanceId===seven.instanceId));
});
test('Blood Knight removes all divine shields on either side and grows by three per shield',()=>{
  let s=ready();const a=place(s,0,'crystal_sentinel'),b=place(s,1,'crystal_sentinel');s=play(s,'blood_knight');assert.deepEqual([m(s,0,'blood_knight').attack,m(s,0,'blood_knight').health],[9,9]);
  assert.ok(!hasKeyword(s.players[0].board.find(m=>m.instanceId===a.instanceId)!,'divineShield'));assert.ok(!hasKeyword(s.players[1].board.find(m=>m.instanceId===b.instanceId)!,'divineShield'));
});
test('Faceless Manipulator copies current buffs, damage, keywords and silence independently',()=>{
  let s=ready();const foe=place(s,1,'ogre',{attack:9,health:4,maxHealth:8,keywords:['taunt']});s=play(s,'faceless_manipulator',target(foe));const copy=m(s,0,'ogre');assert.deepEqual([copy.attack,copy.health,copy.maxHealth],[9,4,8]);assert.ok(hasKeyword(copy,'taunt'));assert.notEqual(copy.instanceId,foe.instanceId);assert.equal(copy.originalOwner,0);assert.equal(copy.attacksRemaining,0);
  s=play(s,'silencing_rune',target(copy));assert.equal(m(s,1,'ogre').attack,9);
});
test('Faceless retains copied Charge from a Tundra Rhino aura and does not inherit other control state',()=>{
  let s=ready();place(s,1,'tundra_beast');const foe=place(s,1,'wolf',{auraCharge:true,returnController:0});
  s=play(s,'faceless_manipulator',target(foe));const copy=m(s,0,'wolf');assert.ok(hasKeyword(copy,'charge'));assert.equal(copy.attacksRemaining,1);assert.equal(copy.returnController,undefined);
});
test('Murloc Warleader affects other murlocs on both sides and disappears with silence',()=>{
  let s=ready();const a=place(s,0,'reef_scout'),b=place(s,1,'reef_scout');s=play(s,'murloc_warleader');
  assert.equal(m(s,0,'reef_scout').attack,a.attack+2);assert.equal(m(s,1,'reef_scout').health,b.health+1);assert.equal(m(s,0,'murloc_warleader').attack,3);
  s=play(s,'silencing_rune',target(m(s,0,'murloc_warleader')));assert.equal(m(s,0,'reef_scout').attack,a.attack);
});
test('Southsea Captain buffs only other friendly Pirates',()=>{
  let s=ready();const a=place(s,0,'deckhand'),b=place(s,1,'deckhand');s=play(s,'southsea_captain');assert.equal(m(s,0,'deckhand').attack,a.attack+1);assert.equal(m(s,1,'deckhand').attack,b.attack);assert.equal(m(s,0,'southsea_captain').attack,3);
});
test('Hungry Crab eats a murloc and gains +2/+2, cannot choose a non-murloc',()=>{
  let s=ready();const fish=place(s,1,'reef_scout'),other=place(s,1,'wisp');const c=hold(s,'hungry_crab');assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:target(other)}),/대상/);
  s=applyAction(s,0,{type:'playCard',instanceId:c.instanceId,target:target(fish)});assert.deepEqual([m(s,0,'hungry_crab').attack,m(s,0,'hungry_crab').health],[3,4]);assert.equal(s.players[1].board.length,1);
});
test('Sea Giant discounts by all living minions on both boards',()=>{
  let s=ready();place(s,0,'wolf');place(s,1,'wisp');place(s,1,'ogre');assert.equal(price(s,'sea_giant'),7);s=play(s,'sea_giant',undefined,undefined,false);assert.equal(s.players[0].mana,3);assert.equal(m(s,0,'sea_giant').attack,8);
});
test('Mountain Giant counts other hand cards, not itself; UI and server agree above printed 10 mana',()=>{
  const s=ready();const giant=hold(s,'mountain_giant');for(let i=0;i<4;i++)hold(s,'wisp');assert.equal(price(s,'mountain_giant'),8);
  s.players[0].mana=7;assert.throws(()=>applyAction(s,0,{type:'playCard',instanceId:giant.instanceId}),/마나/);s.players[0].mana=8;
  assert.equal(applyAction(s,0,{type:'playCard',instanceId:giant.instanceId}).players[0].mana,0);
});
test('Molten Giant discounts from missing health, not armor, and healing raises cost',()=>{
  const s=ready();const giant=hold(s,'molten_giant');s.players[0].health=12;s.players[0].armor=20;assert.equal(price(s,'molten_giant'),2);s.players[0].health=25;assert.equal(price(s,'molten_giant'),15);
  s.players[0].health=10;assert.equal(price(s,'molten_giant'),0);assert.equal(applyAction(s,0,{type:'playCard',instanceId:giant.instanceId}).players[0].mana,10);
});
test('Captain Parrot draws only a pirate from deck, not a random non-pirate',()=>{
  let s=ready();s.players[0].deck=[{cardId:'ogre',instanceId:'nonpirate'},{cardId:'deckhand',instanceId:'pirate-card'}];s=play(s,'captains_parrot');assert.ok(s.players[0].hand.some(c=>c.instanceId==='pirate-card'));assert.deepEqual(s.players[0].deck.map(c=>c.instanceId),['nonpirate']);
});
test('Deck validation allows two epics, rejects three, and mana chart includes 10+ giants',()=>{
  const deck=practiceDeck(catalog,'mage');deck.cards.splice(0,2,'molten_giant','molten_giant');assert.doesNotThrow(()=>validateDeck(deck,catalog));assert.equal(manaCurve(catalog,deck).reduce((a,b)=>a+b,0),30);
  deck.cards[2]='molten_giant';assert.throws(()=>validateDeck(deck,catalog),/최대 2/);
});
test('AI candidates and private simulated evaluation recognize discounted giants, upgraded hero power, and windfury',()=>{
  let s=ready('priest');s=play(s,'shadowform');s.players[0].health=10;const c=hold(s,'molten_giant');s.players[0].mana=2;
  assert.ok(candidates(s,0).some(a=>a.type==='playCard'&&a.instanceId===c.instanceId));assert.ok(candidates(s,0).some(a=>a.type==='heroPower'&&a.target?.kind==='hero'&&a.target.player===1));
  assert.ok(rankBotActions(getPlayerView(s,0),s.catalog,0,5).some(a=>a.type==='playCard'&&a.instanceId===c.instanceId));
});
