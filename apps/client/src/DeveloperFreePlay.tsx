import {useState} from 'react';
import {HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import type {HeroClass} from '../../../packages/engine/src/index.ts';
import {className} from './data.ts';
import type {SoloClass} from './solo-settings.ts';

export function DeveloperFreePlay({initialHero,busy,ready,onStart,onResume}:{
  initialHero:HeroClass;busy:boolean;ready:boolean|undefined;onStart:(player:HeroClass,opponent:SoloClass)=>void;onResume?:()=>void;
}){
  const [player,setPlayer]=useState(initialHero);
  const [opponent,setOpponent]=useState<SoloClass>('random');
  return <section className="account-growth developer-free-play" aria-label="개발자 자유 대전">
    <h3>자유 대전</h3>
    {ready===false&&<p role="status">자유 대전 저장소에 접근할 수 없습니다.</p>}
    <div className="account-row">
      <label>플레이어 직업<select value={player} onChange={event=>setPlayer(event.target.value as HeroClass)}>
        {HERO_CLASSES.map(hero=><option key={hero} value={hero}>{className[hero]}</option>)}
      </select></label>
      <label>상대 AI 직업<select value={opponent} onChange={event=>setOpponent(event.target.value as SoloClass)}>
        <option value="random">무작위 직업</option>
        {HERO_CLASSES.map(hero=><option key={hero} value={hero}>{className[hero]}</option>)}
      </select></label>
      <button type="button" disabled={busy||!ready} onClick={()=>onStart(player,opponent)}>자유 대전 시작</button>
      {onResume&&<button type="button" className="secondary" disabled={busy||!ready} onClick={onResume}>자유 대전 이어하기</button>}
    </div>
  </section>;
}
