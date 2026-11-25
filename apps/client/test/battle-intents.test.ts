import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck} from '../../../packages/engine/src/index.ts';
import {BattleIntentQueue,projectBattleIntents,validateBattleIntent} from '../src/battle-intents.ts';

const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.21.0.json',import.meta.url),'utf8')));
function setup(){
  let state=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'warrior')],{seed:123,firstPlayer:0});
  state=applyAction(state,0,{type:'mulligan',replace:[]});
  state=applyAction(state,1,{type:'mulligan',replace:[]});
  return state;
}
test('reservations are bounded, deduplicated and released in FIFO order',()=>{
  const queue=new BattleIntentQueue(3);
  const a={type:'playCard',instanceId:'a'} as const;
  const b={type:'playCard',instanceId:'b'} as const;
  const c={type:'endTurn'} as const;
  assert.equal(queue.offer(a),true);
  assert.equal(queue.offer(a),false);
  assert.equal(queue.offer(b),true);
  assert.equal(queue.offer(c),true);
  assert.equal(queue.offer({type:'heroPower'}),false);
  assert.deepEqual(queue.take(),a);
  assert.equal(queue.offer(a),false);
  queue.acknowledge();
  assert.deepEqual(queue.take(),b);
  queue.acknowledge();
  assert.deepEqual(queue.take(),c);
  queue.clear();
  assert.equal(queue.take(),undefined);
});
test('cancel affects pending reservations and leaves the sent action in flight',()=>{
  const queue=new BattleIntentQueue();
  queue.offer({type:'heroPower'});
  queue.offer({type:'endTurn'});
  queue.take();
  queue.cancelPending();
  assert.equal(queue.pending.length,0);
  assert.equal(queue.inFlight?.type,'heroPower');
  assert.equal(queue.offer({type:'heroPower'}),false);
  queue.acknowledge();
  assert.equal(queue.offer({type:'heroPower'}),true);
});
test('new authority can reject spent mana, a missing instance, a dead target and a pending choice',()=>{
  const state=setup();
  const view=getPlayerView(state,0);
  const power={type:'heroPower',target:{kind:'hero',player:1}} as const;
  assert.match(validateBattleIntent(view,0,catalog,power)??'',/마나/);
  view.self.mana=2;
  assert.equal(validateBattleIntent(view,0,catalog,power),undefined);
  assert.ok(validateBattleIntent(view,0,catalog,{...power,target:{kind:'minion',instanceId:'gone'}}));
  assert.ok(validateBattleIntent(view,0,catalog,{type:'playCard',instanceId:'gone'}));
  assert.equal(validateBattleIntent(view,0,catalog,{type:'endTurn'}),undefined);
  assert.ok(validateBattleIntent({...view,choicePending:true},0,catalog,{type:'endTurn'}));
  assert.ok(validateBattleIntent({...view,activePlayer:1},0,catalog,{type:'endTurn'}));
});

test('projected reservations reduce public mana and capacity without modifying the accepted frame',()=>{
  const state=setup(),view=getPlayerView(state,0);
  view.self.mana=5;
  view.self.hand=[{instanceId:'one',cardId:'wolf'},{instanceId:'two',cardId:'wolf'}];
  view.self.handCount=2;
  view.self.board=Array.from({length:6},(_,index)=>({instanceId:'unit'+index,cardId:'wolf',attack:2,health:2,maxHealth:2,attacksRemaining:1}));
  const action={type:'playCard',instanceId:'one',position:0} as const;
  const projected=projectBattleIntents(view,0,catalog,[action]);
  assert.equal(projected.self.mana,5-catalog.wolf.cost);
  assert.equal(projected.self.board.length,7);
  assert.deepEqual(projected.self.hand.map(card=>card.instanceId),['two']);
  assert.ok(validateBattleIntent(projected,0,catalog,{type:'playCard',instanceId:'two'}));
  assert.equal(view.self.board.length,6);
  assert.equal(view.self.mana,5);
  assert.equal(projectBattleIntents(view,0,catalog,[]),view);
});

test('windfury may reserve two attacks and spent attack counters recover on cancellation',()=>{
  const view=getPlayerView(setup(),0);
  view.self.board=[{instanceId:'wind',cardId:'wolf',attack:2,health:2,maxHealth:2,attacksRemaining:2,keywords:['windfury']}];
  const attack={type:'attack',attackerId:'wind',target:{kind:'hero',player:1}} as const;
  const queue=new BattleIntentQueue();
  assert.ok(queue.offer(attack,true));
  let projected=projectBattleIntents(view,0,catalog,queue.pending);
  assert.equal(projected.self.board[0].attacksRemaining,1);
  assert.equal(validateBattleIntent(projected,0,catalog,attack),undefined);
  assert.ok(queue.offer(attack,true));
  projected=projectBattleIntents(view,0,catalog,queue.pending);
  assert.ok(validateBattleIntent(projected,0,catalog,attack));
  queue.cancelPending();
  assert.equal(projectBattleIntents(view,0,catalog,queue.pending).self.board[0].attacksRemaining,2);
});
