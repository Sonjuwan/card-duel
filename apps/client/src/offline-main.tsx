/// <reference types="vite/client" />
import {createRoot} from 'react-dom/client';
import {App} from './App.tsx';
import {showOfflineBootFailure} from './offline-startup.ts';
import {loadPublicCatalog} from './data.ts';
import InlineWorker from './local-duel.worker.ts?worker&inline';
import type {PublicAiProfile} from '../../../packages/protocol.ts';
import {unlockBattleSound} from './battle-sound.ts';
import './game-styles.ts';
declare const __OFFLINE_CARDS__:unknown;
declare const __OFFLINE_PROFILE__:PublicAiProfile;
window.addEventListener('pointerdown',unlockBattleSound,{passive:true});
window.addEventListener('click',unlockBattleSound,{passive:true});
window.addEventListener('keydown',unlockBattleSound);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)unlockBattleSound();});
try{
  // Validate the exact bundled catalog before rendering. A failed validation
  // must be visible and recoverable rather than a blank standalone/PWA screen.
  loadPublicCatalog(__OFFLINE_CARDS__,__OFFLINE_PROFILE__.catalogHash);
  createRoot(document.getElementById('root')!).render(<App standalone workerFactory={()=>new InlineWorker()} initialAiProfile={__OFFLINE_PROFILE__}/>);
}catch{
  const host=document.getElementById('root');
  if(host)showOfflineBootFailure(document,host,()=>window.location.reload());
}
