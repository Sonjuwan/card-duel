import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck} from '../../../packages/engine/src/index.ts';
import type {Action,BattleVisualEvent,GameState,PlayerId,Target} from '../../../packages/engine/src/index.ts';
import {battleAnimationTiming,scaledBattleTiming} from '../../../packages/protocol.ts';
import type {BattleAnimation,RoomView} from '../../../packages/protocol.ts';
import {describeAcceptedAction} from '../../server/battle-animation.ts';
import {animationTheme,impactChanges} from '../src/battle-fx-model.ts';
import {nextPlayback,PlaybackTimeline} from '../src/battle-playback.ts';
import {fixture,kinds,scenarioAction} from './animation-preview-model.ts';
import {resolveDrop,selectHandCard,targetAction,targetsFor} from '../src/battle-actions.ts';
const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
const catalog=createCatalog(JSON.parse(readFileSync('data/cards/'+active.file,'utf8')));
function ready(){
  let s=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'warrior')],{seed:19,firstPlayer:0});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[0].mana=10;s.players[0].maxMana=10;
  return s;
}
function room(s:GameState,seat:PlayerId,animation?:BattleAnimation):RoomView{
  return {code:'TESTFX',seat,mode:'human',status:s.phase==='finished'?'finished':'playing',opponentConnected:true,state:getPlayerView(s,seat),animation};
}
function action(s:GameState,a:Action,actor:PlayerId=0){const after=applyAction(s,actor,a);const animation=describeAcceptedAction(s,after,actor,a);assert.ok(animation);return{after,animation};}
const enemyHero:Target={kind:'hero',player:1};
test('a card click only selects or deselects, even for free minions and targeted spells; only a drop plays',()=>{
  const s=ready();s.players[0].hand=[{instanceId:'cheap',cardId:'wisp'},{instanceId:'spell',cardId:'flame_sphere'}];
  const v=getPlayerView(s,0),held=selectHandCard(v,0,catalog,'cheap',null);assert.deepEqual(held,{kind:'held',id:'cheap'});
  assert.equal(selectHandCard(v,0,catalog,'cheap',held),null);assert.deepEqual(targetsFor(v,0,catalog,held),[]);
  const spell=selectHandCard(v,0,catalog,'spell',held);assert.deepEqual(spell,{kind:'held',id:'spell'});
  assert.equal(targetAction(v,0,catalog,spell,enemyHero),null);assert.equal(s.players[0].hand.length,2);
  const drag=resolveDrop(v,0,catalog,{revision:s.revision,intent:{kind:'card',id:'cheap'}},{kind:'board',position:0});
  assert.ok(drag?.action);assert.equal(drag.action.type,'playCard');assert.equal(applyAction(s,0,drag.action).players[0].board.length,1);
  assert.equal(selectHandCard(v,1,catalog,'cheap',null),null);
});
test('accepted attack metadata is public, mirrored on both seats, and uses exact normalized target',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'public-wolf',attack:5,health:2,maxHealth:2,attacksRemaining:1}];
  const {after,animation}=action(s,{type:'attack',attackerId:'public-wolf',target:{kind:'hero'}});
  assert.deepEqual(animation,{revision:after.revision,actor:0,kind:'attack',attackerId:'public-wolf',target:enemyHero,heavy:true});
  const own=nextPlayback(room(s,0),room(after,0,animation))!,opponent=nextPlayback(room(s,1),room(after,1,animation))!;
  assert.equal(own.duration,1200);assert.equal(own.impact,510);assert.equal(opponent.impact,own.impact);
  assert.deepEqual(impactChanges(own.before.state!,own.after.state!,0),[{side:1,target:enemyHero,kind:'damage',amount:5}]);
  assert.deepEqual(impactChanges(opponent.before.state!,opponent.after.state!,1),[{side:1,target:enemyHero,kind:'damage',amount:5}]);
});
test('optional solo animation speed changes the playback timing, not the authoritative revision',()=>{
  const s=ready(),{after,animation}=action(s,{type:'endTurn'}),before=room(s,0),next=room(after,0,animation);
  const normal=nextPlayback(before,next)!,fast=nextPlayback(before,{...next,animationSpeed:'fast'})!;
  assert.equal(fast.duration,Math.round(normal.duration*.55));assert.equal(fast.impact,Math.round(normal.impact*.55));assert.deepEqual(fast.after.state,normal.after.state);
  assert.equal(nextPlayback(before,{...next,animationSpeed:'instant'}),null);assert.deepEqual(scaledBattleTiming(animation,'instant'),{duration:0,impact:0});
});
test('hidden secret and hand identifiers never appear in accepted action animation',()=>{
  const s=ready();s.players[0].hand=[{instanceId:'private-secret-123',cardId:'ice_block'}];
  const {animation}=action(s,{type:'playCard',instanceId:'private-secret-123'});
  assert.deepEqual(Object.keys(animation).sort(),['actor','kind','revision']);assert.equal(animation.kind,'secret');
  assert.doesNotMatch(JSON.stringify(animation),/ice_block|private-secret/);
  s.players[0].hand=[{instanceId:'private-spell-456',cardId:'flame_sphere'}];
  const spell=action(s,{type:'playCard',instanceId:'private-spell-456',target:enemyHero}).animation;
  assert.equal(spell.cardId,'flame_sphere');assert.doesNotMatch(JSON.stringify(spell),/private-spell/);
});
test('snapshot comparison identifies armor, simultaneous damage, removal, heal, summon, freeze and shield changes',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'alpha',attack:3,health:2,maxHealth:2,attacksRemaining:1,keywords:['divineShield']}];
  s.players[1].board=[{cardId:'wisp',instanceId:'beta',attack:1,health:1,maxHealth:1,attacksRemaining:1}];
  const before=getPlayerView(s,0),after=structuredClone(before);after.opponent.armor=2;after.opponent.board=[];after.self.health--;
  after.self.board[0].keywords=[];after.self.board[0].attack=4;after.self.board[0].frozenThroughTurn=2;
  after.self.board.push({cardId:'wisp',instanceId:'summoned',attack:1,health:1,maxHealth:1,attacksRemaining:0});
  const result=impactChanges(before,after,0);
  assert.deepEqual(result.map(e=>e.kind).sort(),['buff','damage','freeze','leave','shield','shield','summon'].sort());
  const heal=structuredClone(after);heal.self.health++;assert.deepEqual(impactChanges(after,heal,0).map(e=>e.kind),['heal']);
});
test('duplication, skipped revisions, initial connection and mismatched events cannot replay stale actions',()=>{
  const s=ready(),{after,animation}=action(s,{type:'endTurn'});
  const before=room(s,0),next=room(after,0,animation);
  assert.ok(nextPlayback(before,next));assert.equal(nextPlayback(next,next),null);assert.equal(nextPlayback(before,{...next,animation:undefined}),null);
  assert.equal(nextPlayback(before,{...next,animation:{...animation,revision:animation.revision-1}}),null);
  assert.equal(nextPlayback({...before,state:null},next),null);
  assert.equal(nextPlayback(before,{...next,state:{...next.state!,revision:next.state!.revision+2}}),null);
  assert.equal(nextPlayback(before,{...next,code:'OTHER1'}),null);
});
test('every action timing has a visible buildup and recovery; heavy spells last 1.9 seconds',()=>{
  for(const kind of ['attack','heroAttack','summon','spell','weapon','secret','coin','power','turn','choice'] as const){
    const a:BattleAnimation={kind,actor:0,revision:5};const t=battleAnimationTiming(a);assert.ok(t.duration>=650&&t.impact>0&&t.impact<t.duration);
    assert.ok(battleAnimationTiming({...a,heavy:true}).duration>=t.duration);
  }
  assert.deepEqual(battleAnimationTiming({kind:'spell',actor:0,revision:9,heavy:true}),{duration:1900,impact:850});
});
test('all spells have a sound and particle theme, including fire, frost and healing',()=>{
  const all=Object.values(catalog).filter(c=>c.kind==='spell');
  const theme=(id:string)=>animationTheme({kind:'spell',actor:0,revision:1,cardId:id},catalog[id]);
  assert.equal(theme('flame_sphere'),'fire');assert.equal(theme('ice_shard'),'ice');
  assert.equal(theme('pyroblast'),'fire');
  const themes=new Set(all.map(c=>theme(c.id)));assert.ok(themes.size>=6,JSON.stringify([...themes]));
  const healing=all.find(c=>c.effects?.some(e=>e.kind==='heal')&&c.class==='priest');assert.ok(healing);assert.equal(theme(healing.id),'holy');
  assert.equal(animationTheme({kind:'secret',actor:1,revision:1},undefined),'shadow');
});
test('hero attack produces a distinct cue and the correct damage on the public snapshot',()=>{
  const s=ready();s.players[0].weapon={attack:3,durability:2};s.players[0].heroAttacksRemaining=1;
  const {after,animation}=action(s,{type:'heroAttack',target:enemyHero});
  assert.equal(animation.kind,'heroAttack');assert.equal(battleAnimationTiming(animation).duration,1250);
  assert.equal(after.players[1].health,27);
});
test('actual engine trace preserves overkill and retaliation, including dead characters, without changing rules',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:5,health:2,maxHealth:2,attacksRemaining:1}];
  s.players[1].board=[{cardId:'wolf',instanceId:'defender',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
  const a:Action={type:'attack',attackerId:'attacker',target:{kind:'minion',instanceId:'defender'}},events:BattleVisualEvent[]=[];
  const after=applyAction(s,0,a,{visualEvent:e=>events.push(e)});
  assert.deepEqual(after,applyAction(s,0,a));
  const trace=describeAcceptedAction(s,after,0,a,events)!;
  assert.equal(trace.blocked,undefined);assert.equal(trace.events?.filter(e=>e.kind==='death').length,2);
  const impacts=impactChanges(getPlayerView(s,0),getPlayerView(after,0),0,trace.events);
  assert.deepEqual(impacts.filter(e=>e.kind==='damage').map(e=>e.amount).sort(),[3,5]);
  assert.equal(impacts.filter(e=>e.kind==='leave'&&e.death).length,2);
});
test('a triggered secret is disclosed only at trigger time; attempted attack uses actual combat target or blocked indication',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
  const secret=Object.values(catalog).find(c=>c.kind==='secret'&&c.trigger==='enemyMinionAttack'&&c.effects.some(e=>e.kind==='cancelEvent'));
  // The classic freezing trap bounces the attacker. Test any applicable
  // canceling minion attack secret without relying on a display name.
  assert.ok(secret);
  s.players[1].secrets=[{cardId:secret.id,instanceId:'hidden-secret-id'}];
  const a:Action={type:'attack',attackerId:'attacker',target:enemyHero},events:BattleVisualEvent[]=[];
  const after=applyAction(s,0,a,{visualEvent:e=>events.push(e)});
  const trace=describeAcceptedAction(s,after,0,a,events)!;
  assert.ok(trace.events?.some(e=>e.kind==='secretTriggered'&&e.cardId===secret.id));assert.equal(trace.blocked,true);
  assert.doesNotMatch(JSON.stringify(trace),/hidden-secret-id/);
});
test('playback waits until impact, serializes rapid opponent updates, and ignores duplicate acknowledgements',()=>{
  const s=ready(),first=action(s,{type:'endTurn'}),second=action(first.after,{type:'endTurn'},1);
  const before=room(s,0),one=room(first.after,0,first.animation),two=room(second.after,0,second.animation);
  let time=0,id=0,visible=s.revision;
  const timers=new Map<ReturnType<typeof setTimeout>,{at:number;fn:()=>void}>(),cues:number[]=[];
  const clock={
    schedule:(fn:()=>void,ms:number)=>{const handle=++id as unknown as ReturnType<typeof setTimeout>;timers.set(handle,{at:time+ms,fn});return handle;},
    cancel:(handle:ReturnType<typeof setTimeout>)=>{timers.delete(handle);}
  };
  const advance=(ms:number)=>{const end=time+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;};
  const timeline=new PlaybackTimeline(before,v=>{visible=v.state!.revision;},cue=>{if(cue)cues.push(cue.animation.revision);},clock);
  timeline.receive(one,true);timeline.receive(one,true);timeline.receive(two,true);
  assert.deepEqual(cues,[first.after.revision]);assert.equal(visible,s.revision);
  advance(179);assert.equal(visible,s.revision);advance(1);assert.equal(visible,first.after.revision);
  advance(620);assert.deepEqual(cues,[first.after.revision,second.after.revision]);assert.equal(visible,first.after.revision);
  advance(180);assert.equal(visible,second.after.revision);
  timeline.receive(two,false);assert.equal(timers.size,0);timeline.dispose();
});
test('all 22 offline animation demonstrations use legal actions and produce matching accepted cues',()=>{
  for(const actor of [0,1] as const)for(const kind of kinds){
    const before=fixture(catalog,actor),a=scenarioAction(before,actor,kind),trace:BattleVisualEvent[]=[];
    const after=applyAction(before,actor,a,{visualEvent:e=>trace.push(e)}),animation=describeAcceptedAction(before,after,actor,a,trace);
    assert.ok(animation,`${actor} ${kind}`);assert.equal(animation.actor,actor);
    assert.ok(nextPlayback(room(before,0),room(after,0,animation)),kind);
  }
});
