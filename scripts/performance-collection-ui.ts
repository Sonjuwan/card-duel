import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createCatalog,deckCards,HERO_CLASSES} from '../packages/engine/src/index.ts';
import {collectionSetCounts,matchesCardSet} from '../apps/client/src/card-sets.ts';
import {createTouchPreviewGuard} from '../apps/client/src/hover-timing.ts';
const {file}=JSON.parse(readFileSync('data/cards/active.json','utf8'));
const catalog=createCatalog(JSON.parse(readFileSync('data/cards/'+file,'utf8')));
const all=Object.values(catalog),lists=[all,...HERO_CLASSES.map(c=>deckCards(catalog,c))];
const keys=['all','basic','original','token'] as const;
const baseline=(cards:typeof all)=>Object.fromEntries(keys.map(k=>[k,cards.filter(c=>matchesCardSet(c,k)).length]));
for(const cards of lists)assert.deepEqual(collectionSetCounts(cards),baseline(cards));
let checksum=0;
function countTrial(optimized:boolean){
  const start=performance.now();
  for(let i=0;i<10000;i++){
    const cards=lists[i%lists.length];
    const counts=optimized?collectionSetCounts(cards):baseline(cards);
    checksum+=counts.all+counts.basic+counts.original+counts.token;
  }
  return performance.now()-start;
}
countTrial(false);countTrial(true);
const pairs=Array.from({length:7},(_,i)=>{if(i%2===0){const before=countTrial(false),after=countTrial(true);return{before,after};}const after=countTrial(true),before=countTrial(false);return{before,after};});
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const guard=createTouchPreviewGuard();
guard.begin(1,0,0,0);
let before=0,after=0,moved=false;
for(let x=1;x<=500;x++){
  // Exact previous transition condition for this single-pointer trace.
  if(!(Math.hypot(x,0)<8&&!moved)){moved=true;before++;}
  if(guard.move(1,x,0))after++;
}
assert.equal(before,493);assert.equal(after,1);
assert.equal(guard.endTap(1,500,0,600),false);
console.log(JSON.stringify({catalogCards:all.length,lists:lists.length,iterations:10000,pairs,baselineMedianMs:median(pairs.map(p=>p.before)),optimizedMedianMs:median(pairs.map(p=>p.after)),dragCancellationRequests:{before,after},checksum,note:'Isolated set-count and gesture operation benchmark, not end-to-end FPS.'}));
