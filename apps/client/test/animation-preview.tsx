import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {applyAction,getPlayerView} from '../../../packages/engine/src/index.ts';
import type {Action,BattleVisualEvent,GameState,PlayerId} from '../../../packages/engine/src/index.ts';
import {fixture,kinds,labels,scenarioAction} from './animation-preview-model.ts';
import type {Scenario} from './animation-preview-model.ts';
import {battleAnimationTiming} from '../../../packages/protocol.ts';
import type {BattleAnimation,RoomView} from '../../../packages/protocol.ts';
import {describeAcceptedAction} from '../../server/battle-animation.ts';
import {Battle} from '../src/Battle.tsx';
import {catalog,loadPublicCatalog} from '../src/data.ts';
import {ClassicNamesContext} from '../src/card-names.ts';
import {unlockBattleSound} from '../src/battle-sound.ts';
import '../src/styles.css';
import '../src/battle.css';
import '../src/classic-table.css';
import '../src/local-cards.css';
import '../src/painted-art.css';
import '../src/hover-preview.css';
import '../src/battle-fx.css';
import './animation-preview.css';
declare const __DEMO_CATALOG__:unknown;
declare const __DEMO_CATALOG_HASH__:string;
loadPublicCatalog(__DEMO_CATALOG__,__DEMO_CATALOG_HASH__);
document.addEventListener('pointerdown',unlockBattleSound,{passive:true});
document.addEventListener('keydown',unlockBattleSound);

function makeView(state:GameState,animation?:BattleAnimation):RoomView{
  return {code:'FXDEMO',seat:0,mode:'human',status:state.phase==='finished'?'finished':'playing',opponentConnected:true,state:getPlayerView(state,0),animation};
}
function Demo(){
  const [actor,setActor]=useState<PlayerId>(0),[state,setState]=useState(()=>fixture(catalog,0)),[animation,setAnimation]=useState<BattleAnimation>(),[version,setVersion]=useState(0);
  const [locked,setLocked]=useState(false),[error,setError]=useState('');
  const busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const unlock=()=>{busy.current=false;setLocked(false);};
  const commit=(before:GameState,who:PlayerId,action:Action)=>{
    try{
      const events:BattleVisualEvent[]=[];const after=applyAction(before,who,action,{visualEvent:event=>events.push(event)});
      const cue=describeAcceptedAction(before,after,who,action,events);
      setState(after);setAnimation(cue);setError('');timer.current=setTimeout(unlock,(cue?battleAnimationTiming(cue).duration:0)+240);
    }catch(e){setError(e instanceof Error?e.message:'시연 오류');unlock();}
  };
  const run=(kind:Scenario)=>{
    if(busy.current)return;busy.current=true;setLocked(true);unlockBattleSound();setError('');
    const before=fixture(catalog,actor);setState(before);setAnimation(undefined);setVersion(old=>old+1);
    timer.current=setTimeout(()=>commit(before,actor,scenarioAction(before,actor,kind)),240);
  };
  const reset=()=>{if(timer.current)clearTimeout(timer.current);unlock();setAnimation(undefined);setState(fixture(catalog,actor));setVersion(n=>n+1);setError('');};
  const send=(action:Action)=>{if(busy.current)return;busy.current=true;setLocked(true);commit(state,0,action);};
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return <ClassicNamesContext.Provider value={true}><main className="game-main fx-demo">
    <header className="fx-demo-controls"><div className="fx-demo-title"><div><p className="eyebrow">CARD DUEL · v0.36.0</p><h1>전투 연출 체험장</h1><small>설치 없이 실제 전투 UI와 연출을 재생하는 오프라인 예시입니다.</small></div><div className="controls"><button aria-pressed={actor===0} disabled={locked} onClick={()=>setActor(0)}>내 행동</button><button aria-pressed={actor===1} disabled={locked} onClick={()=>setActor(1)}>상대 행동</button><button className="secondary" onClick={reset}>초기화</button></div></div>
      <nav className="fx-demo-actions" aria-label="연출 종류">{kinds.map(kind=><button disabled={locked} key={kind} onClick={()=>run(kind)}>{labels[kind]}</button>)}</nav><p className="fx-demo-note">버튼을 누르면 초기 전장부터 재생됩니다. 내 턴에서는 카드 한 번 클릭 → 전장 또는 대상에 드래그하는 조작도 직접 시험할 수 있습니다. {locked?'현재 재생 중…':''} {error}</p>
    </header>
    <Battle key={version} room={makeView(state,animation)} send={send} leave={reset} connected={true} busy={locked}/>
  </main></ClassicNamesContext.Provider>;
}
createRoot(document.getElementById('fx-root')!).render(<Demo/>);
