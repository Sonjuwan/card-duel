import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intentFromSource,advanceGesture,touchDropLocations} from '../src/touch-gesture.ts';
import type {TouchGesture} from '../src/touch-gesture.ts';
const g:TouchGesture={pointerId:1,originX:120,originY:600,drag:{intent:{kind:'card',id:'a'},revision:4},phase:'pending'};
test('touch tap selects, vertical swipes drag, horizontal hand scrolling never drops a card',()=>{
  assert.equal(advanceGesture(g,122,597,4)?.phase,'pending');
  assert.equal(advanceGesture(g,125,570,4)?.phase,'dragging');
  const scroll=advanceGesture(g,160,597,4)!;assert.equal(scroll.phase,'scrolling');assert.equal(advanceGesture(scroll,180,450,4)?.phase,'scrolling');
  assert.equal(advanceGesture(g,120,570,5),null);
  const attack={...g,drag:{intent:{kind:'attack' as const,id:'m'},revision:4}};assert.equal(advanceGesture(attack,160,597,4)?.phase,'dragging');
});
test('only public card and attacker sources produce drag intents',()=>{
  assert.deepEqual(intentFromSource('card:abc'),{kind:'card',id:'abc'});assert.deepEqual(intentFromSource('minion:xyz'),{kind:'attack',id:'xyz'});assert.deepEqual(intentFromSource('hero'),{kind:'heroAttack'});
  for(const source of [undefined,'power','card:','minion:','enemy'])assert.equal(intentFromSource(source),null);
});
test('touch target semantics preserve seat, exact placement and hand/outside rejection',()=>{
  assert.deepEqual(touchDropLocations({hero:'enemy',field:true},0,4,false),[{kind:'target',target:{kind:'hero',player:1},position:4}]);
  assert.deepEqual(touchDropLocations({hero:'self'},1,0,false),[{kind:'target',target:{kind:'hero',player:1},position:0}]);
  assert.deepEqual(touchDropLocations({minionId:'m',ownBoard:true,slot:2},0,4,false),[{kind:'target',target:{kind:'minion',instanceId:'m'},position:4},{kind:'board',position:2}]);
  assert.deepEqual(touchDropLocations({hand:true,field:true},0,2,true),[]);assert.deepEqual(touchDropLocations({field:true},0,2,false),[]);assert.deepEqual(touchDropLocations({},0,2,true),[]);assert.deepEqual(touchDropLocations({field:true},0,2,true),[{kind:'board',position:2}]);
});
