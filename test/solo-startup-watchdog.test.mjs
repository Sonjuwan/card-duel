import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../apps/client/test/build-solo-app.mjs',import.meta.url),'utf8');
const script=source.match(/const assetWatch=`([\s\S]*?)`;/)?.[1].match(/<script id="solo-asset-watch">([\s\S]*?)<\/script>/)?.[1];
function boot({painted=false}={}){
  const listeners=new Map();let watchdog,rendered=painted,observerCallback,disconnected=false,hidden=false,visibilityCallback;
  const elements={'solo-app-status':{textContent:''},'solo-app-banner':{hidden:true},root:{get firstElementChild(){return rendered?{}:null;}}};
  const document={readyState:'complete',get hidden(){return hidden;},getElementById:key=>elements[key]||null,addEventListener:(name,fn)=>{if(name==='visibilitychange')visibilityCallback=fn;},removeEventListener:(name,fn)=>{if(name==='visibilitychange'&&visibilityCallback===fn)visibilityCallback=null;}};
  class FakeMutationObserver{
    constructor(callback){observerCallback=callback;}
    observe(root,options){assert.equal(root,elements.root);assert.equal(options.childList,true);}
    disconnect(){disconnected=true;}
  }
  const window={addEventListener:(name,fn)=>listeners.set(name,fn),setTimeout:(fn,delay)=>{assert.equal(delay,15000);watchdog=fn;},__cardDuelAssetFailed:false};
  assert.ok(script,'asset-watch script must be embedded in installable HTML');
  runInNewContext(script,{document,window,MutationObserver:FakeMutationObserver});
  return {window,elements,load:()=>listeners.get('load')(),fire:()=>watchdog(),setHidden:value=>{hidden=value;},resume:()=>visibilityCallback?.(),paint:()=>{rendered=true;observerCallback?.();},disconnected:()=>disconnected,resourceError:(target,filename)=>listeners.get('error')({target,filename})};
}
test('slow PWA boot is not labelled as missing game files',()=>{
  const ui=boot();ui.load();ui.fire();
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.window.__cardDuelStartupDelayed,true);
  assert.equal(ui.elements['solo-app-banner'].hidden,false);
  assert.match(ui.elements['solo-app-status'].textContent,/게임 시작이 지연/);
});
test('startup watchdog stays silent after the React root has rendered',()=>{
  const ui=boot({painted:true});ui.load();ui.fire();
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.elements['solo-app-banner'].hidden,true);
});
test('normal slow initial render before the deadline is accepted',()=>{
  const ui=boot();ui.load();ui.paint();ui.fire();
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.window.__cardDuelStartupDelayed,undefined);
});
test('late successful render clears the delay warning without erasing saves',()=>{
  const ui=boot();ui.load();ui.fire();ui.paint();
  assert.equal(ui.disconnected(),true);
  assert.equal(ui.window.__cardDuelStartupDelayed,false);
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.elements['solo-app-banner'].hidden,true);
  assert.match(ui.elements['solo-app-status'].textContent,/준비 완료/);
});
test('an actual missing game file remains a hard error even if a delayed root eventually mounts',()=>{
  const ui=boot();ui.load();ui.fire();
  ui.resourceError({tagName:'SCRIPT',getAttribute:name=>name==='src'?'game.js':null});
  ui.paint();
  assert.equal(ui.window.__cardDuelAssetFailed,true);
  assert.match(ui.elements['solo-app-status'].textContent,/게임 파일 일부를 불러오지 못했습니다/);
  assert.equal(ui.elements['solo-app-banner'].hidden,false);
});

test('backgrounding a slow app never raises a false startup warning before a fresh visible grace period',()=>{
  const ui=boot();ui.load();ui.setHidden(true);ui.fire();
  assert.equal(ui.elements['solo-app-banner'].hidden,true);
  ui.setHidden(false);ui.resume();ui.paint();ui.fire();
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.window.__cardDuelStartupDelayed,undefined);
  assert.equal(ui.elements['solo-app-banner'].hidden,true);
});

test('game.js execution exception before first React render gives an immediate recoverable error',()=>{
  const ui=boot();ui.load();
  ui.resourceError(ui.window,'https://example.test/card-duel/game.js');
  assert.equal(ui.window.__cardDuelAssetFailed,true);
  assert.equal(ui.window.__cardDuelStartupDelayed,false);
  assert.equal(ui.elements['solo-app-banner'].hidden,false);
  assert.match(ui.elements['solo-app-status'].textContent,/게임 코드 실행 중 오류/);
  assert.doesNotMatch(ui.elements['solo-app-status'].textContent,/private internals/,'no stack or runtime secrets in the UI');
  ui.fire();
  assert.match(ui.elements['solo-app-status'].textContent,/게임 코드 실행 중 오류/,'late watchdog cannot overwrite crash');
});
test('game.js execution exception after the app has rendered does not show a fatal startup notice',()=>{
  const ui=boot({painted:true});ui.load();
  ui.resourceError(ui.window,'https://example.test/card-duel/game.js');
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.elements['solo-app-banner'].hidden,true);
});
test('unrelated script errors during startup do not falsely mark the game as corrupt',()=>{
  const ui=boot();ui.load();
  ui.resourceError(ui.window,'https://example.test/extension.js');
  ui.resourceError(ui.window);
  assert.equal(ui.window.__cardDuelAssetFailed,false);
  assert.equal(ui.elements['solo-app-banner'].hidden,true);
});
