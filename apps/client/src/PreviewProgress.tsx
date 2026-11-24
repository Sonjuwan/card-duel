import {useEffect,useRef,useState} from 'react';
import {RankCrest,rankTitle} from './RankCrest.tsx';
import {playCinematicSound} from './battle-sound.ts';
import type {AccountProfile,GrowthView} from '../../../packages/account-protocol.ts';
import {rankInfo,questStatus} from '../../../packages/progression.ts';
import {catalog,className} from './data.ts';
import {maxCardCopies} from '../../../packages/engine/src/index.ts';
import {BattleCard} from './battle-pieces.tsx';
import type {HeroClass} from '../../../packages/engine/src/index.ts';

export function PreviewRank({profile,growth}:{profile?:AccountProfile;growth?:GrowthView}){
  if(!profile||!growth)return <section className="preview-progress">성장 기록을 불러오는 중입니다.</section>;
  const rank=rankInfo(profile.rank,growth.ranks),next=growth.ranks.find(item=>item.rank===profile.rank+1);
  const target=next?.minimumXp??0;
  const stats=profile.matchStats?.ranked;
  return <section className="preview-progress rank-dashboard" aria-label="등급">
    <div className="preview-progress-feature"><RankCrest rank={rank}/><strong className="preview-progress-rank">{rankTitle(rank)}</strong><p>{profile.rank} / 25단계</p>
      <div className="rank-stars" aria-label={`승급 승리 ${profile.rankWins}/${growth.winsPerRank}`}>{Array.from({length:growth.winsPerRank},(_,i)=><span key={i} data-earned={i<profile.rankWins} aria-hidden="true">✦</span>)}</div>
    </div>
    <div className="preview-progress-detail">{next?<><RankCrest rank={next}/><h3>{rankTitle(next)}까지</h3>
      <p>{Math.max(0,growth.winsPerRank-profile.rankWins)}승 · {profile.xp>=target?'XP 조건 충족':`${(target-profile.xp).toLocaleString('ko-KR')} XP 남음`}</p>
      <progress aria-label="승급 XP" max={Math.max(1,target)} value={target?Math.min(profile.xp,target):1}/>
    </>:<h3>최고 등급</h3>}<p>전적 {stats?.wins??0}승 {stats?.losses??0}패 {stats?.draws??0}무</p></div>
  </section>;
}

export function PreviewRewards({profile,growth}:{profile?:AccountProfile;growth?:GrowthView}){
  return profile&&growth?<RewardRoad profile={profile} growth={growth}/>:<section className="preview-progress">성장 기록을 불러오는 중입니다.</section>;
}
function RewardRoad({profile,growth}:{profile:AccountProfile;growth:GrowthView}){
  const owned=new Set(profile.ownedCards);
  const rewards=growth.unlocks.filter(item=>!!catalog[item.cardId]);
  const next=rewards.findIndex(item=>!owned.has(item.cardId));
  const [position,setPosition]=useState(()=>Math.max(0,(next<0?rewards.length-1:next)-2));
  const perPage=5;
  const last=Math.max(0,rewards.length-perPage);
  const start=Math.min(position,last);
  const touch=useRef<number|null>(null);
  const nextIndex=next<0?rewards.length:next;
  const lower=nextIndex>0?rewards[nextIndex-1].xp:0;
  const upper=rewards[nextIndex]?.xp??profile.xp;
  const fractional=Math.max(0,Math.min(1,(profile.xp-lower)/Math.max(1,upper-lower)));
  const roadPercent=Math.max(0,Math.min(100,(nextIndex-1-start+fractional)/(perPage-1)*100));
  const turn=(direction:number)=>setPosition(Math.max(0,Math.min(last,start+direction*perPage)));
  return <section className="reward-road" aria-label="보상의 길" onTouchStart={e=>{touch.current=e.touches[0]?.clientX??null;}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{
    const x=e.changedTouches[0]?.clientX;
    if(touch.current!==null&&x!==undefined&&Math.abs(x-touch.current)>45)turn(x<touch.current?1:-1);
    touch.current=null;
  }}>
    <header><strong>{profile.xp.toLocaleString('ko-KR')} XP</strong><p>{next<0?'모든 카드 획득 완료':`다음 카드까지 ${Math.max(0,rewards[next].xp-profile.xp).toLocaleString('ko-KR')} XP`}</p></header>
    <button className="secondary road-edge previous" type="button" aria-label="이전 보상 구간" disabled={start===0} onClick={()=>turn(-1)}>◀</button>
    <div className="road-cards" style={{'--road-progress':`${roadPercent}%`} as React.CSSProperties}>
      <span className="road-progress" aria-label={`현재 ${profile.xp.toLocaleString('ko-KR')} XP`}/>
      {rewards.slice(start,start+perPage).map((item,i)=>{
        const acquired=owned.has(item.cardId);
        return <div key={item.cardId} className="road-stop" data-state={acquired?'owned':start+i===next?'next':'locked'}>
          <BattleCard card={catalog[item.cardId]}/>
          <span className="road-marker" aria-label={acquired?'획득 완료':start+i===next?'다음 보상':'잠김'}>{acquired?'✓':start+i===next?'◆':'·'}</span>
          <small>{item.xp.toLocaleString('ko-KR')} XP</small>
        </div>;
      })}
    </div>
    <button className="secondary road-edge next" type="button" aria-label="다음 보상 구간" disabled={start>=last} onClick={()=>turn(1)}>▶</button>
  </section>;
}
export function RewardReveal({cards,rank,onCatalog,onClose}:{cards:string[];rank?:{before:number;after:number};onCatalog:()=>void;onClose:()=>void}){
  const [index,setIndex]=useState(0);
  const card=catalog[cards[index]];
  const after=rank?rankInfo(rank.after):undefined;
  const before=rank?rankInfo(rank.before):undefined;
  const promote=index===cards.length&&!!after;
  useEffect(()=>{
    if(promote&&after&&before){playCinematicSound(after.league===before.league?'rank':'tier');return;}
    if(!card)return;
    playCinematicSound('xp');
    const sound=setTimeout(()=>playCinematicSound(card.kind!=='coin'&&['rare','epic','legendary'].includes(card.rarity)?'rare':'card'),430);
    const next=setTimeout(()=>setIndex(i=>i+1),2300);
    return()=>{clearTimeout(sound);clearTimeout(next);};
  },[index,card,promote,after,before]);
  return <div className="preview-card-reward-overlay" role="dialog" aria-modal="true" aria-label={card?'새 카드 획득':after?'승급':'보상'}>
    <section className="preview-card-reward-popup reward-reveal" key={index}>
      <h2>{card?'새로운 카드':promote&&after?rankTitle(after)+' 승급!':'보상 획득 완료'}</h2>
      {card&&<><div className="preview-reward-popup-card"><BattleCard card={card}/></div><p>{index+1} / {cards.length} · ×{maxCardCopies(card)}</p><progress aria-label="보상 공개 진행" max={cards.length} value={index+1}/></>}
      {promote&&after&&before&&<div className="promotion-crest" data-tier-up={before.league!==after.league}><span className="promotion-previous" aria-hidden="true"><RankCrest rank={before}/></span><span className="promotion-current"><RankCrest rank={after}/></span></div>}
      <div className="preview-card-reward-actions">
        {cards.length>0&&<button type="button" onClick={onCatalog}>카드 도감에서 확인</button>}
        <button type="button" className="secondary" onClick={onClose}>{card?'연출 건너뛰기':'계속하기'}</button>
      </div>
    </section>
  </div>;
}
export function PreviewQuestPlaceholder(){
  return <section className="preview-placeholder"><h2>퀘스트</h2><p>준비 중</p><small>퀘스트 메뉴만 마련했습니다. 새로운 퀘스트 기능과 보상은 구현하지 않습니다.</small></section>;
}
export function PreviewDeveloper({mode,onMode,children}:{mode:'player'|'developer';onMode:(mode:'player'|'developer')=>void;children?:React.ReactNode}){
  return <section className="preview-developer"><h2>개발자 모드</h2><div className="preview-mode-choices"><button type="button" className={mode==='player'?'chosen':'secondary'} onClick={()=>onMode('player')}>유저 모드</button><button type="button" className={mode==='developer'?'chosen':'secondary'} onClick={()=>onMode('developer')}>개발자 모드</button></div><small>개발자 시험에서는 XP, 카드 획득, 등급과 유저 전적이 변경되지 않습니다.</small>{mode==='developer'&&children}</section>;
}
export function PreviewQuestSummary({profile}:{profile?:AccountProfile}){
  if(!profile)return null;
  const q=questStatus(profile.questGames);
  return <small>기존 데이터 참고: {className[q.heroClass as HeroClass]} {q.games}/10 · 별도 퀘스트 시스템은 보류</small>;
}
