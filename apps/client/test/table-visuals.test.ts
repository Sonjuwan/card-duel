import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck} from '../../../packages/engine/src/index.ts';
import {fanSlot,collectionPage,deriveTableMotion} from '../src/table-visuals.ts';

const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.21.0.json',import.meta.url),'utf8')));
function ready(){let s=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'warrior')],{seed:123,firstPlayer:0});s=applyAction(s,0,{type:'mulligan',replace:[]});return applyAction(s,1,{type:'mulligan',replace:[]});}
test('every valid hand size has a symmetric fan with one slot per card',()=>{
  for(let n=1;n<=10;n++){
    const slots=Array.from({length:n},(_,i)=>Number(fanSlot(i,n).slice(4)));
    assert.equal(new Set(slots).size,n);
    for(let i=0;i<n;i++){assert.ok(slots[i]>=0&&slots[i]<=18);assert.equal(slots[i]+slots[n-1-i],18);}
  }
  assert.equal(fanSlot(-1,10),'fan-9');assert.equal(fanSlot(0,11),'fan-9');
});
test('collection book paginates every legal card exactly once and clamps invalid pages',()=>{
  const ids=Array.from({length:140},(_,i)=>i);
  const first=collectionPage(ids,-2);assert.equal(first.page,0);assert.equal(first.pages,12);
  assert.deepEqual(Array.from({length:first.pages},(_,i)=>collectionPage(ids,i).items).flat(),ids);
  assert.deepEqual(collectionPage(ids,99).items,[132,133,134,135,136,137,138,139]);
  assert.deepEqual(collectionPage([],99),{page:0,pages:1,items:[]});
  assert.equal(collectionPage(ids,NaN,0).items.length,12);
});
test('expanded battlefield layout reserves 48% for two rows and scales portraits by occupancy',()=>{
  const css=readFileSync('apps/client/src/local-cards.css','utf8');
  const rows=css.match(/\.classic-table \.arena-field\{grid-template-rows:([^}]+)\}/)?.[1].split(' ').map(parseFloat);assert.ok(rows);
  assert.equal(rows.reduce((a,b)=>a+b),100);assert.equal(rows[2]+rows[4],48);
  assert.match(css,/--unit-size:min\(164px,calc\(\(100cqh - 16px\) \/ 1\.12\),calc\(\(100cqw - var\(--slot-reserve\)\) \/ var\(--unit-count\)\)\)/);
  for(const [viewportWidth,viewportHeight] of [[941,650],[1024,768],[1366,768],[1920,1080]]){
    const height=Math.min(850,Math.max(540,viewportHeight-122)),rowHeight=height*.24-8;
    const width=(Math.min(1680,viewportWidth)-32)*.774-24;
    for(let n=1;n<=7;n++)for(const friendly of [true,false]){
      const reserve=friendly?(n===7?52:(n+1)*16+12):(n-1)*5+12;
      const size=Math.min(164,(rowHeight-16)/1.12,(width-reserve)/n);
      assert.ok(size>=65,`readable portrait ${viewportWidth} ${n}`);assert.ok(size*1.12+16<=rowHeight+1e-6);assert.ok(size*n+reserve<=width+1e-6);
    }
  }
  assert.match(css,/\.classic-table \.minion-medallion[^}]*aspect-ratio:1\/1/);
  assert.match(readFileSync('apps/client/src/painted-art.css','utf8'),/\.minion-medallion \.painted-art\{background-size:contain/);
});
test('visual changes are derived solely from consecutive authorized player views',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'old',attack:3,health:2,maxHealth:2,attacksRemaining:1}];s.players[1].armor=2;
  const prev=getPlayerView(s,0);
  const next=structuredClone(prev);
  next.revision++;next.activePlayer=1;
  next.self.hand.push({cardId:'wisp',instanceId:'drawn'});
  next.self.board[0].health=1;
  next.opponent.board.push({cardId:'wolf',instanceId:'public-summon',attack:3,health:2,maxHealth:2,attacksRemaining:0});
  next.opponent.armor=0;next.opponent.health-=3;
  const motion=deriveTableMotion(prev,next,0);
  assert.deepEqual([...motion.drawn],['drawn']);
  assert.deepEqual([...motion.summoned],['public-summon']);
  assert.equal(motion.minionDelta.get('old'),-1);
  assert.equal(motion.enemyHeroDelta,-5);assert.equal(motion.turn,'enemy');
  assert.equal('hand' in next.opponent,false);
  next.revision++;assert.equal(deriveTableMotion(prev,next,0).drawn.size,0);
  assert.equal(deriveTableMotion(undefined,next,0).summoned.size,0);
});
