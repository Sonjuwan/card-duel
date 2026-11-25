/* The build substitutes a content-derived cache identifier and asset digests. */
const release = {"id":"394b691eb41873655daf63d48111233c076871f12b76c5366214268a4523cae5","files":{"index.html":"e442b45c5fbe82e137e23268c2a84aea59da3960fa73c82f118612b1f728bb15","game.js":"85c83f5bfbab41d0bb462239a49de0cc4a8479e0acf64756d7c9205a0acabd85","game.css":"ae06a7db602539e12966cb967791b15b20ff37fd142bcdf245cd3b91c25abea4","manifest.webmanifest":"81922b9d40d3a3f15d8168adeaaa2fb80009daac17242666b98c69f146df2ea4","register.js":"ad4382555dc051456317816cb2a95dd0f0993b0a763597bf3ab356a159014622","icon-192.png":"2190f8168d94278ce3dd23fb9f935fce878efe9f0f4be4739ef1d8bda3850a74","icon-512.png":"eddf576e10e76b866739b33183ec014d9b91058bf4fb10c84e41fd6d9600f4ff"}};
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
