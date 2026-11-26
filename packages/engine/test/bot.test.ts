import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, createCatalog, createGame, getPlayerView, HERO_CLASSES, rankBotActions, RuleError, starterDeck, BOT_DIFFICULTIES } from '../src/index.ts';
import type { GameState, Minion, PlayerId } from '../src/index.ts';
const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.8.0.json',import.meta.url),'utf8')));
function ready():GameState{
  let s=createGame(catalog,[starterDeck(catalog,'warrior'),starterDeck(catalog,'mage')],{seed:42,firstPlayer:1});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});
  s.players[1].hand=[];s.players[1].mana=0;return s;
}
function minion(id:string,attack:number,health:number):Minion{return{instanceId:id,cardId:'recruit',attack,health,maxHealth:health,attacksRemaining:1,originalOwner:1};}
test('AI chooses immediate lethal, does not mutate its input',()=>{
  const s=ready();s.players[0].health=3;s.players[1].board=[minion('lethal',4,4)];
  const view=getPlayerView(s,1),before=structuredClone(view),ranked=rankBotActions(view,s.catalog,1);
  assert.deepEqual(view,before);assert.equal(ranked[0].type,'attack');
  assert.equal(applyAction(s,1,ranked[0]).winner,1);
});
test('AI chooses a favorable trade and does not attack through taunt',()=>{
  const s=ready();s.players[1].board=[minion('attacker',5,7)];s.players[0].board=[{...minion('guard',2,3),originalOwner:0,keywords:['taunt']}];
  const [action]=rankBotActions(getPlayerView(s,1),s.catalog,1);
  assert.deepEqual(action,{type:'attack',attackerId:'attacker',target:{kind:'minion',instanceId:'guard'}});
  const next=applyAction(s,1,action);assert.equal(next.players[0].board.length,0);assert.equal(next.players[1].board[0].health,5);
});
test('AI ignores hidden enemy hand, deck order and server RNG; ends an empty turn',()=>{
  const s=ready(),other=structuredClone(s);other.players[0].hand.reverse();other.players[0].deck.reverse();other.rng=999;
  assert.deepEqual(getPlayerView(s,1),getPlayerView(other,1));
  for(const difficulty of BOT_DIFFICULTIES)assert.deepEqual(rankBotActions(getPlayerView(s,1),s.catalog,1,difficulty),rankBotActions(getPlayerView(other,1),other.catalog,1,difficulty));
  assert.deepEqual(rankBotActions(getPlayerView(s,1),s.catalog,1),[{type:'endTurn'}]);
  assert.deepEqual(rankBotActions(getPlayerView(s,0),s.catalog,0),[]);
});
test('beginner sometimes misses lethal; normal and expert always take visible immediate lethal',()=>{
  const s=ready();s.players[0].health=3;s.players[1].board=[minion('lethal',4,4)];
  let passed=0;
  for(let i=0;i<40;i++){
    s.revision=i;
    const view=getPlayerView(s,1);
    if(rankBotActions(view,s.catalog,1,1)[0].type==='endTurn')passed++;
    for(const difficulty of [3,4,5] as const)assert.equal(applyAction(s,1,rankBotActions(view,s.catalog,1,difficulty)[0]).winner,1);
  }
  assert.ok(passed>0&&passed<40);
});
test('easy varies among beneficial actions while normal selects the best immediate one',()=>{
  const s=ready();s.players[1].board=[minion('big',5,6),minion('small',2,4)];
  let pickedSmall=0;
  for(let i=0;i<40;i++){
    s.revision=i;const view=getPlayerView(s,1),easy=rankBotActions(view,s.catalog,1,2)[0],normal=rankBotActions(view,s.catalog,1,3)[0];
    assert.ok(easy.type==='attack');assert.equal(normal.type==='attack'?normal.attackerId:'','big');
    if(easy.attackerId==='small')pickedSmall++;
  }
  assert.ok(pickedSmall>0&&pickedSmall<40);
});
test('hard examines alternative placements for adjacency effects',()=>{
  const s=ready();s.players[1].mana=3;s.players[1].hand=[{instanceId:'captain',cardId:'banner_captain'}];
  s.players[1].board=[minion('a',1,2),minion('b',1,2),minion('c',1,2)].map(m=>({...m,attacksRemaining:0}));
  const view=getPlayerView(s,1),normal=rankBotActions(view,s.catalog,1,3),hard=rankBotActions(view,s.catalog,1,4);
  assert.equal(normal.filter(a=>a.type==='playCard').length,1);
  const placements=hard.filter(a=>a.type==='playCard');
  assert.equal(placements.length,4);assert.ok(placements[0].position===1||placements[0].position===2);
  const after=applyAction(s,1,placements[0]);assert.equal(after.players[1].board.filter(m=>m.cardId==='recruit'&&m.attack===2).length,2);
});
test('expert searches two moves to clear a guard and preserve lethal damage',()=>{
  const s=ready();s.players[0].health=5;
  s.players[1].board=[minion('big',5,6),minion('small',3,4)];
  s.players[0].board=[{...minion('guard',1,3),originalOwner:0,keywords:['taunt']}];
  const view=getPlayerView(s,1);
  assert.deepEqual(rankBotActions(view,s.catalog,1,4)[0],{type:'attack',attackerId:'big',target:{kind:'minion',instanceId:'guard'}});
  const first=rankBotActions(view,s.catalog,1,5)[0];
  assert.deepEqual(first,{type:'attack',attackerId:'small',target:{kind:'minion',instanceId:'guard'}});
  const after=applyAction(s,1,first);
  assert.equal(applyAction(after,1,rankBotActions(getPlayerView(after,1),s.catalog,1,5)[0]).winner,1);
});
test('level 25 finds three-attack lethal through taunt',()=>{
  const s=ready();s.players[0].health=5;
  s.players[0].board=[{...minion('guard',1,4),originalOwner:0,keywords:['taunt']}];
  s.players[1].board=[minion('big',5,6),minion('a',2,3),minion('b',2,3)];
  let current=s;
  for(let i=0;i<3;i++)current=applyAction(current,1,rankBotActions(getPlayerView(current,1),current.catalog,1,25)[0]);
  assert.equal(current.winner,1);
});
test('adaptive policy sees secret count but never the actual enemy secret or server RNG',()=>{
  const active=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8')));
  let s=createGame(active,[starterDeck(active,'mage'),starterDeck(active,'mage')],{seed:926,firstPlayer:1});s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});
  s.players[0].secrets=[{cardId:'ice_block',instanceId:'private-a'}];s.players[0].health=5;
  s.players[1].hand=[{cardId:'flame_sphere',instanceId:'spell'}];s.players[1].mana=6;s.players[1].board=[minion('ready',5,6)];
  const other=structuredClone(s);other.players[0].secrets=[{cardId:'mirror_entity',instanceId:'private-b'}];other.rng=123456;
  const a=getPlayerView(s,1),b=getPlayerView(other,1);assert.deepEqual(a,b);
  const results=rankBotActions(a,s.catalog,1,25,{policyVersion:2});assert.deepEqual(results,rankBotActions(b,other.catalog,1,25,{policyVersion:2}));assert.deepEqual(rankBotActions(a,s.catalog,1,25),results);assert.ok(results.length);
  assert.ok(results.some(x=>x.type!=='endTurn'));
  const experimental=rankBotActions(a,s.catalog,1,25,{policyVersion:3});assert.deepEqual(experimental,rankBotActions(b,other.catalog,1,25,{policyVersion:3}));assert.ok(experimental.length);
  assert.ok(experimental.some(action=>{try{applyAction(s,1,action);return true;}catch{return false;}}));
});
test('every difficulty finishes a full match using legal actions',{timeout:120000},()=>{
  for(const difficulty of BOT_DIFFICULTIES){
    let s=createGame(catalog,[starterDeck(catalog,'mage'),starterDeck(catalog,'hunter')],{seed:2014+difficulty});
    for(let step=0;step<600&&s.phase!=='finished';step++){
      const actor:PlayerId=s.phase==='mulligan'?(s.players[0].mulliganDone?1:0):s.activePlayer;
      const actions=rankBotActions(getPlayerView(s,actor),s.catalog,actor,actor===0?difficulty:3,{nodeLimit:36,responseLimit:0});
      let after:GameState|undefined;
      for(const action of actions){try{after=applyAction(s,actor,action);break;}catch(e){if(!(e instanceof RuleError))throw e;}}
      assert.ok(after);s=after;
      for(const p of s.players)assert.ok(p.board.length<=7&&p.hand.length<=10&&p.mana>=0&&p.mana<=10&&p.health>=0&&p.health<=30);
    }
    assert.equal(s.phase,'finished',`difficulty ${difficulty}`);
  }
});
test('nine full AI versus AI games finish, exercising all hero classes',{timeout:120000},()=>{
  let attacks=0,plays=0,powers=0;
  for(let i=0;i<HERO_CLASSES.length;i++){
    let s=createGame(catalog,[starterDeck(catalog,HERO_CLASSES[i]),starterDeck(catalog,HERO_CLASSES[(i+4)%9])],{seed:2014+i});
    for(let step=0;step<600&&s.phase!=='finished';step++){
      const actor:PlayerId=s.phase==='mulligan'?(s.players[0].mulliganDone?1:0):s.activePlayer;
      const actions=rankBotActions(getPlayerView(s,actor),s.catalog,actor);let next:GameState|undefined;
      for(const action of actions){try{next=applyAction(s,actor,action);if(action.type==='attack'||action.type==='heroAttack')attacks++;if(action.type==='playCard')plays++;if(action.type==='heroPower')powers++;break;}catch(e){if(!(e instanceof RuleError))throw e;}}
      assert.ok(next,'AI must make progress');s=next;
      for(const p of s.players){assert.ok(p.board.length<=7&&p.hand.length<=10&&p.mana<=10&&p.mana>=0);assert.ok(p.health>=0&&p.health<=30);}
    }
    assert.equal(s.phase,'finished',HERO_CLASSES[i]);
  }
  assert.ok(plays>30&&attacks>30&&powers>5);
});


test('opponent sampling cache preserves fixed-node ranking and never shares mutable catalog definitions',()=>{
  const s=ready();
  s.players[0].board=[{...minion('guard',2,4),originalOwner:0,keywords:['taunt']}];
  s.players[1].board=[minion('attacker',3,5),minion('other',2,2)];
  s.players[1].mana=5;
  s.players[1].hand=[{instanceId:'known',cardId:'recruit'}];
  const view=getPlayerView(s,1),original=structuredClone(view);
  for(const policyVersion of [1,2,3] as const){
    const settings={policyVersion,nodeLimit:100,responseLimit:3};
    const cold=rankBotActions(view,structuredClone(s.catalog),1,25,settings);
    const first=rankBotActions(view,s.catalog,1,25,settings);
    const warm=rankBotActions(view,s.catalog,1,25,settings);
    assert.deepEqual(warm,first);
    assert.deepEqual(first,cold);
    assert.ok(first.length);
  }
  assert.deepEqual(view,original);
});
