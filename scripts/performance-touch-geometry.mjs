import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {nearestBoardSlot,nearestTouchTarget,nearestVisibleBoardSlot} from '../apps/client/src/touch-gesture.ts';

// Exact v0.323 reference bodies, retained for differential performance checks.
function targetBefore(x,y,boxes){
  if(!Number.isFinite(x)||!Number.isFinite(y))return undefined;
  const ranked=boxes.flatMap(box=>{
    if(![box.left,box.right,box.top,box.bottom].every(Number.isFinite)||box.left>=box.right||box.top>=box.bottom)return [];
    const dx=Math.max(box.left-x,0,x-box.right),dy=Math.max(box.top-y,0,y-box.bottom);
    return [{box,distance:Math.hypot(dx,dy)}];
  }).sort((a,b)=>a.distance-b.distance);
  const best=ranked[0];
  return best?.box.legal&&best.distance<=10&&(!ranked[1]||ranked[1].distance-best.distance>=4)?best.box.target:undefined;
}
function slotBefore(x,bounds,slots){
  if(!Number.isFinite(bounds.left)||!Number.isFinite(bounds.right)||bounds.left>=bounds.right)return undefined;
  return nearestBoardSlot(x,slots.flatMap(slot=>{
    const left=Math.max(bounds.left,slot.left),right=Math.min(bounds.right,slot.right);
    return Number.isFinite(left)&&Number.isFinite(right)&&left<right?[{position:slot.position,x:(left+right)/2}]:[];
  }));
}

let seed=123456;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const boxes=Array.from({length:16},(_,i)=>{
  const left=(i%8)*50+40,top=Math.floor(i/8)*95+60;
  return {target:i<14?{kind:'minion',instanceId:String(i)}:{kind:'hero',player:i-14},legal:i%3!==0,left,right:left+40,top,bottom:top+70};
});
const slots=Array.from({length:8},(_,i)=>({position:i,left:i*49+40,right:i*49+48})),bounds={left:55,right:390};
const points=Array.from({length:8192},()=>[random()*470,random()*260]);
for(const [x,y] of points){
  assert.deepEqual(targetBefore(x,y,boxes),nearestTouchTarget(x,y,boxes));
  assert.equal(slotBefore(x,bounds,slots),nearestVisibleBoardSlot(x,bounds,slots));
}
const calls=160000;
let sink=0;
function time(fn){
  const start=performance.now();
  for(let i=0;i<calls;i++){
    const [x,y]=points[i%points.length],value=fn(x,y);
    sink+=typeof value==='number'?value:value?.kind==='minion'?Number(value.instanceId):value?.kind==='hero'?value.player:0;
  }
  return performance.now()-start;
}
for(const [name,beforeFn,afterFn] of [
  ['nearest-target',(x,y)=>targetBefore(x,y,boxes),(x,y)=>nearestTouchTarget(x,y,boxes)],
  ['visible-slot',x=>slotBefore(x,bounds,slots),x=>nearestVisibleBoardSlot(x,bounds,slots)]
]){
  time(beforeFn);time(afterFn);
  const before=[],after=[];
  for(let i=0;i<7;i++){
    if(i%2){after.push(time(afterFn));before.push(time(beforeFn));}
    else{before.push(time(beforeFn));after.push(time(afterFn));}
  }
  before.sort((a,b)=>a-b);after.sort((a,b)=>a-b);
  console.log(JSON.stringify({name,callsPerRun:calls,runs:7,beforeMs:before[3],afterMs:after[3],reductionPct:100*(1-after[3]/before[3])}));
}
console.log(JSON.stringify({sink,note:'Isolated geometry benchmark; not browser FPS or end-to-end input latency.'}));
