import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intentFromSource,advanceGesture,finishGesture,interruptTouch,isCaptureHandoff,canPanBoard,boardEdgePanDelta,nearestBoardSlot,nearestVisibleBoardSlot,nearestTouchTarget,touchDropLocations,dropFeedbackText} from '../src/touch-gesture.ts';
import type {TouchGesture} from '../src/touch-gesture.ts';
const g:TouchGesture={pointerId:1,originX:120,originY:600,drag:{intent:{kind:'card',id:'a'},revision:4},phase:'pending'};
test('implicit touch capture transfers to the arena without cancelling a live drag',()=>{
  const drag=advanceGesture(g,125,570,4)!;
  assert.equal(isCaptureHandoff('lostpointercapture',true,true),true);
  assert.equal(finishGesture(drag,4,true),'drop');
  assert.equal(isCaptureHandoff('lostpointercapture',false,true),false);
  assert.equal(isCaptureHandoff('lostpointercapture',true,false),false);
  assert.equal(isCaptureHandoff('pointercancel',true,true),false);
});
test('touch tap selects, vertical swipes drag, horizontal hand scrolling never drops a card',()=>{
  assert.equal(advanceGesture(g,122,597,4)?.phase,'pending');
  assert.equal(advanceGesture(g,125,570,4)?.phase,'dragging');
  const scroll=advanceGesture(g,160,597,4)!;assert.equal(scroll.phase,'scrolling');assert.equal(advanceGesture(scroll,180,450,4)?.phase,'scrolling');
  assert.equal(advanceGesture(g,120,570,5),null);
  const attack={...g,drag:{intent:{kind:'attack' as const,id:'m'},revision:4}};assert.equal(advanceGesture(attack,160,597,4)?.phase,'dragging');
});
test('scrollable crowded boards distinguish natural sideways panning from vertical minion attacks',()=>{
  assert.equal(canPanBoard('auto',320,480),true);assert.equal(canPanBoard('scroll',320,321),false);assert.equal(canPanBoard('hidden',320,480),false);assert.equal(canPanBoard('visible',320,480),false);assert.equal(canPanBoard('auto',0,480),false);
  const attack:TouchGesture={...g,drag:{intent:{kind:'attack',id:'m'},revision:4},canPanBoard:true};
  const pan=advanceGesture(attack,160,597,4)!;assert.equal(pan.phase,'scrolling');assert.equal(advanceGesture(pan,180,450,4)?.phase,'scrolling');assert.equal(finishGesture(pan,4,true),'cancel');
  assert.equal(advanceGesture(attack,130,560,4)?.phase,'dragging');assert.equal(advanceGesture({...attack,canPanBoard:false},160,597,4)?.phase,'dragging');
  assert.equal(advanceGesture({...attack,drag:{intent:{kind:'heroAttack'},revision:4}},160,597,4)?.phase,'dragging');
});
test('held-minion edge pan is bounded, proportional and rejects hidden or center positions',()=>{
  assert.ok(boardEdgePanDelta(10,10,300,50,200)<0);assert.ok(boardEdgePanDelta(299,10,300,50,200)>0);
  assert.ok(boardEdgePanDelta(299,10,300,50,200)>boardEdgePanDelta(280,10,300,50,200));
  for(const x of [0,150,301,NaN])assert.equal(boardEdgePanDelta(x,10,300,50,200),0);
  assert.equal(boardEdgePanDelta(10,10,300,0,200),0);assert.equal(boardEdgePanDelta(300,10,300,200,200),0);
  assert.equal(boardEdgePanDelta(10,10,300,1,200),-1);assert.equal(boardEdgePanDelta(300,10,300,199,200),1);
  assert.equal(boardEdgePanDelta(300,10,300,50,200,10000),boardEdgePanDelta(300,10,300,50,200,40));
});
test('only public card and attacker sources produce drag intents',()=>{
  assert.deepEqual(intentFromSource('card:abc'),{kind:'card',id:'abc'});assert.deepEqual(intentFromSource('minion:xyz'),{kind:'attack',id:'xyz'});assert.deepEqual(intentFromSource('hero'),{kind:'heroAttack'});
  assert.deepEqual(intentFromSource('power'),{kind:'power'});
  for(const source of [undefined,'card:','minion:','enemy'])assert.equal(intentFromSource(source),null);
});
test('completed gesture distinguishes tap, drag, scrolling and stale or inactive pointer',()=>{
  const drag=advanceGesture(g,125,570,4)!,scroll=advanceGesture(g,160,597,4)!;
  assert.equal(finishGesture(g,4,true),'tap');assert.equal(finishGesture(drag,4,true),'drop');assert.equal(finishGesture(scroll,4,true),'cancel');
  for(const gesture of [g,drag,scroll]){assert.equal(finishGesture(gesture,5,true),'cancel');assert.equal(finishGesture(gesture,4,false),'cancel');}
});
test('interrupted gestures retain delayed click guards across repeated focus and visibility events',()=>{
  const dragged=advanceGesture(g,120,570,4)!;
  const guard=interruptTouch(dragged,null,0,1000);assert.deepEqual(guard,{cancelledPointer:1,suppressUntil:1250});
  assert.deepEqual(interruptTouch(null,guard.cancelledPointer,guard.suppressUntil,1001),guard);
  assert.deepEqual(interruptTouch(null,null,0,1002),{cancelledPointer:null,suppressUntil:0});
  assert.deepEqual(interruptTouch({...g,pointerId:7},null,1400,1003),{cancelledPointer:7,suppressUntil:1400});
});
test('touch target semantics preserve seat, exact placement and hand/outside rejection',()=>{
  assert.deepEqual(touchDropLocations({hero:'enemy',field:true},0,4,false),[{kind:'target',target:{kind:'hero',player:1},position:4}]);
  assert.deepEqual(touchDropLocations({hero:'self'},1,0,false),[{kind:'target',target:{kind:'hero',player:1},position:0}]);
  assert.deepEqual(touchDropLocations({minionId:'m',ownBoard:true,slot:2},0,4,false),[{kind:'target',target:{kind:'minion',instanceId:'m'},position:2},{kind:'board',position:2}]);
  assert.deepEqual(touchDropLocations({hand:true,field:true},0,2,true),[]);assert.deepEqual(touchDropLocations({field:true},0,2,false),[]);assert.deepEqual(touchDropLocations({},0,2,true),[]);assert.deepEqual(touchDropLocations({field:true},0,2,true),[{kind:'board',position:2}]);
});
test('touch placement snaps to the nearest stable insertion slot including outer edges',()=>{
  const slots=[{position:0,x:40},{position:1,x:100},{position:2,x:160}];
  for(const [x,position] of [[0,0],[65,0],[70,0],[71,1],[129,1],[140,2],[300,2]])assert.equal(nearestBoardSlot(x,slots),position);
  assert.equal(nearestBoardSlot(70,[...slots].reverse()),0);
  assert.equal(nearestBoardSlot(100,[]),undefined);
  assert.equal(nearestBoardSlot(NaN,slots),undefined);
  assert.equal(nearestBoardSlot(100,[{position:-1,x:100},{position:1,x:NaN}]),undefined);
});
test('placement ignores fully clipped gaps and uses the visible part of partially clipped gaps',()=>{
  const slots=[{position:0,left:0,right:8},{position:1,left:28,right:36},{position:2,left:64,right:72},{position:3,left:94,right:102}];
  assert.equal(nearestVisibleBoardSlot(10,{left:10,right:80},slots),1);
  assert.equal(nearestVisibleBoardSlot(83,{left:10,right:80},slots),2);
  assert.equal(nearestVisibleBoardSlot(70,{left:70,right:98},slots),2);
  assert.equal(nearestVisibleBoardSlot(97,{left:70,right:98},slots),3);
  assert.equal(nearestVisibleBoardSlot(90,{left:80,right:90},slots),undefined);
  assert.equal(nearestVisibleBoardSlot(15,{left:20,right:20},slots),undefined);
});
test('touch target snapping only accepts a clear, nearby, legal visible target',()=>{
  const a={target:{kind:'minion' as const,instanceId:'a'},legal:true,left:10,right:30,top:10,bottom:40},b={target:{kind:'minion' as const,instanceId:'b'},legal:true,left:44,right:64,top:10,bottom:40};
  assert.deepEqual(nearestTouchTarget(34,25,[a,b]),a.target);
  assert.deepEqual(nearestTouchTarget(50,46,[a,b]),b.target);
  assert.equal(nearestTouchTarget(37,25,[a,b]),undefined);
  assert.equal(nearestTouchTarget(35,25,[a,b]),a.target);
  assert.equal(nearestTouchTarget(34,25,[{...a,legal:false},b]),undefined);
  assert.equal(nearestTouchTarget(34,25,[{...a,left:35,right:30},b]),b.target);
  assert.equal(nearestTouchTarget(80,25,[a,b]),undefined);
  assert.equal(nearestTouchTarget(NaN,25,[a,b]),undefined);
  assert.equal(nearestTouchTarget(39,25,[a,b]),b.target);
});
test('drop status names the actual action target and placement only for an actionable drop',()=>{
  assert.equal(dropFeedbackText('action',undefined,'상대 전사 영웅'),'놓기: 상대 전사 영웅 대상');
  assert.equal(dropFeedbackText('action',2,'내 늑대 (1번)'),'놓기: 내 늑대 (1번) 대상 · 배치 3번');
  assert.equal(dropFeedbackText('action',1),'놓으면 2번 위치에 배치합니다.');
  for(const f of ['target','choice','invalid','cancel'] as const)assert.doesNotMatch(dropFeedbackText(f,0,'상대 늑대'),/상대 늑대/);
});
