/* The build substitutes a content-derived cache identifier and asset digests. */
const release = {"id":"2c762c25fb6e431327078989a57940183a01a54c0263d346d5240583a05965d1","version":"0.314.0","files":{"game.js":"3b5485c9475ab8f2c4dd97b94bde5c354c517da61ca0d16e3fb350c502a1ed21","game.css":"7e0086ef881443c44bd224e67a22c3ab2307a935d00788c14b09fabc1b81fb61","manifest.webmanifest":"81922b9d40d3a3f15d8168adeaaa2fb80009daac17242666b98c69f146df2ea4","register.js":"33bdada5c1a9b20419d7eca2d14a94d3f92b28ac8e1b1769ec493f55f9c3de34","icon-192.png":"2190f8168d94278ce3dd23fb9f935fce878efe9f0f4be4739ef1d8bda3850a74","icon-512.png":"eddf576e10e76b866739b33183ec014d9b91058bf4fb10c84e41fd6d9600f4ff","index.html":"5102723f7579ebf01d3730a1ccad19a9adae46e8792a399d055649621c610017"}};
const prefix = 'card-duel-solo-app:' + self.registration.scope + ':';
const cacheName = prefix + release.id;
const url = path => new URL(path, self.registration.scope).href;
const assets = new Map(Object.entries(release.files).map(([path,hash])=>[url(path),hash]));
const app = url('index.html');
const root = url('./');
// A worker process checks each cached response at first use. Further reads in
// that process reuse the verified result without rehashing 14 MB of card art.
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

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed=(await caches.keys()).includes(cacheName);
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
        await cache.put(path,await verifiedResponse(path,hash));
        await reportInstall(++done);
      }
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
      checkedCache.delete(address);
      await cache.delete(address);
    }
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
