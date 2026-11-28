import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {isInstalledGameDisplay,requestLandscapeFeatures} from './landscape-mode.ts';

/** The browser may refuse fullscreen or orientation lock. Neither is needed to
 * play: the same layout is available by turning the device physically. */
export function LandscapeExperience({menu}: {menu?:HTMLElement|null} = {}){
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const requestPending=useRef(false),lockedByUs=useRef(false);
  const rotateButton=useRef<HTMLButtonElement|null>(null);
  const alreadyAppWindow=()=>isInstalledGameDisplay(query=>Boolean(window.matchMedia?.(query)?.matches),
    (navigator as Navigator & {standalone?:boolean}).standalone===true);
  useEffect(()=>{
    const sync=()=>{const full=Boolean(document.fullscreenElement);
      if(!full&&lockedByUs.current){lockedByUs.current=false;try{(screen.orientation as ScreenOrientation & {unlock?:()=>void}|undefined)?.unlock?.();}catch{}}
    };
    document.addEventListener('fullscreenchange',sync);sync();
    return ()=>document.removeEventListener('fullscreenchange',sync);
  },[]);
  useEffect(()=>{
    const media=window.matchMedia('(pointer: coarse) and (orientation: portrait)');
    const update=()=>{
      // The CSS overlay blocks touch, and inert prevents keyboard or screen
      // readers from silently interacting with the covered game.
      for(const selector of ['.screen-content','.app-header .connection','.app-header .brand','.app-header .landscape-fullscreen-control','main > footer','.slot-entry-content']){
        const element=document.querySelector<HTMLElement>(selector);
        if(element)element.inert=media.matches;
      }
      if(media.matches)rotateButton.current?.focus();
      else if(document.activeElement===rotateButton.current){
        document.querySelector<HTMLElement>('.lobby-tabs[aria-label=\"게임 메뉴\"] button,.duel-title button,.slot-entry-choose,.landscape-menu-button')?.focus();
      }
    };
    media.addEventListener('change',update);update();
    return ()=>{media.removeEventListener('change',update);
      for(const selector of ['.screen-content','.app-header .connection','.app-header .brand','.app-header .landscape-fullscreen-control','main > footer','.slot-entry-content']){
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
          if(document.fullscreenElement||window.matchMedia('(display-mode: fullscreen)').matches)return true;
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
      if(!outcome.fullscreen&&alreadyAppWindow())setNotice('설치된 앱에서 운영체제 상태 표시줄 숨기기가 제한됩니다. 가로 배치는 기기를 직접 돌려 이용할 수 있습니다.');
      else if(!outcome.fullscreen&&isLandscape)setNotice('이 브라우저에서는 전체화면이 제한되어 있어요. 홈 화면에 설치한 PWA는 주소창 없이 실행됩니다.');
      else if(!outcome.landscape)setNotice(outcome.fullscreen?'전체화면으로 전환했어요. 자동 가로 회전이 제한되어 있으니 휴대폰을 직접 가로로 돌려주세요.':'자동 화면 회전이 제한되어 있어요. 휴대폰을 직접 가로로 돌려주세요.');
      else if(!outcome.fullscreen)setNotice('가로 모드로 전환했어요. 이 브라우저에서는 전체화면이 제한되어 있어요.');
    }finally{requestPending.current=false;setBusy(false);}
  };
  return <>
    {menu&&createPortal(<button type="button" className="landscape-menu-button"
      onClick={()=>void requestLandscape()} disabled={busy}><span aria-hidden="true">⛶</span> <span>가로 전체화면</span></button>,menu)}
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
        <button type="button" ref={rotateButton} disabled={busy} onClick={()=>void requestLandscape()}>가로 전체화면</button>
        {notice&&<p role="status" className="rotate-device-status">{notice}</p>}
      </div>
    </aside>
  </>;
}
