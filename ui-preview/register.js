// A status toast must never take up a row in the landscape game canvas.
// Dismissal stays in effect until a new actionable patch or a failure occurs.
let statusDismissed=false;
document.getElementById('solo-app-dismiss')?.addEventListener('click',()=>{
  statusDismissed=true;
  const banner=document.getElementById('solo-app-banner');
  if(banner)banner.hidden=true;
});
// Web users may install this *same* release without an app-store build.
// beforeinstallprompt is Chromium-only; Safari and unsupported browsers keep
// their own Home Screen menu, so show a manual guide rather than a fake prompt.
const installButton=document.getElementById('solo-app-install');
const installHelp=document.getElementById('solo-app-install-help');
let deferredInstallPrompt=null;
const standaloneMode=()=>Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
const installNotice=message=>{
  const status=document.getElementById('solo-app-status');
  const banner=document.getElementById('solo-app-banner');
  if(status&&!window.__cardDuelAssetFailed)status.textContent=message;
  statusDismissed=false;
  if(banner){if(banner.dataset)banner.dataset.urgent=window.__cardDuelAssetFailed?'true':'false';banner.hidden=false;}
};
const clearInstallOffer=()=>{
  deferredInstallPrompt=null;
  if(installButton)installButton.hidden=true;
  if(installHelp)installHelp.hidden=true;
};
if(window.isSecureContext&&!standaloneMode()){
  if(installHelp)installHelp.hidden=false;
  installHelp?.addEventListener('click',()=>{
    const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');
    installNotice(ios?'Safari 공유 메뉴 → 홈 화면에 추가를 선택하세요. 설치 후 아이콘으로 실행하면 주소창 없이 플레이할 수 있어요.':'브라우저 메뉴 → 앱 설치 또는 홈 화면에 추가를 선택하세요. 설치 후 아이콘으로 실행하면 주소창 없이 플레이할 수 있어요.');
  });
  window.addEventListener?.('beforeinstallprompt',event=>{
    event.preventDefault?.();
    if(standaloneMode())return;
    deferredInstallPrompt=event;
    if(installButton)installButton.hidden=false;
    installNotice('설치 가능 · 앱 설치 버튼을 누르면 주소창 없는 게임 아이콘을 추가할 수 있어요.');
  });
  installButton?.addEventListener('click',async()=>{
    if(!deferredInstallPrompt)return;
    const invitation=deferredInstallPrompt;
    deferredInstallPrompt=null;
    if(installButton)installButton.hidden=true;
    try{
      await invitation.prompt();
      const choice=await invitation.userChoice;
      installNotice(choice?.outcome==='accepted'?'설치 요청 완료 · 홈 화면에 아이콘이 생기면 그 아이콘으로 실행하세요.':'설치를 취소했어요. 브라우저 메뉴에서 다시 설치할 수 있어요.');
    }catch{installNotice('설치 창을 열지 못했어요. 브라우저 메뉴의 홈 화면에 추가를 이용하세요.');}
  });
  window.addEventListener?.('appinstalled',()=>{
    clearInstallOffer();
    installNotice('홈 화면에 설치됨 · Card Duel 아이콘으로 실행하면 주소창 없이 플레이할 수 있어요.');
  });
}
// Registration is optional: the same game still renders without a service worker.
if ('serviceWorker' in navigator && window.isSecureContext) {
  const storageStatus=document.getElementById('solo-storage-status');
  const protect=document.getElementById('solo-storage-protect');
  let storageStatusEpoch=0;
  const describeStorage=async()=>{
    if(!storageStatus||!protect)return;
    const epoch=++storageStatusEpoch;
    if(typeof navigator.storage?.persisted!=='function'||typeof navigator.storage?.persist!=='function'){
      storageStatus.textContent='브라우저 저장 보호 미지원 · 성장/덱 백업 권장';return;
    }
    try{
      const granted=await navigator.storage.persisted();
      if(epoch!==storageStatusEpoch)return;
      storageStatus.textContent=granted?'브라우저 저장 보호 승인됨 · 별도 백업은 계속 권장':'브라우저 저장 보호 미승인 · 백업 권장';
      protect.hidden=granted;
    }catch{if(epoch===storageStatusEpoch)storageStatus.textContent='브라우저 저장 보호 상태 확인 불가 · 백업 권장';}
  };
  protect?.addEventListener('click',async()=>{
    if(protect.disabled)return;
    const epoch=++storageStatusEpoch;
    protect.disabled=true;
    try{await navigator.storage.persist();await describeStorage();}
    catch{if(epoch===storageStatusEpoch&&storageStatus)storageStatus.textContent='저장 보호 요청 실패 · 성장/덱 백업 권장';}
    finally{protect.disabled=false;}
  });
  describeStorage();
  const announce = (message) => {
    // A long-running first render is not a corrupted game asset. Let the
    // startup watchdog keep its warning until React actually mounts; a
    // routine service-worker ready callback must not conceal it.
    if(window.__cardDuelStartupDelayed&&message.startsWith('오프라인 앱 준비 완료'))return;
    const status = document.getElementById('solo-app-status');
    const banner = document.getElementById('solo-app-banner');
    if (status) status.textContent = window.__cardDuelAssetFailed?'게임 파일 일부를 불러오지 못했습니다 · 실행기를 다시 연결한 뒤 새로고침하세요. 기존 저장 기록을 삭제하지 마세요.':message;
    const assetFailed=Boolean(window.__cardDuelAssetFailed);
    const urgent=assetFailed||/패치 검증 실패|오프라인 앱 설치 실패|오프라인 앱 준비 실패|오프라인 앱 준비 상태 확인 실패/.test(message);
    if(banner?.dataset)banner.dataset.urgent=urgent?'true':'false';
    if (assetFailed||/새 버전 준비 완료|패치 검증 실패|오프라인 앱 설치 실패|오프라인 앱 준비 실패|오프라인 앱 준비 상태 확인 실패/.test(message)) statusDismissed=false;
    // In an installed app, a routine cache-ready check should not cover
    // gameplay on every launch. Only new patches, integrity failures or
    // install problems may reopen the overlay without a direct request.
    const quietStartup=!assetFailed&&standaloneMode()&&message.startsWith('오프라인 앱 준비 완료');
    if(banner)banner.hidden=quietStartup||statusDismissed;
  };
  navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(registration => {
    const updateMessage = () => announce('새 버전 준비 완료 · 진행 중 경기를 저장하고 모든 게임 창을 닫은 뒤 다시 실행하세요.');
    const updateButton=document.getElementById('solo-app-check-update');
    let checking=false,lastCheck=0,updateObserved=false,observedWorker=null;
    if (registration.waiting && navigator.serviceWorker.controller) updateMessage();
    const observeInstallation = () => {
      updateObserved=true;
      const worker = registration.installing;
      if(!worker||observedWorker===worker)return;
      observedWorker=worker;
      if(navigator.serviceWorker.controller)announce('새 패치 파일 검증 중 · 현재 게임 버전은 유지됩니다.');
      else announce('오프라인 앱 설치 중 · 게임은 계속 플레이할 수 있습니다.');
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          if (navigator.serviceWorker.controller) updateMessage();
          else announce('오프라인 앱 준비 완료 · 이 기기에서 인터넷 없이 다시 실행할 수 있습니다.');
        }else if(worker.state==='redundant'){
          if(navigator.serviceWorker.controller&&!registration.waiting)announce('새 패치 검증 실패 · 현재 버전을 유지합니다.');
          else if(!navigator.serviceWorker.controller)announce('오프라인 앱 설치 실패 · 현재 화면은 플레이 가능하지만 오프라인 재실행은 보장되지 않습니다.');
        }
      });
    };
    registration.addEventListener('updatefound', observeInstallation);
    // Registration can resolve after updatefound: observe the already
    // installing worker as well, without registering duplicate listeners.
    observeInstallation();
    navigator.serviceWorker.addEventListener?.('message',event=>{
      const data=event.data,worker=observedWorker;
      // Messages from a different or already-finished worker must not mask
      // an installed release or pretend that a patch is ready.
      if(!worker||event.source!==worker||worker.state!=='installing'||data?.type!=='card-duel-cache-progress')return;
      if(!/^[a-f0-9]{64}$/.test(data.release)||!Number.isInteger(data.done)||!Number.isInteger(data.all)||data.done<1||data.all<1||data.done>data.all||data.all>64)return;
      const label=navigator.serviceWorker.controller?'새 패치 검증 중':'오프라인 앱 설치 중';
      announce(`${label} · 캐시 파일 ${data.done}/${data.all} 확인 · 현재 게임은 계속 플레이할 수 있습니다.`);
    });
    navigator.serviceWorker.ready.then(() => {
      if (registration.waiting&&navigator.serviceWorker.controller)updateMessage();
      else if(!registration.waiting&&!['installing','redundant'].includes(registration.installing?.state))announce('오프라인 앱 준비 완료 · 진행 기록은 이 주소에 저장됩니다.');
      // An installing worker owns the progress banner. Do not announce
      // 'ready' while its new cache is still incomplete.
    }).catch(()=>announce('오프라인 앱 준비 상태 확인 실패 · 연결되면 다시 확인하세요.'));
    // A failed offline check never prevents playing the cached version, and
    // no update request forces activation or replaces an ongoing match.
    const check=async(manual=false)=>{
      // Mobile OS wake/sleep ordering can dispatch focus/online while the
      // PWA is still hidden. Check only once it becomes visible again.
      if(!manual&&document.hidden)return;
      if(checking||!manual&&Date.now()-lastCheck<60000)return;
      if(registration.waiting&&navigator.serviceWorker.controller){updateMessage();return;}
      checking=true;lastCheck=Date.now();updateObserved=false;if(updateButton)updateButton.disabled=true;
      if(manual)announce('새 패치 확인 중…');
      try{await registration.update();if(registration.waiting&&navigator.serviceWorker.controller)updateMessage();else if(registration.installing&&navigator.serviceWorker.controller)announce('새 패치 파일 검증 중 · 현재 게임 버전은 유지됩니다.');else if(manual&&!updateObserved)announce('새 패치 없음 · 현재 버전을 사용합니다.');}
      catch{if(manual)announce('패치 확인 실패 · 현재 버전으로 계속 플레이할 수 있습니다.');}
      finally{checking=false;if(updateButton)updateButton.disabled=false;}
    };
    if(updateButton){updateButton.hidden=false;updateButton.addEventListener('click',()=>void check(true));}
    window.addEventListener?.('focus',()=>void check());window.addEventListener?.('online',()=>void check());
    // Installed mobile PWAs commonly resume with visibilitychange but no
    // window focus event. Keep the same 60s throttle and never update a
    // hidden app, so returning to play can discover a queued patch safely.
    document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)void check();});
    void check();
  }).catch(() => announce('오프라인 앱 준비 실패 · 현재 화면에서는 플레이 가능하지만 브라우저 설치 기능은 보장되지 않습니다.'));
}else{
  // A browser without secure service workers may still run the local game,
  // but must not look like a completed offline installation.
  const status=document.getElementById('solo-app-status'),banner=document.getElementById('solo-app-banner');
  if(status&&!window.__cardDuelAssetFailed)status.textContent='브라우저 오프라인 설치 미지원 · 게임 플레이는 가능하지만 오프라인 재실행은 보장되지 않습니다.';
  if(banner)banner.hidden=false;
}
