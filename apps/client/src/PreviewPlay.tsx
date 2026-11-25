import {useState} from 'react';
import type {Deck,HeroClass} from '../../../packages/engine/src/index.ts';
import {HERO_CLASSES,practiceDeck} from '../../../packages/engine/src/index.ts';
import type {AccountProfile} from '../../../packages/account-protocol.ts';
import type {SlotStorage} from './solo-slots.ts';
import {readDecks} from './named-decks.ts';
import {catalog,className} from './data.ts';
import {LocalHeroArt} from './local-art.tsx';
import {collectionPage} from './table-visuals.ts';
import {offlineGrowth} from './offline-growth.ts';
import type {LocalSaveSummary} from './local-duel.ts';
import {ownedDeck,recommendedOwnedDeck} from '../../../packages/progression.ts';

export function HeroChoice({onChoose}:{onChoose:(value:HeroClass)=>void}){
  return <section className="preview-hero-choice" aria-label="직업 선택"><div className="preview-hero-grid">
    {HERO_CLASSES.map(hero=><button type="button" key={hero} className={`preview-hero-tile faction-${hero}`} onClick={()=>onChoose(hero)}><span className="preview-hero-art"><LocalHeroArt heroClass={hero}/></span><strong>{className[hero]}</strong></button>)}
  </div></section>;
}
type Props={storage:SlotStorage;profile?:AccountProfile;deck:Deck;ready?:boolean;blocked?:boolean;busy:boolean;onDeck:(deck:Deck)=>void;onStart:()=>void;onBuild:(hero:HeroClass)=>void;savedMatch?:LocalSaveSummary|null;saveAvailable?:boolean;onResume:()=>void;onForfeitSaved:()=>void};
export function PreviewPlay({storage,profile,deck,ready,blocked,busy,onDeck,onStart,onBuild,savedMatch,saveAvailable,onResume,onForfeitSaved}:Props){
  const [deckPage,setDeckPage]=useState(0);
  const [hero,setHero]=useState<HeroClass|null>(null);
  const [selectedName,setSelectedName]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  // Storage is slot-scoped; never silently recover a saved deck from a different slot.
  const saved=readDecks(storage).filter(item=>item.deck.heroClass===hero);
  const selected=saved.find(item=>item.name===selectedName);
  const active=selected?.deck??(hero===deck.heroClass?deck:null);
  let playable=false;
  try{if(active&&profile){ownedDeck(active,catalog,profile);playable=ready===true&&!blocked&&!busy;}}catch{}
  const choose=(value:HeroClass)=>{
    setDeckPage(0);setHero(value);setSelectedName(null);setMessage('');
    const first=readDecks(storage).find(item=>item.deck.heroClass===value);
    if(first){onDeck(structuredClone(first.deck));setSelectedName(first.name);return;}
    try{onDeck(profile?recommendedOwnedDeck(catalog,offlineGrowth(catalog),value,profile,Date.now()>>>0):practiceDeck(catalog,value));}
    catch{onDeck(practiceDeck(catalog,value));}
  };
  if(savedMatch&&savedMatch.phase!=='finished')return <section className="preview-resume-gate" aria-label="진행 중인 저장 경기">
    <div className="resume-hero"><LocalHeroArt heroClass={savedMatch.heroClass}/></div>
    <h2>진행 중인 저장 경기</h2>
    <p>{savedMatch.turn}턴 · {className[savedMatch.heroClass]} 대전</p>
    <div className="preview-resume-actions">
      <button type="button" disabled={busy||saveAvailable!==true} onClick={onResume}>이어서 플레이하기</button>
      <button type="button" className="secondary" disabled={busy||saveAvailable!==true} onClick={onForfeitSaved}>새로운 게임 시작</button>
    </div>
    <small>새 게임을 시작하면 이전 경기는 패배로 기록됩니다.</small>
  </section>;
  if(!hero)return <HeroChoice onChoose={choose}/>;
  const {items,page,pages}=collectionPage(saved,deckPage,9);
  return <section className={`preview-deck-select faction-${hero}`} aria-label={`${className[hero]} 덱 선택`}>
    <div className="preview-flow-heading"><button type="button" className="secondary" onClick={()=>{setHero(null);setSelectedName(null);}}>← 직업 변경</button><strong>{className[hero]} · 사용할 덱 선택</strong></div>
    <nav className="preview-deck-pages" aria-label="덱 페이지">
      <button type="button" className="secondary" aria-label="이전 덱 페이지" disabled={page===0} onClick={()=>setDeckPage(page-1)}>◀</button>
      <div className="preview-deck-grid">
      {items.map(item=><button type="button" key={item.name} className={`preview-deck-tile${selectedName===item.name?' chosen':''}`} aria-pressed={selectedName===item.name} onClick={()=>{setSelectedName(item.name);onDeck(structuredClone(item.deck));setMessage('');}}><strong>{item.name}</strong><small>{item.deck.cards.length}/30장</small></button>)}
      {Array.from({length:9-items.length},(_,i)=><span key={i} className="preview-deck-empty" aria-hidden="true"/>)}
      </div>
      <button type="button" className="secondary" aria-label="다음 덱 페이지" disabled={page+1===pages} onClick={()=>setDeckPage(page+1)}>▶</button>
      <small className="preview-deck-page-count">{page+1} / {pages}</small>
    </nav>
    <div className="preview-deck-shortcuts">
      <button type="button" className={`preview-deck-tile${selectedName===null?' chosen':''}`} aria-pressed={selectedName===null} onClick={()=>{setSelectedName(null);try{if(profile)onDeck(recommendedOwnedDeck(catalog,offlineGrowth(catalog),hero,profile,Date.now()>>>0));else onDeck(practiceDeck(catalog,hero));}catch{setMessage('사용 가능한 기본 덱을 구성하지 못했습니다.');}}}><strong>기본 추천 덱</strong><small>보유 카드 기준 자동 구성</small></button>
      <button type="button" className="preview-deck-tile preview-create-deck" onClick={()=>onBuild(hero)}><strong>＋ 새 덱 만들기 / 편집</strong></button>
    </div>
    <div className="preview-deck-actions"><button type="button" className="slot-deck-primary" disabled={!playable||!active} onClick={onStart}>선택한 덱으로 대전 시작</button><small className={playable?'good':'warn'}>{message||(!profile?'보유 카드 확인 중…':blocked?'이전 버전 진행 중 경기 확인 필요':!playable?'선택한 덱에 미보유 카드가 있거나 저장소 준비 중입니다.':'30장 덱 준비 완료')}</small></div>
  </section>;
}
