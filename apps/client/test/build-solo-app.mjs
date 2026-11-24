import {splitSoloMusic} from '../solo-app/music-assets.mjs';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {soloManifest as manifest} from '../solo-app/manifest-config.mjs';
const source=resolve('apps/client/solo-app'),destination=resolve(process.env.CARD_DUEL_SOLO_APP_DIST_DIR||'dist/solo-app');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const standalone=readFileSync('solo-offline.html','utf8');
const version=JSON.parse(readFileSync('package.json','utf8')).version;
if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');

const head='<meta name="theme-color" content="#211b19"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-192.png">';
const banner=`<aside id="solo-app-banner" hidden role="region" aria-label="오프라인 설치와 업데이트 상태" style="font:12px/1.45 system-ui,sans-serif;color:#e1ca98;background:#31281ff2;margin:0"><strong>Card Duel v${version}</strong> · <span id="solo-app-status" role="status"></span> <button id="solo-app-check-update" type="button" hidden>패치 확인</button> <button id="solo-app-install" type="button" hidden>앱 설치</button> <button id="solo-app-install-help" type="button" hidden>설치 방법</button> · <span id="solo-storage-status" role="status"></span> <button id="solo-storage-protect" type="button" hidden>기기 저장 보호 요청</button> <button id="solo-app-dismiss" type="button" aria-label="상태 알림 닫기">✕</button></aside>`;
// Status is an overlay, NOT a full-width layout row: otherwise the PWA
// banner adds height to a 100dvh game and re-enables document scrolling.
const shellStyle='<style id="solo-app-shell-style">#solo-app-banner{position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);right:calc(env(safe-area-inset-right,0px) + 6px);width:min(330px,calc(100dvw - 24px));max-height:min(40dvh,220px);overflow:auto;box-sizing:border-box;z-index:60000;padding:6px 9px;border:1px solid #bd985e;border-radius:10px;box-shadow:0 5px 20px #0009;overscroll-behavior:contain}#solo-app-banner[hidden]{display:none!important}#solo-app-banner button{min-height:44px;min-width:44px;margin:2px;font:inherit}#solo-app-dismiss{float:right}/* Keep a queued patch notice out of the arena until returning to the lobby. */body:has(#root .game-main .duel-screen) #solo-app-banner:not([data-urgent="true"]){visibility:hidden;pointer-events:none}</style>';
const script=standalone.match(/<script type="module">([\s\S]*?)<\/script>/),style=standalone.match(/<style>([\s\S]*?)<\/style>/);
if(!script||!style||(standalone.match(/<script type="module">/g)??[]).length!==1||(standalone.match(/<style>/g)??[]).length!==1)throw Error('Could not isolate standalone resources');
// Installable document must still display an actionable error if its large
// stylesheet or game module cannot load. Catch resource errors before the
// stylesheet begins loading; the register script may run after the failure.
const assetWatch=`<script id="solo-asset-watch">(function(){
  const missing='게임 파일 일부를 불러오지 못했습니다 · 실행기를 다시 연결한 뒤 새로고침하세요. 기존 저장 기록을 삭제하지 마세요.';
  const delayed='게임 시작이 지연되고 있습니다 · 연결 상태를 확인하거나 조금 뒤 다시 실행해 보세요. 저장 기록은 삭제하지 마세요.';
  const crashed='게임 코드 실행 중 오류가 발생했습니다 · 새로고침해 다시 실행하세요. 문제가 반복되면 기존 저장 기록을 삭제하지 말고 백업하세요.';
  const notice=message=>{const status=document.getElementById('solo-app-status'),banner=document.getElementById('solo-app-banner');if(status)status.textContent=message;if(banner){if(banner.dataset)banner.dataset.urgent='true';banner.hidden=false;}};
  const showMissing=()=>{window.__cardDuelAssetFailed=true;window.__cardDuelStartupDelayed=false;notice(missing);};
  const showCrash=()=>{if(window.__cardDuelAssetFailed)return;window.__cardDuelAssetFailed=true;window.__cardDuelStartupDelayed=false;notice(crashed);};
  const showDelayed=()=>{
    if(window.__cardDuelAssetFailed)return;
    if(document.hidden){
      // A background/locked phone cannot be expected to mount React on time.
      // Give it a fresh foreground grace period instead of a false failure.
      const resumed=()=>{if(document.hidden)return;document.removeEventListener('visibilitychange',resumed);window.setTimeout(showDelayed,15000);};
      document.addEventListener('visibilitychange',resumed);
      return;
    }
    const root=document.getElementById('root');
    if(root?.firstElementChild)return;
    window.__cardDuelStartupDelayed=true;
    notice(delayed);
    // On slower phones a successful React mount can arrive after the timeout.
    // Do not permanently report it as corrupt or cover the game after recovery.
    if(!root||typeof MutationObserver!=='function')return;
    const observer=new MutationObserver(()=>{
      if(!root.firstElementChild)return;
      observer.disconnect();
      window.__cardDuelStartupDelayed=false;
      if(window.__cardDuelAssetFailed)return;
      const status=document.getElementById('solo-app-status'),banner=document.getElementById('solo-app-banner');
      if(status?.textContent===delayed){status.textContent='게임 화면 준비 완료';if(banner)banner.hidden=true;}
    });
    observer.observe(root,{childList:true});
  };
  window.addEventListener('error',event=>{
    const node=event.target;
    if(!node||typeof node.getAttribute!=='function'){
      // game.js can download successfully yet throw before the first React
      // paint. A resource error listener alone cannot detect this failure.
      // Ignore extensions and later, nonfatal UI errors. Never expose stacks.
      const source=event.filename;
      if(typeof source!=='string'||!((source.split('?')[0]==='game.js')||source.split('?')[0].endsWith('/game.js')))return;
      if(document.getElementById('root')?.firstElementChild)return;
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showCrash,{once:true});else showCrash();
      return;
    }
    const tag=node.tagName?.toLowerCase(),src=node.getAttribute('src');
    if(!(tag==='script'&&(src==='game.js'||src==='register.js')||tag==='link'&&node.getAttribute('href')==='game.css'))return;
    window.__cardDuelAssetFailed=true;
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showMissing,{once:true});else showMissing();
  },true);
  window.addEventListener('load',()=>window.setTimeout(showDelayed,15000));
})();</script>`;
// The freely shareable one-file HTML remains unchanged. Only the installable
// package separates large card art CSS and game code into integrity-checked
// same-origin resources so the document itself stays small.
// The verified standalone file deliberately uses ordinary browser viewport
// behavior. An installed PWA also wants pixels beneath a device's rounded
// corners/notch, with safe-area-inset padding applied by landscape-shell.css.
// Modify the INSTALLABLE copy only; never silently alter the old game binary.
const viewport=standalone.match(/<meta name="viewport" content="([^"]+)"\s*\/>/);
if(!viewport)throw Error('Could not locate standalone viewport meta');
const immersiveViewport='<meta name="viewport" content="'+(viewport[1].includes('viewport-fit=cover')?viewport[1]:viewport[1]+',viewport-fit=cover')+'"/>';
const html=standalone.replace(viewport[0],immersiveViewport).replace(script[0],'<script type="module" src="game.js"></script>').replace(style[0],assetWatch+'<link rel="stylesheet" href="game.css">').replace('</head>',head+shellStyle+'</head>').replace('<div id="root">',banner+'<div id="root">').replace('</body>','<script src="register.js" defer></script></body>');
if(html===standalone||!html.includes(banner)||!html.includes('game.js')||!html.includes('game.css')||!html.includes('register.js'))throw Error('Could not package standalone game');
const score=splitSoloMusic(script[1],name=>readFileSync(resolve('apps/client/src/assets/music',name)));
const files={...score.files,'index.html':Buffer.from(html),'game.js':Buffer.from(score.script),'game.css':Buffer.from(style[1]),'manifest.webmanifest':Buffer.from(JSON.stringify(manifest,null,2)), 'register.js':readFileSync(resolve(source,'register.js')),'icon-192.png':readFileSync(resolve(source,'icon-192.png')),'icon-512.png':readFileSync(resolve(source,'icon-512.png'))};
const template=readFileSync(resolve(source,'sw-template.js'),'utf8');
const hashes=Object.fromEntries(Object.entries(files).map(([path,bytes])=>[path,digest(bytes)]));
const release={id:digest(JSON.stringify(hashes)+template),files:hashes};
const worker=template.replace('__CACHE_SPEC__',JSON.stringify(release));
mkdirSync(destination,{recursive:true});
for(const [name,bytes] of Object.entries(files))writeFileSync(resolve(destination,name),bytes);
writeFileSync(resolve(destination,'sw.js'),worker);
console.log(`Offline install package: dist/solo-app (release ${release.id.slice(0,12)})`);
