import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../apps/client/solo-app/register.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
  let clock=100_000,updates=0;const documentEvents=new Map(),windowEvents=new Map();
  const element=()=>({hidden:true,disabled:false,textContent:'',addEventListener(){}});
  const els=Object.fromEntries(['solo-app-status','solo-app-banner','solo-app-check-update','solo-storage-status','solo-storage-protect','solo-app-dismiss'].map(id=>[id,element()]));
  const registration={waiting:null,installing:null,addEventListener(){},async update(){updates++;}};
  const navigator={standalone:false,serviceWorker:{controller:{},register:async()=>registration,ready:Promise.resolve(registration),addEventListener(){}},storage:{persisted:async()=>true,persist:async()=>true}};
  const document={hidden:false,getElementById:id=>els[id]||null,addEventListener:(event,fn)=>documentEvents.set(event,fn)};
  const window={isSecureContext:true,matchMedia:()=>({matches:true}),addEventListener:(event,fn)=>windowEvents.set(event,fn)};
  const FakeDate={now:()=>clock};
  runInNewContext(source,{navigator,document,window,Date:FakeDate});
  return {setClock:v=>{clock=v;},setHidden:v=>{document.hidden=v;},visibility:()=>documentEvents.get('visibilitychange')?.(),focus:()=>windowEvents.get('focus')?.(),online:()=>windowEvents.get('online')?.(),updates:()=>updates,ready:async()=>{await tick();await tick();}};
}
test('PWA checks for patches on a visible mobile app resume even if focus is absent',async()=>{
  const app=setup();await app.ready();assert.equal(app.updates(),1,'startup performs first update check');
  app.setClock(161_000);app.visibility();await app.ready();assert.equal(app.updates(),2);
});
test('hidden app and rapid duplicate resume events avoid redundant checks',async()=>{
  const app=setup();await app.ready();app.setClock(161_000);app.setHidden(true);app.visibility();await app.ready();assert.equal(app.updates(),1);
  app.setHidden(false);app.visibility();app.focus();await app.ready();assert.equal(app.updates(),2,'one check per throttle window');
});

test('focus or network restoration during background suspension never starts a patch fetch',async()=>{
  const app=setup();await app.ready();
  app.setClock(161_000);app.setHidden(true);app.focus();app.online();await app.ready();
  assert.equal(app.updates(),1);
  app.setHidden(false);app.visibility();await app.ready();
  assert.equal(app.updates(),2);
});
