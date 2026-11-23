import {useEffect,useRef,useState} from 'react';
import {isInstalledGameDisplay,requestLandscapeFeatures} from './landscape-mode.ts';

/** The browser may refuse fullscreen or orientation lock. Neither is needed to
 * play: the same layout is available by turning the device physically. */
export function LandscapeExperience(){
  const [notice,setNotice]=useState('');
  const [isFullscreen,setIsFullscreen]=useState(false);
  const [isInstalled,setIsInstalled]=useState(false);
  const [busy,setBusy]=useState(false);
  const requestPending=useRef(false),lockedByUs=useRef(false);
  const rotateButton=useRef<HTMLButtonElement|null>(null);
  const alreadyAppWindow=()=>isInstalledGameDisplay(query=>Boolean(window.matchMedia?.(query)?.matches),
    (navigator as Navigator & {standalone?:boolean}).standalone===true);
  useEffect(()=>{
    const sync=()=>{const full=Boolean(document.fullscreenElement);setIsFullscreen(full);
      if(!full&&lockedByUs.current){lockedByUs.current=false;try{(screen.orientation as ScreenOrientation & {unlock?:()=>void}|undefined)?.unlock?.();}catch{}}
    };
    document.addEventListener('fullscreenchange',sync);sync();
    return ()=>{document.removeEventListener('fullscreenchange',sync);if(lockedByUs.current){lockedByUs.current=false;try{(screen.orientation as ScreenOrientation & {unlock?:()=>void}|undefined)?.unlock?.();}catch{}}};
  },[]);
  useEffect(()=>{
    // Installed PWAs already run without browser address chrome. Do not offer
    // a misleading, redundant browser-fullscreen toggle inside that window.
    const standalone=window.matchMedia('(display-mode: standalone)');
    const fullDisplay=window.matchMedia('(display-mode: fullscreen)');
    const sync=()=>setIsInstalled(alreadyAppWindow());
    standalone.addEventListener?.('change',sync);
    fullDisplay.addEventListener?.('change',sync);
    window.addEventListener('focus',sync);
    sync();
    return ()=>{
      standalone.removeEventListener?.('change',sync);
      fullDisplay.removeEventListener?.('change',sync);
      window.removeEventListener('focus',sync);
    };
  },[]);
  useEffect(()=>{
    const media=window.matchMedia('(pointer: coarse) and (orientation: portrait)');
    const update=()=>{
      // The CSS overlay blocks touch, and inert prevents keyboard or screen
      // readers from silently interacting with the covered game.
      for(const selector of ['.screen-content','.app-header .connection','.app-header .brand','.app-header .landscape-fullscreen-control','main > footer']){
        const element=document.querySelector<HTMLElement>(selector);
        if(element)element.inert=media.matches;
      }
      if(media.matches)rotateButton.current?.focus();
      else if(document.activeElement===rotateButton.current){
        document.querySelector<HTMLElement>('.lobby-tabs[aria-label=\"게임 메뉴\"] button,.duel-title button,.landscape-fullscreen-control')?.focus();
      }
    };
    media.addEventListener('change',update);update();
    return ()=>{media.removeEventListener('change',update);
      for(const selector of ['.screen-content','.app-header .connection','.app-header .brand','.app-header .landscape-fullscreen-control','main > footer']){
        const element=document.querySelector<HTMLElement>(selector);if(element)element.inert=false;
      }
    };
  },[]);
  const requestLandscape=async()=>{
    if(requestPending.current)return;
    requestPending.current=true;setBusy(true);setNotice('');
    try{
      const outcome=await requestLandscapeFeatures(
        async()=>{
          if(document.fullscreenElement||alreadyAppWindow())return true;
          if(typeof document.documentElement.requestFullscreen!=='function')return false;
          await document.documentElement.requestFullscreen();return true;
        },
        async()=>{
          const orientation=screen.orientation as ScreenOrientation & {lock?:(direction:'landscape')=>Promise<void>};
          if(typeof orientation?.lock!=='function')return false;
          await orientation.lock('landscape');lockedByUs.current=true;return true;
        }
      );
      const isLandscape=window.matchMedia('(orientation: landscape)').matches;
      if(!outcome.fullscreen&&isLandscape)setNotice('이 브라우저에서는 전체화면이 제한되어 있어요. 홈 화면에 설치한 PWA는 주소창 없이 실행됩니다.');
      else if(!outcome.landscape)setNotice(outcome.fullscreen?'전체화면으로 전환했어요. 자동 가로 회전이 제한되어 있으니 휴대폰을 직접 가로로 돌려주세요.':'자동 화면 회전이 제한되어 있어요. 휴대폰을 직접 가로로 돌려주세요.');
      else if(!outcome.fullscreen)setNotice('가로 모드로 전환했어요. 이 브라우저에서는 전체화면이 제한되어 있어요.');
    }finally{requestPending.current=false;setBusy(false);}
  };
  const toggleFullscreen=async()=>{
    if(requestPending.current)return;
    if(document.fullscreenElement){
      requestPending.current=true;setBusy(true);
      try{await document.exitFullscreen();setNotice('');}
      catch{setNotice('전체화면을 종료할 수 없어요. 브라우저의 전체화면 메뉴에서 나가주세요.');}
      finally{requestPending.current=false;setBusy(false);}
    }else{await requestLandscape();}
  };
  return <>
    {!isInstalled&&<button type="button" className="landscape-fullscreen-control secondary"
      onClick={()=>void toggleFullscreen()} disabled={busy} aria-pressed={isFullscreen}
      aria-label={isFullscreen?'전체화면 종료':'전체화면 및 가로 방향 요청'}>
      {isFullscreen?'⤢ 전체화면 종료':'⛶ 전체화면'}
    </button>}
    {notice&&<div className="landscape-fullscreen-feedback" role="status">
      <span>{notice}</span><button type="button" className="secondary" aria-label="전체화면 안내 닫기" onClick={()=>setNotice('')}>닫기</button>
    </div>}
    <aside className="rotate-device-message" role="dialog" aria-modal="true" aria-label="가로 화면 안내"
      onKeyDownCapture={event=>{
        // The full-screen portrait dialog is intentionally not dismissible:
        // keyboard Tab must not move onto covered game actions or browser
        // controls while the device is waiting to rotate. It has one action.
        if(event.key==='Tab'){event.preventDefault();rotateButton.current?.focus();}
      }}>
      <div className="rotate-device-panel"><div className="rotate-device-icon" aria-hidden="true">▱</div>
        <h2>가로 화면으로 플레이</h2>
        <p>Card Duel은 메인 메뉴부터 전투·덱 편집까지 가로형으로 설계됐어요.</p>
        <p>휴대폰을 가로로 돌려주세요. 자동 회전을 지원하는 브라우저라면 아래 버튼을 사용할 수 있어요.</p>
        <button type="button" ref={rotateButton} disabled={busy} onClick={()=>void requestLandscape()}>전체화면 · 가로 전환</button>
        {notice&&<p role="status" className="rotate-device-status">{notice}</p>}
      </div>
    </aside>
  </>;
}
