import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck} from '../../../packages/engine/src/index.ts';
import {BattleIntentQueue,validateBattleIntent} from '../src/battle-intents.ts';

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
