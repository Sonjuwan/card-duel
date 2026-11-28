/* The build substitutes a content-derived cache identifier and asset digests. */
const release = {"id":"48681b4fba156e77461da6f77233d80c3d74238dba649741023e326241455a08","version":"0.337.0","files":{"game.js":"f29749d43db4c093033da975203eeafe740dcb40415e8f6ac5d2a23b057fb2fb","game.css":"89eaa4e8c208091401c335d6cb853b28f6568623f917946d608389f9aeda875d","manifest.webmanifest":"a9fce88daf3089a83adaf5e6402a9057a22e955223a6b11a5938688739fc62d6","register.js":"befe46e0a843b0424180383b1ac22b5fd6ea97bab900ea0c77105b8b07e701d4","icon-192.png":"771ad00d3660ade913cf2882190d02b0c2b8e166f1ecc4e8f7b6baccb3c6bc7d","icon-512.png":"6f3716d5eca73f2206b66b9e581778a20bd50032b19825ee079318144448dcaf","index.html":"75b11d41ce51e3a9e040a1a4ebd1575fe256c165a05b0f7e742143874ee4f924"}};
const prefix = 'card-duel-solo-app:' + self.registration.scope + ':';
const cacheName = prefix + release.id;
const url = path => new URL(path, self.registration.scope).href;
const assets = new Map(Object.entries(release.files).map(([path,hash])=>[url(path),hash]));
const app = url('index.html');
const root = url('./');
// Verification lasts only for this worker process. A restarted worker checks
// each cached response on first use before serving it.
const checkedCache=new Set();
const pointerCache=prefix+'active-pointer';
const pointerKey=url('__card-duel-active-release__');
async function responseMatches(response,hash) {
  if(!response?.ok||response.redirected)return false;
  const bytes=await response.clone().arrayBuffer();
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  return actual===hash;
}
async function verifiedResponse(path,hash) {
  const response = await fetch(path,{cache:'reload'});
  if(!await responseMatches(response,hash))throw Error('Offline asset integrity mismatch or unavailable');
  return response;
}
async function reportInstall(done) {
  try{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows)try{client.postMessage({type:'card-duel-cache-progress',release:release.id,done,all:assets.size});}catch{}
  }catch{/* Install integrity never depends on notification support. */}
}

async function activeReleaseCache(names) {
  if(!names.includes(pointerCache))return undefined;
  try{
    const pointer=await (await caches.open(pointerCache)).match(pointerKey);
    const active=await pointer?.text();
    if(active&&active!==cacheName&&active.startsWith(prefix)&&
       /^[a-f0-9]{64}$/.test(active.slice(prefix.length))&&names.includes(active))
      return await caches.open(active);
  }catch{/* An unavailable or corrupt cache pointer must not block installation. */}
}
async function reusableAsset(cache,path,hash) {
  if(!cache)return undefined;
  try{
    const response=await cache.match(path);
    if(await responseMatches(response,hash))return response;
  }catch{/* The normal network and integrity path can recover this asset. */}
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const names=await caches.keys();
    const existed=names.includes(cacheName);
    const activeCache=await activeReleaseCache(names);
    const cache = await caches.open(cacheName);
    let done=0;
    try {
      // Do not activate a partial/mixed release from an interrupted patch.
      for (const [path, hash] of assets) {
        // Exact-release reinstalls can recover offline using verified assets.
        // Never delete an already existing complete cache on network failure.
        if(existed){
          const cached=await cache.match(path);
          if(cached&&await responseMatches(cached,hash)){await reportInstall(++done);continue;}
          if(cached)await cache.delete(path);
        }
        const reused=await reusableAsset(activeCache,path,hash);
        await cache.put(path,reused??await verifiedResponse(path,hash));
        await reportInstall(++done);
      }
      // Installation just verified every response placed in this release.
      // A restarted worker has an empty set and still checks on first use.
      for(const path of assets.keys())checkedCache.add(path);
    } catch (error) { if(!existed)await caches.delete(cacheName); throw error; }
    // No skipWaiting: do not replace the version beneath an active game.
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // Delete only a known previous active release. A different cache may
    // belong to another installing/waiting patch, not an obsolete version.
    // Legacy releases lack the pointer; retain their cache on first migration.
    try{
      const meta=await caches.open(pointerCache),old=await meta.match(pointerKey),previous=old?await old.text():null;
      await meta.put(pointerKey,new Response(cacheName));
      if(previous&&previous!==cacheName&&previous.startsWith(prefix)&&/^[a-f0-9]{64}$/.test(previous.slice(prefix.length)))await caches.delete(previous);
    }catch{/* Cache bookkeeping failure must not invalidate a ready release. */}
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const requested=new URL(event.request.url);requested.hash='';
  // Installed games can be opened from a bookmarked/share URL with a query
  // string. Match only the exact known asset pathname within this SW scope,
  // then serve the byte-verified immutable release without network access.
  requested.search='';
  const address=requested.href===root?app:requested.href;
  if(!assets.has(address))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    // Never mix old active assets with a new deployment.
    const cached=await cache.match(address);
    if(cached){
      if(checkedCache.has(address)||await responseMatches(cached,assets.get(address))){
        checkedCache.add(address);return cached;
      }
      // Cache Storage may contain an incomplete or damaged asset after a
      // crash. Never serve it or silently borrow bytes from an older patch.
      await cache.delete(address);
    }
    checkedCache.delete(address);
    // Browser cache eviction is recoverable only using the exact same release.
    try{
      const recovered=await verifiedResponse(address,assets.get(address));
      try{await cache.put(address,recovered.clone());checkedCache.add(address);}catch{/* Quota exceeded: the verified response can still be played. */}
      return recovered;
    }catch{return new Response('Offline app cache missing. Reopen while connected.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  })());
});

// A waiting worker can only be promoted by a user request from a controlled
// game window. Each game window must freeze its lobby and acknowledge first.
let applying=false;
async function gameWindows(){
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  return windows.filter(client=>{
    const address=new URL(client.url);address.search='';address.hash='';
    return address.href===root||address.href===app;
  });
}
function checkWindow(client,token){
  return new Promise(resolve=>{
    const {port1,port2}=new MessageChannel();
    const finish=result=>{clearTimeout(timer);port1.close();resolve(result);};
    const timer=setTimeout(()=>finish('다른 게임 창의 상태를 확인할 수 없습니다.'),3000);
    port1.onmessage=event=>finish(event.data?.token===token?event.data.reason:'다른 게임 창의 상태를 확인할 수 없습니다.');
    try{client.postMessage({type:'card-duel-prepare-update',release:release.id,version:release.version,token},[port2]);}
    catch{finish('다른 게임 창의 상태를 확인할 수 없습니다.');}
  });
}
self.addEventListener('message',event=>{
  const port=event.ports[0],data=event.data;
  if(!port)return;
  if(data?.type==='card-duel-release'){
    port.postMessage({release:release.id,version:release.version});
    return;
  }
  if(data?.type!=='card-duel-apply-update'||data.release!==release.id||applying||
    self.registration.waiting?.state!=='installed')return;
  applying=true;
  event.waitUntil((async()=>{
    const token=crypto.randomUUID();
    let windows=[];
    try{
      windows=await gameWindows();
      if(!windows.some(client=>client.id===event.source?.id))throw Error('이 게임 창에서 다시 시도하세요.');
      const reasons=await Promise.all(windows.map(client=>checkWindow(client,token)));
      const reason=reasons.find(value=>value!==null);
      if(reason!==undefined)throw Error(typeof reason==='string'?reason:'게임 저장 상태를 확인할 수 없습니다.');
      const confirmed=await gameWindows();
      if(confirmed.some(client=>!windows.some(known=>known.id===client.id)))throw Error('새 게임 창이 열렸습니다. 잠시 후 다시 시도하세요.');
      // Locks prevent new actions in the verified windows up to controllerchange.
      port.postMessage({ok:true});
      await self.skipWaiting();
    }catch(error){
      for(const client of windows)client.postMessage({type:'card-duel-cancel-update',token});
      port.postMessage({reason:error.message});
    }finally{applying=false;}
  })());
});
