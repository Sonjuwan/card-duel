import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARD_HOVER_DELAY,createHoverTiming,createTouchPreviewGuard,independentActivation} from '../src/hover-timing.ts';

function fixture(){
  const published:(string|null)[]=[];
  let time=0,sequence=0;
  const timers=new Map<number,{due:number;fn:()=>void}>();
  const clock={
    set(fn:()=>void,ms:number){const id=++sequence;timers.set(id,{due:time+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;},
    clear(id:ReturnType<typeof setTimeout>){timers.delete(id as unknown as number);},
  };
  const tick=(ms:number)=>{time+=ms;for(const [id,timer] of timers){if(timer.due<=time){timers.delete(id);timer.fn();}}};
  const hover=createHoverTiming<string>(value=>published.push(value),clock);
  return{hover,tick,published,timers,current:()=>published.at(-1)};
}
test('preview is absent at 999ms and opens at exactly 1000ms',()=>{
  const f=fixture();assert.equal(CARD_HOVER_DELAY,1000);f.hover.start('hand',()=> 'card');f.tick(999);assert.equal(f.current(),null);f.tick(1);assert.equal(f.current(),'card');
});
test('scrolling, cancelled touches and long presses never become card activation, while fresh taps work',()=>{
  const guard=createTouchPreviewGuard();guard.begin(1,0,0,1000);assert.equal(guard.move(2,100,0),false);assert.equal(guard.move(1,9,0),true);assert.equal(guard.end(1,0,0,1150),true);assert.equal(guard.suppress(1151),true);assert.equal(guard.suppress(1450),false);
  guard.begin(2,0,0,2000);guard.end(2,0,12,2100);assert.equal(guard.suppress(2101),true);guard.begin(3,0,0,2200);guard.end(3,1,2,2250);assert.equal(guard.suppress(2251),false);
  guard.begin(4,0,0,3000);assert.equal(guard.cancel(5,3100),false);assert.equal(guard.cancel(4,3100),true);assert.equal(guard.suppress(3101),true);guard.reset();assert.equal(guard.suppress(3102),false);
  guard.begin(6,0,0,4000);guard.end(6,0,0,5000);assert.equal(guard.suppress(5001),true);
});
test('only trusted non-pointer detail-zero clicks bypass an active touch click guard',()=>{
  const keyboard={detail:0,isTrusted:true};
  assert.equal(independentActivation(keyboard),true);assert.equal(independentActivation({...keyboard,pointerType:''}),true);
  assert.equal(independentActivation({...keyboard,isTrusted:false}),false);
  for(const pointerType of ['touch','pen','mouse'])assert.equal(independentActivation({...keyboard,pointerType}),false);
  assert.equal(independentActivation({...keyboard,sourceCapabilities:{firesTouchEvents:true}}),false);
  assert.equal(independentActivation({...keyboard,detail:1}),false);
  const guard=createTouchPreviewGuard();guard.begin(1,0,0,0);guard.cancel(1,100);assert.equal(guard.suppress(110),true);
  assert.equal(guard.suppress(110)&&!independentActivation(keyboard),false);
  assert.equal(guard.suppress(111)&&!independentActivation({...keyboard,isTrusted:false}),true);
});
test('pointer exit before or after the deadline immediately cancels',()=>{
  const f=fixture();f.hover.start('card',()=> 'card');f.tick(999);f.hover.clear('card');f.tick(1);assert.equal(f.current(),null);assert.equal(f.timers.size,0);
  f.hover.start('card',()=> 'card');f.tick(1000);assert.equal(f.current(),'card');f.hover.clear('card');assert.equal(f.current(),null);
});
test('moving from own hand to either board restarts time and stale leave cannot cancel the new source',()=>{
  const f=fixture();f.hover.start('hand',()=> 'hand');f.tick(700);f.hover.start('own-board',()=> 'own');f.hover.clear('hand');f.tick(999);assert.equal(f.current(),null);f.tick(1);assert.equal(f.current(),'own');
  f.hover.start('enemy-board',()=> 'enemy');assert.equal(f.current(),null);f.hover.clear('own-board');f.tick(1000);assert.equal(f.current(),'enemy');
});
test('duplicate pointer/focus event does not reset a continuous dwell',()=>{
  const f=fixture();f.hover.start('m',()=> 'minion');f.tick(800);f.hover.start('m',()=> 'duplicate');f.tick(200);assert.equal(f.current(),'minion');
});
test('reset or disconnected element cannot publish stale details',()=>{
  const f=fixture();f.hover.start('m',()=> 'old state');f.tick(999);f.hover.clear();f.tick(500);assert.equal(f.current(),null);
  f.hover.start('m',()=>null);f.tick(1000);assert.equal(f.current(),null);assert.equal(f.timers.size,0);
});
test('detail supplier reads latest live stats at deadline, not stale start state',()=>{
  const f=fixture();let health='4';f.hover.start('m',()=>health);f.tick(500);health='2';f.tick(500);assert.equal(f.current(),'2');
});
test('visible preview refreshes updated battle stats and disappears if source is gone',()=>{
  const f=fixture();let health:string|null='4';f.hover.start('m',()=>health);f.tick(700);health='3';f.hover.refresh();assert.equal(f.current(),null);f.tick(300);assert.equal(f.current(),'3');health='1';f.hover.refresh();assert.equal(f.current(),'1');health=null;f.hover.refresh();assert.equal(f.current(),null);
});

test('stationary battle taps pin details without a timer or a follow-up click action',()=>{
  const f=fixture(),guard=createTouchPreviewGuard();
  guard.begin(1,10,10,0);assert.equal(guard.endTap(1,12,12,45),true);assert.equal(guard.suppress(46),true);
  let value:string|null='card';f.hover.pin('source',()=>value);f.hover.leave('source');f.tick(10000);
  assert.equal(f.current(),'card');assert.equal(f.timers.size,0);
  value='updated';f.hover.refresh();assert.equal(f.current(),'updated');
  f.hover.dismissPinned();assert.equal(f.current(),null);
  guard.begin(2,0,0,500);guard.move(2,9,0);assert.equal(guard.endTap(2,0,0,550),false);assert.equal(guard.suppress(551),true);
  guard.begin(3,0,0,900);guard.cancel(3,910);assert.equal(guard.endTap(3,0,0,920),false);
  f.hover.pin('source',()=>value);value=null;f.hover.refresh();assert.equal(f.current(),null);
});

test('a long drag requests preview cancellation only once, and cannot pin or activate a card',()=>{
  const guard=createTouchPreviewGuard();guard.begin(7,0,0,0);
  let cancels=0;for(let i=0;i<500;i++)if(guard.move(7,i,0))cancels++;
  assert.equal(cancels,1);
  assert.equal(guard.endTap(7,0,0,550),false);
  assert.equal(guard.suppress(551),true);
  guard.begin(8,10,10,600);assert.equal(guard.endTap(8,10,10,630),true);
});
