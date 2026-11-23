import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck} from '../../../packages/engine/src/index.ts';
import {fanSlot,collectionPage,collectionNavigation,deriveTableMotion} from '../src/table-visuals.ts';

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
test('card book keyboard navigation follows actual desktop and narrow mobile geometry without activation',()=>{
  const box=(left:number,top:number)=>({left,top,width:90,height:120});
  const desktop=[box(0,0),box(100,0),box(200,0),box(0,140),box(100,140),box(200,140),box(340,0),box(440,0),box(540,0),box(340,165),box(440,165),box(540,165)];
  assert.equal(collectionNavigation('ArrowRight',2,desktop),6);
  assert.equal(collectionNavigation('ArrowLeft',6,desktop),2);
  assert.equal(collectionNavigation('ArrowDown',7,desktop),10);
  assert.equal(collectionNavigation('ArrowUp',10,desktop),7);
  assert.equal(collectionNavigation('ArrowRight',8,desktop),null);
  assert.equal(collectionNavigation('Home',8,desktop),0);assert.equal(collectionNavigation('End',0,desktop),11);
  const mobile=[box(0,0),box(100,0),box(0,145),box(100,145),box(0,290)];
  assert.equal(collectionNavigation('ArrowDown',1,mobile),3);
  assert.equal(collectionNavigation('ArrowDown',3,mobile),4);
  assert.equal(collectionNavigation('ArrowLeft',4,mobile),null);
  const narrow=[box(0,0),box(0,140),box(0,280)];
  assert.equal(collectionNavigation('ArrowDown',0,narrow),1);
  assert.equal(collectionNavigation('ArrowRight',0,narrow),null);
  for(const key of ['Enter',' ','Tab','Escape'])assert.equal(collectionNavigation(key,0,narrow),null);
  assert.equal(collectionNavigation('ArrowDown',-1,narrow),null);
  assert.equal(collectionNavigation('ArrowDown',0,[]),null);
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
