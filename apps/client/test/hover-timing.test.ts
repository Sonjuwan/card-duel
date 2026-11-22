import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARD_HOVER_DELAY,createHoverTiming} from '../src/hover-timing.ts';

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
