import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../apps/client/solo-app/register.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function launch({installed=false,waiting=false,installing=false,assetFailed=false,startupDelayed=false}={}){
  const listeners=new Map(),els=new Map();
  for(const id of ['solo-app-status','solo-app-banner','solo-app-check-update','solo-app-install','solo-app-install-help','solo-storage-status','solo-storage-protect','solo-app-dismiss']){
    els.set(id,{hidden:true,textContent:'',disabled:false,addEventListener(){}});
  }
  const worker=installing?{state:'installing',addEventListener(){}}:null;
  const registration={waiting:waiting?{}:null,installing:worker,addEventListener(){},async update(){}};
  const serviceWorker={controller:{},register:()=>Promise.resolve(registration),ready:Promise.resolve(registration),addEventListener(){}};
  const navigator={serviceWorker,storage:{persisted:()=>Promise.resolve(true),persist:()=>Promise.resolve(true)},standalone:false,userAgent:'Chrome'};
  const window={isSecureContext:true,__cardDuelAssetFailed:assetFailed,__cardDuelStartupDelayed:startupDelayed,matchMedia:()=>({matches:installed}),addEventListener:(type,cb)=>listeners.set(type,cb)};
  const document={getElementById:id=>els.get(id)||null};
  runInNewContext(source,{window,document,navigator,Date,console});
  return {els,registration,ready:async()=>{await tick();await tick();}};
}
test('installed PWA suppresses routine successful cache notice without hiding the status',async()=>{
  const ui=launch({installed:true});await ui.ready();
  assert.match(ui.els.get('solo-app-status').textContent,/오프라인 앱 준비 완료/);
  assert.equal(ui.els.get('solo-app-banner').hidden,true);
  assert.equal(ui.els.get('solo-app-install-help').hidden,true);
});
test('a waiting patch still shows a prominent notice to an installed PWA',async()=>{
  const ui=launch({installed:true,waiting:true});await ui.ready();
  assert.match(ui.els.get('solo-app-status').textContent,/새 버전 준비 완료/);
  assert.equal(ui.els.get('solo-app-banner').hidden,false);
});
test('a worker still installing cannot be misreported as ready',async()=>{
  const ui=launch({installed:true,installing:true});await ui.ready();
  assert.match(ui.els.get('solo-app-status').textContent,/검증 중/);
  assert.equal(ui.els.get('solo-app-banner').hidden,false);
});
test('web tab continues to expose installation when offline cache is already ready',async()=>{
  const ui=launch();await ui.ready();
  assert.equal(ui.els.get('solo-app-banner').hidden,false);
  assert.equal(ui.els.get('solo-app-install-help').hidden,false);
});

test('failed game file cannot be hidden by a later routine PWA ready check',async()=>{
  const ui=launch({installed:true,assetFailed:true});await ui.ready();
  assert.match(ui.els.get('solo-app-status').textContent,/게임 파일 일부를 불러오지 못했습니다/);
  assert.equal(ui.els.get('solo-app-banner').hidden,false,'integrity warning remains visible');
});

test('normal service-worker ready cannot conceal a still-unmounted game',async()=>{
  const ui=launch({installed:true,startupDelayed:true});
  ui.els.get('solo-app-status').textContent='게임 시작이 지연되고 있습니다';
  ui.els.get('solo-app-banner').hidden=false;
  await ui.ready();
  assert.match(ui.els.get('solo-app-status').textContent,/게임 시작이 지연/);
  assert.equal(ui.els.get('solo-app-banner').hidden,false);
});
