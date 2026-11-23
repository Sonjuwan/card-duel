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
