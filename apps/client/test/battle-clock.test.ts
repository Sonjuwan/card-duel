import {test} from 'node:test';
import assert from 'node:assert/strict';
import {secondsUntilDeadline,watchDeadlineSeconds} from '../src/battle-clock.ts';
import type {DeadlineClockRuntime} from '../src/battle-clock.ts';

test('visible turn clock pauses background intervals and resumes with the actual deadline',()=>{
  let now=0,visible=true,visibility:()=>void=()=>{},subscriptions=0,clears=0;
  const published:(number|null)[]=[],active=new Map<ReturnType<typeof setInterval>,()=>void>();
  const clock:DeadlineClockRuntime={
    now:()=>now,visible:()=>visible,
    onVisibility:handler=>{visibility=handler;subscriptions++;return()=>{subscriptions--;visibility=()=>{};};},
    every:(handler,ms)=>{assert.equal(ms,250);const handle={} as ReturnType<typeof setInterval>;active.set(handle,handler);return handle;},
    clear:handle=>{assert.equal(active.delete(handle),true);clears++;},
  };
  const stop=watchDeadlineSeconds(2500,value=>published.push(value),250,clock);
  assert.deepEqual(published,[3]);assert.equal(active.size,1);
  now=650;for(const tick of active.values())tick();assert.deepEqual(published,[3,2]);
  visible=false;visibility();assert.equal(active.size,0);assert.equal(clears,1);
  now=1500;assert.deepEqual(published,[3,2],'hidden playback does not update presentation timers');
  visible=true;visibility();assert.deepEqual(published,[3,2,1],'foreground computes real elapsed time');assert.equal(active.size,1);
  visibility();assert.equal(active.size,1,'repeated visible events do not create duplicate intervals');
  now=4000;for(const tick of [...active.values()])tick();assert.equal(published.at(-1),0);assert.equal(active.size,0,'countdown stops polling at zero');
  visibility();assert.equal(active.size,0,'expired clock never creates another interval');
  stop();assert.equal(active.size,0);assert.equal(clears,2);assert.equal(subscriptions,0);
  const count=published.length;visibility();assert.equal(published.length,count,'unmounted clock never restarts');
});
test('reconnect and turn countdown values include zero, never negative and do not schedule without deadlines',()=>{
  assert.equal(secondsUntilDeadline(2000,0),2);assert.equal(secondsUntilDeadline(2000,1500),1);
  assert.equal(secondsUntilDeadline(2000,2500),0);
  let subscribed=false,scheduled=false;const status:(number|null)[]=[];
  const stop=watchDeadlineSeconds(undefined,value=>status.push(value),1000,{
    now:()=>0,visible:()=>true,onVisibility:()=>{subscribed=true;return()=>{};},
    every:()=>{scheduled=true;return{} as ReturnType<typeof setInterval>;},clear:()=>{},
  });
  assert.deepEqual(status,[null]);assert.equal(subscribed,false);assert.equal(scheduled,false);stop();
  const expired:(number|null)[]=[];
  const stopExpired=watchDeadlineSeconds(-1,value=>expired.push(value),250,{
    now:()=>0,visible:()=>true,onVisibility:()=>()=>{},
    every:()=>{scheduled=true;return{} as ReturnType<typeof setInterval>;},clear:()=>{},
  });
  assert.deepEqual(expired,[0]);assert.equal(scheduled,false,'expired deadlines do not wake a timer');stopExpired();
});


test('browser boundary timer wakes only for a new displayed second and stays paused while hidden',()=>{
  type Timer=ReturnType<typeof setInterval>;
  let now=0,visible=true,visibility=()=>{},serial=0,wakes=0;
  const active=new Map<Timer,{at:number;run:()=>void}>(),published:(number|null)[]=[];
  const clock:DeadlineClockRuntime={
    now:()=>now,visible:()=>visible,onVisibility:fn=>{visibility=fn;return()=>{visibility=()=>{};};},
    every:()=>{throw Error('Browser clock must not use polling');},
    after:(fn,ms)=>{const id=++serial as unknown as Timer;active.set(id,{at:now+ms,run:fn});return id;},
    clear:id=>{active.delete(id);},
  };
  const stop=watchDeadlineSeconds(30500,value=>published.push(value),250,clock);
  const advance=(end:number)=>{
    while(active.size){
      const next=[...active].sort((a,b)=>a[1].at-b[1].at)[0];
      if(next[1].at>end)break;
      now=next[1].at;active.delete(next[0]);wakes++;next[1].run();
    }
    now=end;
  };
  assert.deepEqual(published,[31]);advance(3000);assert.deepEqual(published,[31,30,29,28]);assert.equal(wakes,3);
  visible=false;visibility();assert.equal(active.size,0);advance(10000);assert.equal(wakes,3);
  visible=true;visibility();assert.equal(published.at(-1),21);visibility();assert.equal(published.filter(n=>n===21).length,1);
  advance(30500);assert.equal(published.at(-1),0);assert.equal(active.size,0);assert.equal(wakes,24);
  stop();assert.equal(active.size,0);
});
