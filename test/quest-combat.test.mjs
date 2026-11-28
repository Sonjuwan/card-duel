import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createGame} from '../packages/engine/src/index.ts';
import {loadCatalog} from '../apps/server/server.ts';
import {basicDeck} from '../packages/basic-decks.ts';
import {countQuestEvent} from '../packages/quest-combat.ts';

const catalog=loadCatalog();
function scene(hero='mage',firstPlayer=0){
  const state=createGame(catalog,[basicDeck(catalog,hero),basicDeck(catalog,'mage')],{seed:17,firstPlayer});
  state.phase='playing';state.activePlayer=0;state.turn=firstPlayer===0?1:2;
  for(const p of state.players){p.board=[];p.hand=[];p.mana=10;p.maxMana=10;p.heroAttacksRemaining=1;}
  const counts={},unchanged=state;
  let next=state,serial=0;
  function card(cardId,side=0,discount){
    const instanceId='quest-card-'+ ++serial;
    next.players[side].hand.push({cardId,instanceId,...(discount?{costDiscount:discount}:{})});
    return instanceId;
  }
  function unit(cardId,side,extra={}){
    const c=next.catalog[cardId],instanceId='quest-unit-'+ ++serial;
    next.players[side].board.push({cardId,instanceId,attack:c.attack,health:c.health,maxHealth:c.health,attacksRemaining:1,
      keywords:[...(c.keywords??[])],summonedTurn:0,enteredOrder:serial,originalOwner:side,...extra});
    return {kind:'minion',instanceId};
  }
  function spell(effects,options={}){
    const id='quest-fixture-'+ ++serial;
    next.catalog={...next.catalog,[id]:{kind:'spell',id,class:'neutral',rarity:'basic',name:id,cost:0,description:'',effects,...options}};
    return card(id);
  }
  const step=(action,side=0)=>{
    const before=next,events=[];
    next=applyAction(before,side,action,{combatEvent:e=>events.push(e)});
    assert.deepEqual(next,applyAction(before,side,action),'observer preserves authoritative outcome');
    for(const event of events)countQuestEvent(counts,0,event);
    return next;
  };
  const play=(instanceId,target,choice)=>step({type:'playCard',instanceId,target,choice});
  return {get state(){return next;},unchanged,counts,card,unit,spell,step,play};
}
const enemy={kind:'hero',player:1};

test('resolved spell damage counts armor, caps lethal damage, ignores shields and attributes each area kill once',()=>{
  const battle=scene(),{counts}=battle;
  Object.assign(battle.state.players[1],{health:2,armor:3});
  battle.unit('wolf',1,{health:1,maxHealth:2});
  battle.unit('wolf',1);
  battle.unit('wolf',1,{keywords:['divineShield']});
  battle.play(battle.spell([{kind:'damage',target:'enemyCharacters',amount:12}]));
  assert.deepEqual(counts,{cheapCards:1,spells:1,spellDamage:8,heroDamage:5,earlyDamage:5,kills:2,spellKills:2,areaKills:2});
  assert.equal(battle.state.players[1].board.length,1);
});
test('turn-five threshold uses the player’s seat and does not count retaliatory or sixth-turn damage',()=>{
  const battle=scene('mage',1),{counts}=battle;
  battle.state.turn=10;
  const beast=battle.unit('wolf',0);
  battle.step({type:'attack',attackerId:beast.instanceId,target:enemy});
  assert.equal(counts.faceAttacks,1);assert.equal(counts.beastAttacks,1);
  assert.equal(counts.earlyDamage,counts.heroDamage);
  battle.state.turn=12;
  battle.step({type:'heroPower',target:enemy});
  assert.equal(counts.powerDamage,1);
  assert.equal(counts.heroDamage,counts.earlyDamage+1);
});
test('actual healing, repeated shields and repeated unchanged freezing report exact deltas',()=>{
  const battle=scene('priest'),{counts}=battle;
  const ally=battle.unit('wolf',0,{health:1,maxHealth:3});
  battle.unit('wolf',1);
  const effects=[
    {kind:'heal',target:'friendlyMinions',amount:20},{kind:'heal',target:'friendlyMinions',amount:20},
    {kind:'giveKeyword',target:'friendlyMinions',keyword:'divineShield'},{kind:'giveKeyword',target:'friendlyMinions',keyword:'divineShield'},
    {kind:'freeze',target:'enemyMinions'},{kind:'freeze',target:'enemyMinions'},
    {kind:'buff',target:'friendlyMinions',attack:1,health:3},
  ];
  battle.play(battle.spell(effects));
  assert.equal(counts.heal,2);assert.equal(counts.minionHeal,2);
  assert.equal(counts.freeze,1);assert.equal(counts.shieldGain,1);
  assert.equal(counts.buff,2);assert.equal(counts.healthBuff,3);
  assert.equal(battle.state.players[0].board[0].instanceId,ally.instanceId);
});
test('printed cost qualifiers, real discounts, selected effects and summon-only tokens stay distinct',()=>{
  const battle=scene('druid'),{counts}=battle;
  battle.state.players[0].maxMana=8;battle.state.players[0].mana=6;
  const choose=battle.spell(undefined,{cost:8,choices:[{label:'마나',effects:[{kind:'gainCrystal',amount:3,filled:true}]},{label:'지연',effects:[{kind:'gainMana',amount:1}]}]});
  battle.state.players[0].hand.find(c=>c.instanceId===choose).costDiscount=3;
  battle.play(choose,undefined,0);
  assert.equal(counts.spell7,1);assert.equal(counts.discount,3);
  assert.equal(counts.mana,2);assert.equal(counts.choose,1);
  battle.play(battle.spell([{kind:'summon',cardId:'wolf',count:1},{kind:'summon',cardId:'wolf',count:1,side:'enemy'}]));
  assert.equal(counts.summons,1);assert.equal(counts.beasts,1);assert.equal(counts.minion12,undefined);
  battle.state.players[0].mana=10;
  battle.play(battle.card('wolf'));
  assert.equal(counts.summons,2);assert.equal(counts.minion12,1);
});
test('successful depleting deck draws count, burns and adds do not count',()=>{
  const battle=scene(),{counts}=battle;
  const draw=battle.spell([{kind:'addCard',cardId:'wolf',count:1},{kind:'draw',amount:3}]);
  for(let i=0;i<9;i++)battle.card('wolf');
  battle.play(draw);assert.equal(counts.draw,undefined);
  battle.state.players[0].hand=[];
  battle.play(battle.spell([{kind:'draw',amount:2},{kind:'addCard',cardId:'wolf',count:1}]));
  assert.equal(counts.draw,2);
});
test('secrets are credited on the accepted card action without a trigger',()=>{
  const battle=scene();
  const secret=Object.values(catalog).find(c=>c.kind==='secret'&&c.class==='mage');
  battle.play(battle.card(secret.id));
  assert.equal(battle.counts.secrets,1);
  assert.equal(battle.state.players[0].secrets.length,1);
});
test('warrior, shaman, rogue and paladin active powers provide repeatable actions',()=>{
  const warrior=scene('warrior');warrior.step({type:'heroPower'});assert.equal(warrior.counts.armor,2);
  const shaman=scene('shaman');shaman.step({type:'heroPower'});assert.equal(shaman.counts.totems,1);
  shaman.state.players[0].pendingOverload=9;
  shaman.play(shaman.spell([{kind:'overload',amount:3}]));
  assert.equal(shaman.counts.overload,1);
  const paladin=scene('paladin');paladin.step({type:'heroPower'});assert.equal(paladin.counts.recruits,1);
  const rogue=scene('rogue');rogue.step({type:'heroPower'});rogue.step({type:'heroAttack',target:enemy});
  assert.equal(rogue.counts.weaponAttacks,1);assert.equal(rogue.counts.weaponDamage,1);
});
test('combo activates once, opponent decisions do not count and own scheduled removal retains attribution',()=>{
  const rogue=scene('rogue');
  const combo=[{kind:'damage',target:'enemyHero',amount:1,bonusIfCombo:1},{kind:'damage',target:'enemyHero',amount:1,bonusIfCombo:1}];
  rogue.play(rogue.spell(combo));assert.equal(rogue.counts.combo,undefined);
  rogue.play(rogue.spell(combo));assert.equal(rogue.counts.combo,1);
  const target=rogue.unit('wolf',1);
  rogue.play(rogue.spell([{kind:'deferredDestroy',target:'chosen'}],{targetRule:'enemyMinion'}),target);
  assert.equal(rogue.counts.kills,undefined);
  rogue.step({type:'endTurn'});
  rogue.step({type:'heroPower',target:{kind:'hero',player:0}},1);
  rogue.step({type:'endTurn'},1);
  assert.equal(rogue.counts.kills,1);assert.equal(rogue.counts.spellKills,1);
  assert.equal(rogue.counts.selfDamage,undefined);assert.equal(rogue.counts.power,undefined);
});

test('copied summons count the applied shield once, including a shield granted by the original battlecry',()=>{
  const battle=scene();
  const secret={kind:'secret',id:'copy-fixture',class:'mage',rarity:'basic',name:'복사',cost:0,description:'',
    trigger:'enemyPlayMinion',effects:[{kind:'copyEventMinion'}]};
  const wolf={...battle.state.catalog.wolf,id:'shield-fixture',
    battlecry:[{kind:'giveKeyword',target:'self',keyword:'divineShield'}]};
  battle.state.catalog={...battle.state.catalog,[secret.id]:secret,[wolf.id]:wolf};
  battle.play(battle.card(secret.id));
  battle.step({type:'endTurn'});
  battle.step({type:'playCard',instanceId:battle.card(wolf.id,1)},1);
  assert.equal(battle.counts.summons,1);
  assert.equal(battle.counts.shieldGain,1);
  assert.ok(battle.state.players[0].board[0].keywords.includes('divineShield'));
});
