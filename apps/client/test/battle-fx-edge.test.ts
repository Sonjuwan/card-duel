import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fxEdgeMarkerLabel,fxEdgeMarkerBounds,offscreenFxMarkers} from '../src/battle-fx-model.ts';
import type {FxImpact,FxEdgeMarker,FxAnchor} from '../src/battle-fx-model.ts';
const left:FxEdgeMarker={edge:'left',side:0,count:2,x:8,y:85};
const right:FxEdgeMarker={edge:'right',side:1,count:1,x:302,y:185};
test('offscreen labels distinguish actual player side and direction without exposing hidden cards',()=>{
 assert.equal(fxEdgeMarkerLabel(left,0),'◀ 아군 2명');
 assert.equal(fxEdgeMarkerLabel(left,1),'◀ 상대 2명');
 assert.equal(fxEdgeMarkerLabel(right,0),'상대 1명 ▶');
 assert.equal(fxEdgeMarkerLabel(right,1),'아군 1명 ▶');
 const impacts:FxImpact[]=[{kind:'damage',side:0,target:{kind:'minion',instanceId:'a'},amount:2},{kind:'damage',side:0,target:{kind:'minion',instanceId:'a'},amount:1},{kind:'heal',side:0,target:{kind:'minion',instanceId:'b'},amount:1}];
 const position=():FxAnchor=>({x:8,y:85,fullyVisible:false,edge:'left'});
 const markers=offscreenFxMarkers(impacts,position);
 assert.equal(markers.length,1);assert.equal(fxEdgeMarkerLabel(markers[0],0),'◀ 아군 2명');
});
test('edge markers stay inside mobile and tiny canvas bounds, including a near-bottom hit',()=>{
 for(const [w,h] of [[320,180],[393,260],[600,240],[32,24]] as const){
  for(const marker of [left,right,{...right,y:h+50}]){
   const b=fxEdgeMarkerBounds(marker,w,h);
   assert.ok(b.w>0&&b.h>0&&b.x>=0&&b.y>=0);
   assert.ok(b.x+b.w<=w+1e-8&&b.y+b.h<=h+1e-8);
  }
 }
 assert.deepEqual(fxEdgeMarkerBounds(left,320,180),{w:112,h:20,x:8,y:51});
});
