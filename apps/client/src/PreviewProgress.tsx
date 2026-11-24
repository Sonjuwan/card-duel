import type {AccountProfile,GrowthView} from '../../../packages/account-protocol.ts';
import {rankInfo,questStatus,rankedXpReward,rankedQuestBonus} from '../../../packages/progression.ts';
import {catalog,className} from './data.ts';
import {maxCardCopies} from '../../../packages/engine/src/index.ts';
import {BattleCard} from './battle-pieces.tsx';
import type {HeroClass} from '../../../packages/engine/src/index.ts';

export function PreviewRank({profile,growth}:{profile?:AccountProfile;growth?:GrowthView}){
  if(!profile||!growth)return <section className="preview-progress">성장 기록을 불러오는 중입니다.</section>;
  const rank=rankInfo(profile.rank,growth.ranks),next=growth.ranks.find(item=>item.rank===profile.rank+1);
  return <section className="preview-progress" aria-label="등급"><div className="preview-progress-feature"><strong className="preview-progress-rank">{rank.name}</strong><p>현재 등급 {profile.rank} / 25</p><p>현재 등급 승리 {profile.rankWins} / {growth.winsPerRank}</p><progress max={growth.winsPerRank} value={profile.rankWins}/></div><div className="preview-progress-detail"><h3>승급 진행</h3><p>{next?`다음 등급: ${next.name}`:'최고 등급에 도달했습니다.'}</p>{next&&<><p>누적 XP {profile.xp.toLocaleString()} / {(next.minimumXp??0).toLocaleString()}</p><progress max={Math.max(1,next.minimumXp??0)} value={Math.min(profile.xp,Math.max(1,next.minimumXp??0))}/></>}<p>전적 {profile.matchStats?.ranked.wins??0}승 {profile.matchStats?.ranked.losses??0}패 {profile.matchStats?.ranked.draws??0}무</p></div></section>;
}
export function PreviewRewards({profile,growth}:{profile?:AccountProfile;growth?:GrowthView}){
  if(!profile||!growth)return <section className="preview-progress">성장 기록을 불러오는 중입니다.</section>;
  const owned=new Set(profile.ownedCards),next=growth.unlocks.find(c=>!owned.has(c.cardId));
  const previous=next?growth.unlocks.filter(c=>c.xp<next.xp).at(-1)?.xp??0:0;
  const nearby=next?growth.unlocks.filter(c=>!owned.has(c.cardId)&&c.cardId!==next.cardId).slice(0,4):[];
  const earned=profile.recentMatches?.flatMap(m=>m.unlockedCards??[]).filter((id,i,a)=>a.indexOf(id)===i)??[];
  return <section className="preview-reward-screen" aria-label="경험치와 카드 획득">
    <div className="preview-reward-feature">
      <strong>다음 획득 카드</strong>
      {next&&catalog[next.cardId]?<div className="preview-reward-card"><BattleCard card={catalog[next.cardId]}/><span className="preview-reward-quantity">×{maxCardCopies(catalog[next.cardId])}</span></div>:<div className="preview-reward-complete">모든 카드를 획득했습니다!</div>}
    </div>
    <aside className="preview-reward-sidebar">
      <strong>누적 XP {profile.xp.toLocaleString('ko-KR')}</strong>
      {next?<><p>다음 카드까지 {(next.xp-profile.xp).toLocaleString('ko-KR')} XP</p><progress max={Math.max(1,next.xp-previous)} value={Math.max(0,profile.xp-previous)}/><small>{profile.xp.toLocaleString('ko-KR')} / {next.xp.toLocaleString('ko-KR')} XP</small></>:<p>현재 모든 해금 완료</p>}
      <strong>이후 획득할 카드</strong>
      <div className="preview-next-rewards">{nearby.map(item=><div key={item.cardId}><span>{catalog[item.cardId]?.name??item.cardId} · ×{maxCardCopies(catalog[item.cardId])}</span><small>{item.xp.toLocaleString('ko-KR')} XP</small></div>)}</div>
      <strong>최근 획득 카드</strong>
      <div className="preview-next-rewards">{earned.length?earned.slice(0,6).map(id=><div key={id}><span>{catalog[id]?.name??id}</span><small>×{maxCardCopies(catalog[id])}</small></div>):<small>최근 획득 기록 없음</small>}</div>
      <small>랭크 {profile.rank} 기준 승리 +{rankedXpReward(profile.rank,'win')} XP · 무승부 +{rankedXpReward(profile.rank,'draw')} XP · 패배 +{rankedXpReward(profile.rank,'loss')} XP</small>
      <small>카드는 XP 도달 시 자동 획득됩니다. 전설은 1장, 나머지는 2장까지 덱에서 사용 가능.</small>
    </aside>
  </section>;
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
