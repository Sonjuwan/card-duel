import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, createCatalog, createGame, getHeroPower, getPlayerView, HERO_CLASSES, practiceDeck, publicCardReason } from '../../../packages/engine/src/index.ts';
import type { Action, Card, GameState, HeroClass, Minion, PlayerId, Target } from '../../../packages/engine/src/index.ts';
import { hasRemainingBattleAction, planAttack, planCard, planPower, resolveDrop, repositionSelection, placementOptions, toggleActionSelection, selectHandCard, keyboardTargetIndex, keyboardActionSource,keyboardReturnIndex,modalTabIndex,targetPickerRows, targetAction, targetsFor } from '../src/battle-actions.ts';
import type { DragIntent, Intent, Selection } from '../src/battle-actions.ts';
import { nearestBoardSlot, touchDropLocations,pointerDrop,dropFeedbackText } from '../src/touch-gesture.ts';
import type { TouchHit } from '../src/touch-gesture.ts';

const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8')));
function ready(hero:HeroClass='mage',first:PlayerId=0){let s=createGame(catalog,[practiceDeck(catalog,hero),practiceDeck(catalog,'warrior')],{seed:123,firstPlayer:first});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[first].mana=10;s.players[first].maxMana=10;return s;}
function minion(s:GameState,seat:PlayerId,id:string,instanceId:string,damage=0){const c=s.catalog[id];assert.ok(c.kind==='minion');const m:Minion={instanceId,cardId:id,attack:c.attack,health:c.health-damage,maxHealth:c.health,attacksRemaining:1,keywords:[...(c.keywords??[])]};s.players[seat].board.push(m);return m;}
function hold(s:GameState,id:string,seat:PlayerId=0){s.players[seat].hand=[{cardId:id,instanceId:'held'}];return getPlayerView(s,seat);}
const enemyHero:Target={kind:'hero',player:1};
const selfHero:Target={kind:'hero',player:0};
test('re-selecting a held or pending targeted card cancels without sending an action',()=>{
  const s=ready(),v=hold(s,'flame_sphere');const held=selectHandCard(v,0,catalog,'held',null);assert.deepEqual(held,{kind:'held',id:'held'});assert.equal(selectHandCard(v,0,catalog,'held',held),null);
  const pending=planCard(v,0,catalog,'held')!.selection!;assert.equal(pending.kind,'card');assert.equal(selectHandCard(v,0,catalog,'held',pending),null);assert.equal(selectHandCard(v,0,catalog,'held',{kind:'cardChoice',id:'held'}),null);
  assert.deepEqual(selectHandCard(v,0,catalog,'held',{kind:'held',id:'other'}),held);assert.equal(v.self.hand.length,1);assert.equal(v.self.mana,10);
});
test('keyboard target navigation wraps only the legal target list and never submits an action',()=>{
  assert.equal(keyboardTargetIndex('ArrowRight',-1,3),0);assert.equal(keyboardTargetIndex('ArrowLeft',-1,3),2);
  assert.equal(keyboardTargetIndex('ArrowDown',2,3),0);assert.equal(keyboardTargetIndex('ArrowUp',0,3),2);
  assert.equal(keyboardTargetIndex('Home',2,3),0);assert.equal(keyboardTargetIndex('End',0,3),2);
  assert.equal(keyboardTargetIndex('PageDown',0,12),5);assert.equal(keyboardTargetIndex('PageDown',10,12),11);
  assert.equal(keyboardTargetIndex('PageDown',-1,12),4);assert.equal(keyboardTargetIndex('PageUp',9,12),4);
  assert.equal(keyboardTargetIndex('PageUp',2,12),0);assert.equal(keyboardTargetIndex('PageUp',-1,12),0);
  for(const k of ['Enter',' ','Escape','Tab'])assert.equal(keyboardTargetIndex(k,0,3),null);
  assert.equal(keyboardTargetIndex('ArrowRight',0,0),null);assert.equal(keyboardTargetIndex('ArrowUp',0,1),0);
});
test('keyboard action recovery prefers a still-legal source, then hand, another source, or end-turn fallback',()=>{
  const sources=['minion:m','hero','power','card:a','card:b'];
  assert.equal(keyboardActionSource({type:'attack',attackerId:'m',target:enemyHero}),'minion:m');assert.equal(keyboardActionSource({type:'playCard',instanceId:'a'}),'card:a');assert.equal(keyboardActionSource({type:'heroAttack',target:enemyHero}),'hero');assert.equal(keyboardActionSource({type:'heroPower'}),'power');assert.equal(keyboardActionSource({type:'endTurn'}),undefined);
  assert.equal(keyboardReturnIndex('minion:m',sources),0);assert.equal(keyboardReturnIndex('power',sources),2);assert.equal(keyboardReturnIndex('card:b',sources),4);
  assert.equal(keyboardReturnIndex('card:removed',sources),3);assert.equal(keyboardReturnIndex(undefined,['hero','power']),0);assert.equal(keyboardReturnIndex('power',[]),-1);
});
test('choice dialog tabs cycle enabled controls, including empty and root-focus states',()=>{
  assert.deepEqual([0,1,2].map(i=>modalTabIndex(i,3,false)),[1,2,0]);
  assert.deepEqual([0,1,2].map(i=>modalTabIndex(i,3,true)),[2,0,1]);
  assert.equal(modalTabIndex(-1,3,false),0);assert.equal(modalTabIndex(-1,3,true),2);
  assert.equal(modalTabIndex(0,1,true),0);assert.equal(modalTabIndex(0,0,false),-1);
});
test('target picker describes only legal public units, preserving positions and both seats',()=>{
  for(const seat of [0,1] as const){const s=ready('mage',seat),opponent=seat===0?1:0;minion(s,seat,'wolf','attacker');minion(s,opponent,'night_cat','stealth');minion(s,opponent,'recruit','guard-a');minion(s,opponent,'recruit','guard-b');const v=getPlayerView(s,seat);
    const legal=targetsFor(v,seat,catalog,planAttack(v,seat,catalog,'attacker')),rows=targetPickerRows(v,seat,legal);assert.deepEqual(rows.map(r=>r.target),legal);assert.equal(rows.length,2);
    assert.deepEqual(rows.map(r=>r.kind==='minion'?[r.side,r.cardId,r.position]:[]),[['enemy','recruit',1],['enemy','recruit',2]]);
    assert.equal(targetPickerRows(v,seat,[...legal,...legal,{kind:'minion',instanceId:'absent'}]).length,2);
    const hero=targetPickerRows(v,seat,[{kind:'hero',player:seat}])[0];assert.equal(hero.side,'self');assert.equal(hero.health,30);
  }
});
test('target picker exposes only public shield, taunt, immune and freeze statuses',()=>{
  const state=ready();const defender=minion(state,1,'recruit','shielded');
  defender.keywords=['taunt','divineShield'];defender.frozenThroughTurn=state.turn;defender.immuneThisTurn=true;
  state.players[1].heroImmuneThisTurn=true;
  const view=getPlayerView(state,0),rows=targetPickerRows(view,0,[{kind:'minion',instanceId:'shielded'},{kind:'hero',player:1}]);
  assert.deepEqual(rows[0].publicStatuses,['도발','천상의 보호막','면역','빙결']);
  assert.deepEqual(rows[1].publicStatuses,['면역']);
  assert.equal(rows.some(row=>row.kind==='minion'&&row.cardId!=='recruit'),false);
});
test('repeated source presses cancel only the same attack or targeted power selection',()=>{
  const attack:Selection={kind:'attack',id:'first'},other:Selection={kind:'attack',id:'second'},hero:Selection={kind:'heroAttack'},power:Selection={kind:'power'},card:Selection={kind:'card',id:'held',position:1};
  for(const s of [attack,hero,power]){assert.equal(toggleActionSelection(null,s),s);assert.equal(toggleActionSelection(s,s),null);}
  assert.equal(toggleActionSelection(attack,other),other);assert.equal(toggleActionSelection(attack,hero),hero);
  assert.equal(toggleActionSelection(power,attack),attack);assert.equal(toggleActionSelection(card,card),card);
  const s=ready(),view=getPlayerView(s,0);const planned=planPower(view,0,catalog);assert.equal(planned?.selection?.kind,'power');
  const cleared=toggleActionSelection(planned!.selection!,planned!.selection!);assert.deepEqual(targetsFor(view,0,catalog,cleared),[]);assert.equal(targetAction(view,0,catalog,cleared,enemyHero),null);
});
function drag(intent:DragIntent,s:GameState){return{intent,revision:s.revision};}
function actionOf(intent:Intent|null){assert.ok(intent?.action);return intent.action;}

test('click or drag an untargeted minion into the exact requested insertion slot',()=>{const s=ready();minion(s,0,'wolf','left');minion(s,0,'wolf','right');const view=hold(s,'wisp');const click=actionOf(planCard(view,0,catalog,'held',1));const drop=actionOf(resolveDrop(view,0,catalog,drag({kind:'card',id:'held'},s),{kind:'board',position:1}));assert.deepEqual(click,drop);const n=applyAction(s,0,drop);assert.deepEqual(n.players[0].board.map(x=>x.cardId),['wolf','wisp','wolf']);});
test('placement picker offers every exact friendly insertion gap, including duplicate minions and both seats',()=>{
  for(const seat of [0,1] as const){const s=ready('mage',seat);minion(s,seat,'wolf','a');minion(s,seat,'wolf','b');minion(s,seat,'recruit','c');const v=hold(s,'wisp',seat),held=selectHandCard(v,seat,catalog,'held',null);
    assert.deepEqual(placementOptions(v,seat,catalog,held),[{position:0,leftCardId:undefined,rightCardId:'wolf'},{position:1,leftCardId:'wolf',rightCardId:'wolf'},{position:2,leftCardId:'wolf',rightCardId:'recruit'},{position:3,leftCardId:'recruit',rightCardId:undefined}]);
    for(const {position} of placementOptions(v,seat,catalog,held)){const next=applyAction(s,seat,actionOf(planCard(v,seat,catalog,'held',position)));assert.equal(next.players[seat].board[position].cardId,'wisp');}
    assert.deepEqual(placementOptions({...v,activePlayer:seat===0?1:0},seat,catalog,held),[]);assert.deepEqual(placementOptions({...v,choicePending:true},seat,catalog,held),[]);assert.deepEqual(placementOptions(v,seat,catalog,null),[]);
    assert.deepEqual(placementOptions(hold(s,'flame_sphere',seat),seat,catalog,held),[]);
    for(let i=3;i<7;i++)minion(s,seat,'wolf',`full-${i}`);assert.deepEqual(placementOptions(hold(s,'wisp',seat),seat,catalog,held),[]);
  }
});
test('touch near a friendly minion falls back to the nearest insertion rather than the previous selected slot',()=>{const s=ready();minion(s,0,'wolf','left');minion(s,0,'wolf','right');const view=hold(s,'wisp'),slot=nearestBoardSlot(112,[{position:0,x:30},{position:1,x:100},{position:2,x:170}]);const locations=touchDropLocations({ownBoard:true,minionId:'right',slot},0,2,false);const intent=locations.map(location=>resolveDrop(view,0,catalog,drag({kind:'card',id:'held'},s),location)).find(Boolean)??null;const n=applyAction(s,0,actionOf(intent));assert.deepEqual(n.players[0].board.map(x=>x.cardId),['wolf','wisp','wolf']);});
test('shared pointer hover and drop classify exact placement, valid targets, choices, and rejected interaction controls',()=>{
  const s=ready();minion(s,0,'wolf','left');minion(s,0,'wolf','right');let view=hold(s,'wisp');const d=drag({kind:'card',id:'held'},s);
  const minionPlan=pointerDrop(view,0,catalog,d,{ownBoard:true,field:true,minionId:'right',slot:1},2);assert.equal(minionPlan.feedback,'action');assert.deepEqual(applyAction(s,0,actionOf(minionPlan.intent)).players[0].board.map(m=>m.cardId),['wolf','wisp','wolf']);assert.match(dropFeedbackText(minionPlan.feedback,1),/2번/);
  for(const hit of [{hand:true,field:true},{control:true,field:true},{}])assert.deepEqual(pointerDrop(view,0,catalog,d,hit,2),{intent:null,feedback:'cancel'});
  assert.deepEqual(pointerDrop(view,0,catalog,d,{field:true,hero:'enemy'},2),{intent:null,feedback:'invalid'});
  assert.deepEqual(pointerDrop(view,0,catalog,d,{ownBoard:true,field:true,minionId:'right'},2),{intent:null,feedback:'invalid'});
  assert.equal(pointerDrop({...view,revision:view.revision+1},0,catalog,d,{ownBoard:true,slot:1},2).feedback,'cancel');
  view=hold(s,'flame_sphere');const target=pointerDrop(view,0,catalog,d,{field:true,hero:'enemy'},2);assert.equal(target.feedback,'action');assert.equal(applyAction(s,0,actionOf(target.intent)).players[1].health,24);
  const selection=pointerDrop(view,0,catalog,d,{field:true},2);assert.deepEqual(selection,{intent:null,feedback:'invalid'});
  const choice=Object.values(catalog).find(c=>c.kind==='spell'&&c.choices?.length);assert.ok(choice?.kind==='spell');const other=ready(choice.class==='neutral'?'mage':choice.class),choiceView=hold(other,choice.id);assert.equal(pointerDrop(choiceView,0,catalog,drag({kind:'card',id:'held'},other),{field:true},0).feedback,'choice');
});
test('changing a pending minion placement preserves its target/choice and submits the new position',()=>{
  const card=Object.values(catalog).find(c=>c.kind==='minion'&&c.targetRule==='enemyMinion'&&!c.choices);assert.ok(card?.kind==='minion');
  const s=ready(card.class==='neutral'?'mage':card.class);minion(s,0,'wolf','left');minion(s,0,'wolf','right');minion(s,1,'snow_brute','enemy');const view=hold(s,card.id);
  const plan=planCard(view,0,catalog,'held',0);assert.equal(plan?.selection?.kind,'card');
  const moved=repositionSelection(view,catalog,plan!.selection!,1);assert.deepEqual(moved,{...plan!.selection,position:1});
  const a=targetAction(view,0,catalog,moved,{kind:'minion',instanceId:'enemy'});assert.ok(a);assert.equal(a.type,'playCard');assert.equal(a.position,1);
  const next=applyAction(s,0,a);assert.equal(next.players[0].board[1].cardId,card.id);
  const choice={kind:'cardChoice' as const,id:'held',position:0};assert.deepEqual(repositionSelection(view,catalog,choice,99),{...choice,position:2});
  const spellView=hold(s,'flame_sphere'),spell=planCard(spellView,0,catalog,'held')!.selection!;assert.equal(repositionSelection(spellView,catalog,spell,1),spell);
});
test('shared pointer attack cannot bypass taunt or target UI controls',()=>{const s=ready();minion(s,0,'wolf','attacker');minion(s,1,'recruit','guard');const view=getPlayerView(s,0),d=drag({kind:'attack',id:'attacker'},s);assert.deepEqual(pointerDrop(view,0,catalog,d,{field:true,hero:'enemy'},0),{intent:null,feedback:'invalid'});assert.equal(pointerDrop(view,0,catalog,d,{field:true,minionId:'guard'},0).feedback,'action');assert.equal(pointerDrop(view,0,catalog,d,{field:true,control:true},0).feedback,'cancel');});
test('targeted spell is not committed by a board drop; dropping on a valid target does commit',()=>{const s=ready(),view=hold(s,'flame_sphere');const p=resolveDrop(view,0,catalog,drag({kind:'card',id:'held'},s),{kind:'board',position:0});assert.equal(p?.selection?.kind,'card');assert.equal(p?.action,undefined);const target=targetAction(view,0,catalog,p!.selection!,enemyHero);assert.ok(target);assert.deepEqual(target,actionOf(resolveDrop(view,0,catalog,drag({kind:'card',id:'held'},s),{kind:'target',target:enemyHero})));assert.equal(applyAction(s,0,target).players[1].health,24);});
test('dragging an attack cannot bypass taunt, stealth or friendly-target restrictions',()=>{const s=ready();minion(s,0,'wolf','attacker');minion(s,1,'recruit','guard');minion(s,1,'night_cat','stealth');const view=getPlayerView(s,0),d=drag({kind:'attack',id:'attacker'},s);assert.deepEqual(targetsFor(view,0,catalog,planAttack(view,0,catalog,'attacker')),[{kind:'minion',instanceId:'guard'}]);for(const target of [enemyHero,selfHero,{kind:'minion',instanceId:'stealth'} as Target,{kind:'minion',instanceId:'attacker'} as Target])assert.equal(resolveDrop(view,0,catalog,d,{kind:'target',target}),null);const a=actionOf(resolveDrop(view,0,catalog,d,{kind:'target',target:{kind:'minion',instanceId:'guard'}}));assert.equal(applyAction(s,0,a).players[1].board.some(m=>m.instanceId==='guard'),false);});
test('hero drag attack and power target use public rules; frozen heroes cannot drag or attack',()=>{const s=ready();s.players[0].weapon={attack:3,durability:2};s.players[0].heroAttacksRemaining=1;let v=getPlayerView(s,0);const a=actionOf(resolveDrop(v,0,catalog,drag({kind:'heroAttack'},s),{kind:'target',target:enemyHero}));assert.equal(applyAction(s,0,a).players[1].health,27);const p=planPower(v,0,catalog);assert.ok(p?.selection);const hit=targetAction(v,0,catalog,p.selection,enemyHero);assert.ok(hit);assert.equal(applyAction(s,0,hit).players[1].health,29);s.players[0].heroFrozenThroughTurn=s.turn;v=getPlayerView(s,0);assert.equal(planAttack(v,0,catalog),null);assert.equal(resolveDrop(v,0,catalog,drag({kind:'heroAttack'},s),{kind:'target',target:enemyHero}),null);});
test('stale drag, wrong turn, pending choice, insufficient mana and full board cannot submit actions',()=>{const s=ready(),v=hold(s,'wisp');const d=drag({kind:'card',id:'held'},s);assert.equal(resolveDrop({...v,revision:v.revision+1},0,catalog,d,{kind:'board',position:0}),null);assert.equal(resolveDrop({...v,activePlayer:1},0,catalog,d,{kind:'board',position:0}),null);assert.equal(resolveDrop({...v,choicePending:true},0,catalog,d,{kind:'board',position:0}),null);assert.equal(resolveDrop({...v,phase:'finished'},0,catalog,d,{kind:'board',position:0}),null);for(let i=0;i<7;i++)minion(s,0,'wolf',`m${i}`);assert.equal(planCard(getPlayerView(s,0),0,catalog,'held'),null);s.players[0].board=[];s.players[0].mana=1;assert.equal(planCard(hold(s,'flame_sphere'),0,catalog,'held'),null);});
test('selection effects require choosing a valid option, and can then resolve a legal target',()=>{const card=Object.values(catalog).find(c=>c.kind==='spell'&&c.choices?.some(o=>o.targetRule)) as Extract<Card,{kind:'spell'}>;assert.ok(card);const s=ready(card.class==='neutral'?'druid':card.class);minion(s,0,'wolf','friendly');minion(s,1,'wolf','enemy');const v=hold(s,card.id);const p=planCard(v,0,catalog,'held');assert.equal(p?.selection?.kind,'cardChoice');assert.equal(targetAction(v,0,catalog,p?.selection??null,enemyHero),null);assert.equal(planCard(v,0,catalog,'held',undefined,99),null);const option=card.choices!.findIndex(o=>!!o.targetRule);const next=planCard(v,0,catalog,'held',undefined,option);assert.ok(next);if(next.action)assert.doesNotThrow(()=>applyAction(s,0,next.action!));else{const targets=targetsFor(v,0,catalog,next.selection);assert.ok(targets.length);const a=targetAction(v,0,catalog,next.selection,targets[0]);assert.ok(a);assert.doesNotThrow(()=>applyAction(s,0,a));}});
test('a targeted minion with no target still enters the battlefield at the chosen position',()=>{const card=Object.values(catalog).find(c=>c.kind==='minion'&&c.targetRule==='enemyMinion'&&!c.choices) as Extract<Card,{kind:'minion'}>;assert.ok(card);const s=ready(card.class==='neutral'?'mage':card.class),v=hold(s,card.id);const p=actionOf(planCard(v,0,catalog,'held',0));const n=applyAction(s,0,p);assert.equal(n.players[0].board[0].cardId,card.id);});
test('all 382 cards: planned click/drag routes agree with the server in rich, combo and sparse fixtures',{timeout:60000},t=>{
  const all=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);assert.equal(all.length,382);let accepted=0;
  for(const card of all)for(const variant of ['rich','combo','sparse'] as const){const cls=card.kind==='coin'||card.class==='neutral'?'mage':card.class;const s=ready(cls);const p=s.players[0];p.health=20;p.mana=variant==='sparse'?1:10;p.maxMana=p.mana;p.cardsPlayedThisTurn=variant==='combo'?1:0;p.minionsPlayedThisTurn=p.cardsPlayedThisTurn;if(variant!=='sparse'){p.weapon={attack:3,durability:2};minion(s,0,'wolf','f1');minion(s,0,'void_sentinel','f2');minion(s,0,'snow_brute','f3',1);minion(s,0,'ogre','f4');minion(s,1,'wolf','e1',1);minion(s,1,'snow_brute','e2');minion(s,1,'ogre','e3');minion(s,1,'night_cat','e4');minion(s,1,'wisp','e5');}const view=hold(s,card.id);const plan=planCard(view,0,catalog,'held',2);assert.equal(!!plan,!publicCardReason(view,0,view.self.hand[0],catalog),`${card.id} ${variant}`);assert.deepEqual(resolveDrop(view,0,catalog,drag({kind:'card',id:'held'},s),{kind:'board',position:2}),plan,`${card.id} board drop`);if(!plan)continue;
    const choices:Intent[]=plan.selection?.kind==='cardChoice'&&(card.kind==='minion'||card.kind==='spell')?card.choices!.map((_,i)=>planCard(view,0,catalog,'held',2,i)).filter((x):x is Intent=>!!x):[plan];assert.ok(choices.length,card.id);
    for(const choice of choices){let actions:Action[]=[];if(choice.action)actions=[choice.action];else {const selection:Selection=choice.selection;actions=targetsFor(view,0,catalog,selection).map(target=>targetAction(view,0,catalog,selection,target)!);assert.ok(actions.length,card.id);assert.ok(actions.every(Boolean));}for(const a of actions){if(a.type==='playCard'&&a.target&&plan.selection?.kind!=='cardChoice')assert.deepEqual(actionOf(resolveDrop(view,0,catalog,drag({kind:'card',id:'held'},s),{kind:'target',target:a.target,position:2})),a,`${card.id} direct target drop`);try{const next=applyAction(s,0,a);assert.equal(next.revision,s.revision+1);accepted++;}catch(e){assert.fail(`${card.id} ${variant} ${JSON.stringify(a)}: ${e}`);}}}
  }assert.ok(accepted>1000);t.diagnostic(`${accepted} public-interface click / target actions accepted by authoritative engine`);
});

test('hero power drag respects target requirements and stale revisions',()=>{
 const mage=getPlayerView(ready('mage'),0), warrior=getPlayerView(ready('warrior'),0);
 const drag=(v:typeof mage)=>({intent:{kind:'power' as const},revision:v.revision});
 assert.deepEqual(resolveDrop(mage,0,catalog,drag(mage),{kind:'target',target:enemyHero}),{action:{type:'heroPower',target:enemyHero}});
 assert.equal(resolveDrop(mage,0,catalog,drag(mage),{kind:'board',position:0}),null);
 assert.deepEqual(resolveDrop(warrior,0,catalog,drag(warrior),{kind:'board',position:0}),{action:{type:'heroPower'}});
 assert.equal(resolveDrop(warrior,0,catalog,{...drag(warrior),revision:warrior.revision-1},{kind:'board',position:0}),null);
 assert.equal(pointerDrop(warrior,0,catalog,drag(warrior),{field:true,hero:'enemy'},0).intent,null);
 assert.equal(pointerDrop(warrior,0,catalog,drag(warrior),{field:true,hand:true},0).intent,null);
 assert.deepEqual(pointerDrop(warrior,0,catalog,drag(warrior),{field:true,ownBoard:true},0).intent,{action:{type:'heroPower'}});
 assert.deepEqual(pointerDrop(mage,0,catalog,drag(mage),{field:true,hero:'enemy'},0).intent,{action:{type:'heroPower',target:enemyHero}});
});


test('all nine power controls resolve the same accepted action by click or drag',()=>{
  for(const hero of HERO_CLASSES){
    const state=ready(hero),view=getPlayerView(state,0),intent=drag({kind:'power'},state);
    const power=getHeroPower(view.self),click=planPower(view,0,state.catalog);
    const target:Target|undefined=power.targetRule?enemyHero:undefined;
    const action:Action|null|undefined=target?targetAction(view,0,state.catalog,click?.selection??null,target):click?.action;
    assert.ok(action,hero);
    const hit:TouchHit=target?{field:true,hero:'enemy'}:{field:true,ownBoard:true};
    assert.deepEqual(pointerDrop(view,0,state.catalog,intent,hit,0).intent?.action,action,hero);
    const next=applyAction(state,0,action);
    assert.equal(next.players[0].mana,state.players[0].mana-2,hero);
    assert.equal(next.players[0].heroPowerUsed,true,hero);
    const spent=getPlayerView(next,0);
    assert.equal(pointerDrop(spent,0,next.catalog,drag({kind:'power'},next),hit,0).intent,null,hero);
  }
});

test('an enemy board drop reserves a friendly slot and does not commit a targeted spell on empty ground',()=>{
  const s=ready();
  minion(s,0,'wolf','left');
  minion(s,0,'wolf','right');
  const view=hold(s,'wisp');
  const pointer=drag({kind:'card',id:'held'},s);
  const drop=pointerDrop(view,0,catalog,pointer,{enemyBoard:true,field:true,slot:1},0);
  assert.deepEqual(drop.intent?.action,{type:'playCard',instanceId:'held',position:1,choice:undefined});
  const after=applyAction(s,0,drop.intent!.action!);
  assert.deepEqual(after.players[0].board.map(unit=>unit.cardId),['wolf','wisp','wolf']);
  assert.deepEqual(after.players[1].board,[]);
  const spell=hold(s,'flame_sphere');
  assert.equal(pointerDrop(spell,0,catalog,pointer,{field:true,enemyBoard:true},0).intent,null);
});

test('turn-ready requires exhaustion of free cards, attacks and hero power, not merely zero mana',()=>{
  const s=ready('mage'),v=getPlayerView(s,0);v.self.hand=[];v.self.mana=0;v.self.board=[];v.self.heroPowerUsed=true;
  assert.equal(hasRemainingBattleAction(v,0,catalog),false);
  v.self.hand=[{instanceId:'free',cardId:'wisp'}];assert.equal(hasRemainingBattleAction(v,0,catalog),true);
  v.self.hand=[];v.self.board=[{instanceId:'attacker',cardId:'wolf',attack:3,health:2,maxHealth:2,attacksRemaining:1}];assert.equal(hasRemainingBattleAction(v,0,catalog),true);
  v.self.board[0].attacksRemaining=0;assert.equal(hasRemainingBattleAction(v,0,catalog),false);
  v.self.mana=2;v.self.heroPowerUsed=false;assert.equal(hasRemainingBattleAction(v,0,catalog),true);
});
