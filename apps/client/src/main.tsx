
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { loadPublicCatalog } from './data.ts';
import {requestCatalog} from './catalog-request.ts';
import './styles.css';
import './battle.css';
import './classic-table.css';
import './local-cards.css';
import './painted-art.css';
import './hover-preview.css';
import './battle-fx.css';
import './landscape-combat.css';
import './landscape-shell.css';
import { unlockBattleSound } from './battle-sound.ts';
window.addEventListener('pointerdown',unlockBattleSound,{passive:true});
window.addEventListener('click',unlockBattleSound,{passive:true});
window.addEventListener('keydown',unlockBattleSound);
const root=createRoot(document.getElementById('root')!);
let loading=false;
async function start(){
  if(loading)return;loading=true;
  root.render(<main><section className="panel" role="status"><h2>Card Duel</h2><p>최신 카드 정보를 불러오는 중입니다… 서버가 처음 시작되면 시간이 걸릴 수 있습니다.</p></section></main>);
  try{
    const {cards,hash}=await requestCatalog();loadPublicCatalog(cards,hash);
    root.render(<App workerFactory={()=>new Worker(new URL('./local-duel.worker.ts',import.meta.url),{type:'module'})}/>);
  }catch(error){
    root.render(<main><section className="panel" role="alert"><h2>카드 정보를 불러오지 못했습니다.</h2><p>{error instanceof Error?error.message:'연결을 확인하세요.'}</p><button type="button" onClick={()=>void start()}>다시 불러오기</button></section></main>);
  }finally{loading=false;}
}
void start();
