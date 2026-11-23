import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {isInstalledGameDisplay,requestLandscapeFeatures} from '../apps/client/src/landscape-mode.ts';
const ui=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
test('unsupported fullscreen does not prevent supported orientation lock',async()=>{
  let locks=0;
  const result=await requestLandscapeFeatures(async()=>false,async()=>{locks++;return true;});
  assert.equal(locks,1);assert.deepEqual(result,{fullscreen:false,landscape:true,fullscreenDenied:false,orientationDenied:false});
});
test('rejected fullscreen still attempts orientation lock, while rejected lock preserves fullscreen',async()=>{
  let locks=0;
  const a=await requestLandscapeFeatures(async()=>{throw Error('denied');},async()=>{locks++;return true;});
  assert.equal(locks,1);assert.equal(a.fullscreenDenied,true);assert.equal(a.landscape,true);
  const b=await requestLandscapeFeatures(async()=>true,async()=>{throw Error('no orientation');});
  assert.equal(b.fullscreen,true);assert.equal(b.orientationDenied,true);
});
test('unsupported browser APIs are treated as manual rotation, not a crashed app',async()=>{
  const result=await requestLandscapeFeatures(async()=>false,async()=>false);
  assert.equal(result.fullscreen,false);assert.equal(result.landscape,false);
  assert.equal(result.fullscreenDenied,false);assert.equal(result.orientationDenied,false);
});
test('concurrent requests are fenced and orientation lock is released on exit',()=>{
  assert.match(ui,/if\(requestPending\.current\)return/);
  assert.match(ui,/lockedByUs\.current=true/);
  assert.match(ui,/if\(!full&&lockedByUs\.current\)/);
  assert.match(ui,/\.unlock\?\.\(\)/);
  assert.match(ui,/disabled=\{busy\}/);
  assert.match(ui,/requestLandscapeFeatures\(/);
});

test('installed standalone display is already immersive even without Fullscreen API',()=>{
  const matches=query=>query==='(display-mode: standalone)';
  assert.equal(isInstalledGameDisplay(matches),true);
  assert.equal(isInstalledGameDisplay(()=>false,true),true,'iOS navigator.standalone fallback');
  assert.equal(isInstalledGameDisplay(query=>query==='(display-mode: fullscreen)'),true);
  assert.equal(isInstalledGameDisplay(()=>false),false,'ordinary browser tab keeps fullscreen option');
  assert.match(ui,/document.fullscreenElement\|\|alreadyAppWindow\(\)/);
  assert.match(readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8'),/@media \(display-mode:standalone\)\{\.landscape-fullscreen-control\{display:none\}\}/);
});
