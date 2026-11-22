import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,practiceDeck,legendaryPracticeDeck,validateDeck,repairDeck,deckCards,HERO_CLASSES,getPlayerView,publicCardCost,legalPublicTargets,hasKeyword,getHeroPower,turnTimeLimitSeconds,maxCardCopies} from '../src/index.ts';
import type {GameState,HeroClass,PlayerId,Minion,Target} from '../src/index.ts';

const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(new URL('../../../data/cards/v0.22.0.json',import.meta.url),'utf8'));
const catalog=createCatalog(data);
function ready(hero:HeroClass='mage',enemy:HeroClass='warrior'):GameState{
  let s=createGame(catalog,[practiceDeck(catalog,hero),practiceDeck(catalog,enemy)],{seed:459,firstPlayer:0});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});
  for(const p of s.players){p.maxMana=10;p.mana=10;p.hand=[];}
  return s;
}
function hold(s:GameState,id:string,owner=s.activePlayer){const c={cardId:id,instanceId:'test-card-'+s.nextId++};s.players[owner].hand.push(c);return c;}
function play(s:GameState,id:string,target?:Target,choice?:number,random?:()=>number):GameState{
  s.players[s.activePlayer].mana=10;const c=hold(s,id);return applyAction(s,s.activePlayer,{type:'playCard',instanceId:c.instanceId,target,choice},{random});
}
function end(s:GameState,random?:()=>number){return applyAction(s,s.activePlayer,{type:'endTurn'},{random});}
function m(s:GameState,owner:PlayerId,id:string){const found=s.players[owner].board.find(m=>m.cardId===id);assert.ok(found,id);return found;}
function place(s:GameState,owner:PlayerId,id:string,extra:Partial<Minion>={}):Minion{
  const d=s.catalog[id];assert.ok(d.kind==='minion');const a:Minion={instanceId:'fixture-'+s.nextId++,cardId:id,originalOwner:owner,attack:d.attack,health:d.health,maxHealth:d.health,attacksRemaining:1,keywords:[...(d.keywords??[])],enteredOrder:s.nextEntryOrder??1,...extra};s.nextEntryOrder=(s.nextEntryOrder??1)+1;s.players[owner].board.push(a);return a;
}
const t=(m:Minion):Target=>({kind:'minion',instanceId:m.instanceId});
const h=(player:PlayerId):Target=>({kind:'hero',player});
const hit=(s:GameState,a:Minion,target:Target)=>applyAction(s,s.activePlayer,{type:'attack',attackerId:a.instanceId,target});
const power=(s:GameState,target?:Target)=>applyAction(s,s.activePlayer,{type:'heroPower',target});
const price=(s:GameState,id:string)=>publicCardCost(getPlayerView(s,s.activePlayer),s.activePlayer,s.catalog[id],s.catalog);
const hand=(s:GameState,who:PlayerId,id:string)=>s.players[who].hand.filter(c=>c.cardId===id).length;
const kill=(s:GameState,id:string,who:PlayerId)=>play(s,'soul_drain',t(m(s,who,id)));

test('June 2014 roster has 36 legendary collectible cards and 27 tokens; prior definitions are immutable',()=>{
  const legendary=data.filter((c:{rarity:string;collectible?:boolean})=>c.rarity==='legendary'&&c.collectible!==false);
  assert.equal(legendary.length,36);assert.equal(legendary.filter((c:{class:string})=>c.class==='neutral').length,27);
  assert.equal(data.length,437);assert.equal(data.filter((c:{collectible?:boolean})=>c.collectible!==false).length,382);
  for(const c of old)assert.deepEqual(c,data.find((d:{id:string})=>d.id===c.id));
  for(const cls of HERO_CLASSES){const deck=legendaryPracticeDeck(catalog,cls);validateDeck(deck,catalog);const leg=deck.cards.filter(id=>maxCardCopies(catalog[id])===1);assert.equal(leg.length,2);assert.ok(leg.some(id=>catalog[id].kind!=='coin'&&catalog[id].class===cls));const invalid={...deck,cards:[...deck.cards.slice(0,29),leg[0]]};assert.throws(()=>validateDeck(invalid,catalog),/최대 1장/);assert.equal(repairDeck(catalog,invalid).discarded.length,1);}
  assert.equal(maxCardCopies(catalog.ashbringer),0);assert.ok(!deckCards(catalog,'paladin').some(c=>c.id==='ashbringer'));
});
test('Grom enrage and Alakir windfury, charge, shield, taunt',()=>{
  let s=play(ready('warrior'),'grommash_hellscream');assert.equal(m(s,0,'grommash_hellscream').attacksRemaining,1);
  s=play(s,'flame_sphere',t(m(s,0,'grommash_hellscream')));assert.equal(m(s,0,'grommash_hellscream').attack,10);
  s=play(ready('shaman'),'alakir');const a=m(s,0,'alakir');assert.ok(['windfury','charge','divineShield','taunt'].every(k=>hasKeyword(a,k as never)));
  s=hit(s,a,h(1));s=hit(s,m(s,0,'alakir'),h(1));assert.equal(s.players[1].health,24);
});
test('Edwin scales by earlier plays, not by itself; King Krush charges',()=>{
  let s=play(ready('rogue'),'wisp');s=play(s,'wisp');s=play(s,'edwin_vancleef');assert.deepEqual([m(s,0,'edwin_vancleef').attack,m(s,0,'edwin_vancleef').health],[6,6]);
  s=play(ready('hunter'),'king_krush');s=hit(s,m(s,0,'king_krush'),h(1));assert.equal(s.players[1].health,22);
});
test('Cenarius grants both alternate effects and never buffs himself',()=>{
  let s=ready('druid');place(s,0,'wisp');s=play(s,'cenarius',undefined,0);assert.equal(m(s,0,'wisp').attack,3);assert.equal(m(s,0,'cenarius').attack,5);
  s=play(ready('druid'),'cenarius',undefined,1);const trees=s.players[0].board.filter(m=>m.cardId==='cenarius_treant');assert.equal(trees.length,2);assert.ok(trees.every(x=>x.attack===2&&x.health===2&&hasKeyword(x,'taunt')));
});
test('Jaraxxus replaces hero, caps health at 15, equips Blood Fury and summons infernal; Sacrificial Pact can destroy him',()=>{
  let s=ready('warlock','warlock');s.players[0].armor=8;s.players[0].health=4;s=play(s,'lord_jaraxxus');assert.equal(s.players[0].heroForm,'jaraxxus');assert.equal(s.players[0].health,15);assert.equal(s.players[0].maxHealth,15);assert.equal(s.players[0].armor,0);assert.equal(s.players[0].board.length,0);assert.deepEqual(s.players[0].weapon,{attack:3,durability:8,cardId:'blood_fury'});
  s.players[0].mana=10;s=power(s);assert.equal(m(s,0,'jaraxxus_infernal').health,6);assert.equal(getHeroPower(s.players[0]).cost,2);
  s=end(s);assert.ok(legalPublicTargets(getPlayerView(s,1),1,'demonMinion',catalog,true).some(x=>x.kind==='hero'&&x.player===0));s=play(s,'demon_pact',h(0));assert.equal(s.winner,1);
});
test('Antonidas, Cho and Illidan respond to card and spell events',()=>{
  let s=play(ready(),'archmage_antonidas');s=play(s,'lorewalker_cho');s=play(s,'illidan_stormrage');s=play(s,'flame_sphere',h(1));assert.equal(hand(s,0,'flame_sphere'),1);assert.equal(hand(s,1,'flame_sphere'),1);assert.equal(s.players[0].board.filter(x=>x.cardId==='illidan_flame').length,1);
  s=end(s);s=play(s,'flame_sphere',h(0));assert.equal(hand(s,0,'flame_sphere'),2);
});
test('Velen doubles spell damage, healing, hero power and missile count; Malygos adds five spell damage',()=>{
  let s=play(ready('priest'),'prophet_velen');s=play(s,'flame_sphere',h(1));assert.equal(s.players[1].health,18);s.players[0].health=15;s.players[0].mana=10;s=power(s,h(0));assert.equal(s.players[0].health,19);
  s=play(ready(),'prophet_velen');s=play(s,'starlight_barrage');assert.equal(s.players[1].health,24);
  s=play(ready(),'malygos');s=play(s,'flame_sphere',h(1));assert.equal(s.players[1].health,19);
});
test('Thalnos spell damage and death draw, Tirion weapon, Cairne and Beast summoned deathrattles',()=>{
  let s=play(ready(),'bloodmage_thalnos');s=play(s,'flame_sphere',h(1));assert.equal(s.players[1].health,23);const count=s.players[0].deck.length;s=kill(s,'bloodmage_thalnos',0);assert.equal(s.players[0].deck.length,count-1);
  s=play(ready(),'tirion_fordring');s=kill(s,'tirion_fordring',0);assert.deepEqual(s.players[0].weapon,{attack:5,durability:3,cardId:'ashbringer'});
  s=play(ready(),'cairne_bloodhoof');s=kill(s,'cairne_bloodhoof',0);assert.equal(m(s,0,'baine_bloodhoof').health,5);
  s=play(ready(),'the_beast');s=kill(s,'the_beast',0);assert.equal(m(s,1,'finkle_einhorn').attack,3);
});
test('Millhouse applies exactly to the next enemy turn, King Mukla gives enemy bananas',()=>{
  let s=play(ready(),'millhouse_manastorm');assert.equal(price(s,'flame_sphere'),4);s=end(s);assert.equal(price(s,'flame_sphere'),0);assert.equal(price(s,'ogre'),6);s=end(end(s));assert.equal(price(s,'flame_sphere'),4);
  s=play(ready(),'king_mukla');assert.equal(hand(s,1,'mukla_banana'),2);
});
test('Pagle draws on the next owner start with 50% probability; Tink transforms another minion',()=>{
  let s=play(ready(),'nat_pagle');s=end(s);const n=s.players[0].deck.length;s=end(s,()=>0.01);assert.equal(s.players[0].deck.length,n-2);
  s=play(ready(),'nat_pagle');s=end(s);const n2=s.players[0].deck.length;s=end(s,()=>0.99);assert.equal(s.players[0].deck.length,n2-1);
  s=ready();place(s,1,'ogre');s=play(s,'tinkmaster_overspark',undefined,undefined,()=>0);assert.ok(['tink_devil','tink_squirrel'].includes(s.players[1].board[0].cardId));assert.equal(m(s,0,'tinkmaster_overspark').attack,3);
});
test('Murk-Eye counts other Murlocs on both boards; Leeroy summons two enemy whelps',()=>{
  let s=ready();const fellow=deckCards(catalog,'mage').find(c=>c.kind==='minion'&&c.tribe==='murloc'&&c.id!=='old_murk_eye'&&!c.auras?.length)!;place(s,0,fellow.id);place(s,1,fellow.id);s=play(s,'old_murk_eye');assert.equal(m(s,0,'old_murk_eye').attack,4);
  s=play(ready(),'leeroy_jenkins');assert.equal(s.players[1].board.filter(x=>x.cardId==='leeroy_whelp').length,2);s=hit(s,m(s,0,'leeroy_jenkins'),h(1));assert.equal(s.players[1].health,24);
});
test('Greenskin upgrades weapon and Harrison draws its remaining durability',()=>{
  let s=play(ready(),'iron_axe');s=play(s,'captain_greenskin');assert.equal(s.players[0].weapon?.attack,4);assert.equal(s.players[0].weapon?.durability,3);
  s=end(s);const n=s.players[1].deck.length;s=play(s,'harrison_jones');assert.equal(s.players[0].weapon,null);assert.equal(s.players[1].deck.length,n-3);
});
test('Black Knight targets enemy taunt only; Sylvanas steals a random enemy minion',()=>{
  let s=ready();const taunt=deckCards(catalog,'mage').find(c=>c.kind==='minion'&&c.keywords?.includes('taunt'))!;const enemy=place(s,1,taunt.id),friend=place(s,0,taunt.id);assert.deepEqual(legalPublicTargets(getPlayerView(s,0),0,'enemyTauntMinion',catalog,true),[t(enemy)]);assert.throws(()=>play(s,'the_black_knight',t(friend)),/대상/);s=play(s,'the_black_knight',t(enemy));assert.equal(s.players[1].board.length,0);
  s=ready();place(s,1,'ogre');s=play(s,'sylvanas_windrunner');s=kill(s,'sylvanas_windrunner',0);assert.ok(m(s,0,'ogre'));assert.equal(s.players[1].board.length,0);
});
test('Hogger, Geddon, Gruul and Ragnaros turn-end triggers',()=>{
  let s=play(ready(),'hogger');s=end(s);assert.equal(m(s,0,'hogger_gnoll').health,2);
  s=ready();place(s,1,'wisp');s=play(s,'baron_geddon');s=end(s);assert.equal(s.players[0].health,28);assert.equal(s.players[1].health,28);assert.equal(s.players[1].board.length,0);assert.equal(m(s,0,'baron_geddon').health,5);
  s=play(ready(),'gruul');s=end(end(s));assert.deepEqual([m(s,0,'gruul').attack,m(s,0,'gruul').health],[9,9]);
  s=play(ready(),'ragnaros');assert.throws(()=>hit(s,m(s,0,'ragnaros'),h(1)),/공격/);s=end(s);assert.equal(s.players[1].health,22);
});
test('Alexstrasza sets health but not armor, Onyxia fills only available board spaces',()=>{
  let s=ready();s.players[1].armor=7;s=play(s,'alexstrasza',h(1));assert.equal(s.players[1].health,15);assert.equal(s.players[1].armor,7);
  s=ready();place(s,0,'wisp');s=play(s,'onyxia');assert.equal(s.players[0].board.length,7);assert.equal(s.players[0].board.filter(x=>x.cardId==='onyxia_whelp').length,5);
});
test('Nozdormu restricts both turns while alive and unsilenced',()=>{
  let s=play(ready(),'nozdormu');assert.equal(turnTimeLimitSeconds(s),15);s=end(s);assert.equal(turnTimeLimitSeconds(s),15);m(s,0,'nozdormu').silenced=true;assert.equal(turnTimeLimitSeconds(s),undefined);
});
test('Ysera produces Dream cards; Nightmare destroys at next owner start, Awakens spares Ysera',()=>{
  let s=play(ready(),'ysera');s=end(s,()=>0);assert.equal(hand(s,0,'dream'),1);
  s=ready();const a=place(s,0,'ogre');s=play(s,'nightmare',t(a));assert.equal(m(s,0,'ogre').attack,11);s=end(end(s));assert.equal(s.players[0].board.length,0);
  s=ready();place(s,0,'ysera');place(s,1,'ysera');place(s,1,'wisp');s=play(s,'ysera_awakens');assert.equal(m(s,0,'ysera').health,12);assert.equal(m(s,1,'ysera').health,12);assert.equal(s.players[0].health,25);assert.equal(s.players[1].health,25);assert.equal(s.players[1].board.length,1);
});
test('Deathwing clears other minions and own hand; Gelbin and ETC create their respective cards',()=>{
  let s=ready();place(s,0,'wisp');place(s,1,'ogre');hold(s,'wisp');hold(s,'ogre');s=play(s,'deathwing');assert.equal(s.players[0].hand.length,0);assert.equal(s.players[0].board.length,1);assert.equal(s.players[1].board.length,0);
  s=play(ready(),'gelbin_mekkatorque',undefined,undefined,()=>0);assert.ok(m(s,0,'homing_chicken'));s=end(s);const n=s.players[0].deck.length;s=end(s);assert.equal(s.players[0].deck.length,n-4);
  s=play(ready(),'elite_tauren_chieftain',undefined,undefined,()=>0);assert.equal(hand(s,0,'power_of_the_horde'),1);assert.equal(hand(s,1,'power_of_the_horde'),1);
});
