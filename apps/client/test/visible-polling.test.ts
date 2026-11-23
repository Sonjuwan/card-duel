import {test} from 'node:test';
import assert from 'node:assert/strict';
import {watchVisiblePolling} from '../src/visible-polling.ts';
import type {VisiblePollingEnvironment} from '../src/visible-polling.ts';

function fakeEnvironment(initialVisible:boolean){
  let shown=initialVisible,listener=()=>{},subscribers=0;
  const intervals=new Map<ReturnType<typeof setInterval>,()=>void>();
  const environment:VisiblePollingEnvironment={
    visible:()=>shown,
    listen:fn=>{listener=fn;subscribers++;return()=>{listener=()=>{};subscribers--;};},
    every:(fn,ms)=>{assert.equal(ms,10000);const handle={} as ReturnType<typeof setInterval>;intervals.set(handle,fn);return handle;},
    clear:handle=>{assert.equal(intervals.delete(handle),true);},
  };
  return {environment,intervals,show:()=>{shown=true;listener();},hide:()=>{shown=false;listener();},tick:()=>{for(const fn of [...intervals.values()])fn();},get subscribers(){return subscribers;}};
}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test('hidden developer panel starts no request or interval, then polls on foreground without duplicates',async()=>{
  const runtime=fakeEnvironment(false),signals:AbortSignal[]=[],ticks:number[]=[];
  const stop=watchVisiblePolling({periodMs:10000,environment:runtime.environment,onTick:()=>ticks.push(ticks.length+1),run:async signal=>{signals.push(signal);}});
  await settle();assert.equal(runtime.intervals.size,0);assert.equal(signals.length,0);
  runtime.show();await settle();assert.equal(runtime.intervals.size,1);assert.equal(signals.length,1);
  runtime.show();await settle();assert.equal(runtime.intervals.size,1);assert.equal(signals.length,2,'foreground event refreshes immediately');
  runtime.tick();await settle();assert.equal(signals.length,3);assert.equal(ticks.length,3);
  runtime.hide();assert.equal(runtime.intervals.size,0);
  runtime.tick();await settle();assert.equal(signals.length,3,'no hidden polling');
  stop();assert.equal(runtime.subscribers,0);
});

test('background transition aborts pending developer request and ignores its late failure',async()=>{
  const runtime=fakeEnvironment(true),signals:AbortSignal[]=[],failures:unknown[]=[];
  const rejects:((reason?:unknown)=>void)[]=[];
  const stop=watchVisiblePolling({periodMs:10000,environment:runtime.environment,run:signal=>{
    signals.push(signal);return new Promise((_,reject)=>rejects.push(reject));
  },onError:error=>failures.push(error)});
  await settle();runtime.tick();await settle();assert.equal(signals.length,1,'pending request is not duplicated');
  runtime.hide();assert.equal(signals[0].aborted,true);assert.equal(runtime.intervals.size,0);
  runtime.show();await settle();assert.equal(signals.length,2);assert.equal(signals[1].aborted,false);
  rejects[0](Error('stale request'));await settle();assert.deepEqual(failures,[],'late hidden failures are ignored');
  rejects[1](Error('current request'));await settle();assert.equal(failures.length,1);
  stop();stop();assert.equal(runtime.intervals.size,0);assert.equal(runtime.subscribers,0);
});

test('disposing visible polling aborts requests and disables visibility reactivation',async()=>{
  const runtime=fakeEnvironment(true),signals:AbortSignal[]=[];
  const stop=watchVisiblePolling({periodMs:10000,environment:runtime.environment,run:signal=>{signals.push(signal);return new Promise(()=>{});}});
  await settle();assert.equal(signals.length,1);stop();assert.equal(signals[0].aborted,true);
  assert.equal(runtime.intervals.size,0);runtime.hide();runtime.show();runtime.tick();await settle();
  assert.equal(signals.length,1);assert.equal(runtime.subscribers,0);
  assert.throws(()=>watchVisiblePolling({periodMs:0,run:async()=>{},environment:runtime.environment}),/Invalid polling interval/);
});
