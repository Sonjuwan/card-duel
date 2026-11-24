/* The build substitutes a content-derived cache identifier and asset digests. */
const release = {"id":"5c9778cd5ab766901fccdae05af77fb6cab14f958fcf9b7a502c4f1f4a5a7efa","files":{"music-home.mp3":"372523c76205f0327b70badf6c60ed0b89f48d3ae731f70ae183bedd231cdcea","music-prepare.mp3":"a007039c814a4fb3ba1109fed09e418fda35316114e60314fed7ffe4ebe58a03","music-library.mp3":"6e9abf90d0ed9a8a4862b9cc37070626855c77458aed03ca53cda713dc958148","music-deck.mp3":"8d0758f2c2c9f601b21bc247d6d42a9af1e6080b9e3e5efbc2cb169b40f4f4c2","music-battle-1.mp3":"faf0e282ed9c41244aa75286e03aec3d52c91fdc5a058493f4e524b3dd80eb60","music-battle-2.mp3":"d51b13527263ad6cfb4227fbd2fc4c5f22fc82ea537c58fa8a09240ed1b89071","music-battle-3.mp3":"f36ec60ec8b918212e349eaa41a152a0b6e9986bcadf49601c2281cecf5cbc66","music-battle-4.mp3":"d3712efccad4c14e65f2b2a609ef61299b5eaed6b1909d09ef78a00427be7e05","music-battle-5.mp3":"0421c484e0cab63f8bd689211d5cb9b0a9cd95aa05c3d75dd0a28919be9b596c","music-battle-6.mp3":"1900e2822c2cbcfed5c3dd1f71bda0f4531fc105870c45f98aed0289c879d720","music-progress.mp3":"f864f193d156ec8d994c7497057205ffdb27153e710c45c915056ea3d278dd96","music-win.mp3":"aec038f1e10ae3b4fc83d6598e60a21caf09ad9751306d6836c4d2e03b135395","music-loss.mp3":"e0a2893f5714bffed3a37fa4f5343250bea91618bff2de7c2a42c5573f062bb3","index.html":"07054dbde3d13734c85fa4cfddf0aaa7e027c772d76c4335880f0534f9dd235c","game.js":"18e32e2f5c6aa8058937b84230a5ab5c44dd7ca9a1579f7de58a535fd1294085","game.css":"32f2099a878e76165c7b75bb809ad3f01dedb9f95da33f26c1fa50557f323659","manifest.webmanifest":"81922b9d40d3a3f15d8168adeaaa2fb80009daac17242666b98c69f146df2ea4","register.js":"ad4382555dc051456317816cb2a95dd0f0993b0a763597bf3ab356a159014622","icon-192.png":"2190f8168d94278ce3dd23fb9f935fce878efe9f0f4be4739ef1d8bda3850a74","icon-512.png":"eddf576e10e76b866739b33183ec014d9b91058bf4fb10c84e41fd6d9600f4ff"}};
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
