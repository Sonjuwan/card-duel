import {musicAssets,restoreSoloMusic} from '../solo-app/music-assets.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync,cpSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {get} from 'node:http';
import {createSoloAppServer,loadSoloRelease} from '../../cli/serve-solo-app.mjs';
const directory=resolve(process.env.CARD_DUEL_SOLO_APP_DIST_DIR||'dist/solo-app');
const read=name=>readFileSync(resolve(directory,name));
const worker=read('sw.js').toString();
const release=JSON.parse(worker.match(/const release = (.+);/)[1]);
const scope='https://example.invalid/game/';
const assetCount=Object.keys(release.files).length;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('install package embeds actual game and includes content-checked manifest resources',()=>{
  const html=read('index.html').toString(),manifest=JSON.parse(read('manifest.webmanifest'));
  const standalone=readFileSync('solo-offline.html','utf8');
  const standaloneScript=standalone.match(/<script type="module">([\s\S]*?)<\/script>/);
  const standaloneStyle=standalone.match(/<style>([\s\S]*?)<\/style>/);
  assert.match(html,/rel="manifest" href="manifest.webmanifest"/);
  assert.match(html,/src="register.js" defer/);
  assert.match(html,/<script type="module" src="game\.js" integrity="sha256-[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="game\.css" integrity="sha256-[^"]+">/);
  assert.match(html,/<script id="solo-asset-watch">/);
  assert.ok(html.indexOf('id="solo-asset-watch"')<html.indexOf('href="game.css"'),'resource errors must be observed before art CSS loads');
  assert.ok(html.length<6000,'installable document stays under 6 KB and excludes bundled game/card art');
  assert.ok(!html.includes('data:image/webp;base64,'));
  assert.equal(restoreSoloMusic(read('game.js').toString(),read),standaloneScript?.[1],'installable audio restores the exact standalone bundle');
  assert.doesNotMatch(read('game.js').toString(),/data:audio\/mpeg;base64,/);
  assert.equal(read('game.css').toString(),standaloneStyle?.[1],'card art and styles match standalone exactly');
  assert.match(read('game.css').toString(),/#solo-app-banner button\{min-height:44px\}/,'installed update and storage protection controls keep mobile-sized targets');
  assert.ok((read('game.css').toString().match(/data:image\/webp;base64,/g)??[]).length>=380,'all embedded card art survives');
  assert.match(html,/id="solo-storage-protect"/);
  assert.ok(html.includes(`RUNEHALL v${JSON.parse(readFileSync('package.json','utf8')).version}`));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
  assert.deepEqual(Object.keys(release.files).sort(),[...musicAssets,'index.html','game.js','game.css','manifest.webmanifest','register.js','icon-192.png','icon-512.png'].sort());
  for(const [name,digest] of Object.entries(release.files))assert.equal(hash(read(name)),digest);
  for(const name of ['game.js','game.css','register.js']){
    assert.ok(html.includes(`integrity="sha256-${Buffer.from(release.files[name],'hex').toString('base64')}"`));
  }
  for(const icon of manifest.icons){const png=read(icon.src),size=Number(icon.sizes.split('x')[0]);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
  assert.match(release.id,/^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(read('version.json')),{version:release.version,release:release.id});
});

function fakeWorker({corrupt=false,offline=false,script=worker,readAsset=read,sharedStorage,seedOld=true,seedPointer=true}={}){
  const config=JSON.parse(script.match(/const release = (.+);/)[1]);
  const prefix=`card-duel-solo-app:${scope}:`,pointer=prefix+'active-pointer',pointerKey=scope+'__card-duel-active-release__';
  const listeners=new Map(),storage=sharedStorage??new Map(),other=`card-duel-solo-app:https://other.invalid/:old`,old=prefix+'a'.repeat(64),name=prefix+config.id;
  if(seedOld){storage.set(other,new Map());storage.set(old,new Map());if(seedPointer)storage.set(pointer,new Map([[pointerKey,new Response(old)]]));}
  let claimed=0,digests=0;const progress=[],fetched=[];
  // Real CacheStorage stores immutable response bytes. Do not retain a stream
  // Response object in the mock: Node 22 can mark a cloned stream consumed
  // after several verification reads, unlike the browser Cache API.
  const caches={keys:async()=>[...storage.keys()],delete:async key=>storage.delete(key),open:async key=>{
    if(!storage.has(key))storage.set(key,new Map());const values=storage.get(key);
    return {
      put:async (url,response)=>{values.set(url,Buffer.from(await response.arrayBuffer()));},
      match:async url=>{let value=values.get(url);if(value===undefined)return undefined;
        if(value instanceof Response){value=Buffer.from(await value.clone().arrayBuffer());values.set(url,value);}
        return new Response(value);
      },
      delete:async url=>values.delete(url)
    };
  }};
  const fetch=async url=>{if(offline)throw Error('No connection');const path=new URL(url).pathname.split('/').at(-1);fetched.push(path);return new Response(corrupt&&path==='register.js'?'corrupt':readAsset(path));};
  const self={registration:{scope},clients:{claim:async()=>{claimed++;},matchAll:async()=>[{postMessage:data=>progress.push(data)}]},addEventListener:(type,callback)=>listeners.set(type,callback)};
  const crypto={subtle:{digest:(...args)=>{digests++;return webcrypto.subtle.digest(...args);}}};
  runInNewContext(script,{self,caches,fetch,URL,Response,crypto,Uint8Array,Map,Object,Array,Error});
  const event=type=>{let promise;listeners.get(type)({waitUntil:value=>{promise=value;}});return promise;};
  const request=(url,method='GET')=>{let promise;listeners.get('fetch')({request:{url,method},respondWith:value=>{promise=value;}});return promise;};
  return {storage,old,other,name,pointer,pointerKey,event,request,progress,fetched,digests:()=>digests,claimed:()=>claimed,setOffline:value=>{offline=value;},setCorrupt:value=>{corrupt=value;},setAssetReader:value=>{readAsset=value;}};
}
test('candidate downloads only missing, modified or damaged active-release assets',async()=>{
  const app=fakeWorker();
  const old=app.storage.get(app.old);
  for(const path of Object.keys(release.files))old.set(scope+path,read(path));
  old.set(scope+'game.js',Buffer.from('old version bytes'));
  old.set(scope+'game.css',Buffer.from('damaged bytes'));
  old.delete(scope+'register.js');
  await app.event('install');
  assert.deepEqual(app.fetched.sort(),['game.css','game.js','register.js']);
  assert.equal(app.storage.get(app.name).size,assetCount);
  assert.ok(app.storage.has(app.old),'active release is preserved while the candidate waits');
  for(const [path,digest] of Object.entries(release.files)){
    assert.equal(hash(app.storage.get(app.name).get(scope+path)),digest);
  }
});

test('service worker completes precache, preserves old release until activation, then serves exact offline game',async()=>{
  const app=fakeWorker();await app.event('install');assert.equal(app.storage.get(app.name).size,assetCount);
  assert.deepEqual(app.progress.map(report=>report.done),Array.from({length:assetCount},(_,i)=>i+1));
  assert.ok(app.progress.every(report=>report.type==='card-duel-cache-progress'&&report.release===release.id&&report.all===assetCount));
  assert.ok(app.storage.has(app.old));assert.equal(app.claimed(),0);
  await app.event('activate');assert.ok(!app.storage.has(app.old));assert.ok(app.storage.has(app.other));assert.equal(app.claimed(),1);
  const response=await app.request(scope);assert.equal(hash(Buffer.from(await response.arrayBuffer())),release.files['index.html']);
  assert.equal((await app.request(scope+'manifest.webmanifest')).status,200);
  app.setOffline(true);
  for(const target of [scope+'?source=homescreen',scope+'index.html?from=friend&x=1']){
    const cached=await app.request(target);
    assert.equal(hash(Buffer.from(await cached.arrayBuffer())),release.files['index.html'],'offline PWA honors share/install query without fetching');
  }
  const jsWithQuery=await app.request(scope+'game.js?build=preview');
  assert.equal(hash(Buffer.from(await jsWithQuery.arrayBuffer())),release.files['game.js'],'query never substitutes an unverified game script');
  assert.equal(app.request(scope+'unlisted.js?x=1'),undefined,'query normalization must not expose unknown files');
  app.setOffline(false);
  for(const asset of ['game.js','game.css'])assert.equal(hash(Buffer.from(await (await app.request(scope+asset)).arrayBuffer())),release.files[asset]);
  assert.equal(app.request('https://example.invalid/other/'),undefined);assert.equal(app.request(scope,'POST'),undefined);
  app.storage.get(app.name).delete(scope+'index.html');app.setOffline(true);assert.equal((await app.request(scope)).status,503);
  app.setOffline(false);const healed=await app.request(scope);assert.equal(hash(Buffer.from(await healed.arrayBuffer())),release.files['index.html']);assert.ok(app.storage.get(app.name).has(scope+'index.html'));
  app.storage.get(app.name).delete(scope+'register.js');app.setCorrupt(true);assert.equal((await app.request(scope+'register.js')).status,503);assert.ok(!app.storage.get(app.name).has(scope+'register.js'));
});
test('interrupted or mixed patch never deletes old active version or activates partial assets',async()=>{
  for(const option of [{corrupt:true},{offline:true}]){const app=fakeWorker(option);await assert.rejects(app.event('install'));assert.ok(app.storage.has(app.old));assert.ok(app.storage.has(app.other));assert.ok(!app.storage.has(app.name));assert.equal(app.claimed(),0);}
});
test('an exact cached release can reinstall offline and a partial repair never deletes its valid assets',async()=>{
  const first=fakeWorker();await first.event('install');await first.event('activate');
  const same=fakeWorker({sharedStorage:first.storage,seedOld:false,offline:true});
  await same.event('install');assert.equal(same.storage.get(same.name).size,assetCount);
  await same.event('activate');assert.equal(hash(Buffer.from(await (await same.request(scope)).arrayBuffer())),release.files['index.html']);
  same.storage.get(same.name).set(scope+'register.js',new Response('damaged cache entry'));
  const repair=fakeWorker({sharedStorage:same.storage,seedOld:false,offline:true});
  await assert.rejects(repair.event('install'));assert.ok(repair.storage.has(repair.name));assert.equal(repair.storage.get(repair.name).size,assetCount-1);
  assert.equal(hash(Buffer.from(await (await repair.request(scope)).arrayBuffer())),release.files['index.html']);
  repair.setOffline(false);await repair.event('install');assert.equal(repair.storage.get(repair.name).size,assetCount);
});
test('the installing worker reuses verified bytes but a restarted worker rechecks them',async()=>{
  const first=fakeWorker();await first.event('install');await first.event('activate');
  first.setOffline(true);
  const installedDigests=first.digests();
  assert.equal((await first.request(scope+'game.css')).status,200);
  assert.equal(first.digests(),installedDigests);
  const restarted=fakeWorker({sharedStorage:first.storage,seedOld:false,offline:true});
  assert.equal((await restarted.request(scope+'game.css')).status,200);
  assert.equal(restarted.digests(),1);
});

test('a corrupted cached game or stylesheet is never served, but the exact release can repair it',async()=>{
  const first=fakeWorker();await first.event('install');await first.event('activate');
  const files=['game.js','game.css','index.html'];
  for(const asset of files){
    first.storage.get(first.name).set(scope+asset,new Response('damaged '+asset));
    const resumed=fakeWorker({sharedStorage:first.storage,seedOld:false,offline:true});
    const rejected=await resumed.request(scope+asset);assert.equal(rejected.status,503,'never serve damaged '+asset);
    assert.ok(!resumed.storage.get(resumed.name).has(scope+asset),'remove only corrupt '+asset);
    assert.ok(resumed.storage.get(resumed.name).has(scope+'register.js'),'keep unrelated valid assets');
    resumed.setOffline(false);
    const repaired=await resumed.request(scope+asset);assert.equal(hash(Buffer.from(await repaired.arrayBuffer())),release.files[asset]);
    assert.equal(hash(Buffer.from(await (await resumed.request(scope+asset)).arrayBuffer())),release.files[asset],'verified cache can be reused');
  }
  const resumedOffline=fakeWorker({sharedStorage:first.storage,seedOld:false,offline:true});
  for(const asset of files)assert.equal(hash(Buffer.from(await (await resumedOffline.request(scope+asset)).arrayBuffer())),release.files[asset],'all repaired assets survive offline restart');
});
test('activation deletes only known previous active cache, preserving an overlapping future patch and legacy caches',async()=>{
  const fixture=(tag)=>{
    const files=new Map(Object.keys(release.files).map(name=>[name,read(name)]));
    files.set('index.html',Buffer.concat([files.get('index.html'),Buffer.from('\n<!-- '+tag+' -->')]));
    const hashes=Object.fromEntries([...files].map(([name,bytes])=>[name,hash(bytes)])),template=worker.replace(/^const release = .+;$/m,'const release = __CACHE_SPEC__;'),spec={id:hash(JSON.stringify(hashes)+template),files:hashes};
    return {script:template.replace('__CACHE_SPEC__',JSON.stringify(spec)),readAsset:name=>files.get(name),spec};
  };
  const a=fixture('previous'),c=fixture('future');
  const previous=fakeWorker({...a,seedPointer:false});await previous.event('install');await previous.event('activate');
  assert.ok(previous.storage.has(previous.old),'legacy cache cannot be identified as obsolete');
  const middle=fakeWorker({sharedStorage:previous.storage,seedOld:false}),future=fakeWorker({...c,sharedStorage:previous.storage,seedOld:false});
  await middle.event('install');await future.event('install');await middle.event('activate');
  assert.ok(!middle.storage.has(previous.name));assert.ok(middle.storage.has(future.name),'waiting future patch must not be deleted');
  middle.setOffline(true);future.setOffline(true);
  assert.equal(hash(Buffer.from(await (await middle.request(scope)).arrayBuffer())),release.files['index.html']);
  await future.event('activate');assert.ok(!future.storage.has(middle.name));assert.ok(future.storage.has(future.other));assert.ok(future.storage.has(future.old));
  assert.equal(hash(Buffer.from(await (await future.request(scope)).arrayBuffer())),c.spec.files['index.html']);
});
test('two complete releases coexist while a patch waits and an offline reload serves only the active release',async()=>{
  const fixture=new Map(Object.keys(release.files).map(name=>[name,read(name)]));
  fixture.set('index.html',Buffer.concat([fixture.get('index.html'),Buffer.from('\n<!-- previous complete release fixture -->')]));
  fixture.set('register.js',Buffer.concat([fixture.get('register.js'),Buffer.from('\n// previous complete release fixture')]));
  const files=Object.fromEntries([...fixture].map(([name,bytes])=>[name,hash(bytes)]));
  const template=worker.replace(/^const release = .+;$/m,'const release = __CACHE_SPEC__;'),previous={id:hash(JSON.stringify(files)+template),files};
  const oldScript=template.replace('__CACHE_SPEC__',JSON.stringify(previous));
  const oldApp=fakeWorker({script:oldScript,readAsset:name=>fixture.get(name)});
  await oldApp.event('install');await oldApp.event('activate');assert.equal(oldApp.claimed(),1);
  oldApp.setAssetReader(read); // The host has been completely upgraded.
  const newApp=fakeWorker({sharedStorage:oldApp.storage,seedOld:false});
  await newApp.event('install');assert.ok(oldApp.storage.has(oldApp.name));assert.ok(oldApp.storage.has(newApp.name));assert.equal(newApp.claimed(),0);
  oldApp.setOffline(true);newApp.setOffline(true);
  const oldHome=await oldApp.request(scope);assert.equal(hash(Buffer.from(await oldHome.arrayBuffer())),previous.files['index.html']);
  const oldRegister=await oldApp.request(scope+'register.js');assert.equal(hash(Buffer.from(await oldRegister.arrayBuffer())),previous.files['register.js']);
  // Browser closes the previous windows and activates the fully cached patch.
  await newApp.event('activate');assert.ok(!oldApp.storage.has(oldApp.name));assert.ok(oldApp.storage.has(newApp.other));assert.equal(newApp.claimed(),1);
  const newHome=await newApp.request(scope);assert.equal(hash(Buffer.from(await newHome.arrayBuffer())),release.files['index.html']);
  const newRegister=await newApp.request(scope+'register.js');assert.equal(hash(Buffer.from(await newRegister.arrayBuffer())),release.files['register.js']);
});
test('storage durability is requested only on user action and reports the browser decision',async()=>{
  let granted=false,requests=0,click;const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:(type,handler)=>{if(type==='click')click=handler;}}]));
  const registration={waiting:null,addEventListener:()=>{},update:async()=>{}};
  const navigator={storage:{persisted:async()=>granted,persist:async()=>{requests++;return granted;}},serviceWorker:{controller:null,register:async()=>registration,ready:Promise.resolve(registration)}};
  runInNewContext(read('register.js').toString(),{navigator,window:{isSecureContext:true},document:{getElementById:id=>elements.get(id)}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,0);assert.equal(elements.get('solo-storage-protect').hidden,false);assert.match(elements.get('solo-storage-status').textContent,/미승인/);
  await click();assert.equal(requests,1);assert.match(elements.get('solo-storage-status').textContent,/미승인/);
  granted=true;await click();assert.equal(requests,2);assert.match(elements.get('solo-storage-status').textContent,/승인됨/);assert.equal(elements.get('solo-storage-protect').hidden,true);
});
test('missing game module, stylesheet, or registration leaves a visible recovery message even after startup',async()=>{
  const html=read('index.html').toString(),code=html.match(/<script id="solo-asset-watch">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(code);
  for(const asset of [{tagName:'SCRIPT',name:'src',value:'game.js'},{tagName:'LINK',name:'href',value:'game.css'},{tagName:'SCRIPT',name:'src',value:'register.js'}]){
    const events=new Map(),documentEvents=new Map();
    const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect','solo-app-check-update'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:()=>{}}]));
    const document={readyState:'loading',getElementById:id=>elements.get(id),addEventListener:(type,handler)=>documentEvents.set(type,handler)};
    const window={isSecureContext:true,addEventListener:(type,handler)=>events.set(type,handler)};
    runInNewContext(code,{window,document});
    events.get('error')({target:{tagName:'IMG',getAttribute:()=>asset.value}});assert.equal(window.__cardDuelAssetFailed,undefined);
    events.get('error')({target:{tagName:asset.tagName,getAttribute:key=>key===asset.name?asset.value:null}});
    assert.equal(window.__cardDuelAssetFailed,true);documentEvents.get('DOMContentLoaded')();
    const banner=elements.get('solo-app-banner'),status=elements.get('solo-app-status');
    assert.equal(banner.hidden,false);assert.match(status.textContent,/게임 파일 일부.*저장 기록을 삭제하지/);
    const registration={waiting:null,addEventListener:()=>{},update:async()=>{}};
    const navigator={serviceWorker:{controller:null,register:async()=>registration,ready:Promise.resolve(registration)}};
    runInNewContext(read('register.js').toString(),{window,document,navigator});
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(status.textContent,/게임 파일 일부.*저장 기록을 삭제하지/,'ready state cannot mask asset failure');
  }
});
test('insecure or service-worker-free browsers explain that play is possible but installation is unavailable',()=>{
  for(const option of [{secure:false,serviceWorker:{}},{secure:true}]){
    const elements=new Map(['solo-app-status','solo-app-banner'].map(id=>[id,{textContent:'',hidden:true}]));
    const navigator=option.serviceWorker?{serviceWorker:option.serviceWorker}:{};
    const window={isSecureContext:option.secure};
    runInNewContext(read('register.js').toString(),{window,navigator,document:{getElementById:id=>elements.get(id)}});
    assert.match(elements.get('solo-app-status').textContent,/오프라인 설치 미지원.*재실행은 보장되지/);
    assert.equal(elements.get('solo-app-banner').hidden,false);
  }
});
test('an older storage query cannot hide a newer successful persist or overwrite a failed request',async()=>{
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  for(const fails of [false,true]){
    let resolveInitial,click;
    const stale=new Promise(resolve=>{resolveInitial=resolve;});
    const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:(type,handler)=>{if(type==='click')click=handler;}}]));
    let polls=0;const navigator={storage:{persisted:async()=>++polls===1?stale:true,persist:async()=>{if(fails)throw Error('Permission denied');return true;}},serviceWorker:{controller:null,register:async()=>({addEventListener:()=>{},update:async()=>{}}),ready:Promise.resolve({})}};
    runInNewContext(read('register.js').toString(),{navigator,window:{isSecureContext:true},document:{getElementById:id=>elements.get(id)}});
    await tick();const protection=click();await protection;
    const status=elements.get('solo-storage-status');
    assert.match(status.textContent,fails?/요청 실패/:/승인됨/);
    resolveInitial(false);await tick();assert.match(status.textContent,fails?/요청 실패/:/승인됨/,'stale initial check never replaces the newest result');
    assert.equal(elements.get('solo-storage-protect').disabled,false);
    assert.equal(polls,fails?1:2);
  }
});
test('real previous release can upgrade and roll back using complete isolated offline caches',{skip:!process.env.CARD_DUEL_PREVIOUS_RELEASE_DIR},async()=>{
  const previousDir=resolve(process.env.CARD_DUEL_PREVIOUS_RELEASE_DIR);const realPrevious=loadSoloRelease(previousDir);
  assert.notEqual(realPrevious.id,release.id,'use a distinct previously built release');
  const oldAsset=name=>readFileSync(resolve(previousDir,name)),oldScript=oldAsset('sw.js').toString(),oldSpec=JSON.parse(oldScript.match(/const release = (.+);/)[1]);
  const oldApp=fakeWorker({script:oldScript,readAsset:oldAsset});await oldApp.event('install');await oldApp.event('activate');
  const knewPrevious=oldApp.storage.has(oldApp.pointer);
  const next=fakeWorker({sharedStorage:oldApp.storage,seedOld:false});await next.event('install');
  assert.ok(oldApp.storage.has(oldApp.name));assert.ok(next.storage.has(next.name));oldApp.setOffline(true);next.setOffline(true);
  assert.equal(hash(Buffer.from(await (await oldApp.request(scope)).arrayBuffer())),oldSpec.files['index.html']);
  await next.event('activate');assert.equal(next.storage.has(oldApp.name),!knewPrevious,'legacy caches are retained until safely identified');assert.equal(hash(Buffer.from(await (await next.request(scope)).arrayBuffer())),release.files['index.html']);
  const rollback=fakeWorker({script:oldScript,readAsset:oldAsset,sharedStorage:next.storage,seedOld:false});await rollback.event('install');assert.ok(next.storage.has(next.name));assert.ok(rollback.storage.has(rollback.name));
  assert.equal(hash(Buffer.from(await (await next.request(scope)).arrayBuffer())),release.files['index.html']);
  rollback.setOffline(true);await rollback.event('activate');assert.ok(!rollback.storage.has(next.name));assert.equal(hash(Buffer.from(await (await rollback.request(scope)).arrayBuffer())),oldSpec.files['index.html']);
  assert.ok(rollback.storage.has(rollback.other),'unrelated origin cache must survive both transitions');
});
test('manual and focus patch checks preserve the current version and report waiting or failure without forcing activation',async()=>{
  let checks=0,fail=false;const clickHandlers=new Map(),registrationHandlers=new Map(),windowHandlers=new Map();
  const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect','solo-app-check-update'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:(type,handler)=>{if(type==='click')clickHandlers.set(id,handler);}}]));
  const registration={waiting:null,installing:null,addEventListener:(type,handler)=>registrationHandlers.set(type,handler),update:async()=>{checks++;if(fail)throw Error('offline');}};
  const navigator={serviceWorker:{controller:{},register:async()=>registration,ready:Promise.resolve(registration)}};
  runInNewContext(read('register.js').toString(),{navigator,window:{isSecureContext:true,addEventListener:(type,handler)=>windowHandlers.set(type,handler)},document:{getElementById:id=>elements.get(id)}});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));await tick();assert.equal(checks,1);assert.equal(elements.get('solo-app-check-update').hidden,false);
  windowHandlers.get('focus')();await tick();assert.equal(checks,1,'focus checks are rate limited');
  clickHandlers.get('solo-app-check-update')();await tick();assert.equal(checks,2);assert.match(elements.get('solo-app-status').textContent,/새 패치 없음/);
  fail=true;clickHandlers.get('solo-app-check-update')();await tick();assert.equal(checks,3);assert.match(elements.get('solo-app-status').textContent,/패치 확인 실패.*계속 플레이/);
  const workerHandlers=new Map();registration.installing={state:'installing',addEventListener:(type,handler)=>workerHandlers.set(type,handler)};registrationHandlers.get('updatefound')();assert.match(elements.get('solo-app-status').textContent,/검증 중/);registration.installing.state='redundant';workerHandlers.get('statechange')();assert.match(elements.get('solo-app-status').textContent,/검증 실패.*유지/);
  registration.waiting={};clickHandlers.get('solo-app-check-update')();await tick();assert.equal(checks,3);assert.match(elements.get('solo-app-status').textContent,/새 버전 준비 완료.*모든 게임 창/);
  assert.equal(elements.get('solo-app-check-update').disabled,false);
});
test('first-time installation reports long cache work, failure, and a later successful retry without duplicate listeners',async()=>{
  let resolveReady;const handlers=new Map(),workerHandlers=new Map(),installing={state:'installing',listeners:0,addEventListener(type,callback){this.listeners++;workerHandlers.set(type,callback);}};
  const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect','solo-app-check-update'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:()=>{}}]));
  const registration={installing,waiting:null,addEventListener:(type,handler)=>handlers.set(type,handler),update:async()=>{}};
  const navigator={serviceWorker:{controller:null,register:async()=>registration,ready:new Promise(resolve=>{resolveReady=resolve;})}};
  runInNewContext(read('register.js').toString(),{navigator,window:{isSecureContext:true},document:{getElementById:id=>elements.get(id)}});
  await new Promise(resolve=>setImmediate(resolve));
  const status=elements.get('solo-app-status');
  assert.match(status.textContent,/오프라인 앱 설치 중.*계속 플레이/);
  handlers.get('updatefound')();assert.equal(installing.listeners,1,'existing worker gets only one state listener');
  installing.state='redundant';workerHandlers.get('statechange')();assert.match(status.textContent,/설치 실패.*재실행은 보장되지/);
  const replacement={state:'installing',addEventListener:(type,handler)=>workerHandlers.set(type,handler)};
  registration.installing=replacement;handlers.get('updatefound')();assert.match(status.textContent,/설치 중/);
  replacement.state='installed';workerHandlers.get('statechange')();assert.match(status.textContent,/준비 완료.*인터넷 없이/);
  resolveReady(registration);await new Promise(resolve=>setImmediate(resolve));assert.match(status.textContent,/준비 완료.*기록은 이 주소/);
});
test('cache progress comes only from the current installing worker and never replaces completion',async()=>{
  let onMessage;const handlers=new Map(),workerHandlers=new Map(),worker={state:'installing',addEventListener:(type,handler)=>workerHandlers.set(type,handler)};
  const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect','solo-app-check-update'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:()=>{}}]));
  const registration={installing:worker,waiting:null,addEventListener:(type,handler)=>handlers.set(type,handler),update:async()=>{}};
  const navigator={serviceWorker:{controller:null,register:async()=>registration,ready:new Promise(()=>{}),addEventListener:(type,handler)=>{if(type==='message')onMessage=handler;}}};
  runInNewContext(read('register.js').toString(),{navigator,window:{isSecureContext:true},document:{getElementById:id=>elements.get(id)}});
  await new Promise(resolve=>setImmediate(resolve));
  const status=elements.get('solo-app-status'),data={type:'card-duel-cache-progress',release:release.id,done:2,all:7};
  onMessage({source:{},data});assert.doesNotMatch(status.textContent,/2\/7/);
  onMessage({source:worker,data:{...data,done:9}});assert.doesNotMatch(status.textContent,/9\/7/);
  onMessage({source:worker,data});assert.match(status.textContent,/설치 중.*2\/7/);
  worker.state='installed';workerHandlers.get('statechange')();assert.match(status.textContent,/준비 완료/);
  onMessage({source:worker,data:{...data,done:7}});assert.match(status.textContent,/준비 완료/);
  assert.doesNotMatch(status.textContent,/7\/7/,'late progress cannot hide completion');
});
test('slow ready callback never hides an already waiting verified patch',async()=>{
  let resolveReady;const elements=new Map(['solo-app-status','solo-app-banner','solo-storage-status','solo-storage-protect','solo-app-check-update'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener:()=>{}}]));
  const registration={installing:null,waiting:{},addEventListener:()=>{},update:async()=>{}};
  const navigator={serviceWorker:{controller:{},register:async()=>registration,ready:new Promise(resolve=>{resolveReady=resolve;})}};
  runInNewContext(read('register.js').toString(),{navigator,window:{isSecureContext:true},document:{getElementById:id=>elements.get(id)}});
  await new Promise(resolve=>setImmediate(resolve));assert.match(elements.get('solo-app-status').textContent,/새 버전 준비 완료/);
  resolveReady(registration);await new Promise(resolve=>setImmediate(resolve));assert.match(elements.get('solo-app-status').textContent,/새 버전 준비 완료.*모든 게임 창/);
});
test('local-only launcher serves fixed app assets and denies unrelated paths and methods',async t=>{
  const server=createSoloAppServer(directory);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const home=await fetch(origin+'/');assert.equal(home.status,200);assert.equal(hash(Buffer.from(await home.arrayBuffer())),release.files['index.html']);
  const sw=await fetch(origin+'/sw.js');assert.match(sw.headers.get('Content-Type'),/javascript/);assert.equal(sw.headers.get('Cache-Control'),'no-cache');
  assert.equal((await fetch(origin+'/manifest.webmanifest')).headers.get('Content-Type'),'application/manifest+json');
  for(const [name,kind] of [['game.js','javascript'],['game.css','text/css']]){
    const resource=await fetch(origin+'/'+name);assert.match(resource.headers.get('Content-Type'),new RegExp(kind));
    assert.equal(hash(Buffer.from(await resource.arrayBuffer())),release.files[name]);
  }
  assert.equal((await fetch(origin+'/index.html',{method:'HEAD'})).status,200);
  assert.deepEqual(await (await fetch(origin+'/version.json?check=1')).json(),{version:release.version,release:release.id});
  assert.equal((await fetch(origin+'/README.md')).status,404);assert.equal((await fetch(origin+'/sw.js',{method:'POST'})).status,405);
  const invalidHost=await new Promise((resolve,reject)=>{get(origin+'/',{headers:{Host:'untrusted.invalid'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});
  assert.equal(invalidHost,403);
});
test('launcher verifies a complete release and serves immutable files until a deliberate restart',async t=>{
  const temporary=mkdtempSync(resolve(tmpdir(),'card-duel-release-'));
  t.after(()=>rmSync(temporary,{recursive:true,force:true}));
  cpSync(directory,temporary,{recursive:true});
  assert.equal(loadSoloRelease(temporary).id,release.id);
  const server=createSoloAppServer(temporary);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  writeFileSync(resolve(temporary,'game.css'),'mixed release asset');
  assert.throws(()=>loadSoloRelease(temporary),/integrity mismatch: game.css/);
  assert.throws(()=>createSoloAppServer(temporary),/integrity mismatch: game.css/);
  assert.equal(hash(Buffer.from(await (await fetch(origin+'/register.js')).arrayBuffer())),release.files['register.js']);
  assert.equal(hash(Buffer.from(await (await fetch(origin+'/game.css')).arrayBuffer())),release.files['game.css']);
  writeFileSync(resolve(temporary,'game.css'),read('game.css'));
  writeFileSync(resolve(temporary,'game.js'),'mixed release asset');
  assert.throws(()=>loadSoloRelease(temporary),/integrity mismatch: game.js/);
  writeFileSync(resolve(temporary,'game.js'),read('game.js'));
  writeFileSync(resolve(temporary,'sw.js'),worker+'\n// changed');
  assert.throws(()=>loadSoloRelease(temporary),/integrity mismatch: sw.js/);
  writeFileSync(resolve(temporary,'sw.js'),worker);
  rmSync(resolve(temporary,'icon-192.png'));
  assert.throws(()=>loadSoloRelease(temporary),/ENOENT/);
});
