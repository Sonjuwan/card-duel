import {useEffect,useRef,useState} from 'react';
import type {Deck,HeroClass} from '../../../packages/engine/src/index.ts';
import {HERO_CLASSES,validateDeck} from '../../../packages/engine/src/index.ts';
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

export function HeroChoice({onChoose,label='직업 선택'}:{onChoose:(value:HeroClass)=>void;label?:string}){
  return <section className="preview-hero-choice" aria-label={label}><div className="preview-hero-grid">
    {HERO_CLASSES.map(hero=><button type="button" key={hero} className={`preview-hero-tile faction-${hero}`} onClick={()=>onChoose(hero)}><span className="preview-hero-art"><LocalHeroArt heroClass={hero}/></span><strong>{className[hero]}</strong></button>)}
  </div></section>;
}
export type PendingMatch={save:LocalSaveSummary;available?:boolean;onResume:()=>void;onRestart:()=>void};
export type DeckSelection={kind:'saved';name:string}|{kind:'basic';hero:HeroClass};
type PickerProps={storage:SlotStorage;selection:DeckSelection|null;onSelect:(value:DeckSelection|null)=>void;
  profile?:AccountProfile;requireOwned?:boolean;ready?:boolean;blocked?:boolean;busy?:boolean;
  pending?:PendingMatch;onStart?:(deck:Deck)=>void;onBuild:()=>void;onBasic:()=>void;onEdit:(entry:NamedDeck)=>void};

export function DeckPicker({storage,selection,onSelect,profile,requireOwned,ready=true,blocked,busy,pending,onStart,onBuild,onBasic,onEdit}:PickerProps){
  const [library,setLibrary]=useState(()=>checkedDeckLibrary([],storage));
  const saved=library.decks;
  const selected=selection?.kind==='saved'?saved.find(item=>item.name===selection.name):undefined;
  const [deckPage,setDeckPage]=useState(()=>Math.floor(Math.max(0,selected?saved.indexOf(selected):0)/9));
  const [message,setMessage]=useState('');
  const [deleting,setDeleting]=useState(false);
  const currentLibrary=useRef(library.decks);
  currentLibrary.current=library.decks;
  const mutation=useRef(false);
  useEffect(()=>watchDeckLibraryChanges({store:storage,current:()=>currentLibrary.current,canRefresh:()=>!mutation.current,
    onChange:decks=>{setLibrary({decks,warning:null});},
    onError:warning=>setLibrary(current=>({...current,warning})),
    onRecovered:()=>setLibrary(current=>({...current,warning:null}))}),[storage,deleting]);
  const basicHero=selection?.kind==='basic'?selection.hero:undefined;
  const active=selected?.deck??(basicHero?basicDeck(catalog,basicHero):undefined);
  let valid=false;
  if(active){
    try{
      validateDeck(active,catalog);
      if(requireOwned&&profile)ownedDeck(active,catalog,profile);
      valid=!requireOwned||!!profile;
    }catch{}
  }
  const playable=valid&&ready&&!blocked&&!busy&&!deleting&&!library.warning;
  const remove=async()=>{
    if(!selected||mutation.current||!window.confirm(`${selected.name} 덱을 삭제할까요?`))return;
    mutation.current=true;setDeleting(true);
    try{
      const decks=await withDeckLibraryLock(()=>deleteNamedDeck(selected,storage));
      setLibrary({decks,warning:null});onSelect(null);setMessage('저장 덱 삭제 완료');
    }catch(error){
      setLibrary(current=>({...current,decks:deckLibraryAfterWriteFailure(current.decks,storage)}));
      setMessage(error instanceof Error?error.message:'저장 공간을 사용할 수 없습니다.');
    }finally{mutation.current=false;setDeleting(false);}
  };
  const {items,page,pages}=collectionPage(saved,deckPage,9);
  return <section className="preview-deck-select" aria-label="덱 선택">
    <div className="preview-flow-heading">
      <h2>덱 선택</h2>
      {pending&&<button type="button" className="secondary deck-resume" disabled={busy||pending.available!==true}
        onClick={pending.onResume} title={`${className[pending.save.heroClass]} · ${pending.save.turn}턴`}>이어서 플레이하기</button>}
    </div>
    <nav className="preview-deck-pages" aria-label="덱 페이지">
      <button type="button" className="secondary" aria-label="이전 덱 페이지" disabled={page===0} onClick={()=>setDeckPage(page-1)}>◀</button>
      <div className="preview-deck-grid" aria-label="저장한 덱">
        {items.map(item=><button type="button" key={item.name} className={`preview-deck-tile saved-deck-tile faction-${item.deck.heroClass}${selected?.name===item.name?' chosen':''}`}
          aria-pressed={selected?.name===item.name} onClick={()=>{onSelect({kind:'saved',name:item.name});setMessage('');}}>
          <span className="deck-slot-portrait" aria-hidden="true"><LocalHeroArt heroClass={item.deck.heroClass}/></span>
          <span className="deck-slot-copy"><strong>{item.name}</strong><small>{className[item.deck.heroClass]} · {item.deck.cards.length}/30장</small></span>
        </button>)}
        {Array.from({length:9-items.length},(_,index)=><span key={index} className="preview-deck-empty" aria-hidden="true"/>)}
      </div>
      <button type="button" className="secondary" aria-label="다음 덱 페이지" disabled={page+1===pages} onClick={()=>setDeckPage(page+1)}>▶</button>
      <small className="preview-deck-page-count">{page+1} / {pages}</small>
    </nav>
    <div className="preview-deck-shortcuts">
      <button type="button" className={`preview-deck-tile${basicHero?' chosen':''}`}
        aria-pressed={!!basicHero} onClick={onBasic}>기본 덱{basicHero&&<small>{className[basicHero]} · 30장</small>}</button>
      <button type="button" className="preview-deck-tile" onClick={onBuild}>새 덱 만들기</button>
      <button type="button" className="preview-deck-tile" disabled={!selected||deleting||!!library.warning} onClick={()=>selected&&onEdit(selected)}>편집</button>
    </div>
    <div className="preview-deck-actions">
      {onStart&&<button type="button" className="slot-deck-primary"
        disabled={pending?busy||pending.available!==true:!playable}
        onClick={()=>{if(pending)pending.onRestart();else if(active)onStart(structuredClone(active));}}>
        {pending?'새로운 게임 시작':'선택한 덱으로 대전 시작'}
      </button>}
      <button type="button" className="secondary deck-delete" disabled={!selected||deleting||!!library.warning} onClick={()=>void remove()}>덱 삭제</button>
      <small className="deck-selection-status" role="status">{library.warning||message||(blocked?'이전 버전 진행 중 경기 확인 필요':
        !ready?'저장소 확인 중…':active&&!valid?'사용할 수 없는 덱입니다.':'')}</small>
    </div>
  </section>;
}
