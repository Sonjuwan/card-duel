import {useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {AccountProfile} from '../../../packages/account-protocol.ts';
import {careerOf,emptyHeroCareer,emptyRecord,levelProgress,masteryTier,totalMatches,winPercentage} from '../../../packages/career.ts';
import {HERO_CLASSES} from '../../../packages/engine/src/rules.ts';
import type {HeroClass} from '../../../packages/engine/src/types.ts';
import {rankInfo} from '../../../packages/progression.ts';
import {catalog,className} from './data.ts';
import {Sigil} from './battle-pieces.tsx';
import {LocalHeroArt} from './local-art.tsx';
import {RankCrest,rankTitle} from './RankCrest.tsx';
import logo from './assets/runehall-logo.svg';

export type HomeDestination='play'|'catalog'|'rewards'|'quests'|'rank'|'slots'|'growth'|'developer';
type HomeProps={profile?:AccountProfile;slot:number;developer:boolean;onOpen:(view:HomeDestination)=>void;fullscreenMenu:(menu:HTMLElement|null)=>void;update:ReactNode};
const xpFormatter=new Intl.NumberFormat('ko-KR');
const xpText=(xp:number)=>xpFormatter.format(xp)+' XP';
const percentText=(rate:number|null)=>rate===null?'—':rate+'%';
const mainActions=[
  {view:'play',label:'대전',icon:'warrior'},
  {view:'catalog',label:'카드 도감',icon:'deck'},
  {view:'rewards',label:'보상의 길',icon:'shield'},
  {view:'quests',label:'퀘스트',icon:'neutral'},
] as const;

export function RunehallHome({profile,slot,developer,onOpen,fullscreenMenu,update}:HomeProps){
  const rank=profile?rankInfo(profile.rank):undefined;
  const record=profile?careerOf(profile).record:emptyRecord();
  const level=levelProgress(profile?.xp??0,'account');
  return <nav className="lobby-tabs lobby-home runehall-home" aria-label="게임 메뉴">
    <h1 className="rh-brand"><img src={logo} alt="RUNEHALL 룬홀" draggable={false}/></h1>
    <div className="rh-home-columns">
      <section className="rh-home-account" aria-label="계정 성장">
        <button type="button" className="rh-rank-link" aria-label="등급" data-lobby-tab="rank" onClick={()=>onOpen('rank')}>
          {rank?<><RankCrest rank={rank}/><strong>{rankTitle(rank)}</strong></>:<span>등급 확인 중</span>}
        </button>
        <div className="rh-account-level">
          <div><strong>계정 Lv. {level.level}</strong><span>{xpText(profile?.xp??0)}</span></div>
          <progress aria-label="계정 레벨 진행도" max={level.required} value={level.progress}/>
          <small>다음 레벨까지 {xpText(level.remaining)}</small>
        </div>
      </section>
      <div className="rh-main-actions">
        {mainActions.map(({view,label,icon})=><button key={view} type="button" data-lobby-tab={view}
          className={view==='play'?'rh-primary':undefined} onClick={()=>onOpen(view)}><Sigil kind={icon}/>{label}</button>)}
        {update}
      </div>
      <section className="rh-home-tools" aria-label="기록 및 설정">
        <div className="rh-slot">
          <span>현재 저장 슬롯 <strong>{slot}</strong></span>
          <button type="button" data-lobby-tab="slots" onClick={()=>onOpen('slots')}>슬롯 선택</button>
        </div>
        <div className="rh-match-stats">
          <div><small>누적 전적</small><strong>{record.wins}승 {record.losses}패{record.draws>0?' '+record.draws+'무':''}</strong></div>
          <div><small>전체 승률</small><strong>{percentText(winPercentage(record))}</strong></div>
        </div>
        <button type="button" data-lobby-tab="growth" onClick={()=>onOpen('growth')}>직업별 성장</button>
        <button type="button" data-lobby-tab="developer" aria-label="개발자 모드" aria-pressed={developer} onClick={()=>onOpen('developer')}>개발자 모드 <span aria-hidden="true">{developer?'ON':'OFF'}</span></button>
        <div className="rh-fullscreen" ref={fullscreenMenu}/>
      </section>
    </div>
  </nav>;
}

export function PlayerGrowth({profile}:{profile?:AccountProfile}){
  const [selected,setSelected]=useState<HeroClass>('warrior');
  const dialog=useRef<HTMLDialogElement>(null);
  const career=useMemo(()=>profile?careerOf(profile):undefined,[profile]);
  const owned=useMemo(()=>new Set(profile?.ownedCards),[profile?.ownedCards]);
  const hero=career?.heroes[selected]??emptyHeroCareer(),details=levelProgress(hero.xp,'hero');
  const classCards=useMemo(()=>Object.values(catalog).filter(card=>card.kind!=='coin'&&card.collectible!==false&&card.class===selected),[catalog,selected]);
  const collected=classCards.filter(card=>owned.has(card.id)).length;
  return <section className="rh-class-growth" aria-labelledby="rh-growth-title">
    <h2 id="rh-growth-title">직업별 성장</h2>
    <div className="rh-class-grid">
      {HERO_CLASSES.map(id=>{
        const stats=career?.heroes[id]??emptyHeroCareer(),level=levelProgress(stats.xp,'hero'),mastery=masteryTier(stats.xp);
        return <button key={id} type="button" className={'rh-class-tile faction-'+id} aria-label={className[id]+' 성장 상세'}
          onClick={()=>{setSelected(id);dialog.current?.showModal();}}>
          <span className="rh-class-portrait" data-mastery={mastery} aria-hidden="true"><LocalHeroArt heroClass={id}/>{mastery>0&&<span className="mastery-ring"/>}</span>
          <span className="rh-class-info">
            <strong>{className[id]} <span>Lv. {level.level}</span></strong>
            <span>{stats.wins}승 {stats.losses}패{stats.draws>0?' '+stats.draws+'무':''} · 승률 {percentText(winPercentage(stats))}</span>
            <progress aria-label={className[id]+' 레벨 진행도'} value={level.progress} max={level.required}/>
          </span>
        </button>;
      })}
    </div>
    <dialog ref={dialog} className="lobby-dialog rh-class-detail" aria-labelledby="rh-class-title">
      <form method="dialog"><button className="secondary" autoFocus>닫기</button></form>
      <div className="rh-detail-heading">
        <span className="rh-class-portrait" data-mastery={masteryTier(hero.xp)} aria-hidden="true">
          <LocalHeroArt heroClass={selected}/>{masteryTier(hero.xp)>0&&<span className="mastery-ring"/>}
        </span>
        <h3 id="rh-class-title">{className[selected]} · Lv. {details.level}</h3>
      </div>
      <dl>
        <dt>누적 경험치</dt><dd>{xpText(hero.xp)}</dd>
        <dt>다음 레벨까지</dt><dd>{xpText(details.remaining)}</dd>
        <dt>총 대전</dt><dd>{totalMatches(hero)}전</dd>
        <dt>누적 전적</dt><dd>{hero.wins}승 {hero.losses}패 {hero.draws}무</dd>
        <dt>승률</dt><dd>{percentText(winPercentage(hero))}</dd>
        <dt>최대 연승</dt><dd>{hero.bestStreak}승</dd>
        <dt>완료한 직업 퀘스트</dt><dd>{hero.quests}개</dd>
        <dt>직업 카드 수집률</dt><dd>{classCards.length?Math.round(100*collected/classCards.length)+'%':'—'} ({collected}/{classCards.length})</dd>
      </dl>
    </dialog>
  </section>;
}
