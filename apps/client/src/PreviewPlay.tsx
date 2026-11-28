import {useEffect,useRef,useState} from 'react';
import type {Deck,HeroClass} from '../../../packages/engine/src/index.ts';
import {HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import type {AccountProfile} from '../../../packages/account-protocol.ts';
import type {SlotStorage} from './solo-slots.ts';
import {checkedDeckLibrary,deckLibraryAfterWriteFailure,deleteNamedDeck,withDeckLibraryLock,type NamedDeck} from './named-decks.ts';
import {watchDeckLibraryChanges} from './deck-library-sync.ts';
import {catalog,className} from './data.ts';
import {LocalHeroArt} from './local-art.tsx';
import {collectionPage} from './table-visuals.ts';
import type {LocalSaveSummary} from './local-duel.ts';
import {basicDeck} from '../../../packages/basic-decks.ts';
import {ownedDeck} from '../../../packages/progression.ts';

export function HeroChoice({onChoose}:{onChoose:(value:HeroClass)=>void}){
  return <section className="preview-hero-choice" aria-label="직업 선택"><div className="preview-hero-grid">
    {HERO_CLASSES.map(hero=><button type="button" key={hero} className={`preview-hero-tile faction-${hero}`} onClick={()=>onChoose(hero)}><span className="preview-hero-art"><LocalHeroArt heroClass={hero}/></span><strong>{className[hero]}</strong></button>)}
  </div></section>;
}
type SavedGateProps={savedMatch:LocalSaveSummary;saveAvailable?:boolean;busy:boolean;onResume:()=>void;onForfeitSaved:()=>void};
export function SavedMatchGate({savedMatch,saveAvailable,busy,onResume,onForfeitSaved}:SavedGateProps){
  return <section className="preview-resume-gate" aria-label="진행 중인 저장 경기">
    <div className="resume-hero"><LocalHeroArt heroClass={savedMatch.heroClass}/></div>
    <h2>진행 중인 저장 경기</h2>
    <p>{savedMatch.turn}턴 · {className[savedMatch.heroClass]} 대전</p>
    <div className="preview-resume-actions">
      <button type="button" disabled={busy||saveAvailable!==true} onClick={onResume}>이어서 플레이하기</button>
      <button type="button" className="secondary" disabled={busy||saveAvailable!==true} onClick={onForfeitSaved}>새로운 게임 시작</button>
    </div>
    <small>새 게임을 시작하면 이전 경기는 패배로 기록됩니다.</small>
  </section>;
}

type PickerProps={storage:SlotStorage;hero:HeroClass;initialName?:string|null;profile?:AccountProfile;requireOwned?:boolean;
  ready?:boolean;blocked?:boolean;busy?:boolean;onChangeHero:()=>void;onStart?:(deck:Deck)=>void;
  onBuild:(hero:HeroClass)=>void;onEdit:(entry:NamedDeck)=>void};

export function ClassDeckPicker({storage,hero,initialName,profile,requireOwned,ready=true,blocked,busy,onChangeHero,onStart,onBuild,onEdit}:PickerProps){
  const [library,setLibrary]=useState(()=>checkedDeckLibrary([],storage));
  const [selectedName,setSelectedName]=useState(()=>initialName===undefined?
    library.decks.find(entry=>entry.deck.heroClass===hero)?.name??null:initialName);
  const saved=library.decks.filter(item=>item.deck.heroClass===hero);
  const selected=saved.find(item=>item.name===selectedName);
  const [deckPage,setDeckPage]=useState(()=>Math.floor(Math.max(0,saved.findIndex(item=>item.name===selectedName))/9));
  const [message,setMessage]=useState('');
  const [deleting,setDeleting]=useState(false);
  const currentLibrary=useRef(library.decks);
  currentLibrary.current=library.decks;
  const mutation=useRef(false);
  useEffect(()=>watchDeckLibraryChanges({store:storage,current:()=>currentLibrary.current,canRefresh:()=>!mutation.current,
    onChange:decks=>{setLibrary({decks,warning:null});setSelectedName(null);},
    onError:warning=>setLibrary(current=>({...current,warning})),
    onRecovered:()=>setLibrary(current=>({...current,warning:null}))}),[storage,deleting]);
  const active=selected?.deck??basicDeck(catalog,hero);
  let valid=active.cards.length===30;
  if(requireOwned){
    try{if(profile)ownedDeck(active,catalog,profile);else valid=false;}catch{valid=false;}
  }
  const playable=valid&&ready&&!blocked&&!busy&&!deleting&&!library.warning;
  const remove=async()=>{
    if(!selected||mutation.current||!window.confirm(`${selected.name} 덱을 삭제할까요?`))return;
    mutation.current=true;setDeleting(true);
    try{
      const decks=await withDeckLibraryLock(()=>deleteNamedDeck(selected,storage));
      setLibrary({decks,warning:null});setSelectedName(null);setMessage('저장 덱 삭제 완료');
    }catch(error){
      setLibrary(current=>({...current,decks:deckLibraryAfterWriteFailure(current.decks,storage)}));
      setMessage(error instanceof Error?error.message:'저장 공간을 사용할 수 없습니다.');
    }finally{mutation.current=false;setDeleting(false);}
  };
  const {items,page,pages}=collectionPage(saved,deckPage,9);
  return <section className={`preview-deck-select faction-${hero}`} aria-label={`${className[hero]} 덱 선택`}>
    <div className="preview-flow-heading"><button type="button" className="secondary" onClick={onChangeHero}>← 직업 변경</button><strong>{className[hero]} · 덱 선택</strong></div>
    <nav className="preview-deck-pages" aria-label="덱 페이지">
      <button type="button" className="secondary" aria-label="이전 덱 페이지" disabled={page===0} onClick={()=>setDeckPage(page-1)}>◀</button>
      <div className="preview-deck-grid" aria-label="저장한 덱">
        {items.map(item=><button type="button" key={item.name} className={`preview-deck-tile${selected?.name===item.name?' chosen':''}`}
          aria-pressed={selected?.name===item.name} onClick={()=>{setSelectedName(item.name);setMessage('');}}>
          <strong>{item.name}</strong><small>{item.deck.cards.length}/30장</small>
        </button>)}
        {Array.from({length:9-items.length},(_,index)=><span key={index} className="preview-deck-empty" aria-hidden="true"/>)}
      </div>
      <button type="button" className="secondary" aria-label="다음 덱 페이지" disabled={page+1===pages} onClick={()=>setDeckPage(page+1)}>▶</button>
      <small className="preview-deck-page-count">{page+1} / {pages}</small>
    </nav>
    <div className="preview-deck-shortcuts">
      <button type="button" className={`preview-deck-tile${!selected?' chosen':''}`} aria-pressed={!selected} onClick={()=>{setSelectedName(null);setMessage('');}}>기본 덱</button>
      <button type="button" className="preview-deck-tile" onClick={()=>onBuild(hero)}>새 덱 만들기</button>
      <button type="button" className="preview-deck-tile" disabled={!selected||deleting||!!library.warning} onClick={()=>selected&&onEdit(selected)}>편집</button>
    </div>
    <div className="preview-deck-actions">
      {onStart&&<button type="button" className="slot-deck-primary" disabled={!playable}
        onClick={()=>onStart(structuredClone(active))}>선택한 덱으로 대전 시작</button>}
      <button type="button" className="secondary deck-delete" disabled={!selected||deleting||!!library.warning} onClick={()=>void remove()}>덱 삭제</button>
      <small className="deck-selection-status" role="status">{library.warning||message||(blocked?'이전 버전 진행 중 경기 확인 필요':
        !ready?'저장소 확인 중…':!valid?'사용할 수 없는 덱입니다.':'')}</small>
    </div>
  </section>;
}
