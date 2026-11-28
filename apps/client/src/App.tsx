import type {RankedRewardSummary} from '../../../packages/account-protocol.ts';
import {collectionBotDeck} from '../../../packages/collection-bot-deck.ts';
import {syncOwned} from '../../../packages/progression.ts';
import {basicDeck} from '../../../packages/basic-decks.ts';
import {useDeckEditMotion} from './deck-edit-motion.ts';
import {ToastNotice} from './ToastNotice.tsx';
import {OfflineStatus} from './OfflineStatus.tsx';
import {AudioMixer} from './AudioMixer.tsx';
import {LobbyDialog} from './lobby-dialog.tsx';
import { deckManaCurveLabel } from './deck-curve-label.ts';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { HERO_CLASSES,HERO_POWERS,DECK_STYLES,deckCards,practiceDeck,strategicDeck,completePracticeDeck,validateDeck,repairDeck,manaCurve,exportDeckCode,importDeckCode,maxCardCopies } from '../../../packages/engine/src/index.ts';
import type { Action,Card,Deck,HeroClass,BotDifficulty,DeckStyle } from '../../../packages/engine/src/index.ts';
import type { ClientEvents, ServerEvents, Session, RoomView, Result,AnimationSpeed } from '../../../packages/protocol.ts';
import { catalog,catalogHash,className,heroPowerDescription,tribes as tribeNames } from './data.ts';
import { readDraft,saveDraft,readDeveloperDraft,saveDeveloperDraft,mergeRoomView } from './storage.ts';
import { Battle } from './Battle.tsx';
import { BattleCard, Sigil } from './battle-pieces.tsx';
import type { Inspectable } from './battle-pieces.tsx';
import { PlayLobby } from './Lobby.tsx';
import {ClassDeckPicker,HeroChoice,SavedMatchGate} from './PreviewPlay.tsx';
import {PreviewRank,PreviewRewards,RewardReveal,PreviewQuestPlaceholder,PreviewDeveloper} from './PreviewProgress.tsx';
import {syncNewCards,markCardViewed} from './new-card-flags.ts';
import {LandscapeExperience} from './LandscapeExperience.tsx';
import { ClassicNamesContext, displayCardName, cardSearchTerms, matchesCardSearch } from './card-names.ts';
import { LocalCardArt, LocalHeroArt } from './local-art.tsx';
import { BookTabs,bookClasses,ManaFilter,CollectionBook,useBookSize, CollectionDetailDialog, showCollectionDetail } from './collection-book.tsx';
import { groupedCollection, collectionPage } from './table-visuals.ts';
import { collectionSetCounts, matchesCardSet, sortCardsForDisplay, deckAddReason } from './card-sets.ts';
import type { CardSetFilter } from './card-sets.ts';
import { HoverPreviewProvider } from './hover-preview.tsx';
import {localAiProfile} from './local-profile.ts';
import type {LocalRequest,LocalResponse,LocalSaveSummary,LocalSlotOverview} from './local-duel.ts';
import type {DeviceMode} from './device-budget.ts';
import {readSoloSettings,saveSoloSettings,resolveSolo,readSoloHistory,resultFromRoom,recordSoloResult,DECK_STYLE_LABELS} from './solo-settings.ts';
import type {SoloSettings,ResolvedSolo,SoloClass,SoloStyle,FirstSelection} from './solo-settings.ts';
import {readRoomTicket,saveRoomTicket,newRoomTicket,terminalSessionFailure,sessionStore,releaseDisposition,reserveReleaseReload,confirmRelease,shouldWarnLocalExit,shouldConfirmUnstoredResultExit,reconcileSaveProbe,savedMatchConfidence,localViewAcknowledges} from './session-recovery.ts';
import {AccountPanel} from './AccountPanel.tsx';
import type {AccountPlayMode} from './AccountPanel.tsx';
import type {AccountView} from '../../../packages/account-protocol.ts';
import type {AccountProfile} from '../../../packages/account-protocol.ts';
import {offlineGrowth} from './offline-growth.ts';
import type {FreeMatchSelection} from './DeveloperFreePlay.tsx';
import {DeveloperFreePlay,readFreeMatchSelection,rememberFreeMatchSelection,resolveFreeDeck} from './DeveloperFreePlay.tsx';
import {OfflineGrowthPanel,OfflineDeveloperPanel} from './OfflineGrowthPanel.tsx';
import {readDecks,saveNamedDeck,deleteNamedDeck,withDeckLibraryLock,deckLibraryAfterWriteFailure,checkedDeckLibrary} from './named-decks.ts';
import {watchDeckLibraryChanges} from './deck-library-sync.ts';
import type {NamedDeck} from './named-decks.ts';
import {SOLO_SLOTS,readSelectedSlot,rememberSlot,soloSlotStorage,hasSlotLocalData,slotPreviewRefreshAction,currentSoloNamespace} from './solo-slots.ts';
import {rankInfo} from '../../../packages/progression.ts';
import type {SoloSlot,SlotStorage} from './solo-slots.ts';
import project from '../../../package.json';

const sessionKey='card-duel-session-v03';
const random32=()=>typeof globalThis.crypto!=='undefined'?crypto.getRandomValues(new Uint32Array(1))[0]:(Math.random()*4294967296)>>>0;
function readSession():Session|null{try{const s:unknown=JSON.parse(sessionStorage.getItem(sessionKey)??'null');if(!s||typeof s!=='object')return null;const v=s as Session;return typeof v.code==='string'&&/^[A-Z2-9]{6}$/.test(v.code)&&typeof v.token==='string'&&/^[0-9a-f]{64}$/.test(v.token)&&(v.seat===0||v.seat===1)?v:null;}catch{return null;}}
type DeckEditorProps={deck:Deck;setDeck:(deck:Deck)=>void;undo?:()=>void;undoAvailable?:boolean;draftStored?:boolean;initialSet?:CardSetFilter;workspaceMode?:boolean;initialName?:string;ownedCards?:readonly string[];forceOwned?:boolean;strategicPresets?:boolean;storage?:SlotStorage};
/** Keep the displayed named-deck list fresh when another tab updates the
 * same slot, while leaving local unsaved edits and stored bytes untouched. */
function useDeckLibraryAutoRefresh(storage:SlotStorage,saved:NamedDeck[],setSaved:(value:NamedDeck[])=>void,canRefresh:()=>boolean,onChanged:()=>void,onError:(message:string)=>void,onRecovered:(previousError:string)=>void,refreshWhenReady:boolean){
  const latestRef=useRef(saved);latestRef.current=saved;
  const callbacks=useRef({canRefresh,onChanged,onError,onRecovered});callbacks.current={canRefresh,onChanged,onError,onRecovered};
  useEffect(()=>watchDeckLibraryChanges({store:storage,current:()=>latestRef.current,canRefresh:()=>callbacks.current.canRefresh(),onChange:next=>{latestRef.current=next;setSaved(next);callbacks.current.onChanged();},onError:message=>callbacks.current.onError(message),onRecovered:message=>callbacks.current.onRecovered(message)}),[storage,setSaved,refreshWhenReady]);
}
export function DeckEditor(props:DeckEditorProps){
  return <DeckEditorView {...props}/>;
}
function useCompactCollection(){
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(orientation:landscape) and (max-height:540px)');
    const sync=()=>setCompact(media.matches);
    sync();
    media.addEventListener('change',sync);
    return()=>media.removeEventListener('change',sync);
  },[]);
  return compact;
}

function DeckEditorView({deck,setDeck,undo,undoAvailable=false,draftStored=true,initialSet='all',workspaceMode=false,initialName='',ownedCards,forceOwned=false,strategicPresets=false,storage:providedStorage}:DeckEditorProps){
  const classicNames=useContext(ClassicNamesContext);
  const storage=useMemo(()=>providedStorage??soloSlotStorage(1),[providedStorage]);
  const [editNotice,setEditNotice]=useState<{key:string;message:string;warning:boolean;cardId?:string}|null>(null);
  const deckKey=(value:Deck)=>JSON.stringify([value.heroClass,value.cards]);
  const notice=editNotice?.key===deckKey(deck)?editNotice:null;
  const showNotice=(message:string,value:Deck,warning=false,cardId?:string)=>setEditNotice({message,key:deckKey(value),warning,cardId});
  useEffect(()=>{if(!editNotice)return;const timer=setTimeout(()=>setEditNotice(null),2600);return()=>clearTimeout(timer);},[editNotice]);
  const [filterSet,setFilterSet]=useState<CardSetFilter>(initialSet);
  const [recommendStyle,setRecommendStyle]=useState<DeckStyle>('practice');
  const [search,setSearch]=useState('');const [kind,setKind]=useState('all');const [filterRarity,setFilterRarity]=useState('all'),[filterCost,setFilterCost]=useState('all'),[deckTab,setDeckTab]=useState<HeroClass|'neutral'>(deck.heroClass);const [shareCode,setShareCode]=useState('');
  const [ownedOnly,setOwnedOnly]=useState(true);const owned=useMemo(()=>ownedCards?new Set(ownedCards):null,[ownedCards]);
  const restricted=!!owned&&(forceOwned||ownedOnly);
  const deckCatalog=useMemo(()=>restricted?Object.fromEntries(Object.entries(catalog).filter(([id,c])=>c.kind==='coin'||c.collectible===false||owned!.has(id))):catalog,[restricted,owned]);
  const [saved,setSaved]=useState<NamedDeck[]>(()=>readDecks(storage)),[deckName,setDeckName]=useState(initialName),[savedIndex,setSavedIndex]=useState(''),[storageMessage,setStorageMessage]=useState(()=>checkedDeckLibrary([],storage).warning??'');
  const shareRef=useRef<HTMLTextAreaElement>(null);
  const copyShare=async()=>{if(!shareCode.trim())return;try{await navigator.clipboard.writeText(shareCode);setStorageMessage('공유 코드 복사 완료');}catch{shareRef.current?.focus();shareRef.current?.select();setStorageMessage('공유 코드를 선택했습니다. Ctrl+C로 복사하세요.');}};
  const storageFailure=(e:unknown)=>{setSaved(current=>deckLibraryAfterWriteFailure(current,storage));setSavedIndex('');setStorageMessage(e instanceof Error?e.message:'브라우저 저장 공간을 사용할 수 없습니다.');};
  const mutationBusy=useRef(false),[mutating,setMutating]=useState(false);
  useDeckLibraryAutoRefresh(storage,saved,setSaved,()=>!mutationBusy.current,()=>{setSavedIndex('');setStorageMessage('다른 탭의 저장 덱 변경을 반영했습니다. 목록에서 다시 선택하세요.');},setStorageMessage,previous=>setStorageMessage(current=>current===previous?'저장 덱 확인 완료':current),!mutating);
  const save=async()=>{if(mutationBusy.current)return;const name=deckName.trim();if(!name||name.length>40){setStorageMessage('덱 이름을 1~40자로 입력하세요.');return;}try{validateDeck(deck,catalog);}catch(e){setStorageMessage((e as Error).message);return;}const old=saved.find(d=>d.name===name)??null;if(old&&!window.confirm('기존 이름의 덱을 덮어쓸까요?'))return;mutationBusy.current=true;setMutating(true);try{const entry={name,deck:structuredClone(deck)},next=await withDeckLibraryLock(()=>saveNamedDeck(entry,old,storage));setSaved(next);setSavedIndex(String(next.findIndex(d=>d.name===name)));setStorageMessage('덱 저장 완료');}catch(e){storageFailure(e);}finally{mutationBusy.current=false;setMutating(false);}};
  const load=()=>{const item=saved[Number(savedIndex)];if(!savedIndex||!item)return;try{validateDeck(item.deck,catalog);setDeck(structuredClone(item.deck));setDeckName(item.name);setStorageMessage('덱 불러오기 완료');}catch{const repaired=repairDeck(catalog,item.deck);if(!window.confirm(`현재 버전에서 사용할 수 없는 카드 ${repaired.discarded.length}장이 있습니다. 사용 가능한 카드만 가져오시겠습니까? 원래 저장 덱은 남습니다.`))return;setDeck(repaired.deck);setDeckName((item.name+' (복원)').slice(0,40));setStorageMessage(`호환 카드 ${repaired.deck.cards.length}장 불러옴. 나머지 카드를 추가하세요.`);}};
  const removeSaved=async()=>{if(mutationBusy.current)return;const entry=saved[Number(savedIndex)];if(!savedIndex||!entry||!window.confirm('저장한 덱을 삭제할까요?'))return;mutationBusy.current=true;setMutating(true);try{setSaved(await withDeckLibraryLock(()=>deleteNamedDeck(entry,storage)));setSavedIndex('');setStorageMessage('저장 덱 삭제 완료');}catch(e){storageFailure(e);}finally{mutationBusy.current=false;setMutating(false);}};
  const counts=useMemo(()=>{const map=new Map<string,number>();for(const id of deck.cards)map.set(id,(map.get(id)??0)+1);return map;},[deck.cards]);
  // Sort only when the active class or name preference changes, not on every
  // card add/remove, search keystroke, or temporary status message.
  const legal=useMemo(()=>sortCardsForDisplay(deckCards(catalog,deck.heroClass),classicNames),[deck.heroClass,classicNames]);
  const setCards=useMemo(()=>legal.filter(c=>matchesCardSet(c,filterSet)&&(!restricted||owned!.has(c.id))),[legal,filterSet,restricted,owned]);
  const legalSetCounts=useMemo(()=>collectionSetCounts(legal),[legal]);
  const availableRarities=useMemo(()=>new Set(setCards.map(c=>c.rarity)),[setCards]);
  const query=search.trim().toLocaleLowerCase(),terms=useMemo(()=>cardSearchTerms(query),[query]);
  const shown=useMemo(()=>setCards.filter(c=>(kind==='all'||c.kind===kind)&&(filterRarity==='all'||c.rarity===filterRarity)&&(filterCost==='all'||(filterCost==='10plus'?c.cost>=10:c.cost===Number(filterCost)))&&matchesCardSearch(c,terms)),[setCards,kind,filterRarity,filterCost,deck.heroClass,terms]);const curve=useMemo(()=>manaCurve(catalog,deck),[deck]);const curveMax=Math.max(1,...curve);
  const filterKey=JSON.stringify([deck.heroClass,search,kind,filterRarity,filterCost,filterSet,ownedOnly]);
  const [bookPosition,setBookPosition]=useState({key:'',page:0});
  const groups=useMemo(()=>[deck.heroClass,'neutral'].map(key=>({key,items:shown.filter(card=>card.class===key)})),[shown,deck.heroClass]);
  const spread=useMemo(()=>groupedCollection(groups,0,8),[groups]);
  const requested=bookPosition.key===filterKey?bookPosition.page:Math.max(0,spread.spreads.findIndex(p=>p.key===deckTab));
  const bookPage=groupedCollection(groups,requested,8);
  const activeTab=bookPage.current?.key??deck.heroClass;
  const turnBook=(page:number)=>{const next=spread.spreads[page];if(next)setDeckTab(next.key as HeroClass|'neutral');setBookPosition({key:filterKey,page});};
  const selectBook=(value:HeroClass|'neutral')=>{const index=spread.spreads.findIndex(p=>p.key===value);if(index>=0)turnBook(index);};
  const deckRows=useMemo(()=>legal.filter(card=>counts.has(card.id)),[legal,counts]);
  const kindCounts={minion:0,spell:0,weapon:0,secret:0};for(const id of deck.cards){const c=catalog[id];if(c&&c.kind!=='coin')kindCounts[c.kind]++;}
  const averageCost=deck.cards.length?(curve.reduce((sum,n,i)=>sum+n*i,0)/deck.cards.length).toFixed(1):'0.0';
  const legalIds=useMemo(()=>new Set(legal.map(card=>card.id)),[legal]);
  const addReason=(card:Card)=>!legalIds.has(card.id)?'현재 직업에서 사용할 수 없는 카드':restricted&&!owned!.has(card.id)?'보유하지 않은 카드':deckAddReason(card,deck.cards.length,counts.get(card.id)??0);
  const motion=useDeckEditMotion(deck.cards);
  const [located,setLocated]=useState<{id:string;sequence:number}>();
  useEffect(()=>{
    if(!located)return;
    const timer=setTimeout(()=>setLocated(undefined),1200);
    return()=>clearTimeout(timer);
  },[located]);
  const locate=(id:string)=>{
    const visible=spread.spreads.findIndex(page=>page.items.some(card=>card.id===id));
    if(visible>=0)turnBook(visible);
    else {
      const all=legal.filter(card=>!restricted||owned!.has(card.id));
      const reset=groupedCollection([deck.heroClass,'neutral'].map(key=>({key,items:all.filter(card=>card.class===key)})),0,8);
      const index=reset.spreads.findIndex(page=>page.items.some(card=>card.id===id));
      if(index<0){showNotice('현재 보유 카드 목록에서 찾을 수 없습니다.',deck,true);return;}
      setSearch('');setKind('all');setFilterRarity('all');setFilterCost('all');setFilterSet('all');
      setDeckTab(reset.spreads[index].key as HeroClass|'neutral');
      setBookPosition({key:JSON.stringify([deck.heroClass,'','all','all','all','all',ownedOnly]),page:index});
    }
    setLocated(previous=>({id,sequence:(previous?.sequence??0)+1}));
  };
  const add=(id:string,source:HTMLElement)=>{const card=catalog[id];if(!card)return;const reason=addReason(card);if(reason){showNotice(`${displayCardName(card,classicNames)} 추가 불가 · ${reason}`,deck,true);return;}motion.prepare(id,source);const next={...deck,cards:[...deck.cards,id]};setDeck(next);showNotice(`${displayCardName(card,classicNames)} 1장 추가 · ${next.cards.length}/30장`,next,false,id);};
  const remove=(id:string,source:HTMLElement)=>{const copy=[...deck.cards];const index=copy.indexOf(id);if(index>=0){motion.prepare(id,source,true);copy.splice(index,1);const next={...deck,cards:copy};setDeck(next);showNotice(`${displayCardName(catalog[id],classicNames)} 1장 제거 · ${next.cards.length}/30장`,next,false,id);}};
  const fill=()=>{try{setDeck(completePracticeDeck(deckCatalog,deck));setStorageMessage(`부족한 ${30-deck.cards.length}장을 추천 카드로 채웠습니다.`);}catch(e){setStorageMessage((e as Error).message);}};
  const loadPreset=()=>{
    try{
      setDeck(strategicPresets?strategicDeck(deckCatalog,deck.heroClass,recommendStyle,random32()):basicDeck(catalog,deck.heroClass));
      if(!strategicPresets)setDeckName('');
    }catch(e){setStorageMessage((e as Error).message);}
  };
  const compact=useCompactCollection();
  const deckList=<div className="deck-list"><h3>내 덱 <span className="deck-live-count">{deck.cards.length}/30</span></h3><div className="deck-stats"><strong>평균 마나 {averageCost}</strong><span>하수인 {kindCounts.minion} · 주문 {kindCounts.spell}</span><span>무기 {kindCounts.weapon} · 비밀 {kindCounts.secret}</span></div><div className="mana-curve" role="img" aria-label={deckManaCurveLabel(curve)}>{curve.map((n,i)=><div key={i} data-recent={notice?.cardId&&Math.min(10,catalog[notice.cardId].cost)===i||undefined} aria-hidden="true" title={`${i===10?'10+':i}마나 ${n}장`}><small>{n||''}</small><span style={{height:`${Math.max(2,n/curveMax*48)}px`}}/><small>{i===10?'10+':i}</small></div>)}</div><div className="deck-list-scroll" ref={motion.list}>{deckRows.map(c=><div className="deck-entry" data-deck-card={c.id} data-recent={notice?.cardId===c.id||undefined} key={c.id}><button type="button" className="deck-inspect-row" aria-label={`${displayCardName(c,classicNames)} 카드 위치 보기 · ${counts.get(c.id)}장`} onClick={()=>locate(c.id)}><span className="local-deck-tile"><LocalCardArt card={c}/></span><span className="cost small">{c.cost}</span><span>{displayCardName(c,classicNames)}</span><b>×{counts.get(c.id)}</b></button><button type="button" className="deck-remove" aria-label={`${displayCardName(c,classicNames)} 한 장 제거`} title="한 장 제거" onClick={event=>remove(c.id,event.currentTarget.closest<HTMLElement>('.deck-entry')??event.currentTarget)}>−</button></div>)}{!deck.cards.length&&<p>카드를 눌러 덱에 추가하세요.</p>}</div><div className="controls saved-decks"><input placeholder="저장할 덱 이름" value={deckName} maxLength={40} onChange={e=>setDeckName(e.target.value)}/><button className="deck-save-primary" disabled={mutating||deck.cards.length!==30} onClick={save}>덱 저장</button>{!workspaceMode&&<><select value={savedIndex} onChange={e=>setSavedIndex(e.target.value)}><option value="">저장된 덱 ({saved.length})</option>{saved.map((d,i)=><option key={d.name} value={i}>{d.name} · {className[d.deck.heroClass]}</option>)}</select><button className="secondary" disabled={!savedIndex} onClick={load}>불러오기</button><button className="secondary" disabled={mutating||!savedIndex} onClick={removeSaved}>삭제</button></>}{storageMessage&&<small role="status">{storageMessage}</small>}</div></div>;
  return <section className="panel deck-panel deck-builder collection-workspace">
    <div className="deck-editor-controls collection-toolbar">
    <LobbyDialog label="덱 관리" icon={compact?"⋯":undefined}>
    {owned&&<div className="controls">{forceOwned?<strong>유저 모드 · 보유 카드만 사용</strong>:<label><input type="checkbox" checked={ownedOnly} onChange={e=>setOwnedOnly(e.target.checked)}/> 보유 카드만 보기·추천하기</label>}<small>{restricted?'랭크/계정 대전용 덱':'전체 카드 연습 모드'}</small>{deck.cards.some(id=>!owned.has(id))&&<button className="secondary" onClick={()=>setDeck({...deck,cards:deck.cards.filter(id=>owned.has(id))})}>미보유 카드 제거</button>}</div>}
    <div className="controls">{workspaceMode?<strong>직업 · {className[deck.heroClass]}</strong>:<label>직업<select value={deck.heroClass} onChange={e=>setDeck(practiceDeck(catalog,e.target.value as HeroClass))}>{HERO_CLASSES.map(c=><option key={c} value={c}>{className[c]}</option>)}</select></label>}{strategicPresets&&<label>추천 덱 유형<select value={recommendStyle} onChange={e=>setRecommendStyle(e.target.value as DeckStyle)}>{DECK_STYLES.map(s=><option key={s} value={s}>{DECK_STYLE_LABELS[s]}</option>)}</select></label>}<button onClick={loadPreset}>{strategicPresets?'추천 덱':'기본 덱 복제'}</button><button className="secondary" disabled={deck.cards.length===30} onClick={fill} title="현재 카드를 그대로 유지하고 빈칸만 채웁니다">빈칸 자동 채우기</button><button className="secondary" onClick={()=>setDeck({...deck,cards:[]})}>비우기</button><button className="secondary" disabled={!undoAvailable} onClick={undo}>되돌리기</button><small>{draftStored?'편집 중인 덱 자동 저장':'임시 덱 저장 공간을 사용할 수 없습니다.'}</small></div>
    <div className="power-note">영웅 능력 · {HERO_POWERS[deck.heroClass].name} (2마나) <span>{heroPowerDescription[deck.heroClass]}</span></div>
    <details className="deck-share"><summary>친구와 덱 공유하기</summary><p>공유 코드를 생성해 복사하거나 친구의 코드를 붙여넣어 불러오세요. 완성된 30장 덱만 공유할 수 있습니다.</p><textarea ref={shareRef} aria-label="덱 공유 코드" value={shareCode} onChange={e=>setShareCode(e.target.value)} placeholder="덱 공유 코드를 붙여넣으세요" maxLength={8192}/><div className="controls"><button disabled={deck.cards.length!==30} onClick={()=>{try{setShareCode(exportDeckCode(catalog,deck));setStorageMessage('덱 공유 코드 생성 완료');}catch(e){setStorageMessage((e as Error).message);}}}>공유 코드 만들기</button><button className="secondary" disabled={!shareCode.trim()} onClick={copyShare}>복사</button><button className="secondary" disabled={!shareCode.trim()} onClick={()=>{try{const next=importDeckCode(catalog,shareCode);setDeck(next);setStorageMessage('공유 덱 불러오기 완료');}catch(e){setStorageMessage((e as Error).message);}}}>공유 코드 불러오기</button></div></details>
    </LobbyDialog>
    <LobbyDialog label="카드 필터" icon={compact?"⌕":undefined}><div className="card-set-tabs" role="group" aria-label="카드 세트">{([["all","전체"],["basic","기본 카드"],["original","클래식 카드"]] as const).map(([key,label])=><button type="button" key={key} data-set-filter={key} aria-pressed={filterSet===key} onClick={()=>{setFilterSet(key);setFilterRarity('all');}}>{label}<small>{legalSetCounts[key]}</small></button>)}</div><div className="controls"><input type="search" aria-label="카드 이름 또는 효과 검색" title="이름 · 효과 · 종족 · 능력 (여러 검색어 가능)" placeholder="카드 이름 또는 효과 검색" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="카드 종류" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">전체 종류</option><option value="minion">하수인</option><option value="spell">주문</option><option value="weapon">무기</option><option value="secret">비밀</option></select><select aria-label="카드 등급" value={filterRarity} onChange={e=>setFilterRarity(e.target.value)}><option value="all">전체 등급</option>{availableRarities.has('basic')&&<option value="basic">기본</option>}{availableRarities.has('common')&&<option value="common">일반</option>}{availableRarities.has('rare')&&<option value="rare">희귀</option>}{availableRarities.has('epic')&&<option value="epic">영웅</option>}{availableRarities.has('legendary')&&<option value="legendary">전설</option>}</select><ManaFilter value={filterCost} onChange={setFilterCost}/><button className="secondary" onClick={()=>{setSearch('');setKind('all');setFilterRarity('all');setFilterCost('all');setFilterSet('all');}}>필터 초기화</button><small>{shown.length}/{legal.length}종</small></div></LobbyDialog>
    {notice&&<ToastNotice key={notice.message} kind={notice.warning?'error':'success'}>{notice.message}</ToastNotice>}
    </div>
    <div className={`deck-layout collection-body${compact?' compact-deck-body':''}`}><div className="book-pane"><div className="book-with-tabs"><BookTabs classes={[deck.heroClass,'neutral']} active={activeTab} onClass={selectBook}/><CollectionBook cards={bookPage.current?.items??[]} paging={{...bookPage,label:bookPage.current?`${bookPage.current.index+1} / ${bookPage.current.pages}`:'검색 결과 없음',onPage:turnBook}} renderCard={c=><div key={c.id} className="collection-item">
      <BattleCard card={c} enabled actionLabel="덱에 추가" onClick={(_,source)=>add(c.id,source)}/>
      {located?.id===c.id&&<span key={located.sequence} className="deck-card-located" aria-hidden="true"/>}
      <small className="collection-copy-badge" aria-label={`덱에 ${counts.get(c.id)??0}장`}>{counts.get(c.id)??0}/{owned&&!owned.has(c.id)?0:maxCardCopies(c)}</small>
    </div>}/></div></div>
    <aside className="deck-sidebar">{deckList}</aside></div>
  </section>;
}
export type DeckScreen='classes'|'select'|'cards'|'build';

const EMPTY_UNREAD_IDS:readonly string[]=[];
function CardBrowser({initialClass='all',focusCardId,unreadIds=EMPTY_UNREAD_IDS,onViewed,ownedCards,developer=false}:{focusCardId?:string;initialClass?:HeroClass|'all'|'neutral';unreadIds?:readonly string[];onViewed?:(id:string)=>void;ownedCards?:readonly string[];developer?:boolean}){
  const classic=useContext(ClassicNamesContext),[scope,setScope]=useState(initialClass),[set,setSet]=useState<CardSetFilter|'token'>('all'),[query,setQuery]=useState(''),[rarity,setRarity]=useState('all'),[kind,setKind]=useState('all'),[cost,setCost]=useState('all'),[newOnly,setNewOnly]=useState(false),[page,setPage]=useState(0),[inspected,setInspected]=useState<Inspectable|null>(null);
  const detailDialog=useRef<HTMLDialogElement>(null);
  const openDetail=(card:Card)=>{
    setInspected({card});
    onViewed?.(card.id);
    showCollectionDetail(detailDialog.current,null);
  };
  const unread=useMemo(()=>new Set(unreadIds),[unreadIds]);
  const owned=useMemo(()=>ownedCards?new Set(ownedCards):null,[ownedCards]);
  const all=useMemo(()=>{return sortCardsForDisplay(Object.values(catalog).filter(c=>developer||maxCardCopies(c)>0&&(!owned||owned.has(c.id))),classic).sort((a,b)=>Number(unread.has(b.id))-Number(unread.has(a.id)));},[classic,owned,unread,developer]);
  const allSetCounts=useMemo(()=>collectionSetCounts(all),[all]);
  const [tribe,setTribe]=useState('all');
  const tribes=useMemo(()=>[...new Set(all.flatMap(c=>c.kind==='minion'&&c.tribe!=='none'?[c.tribe]:[]))],[all]);
  const shown=useMemo(()=>{const terms=cardSearchTerms(query);return all.filter(c=>matchesCardSet(c,set)&&(rarity==='all'||(c.kind==='coin'?'basic':c.rarity)===rarity)&&(kind==='all'||c.kind===kind)&&(tribe==='all'||c.kind==='minion'&&c.tribe===tribe)&&(cost==='all'||(cost==='10plus'?c.cost>=10:c.cost===Number(cost)))&&(!newOnly||unread.has(c.id))&&matchesCardSearch(c,terms));},[all,set,rarity,kind,tribe,cost,query,newOnly,unread]);
  const size=useBookSize();
  const groups=useMemo(()=>bookClasses.map(key=>({key,items:shown.filter(card=>(card.kind==='coin'?'neutral':card.class)===key)})),[shown]);
  const collectibleCount=useMemo(()=>all.filter(card=>maxCardCopies(card)>0).length,[all]);
  const filteredCount=scope==='all'?shown.length:groups.find(group=>group.key===scope)?.items.length??0;
  const spread=useMemo(()=>groupedCollection(groups,0,size),[groups,size]);
  const first=scope==='all'?0:spread.spreads.findIndex(item=>item.key===scope);
  const selectedPage=collectionPage(spread.spreads,Math.max(0,first)+page,1);
  const result={page:selectedPage.page,pages:selectedPage.pages,spreads:spread.spreads,current:spread.spreads[selectedPage.page]};
  const active=scope==='all'?(result.current?.key??'warrior'):scope;
  const focused=useRef<string|undefined>(undefined);
  useEffect(()=>{if(!focusCardId||focused.current===focusCardId)return;const target=spread.spreads.findIndex(p=>p.items.some(c=>c.id===focusCardId));if(target<0)return;focused.current=focusCardId;setScope('all');setPage(target);},[focusCardId,spread]);
  const changeClass=(key:HeroClass|'neutral')=>{
    setScope(key);
    setPage(0);
  };
  const compactFilters=useCompactCollection();
  const filtersMounted=useRef(false);
  useEffect(()=>{if(!filtersMounted.current){filtersMounted.current=true;return;}setPage(0);setInspected(null);},[set,query,rarity,kind,tribe,cost,newOnly]);
  const filters=<>
    <div className="preview-card-filters">
    <div className="card-set-tabs" role="group" aria-label="카드 세트">{([['all','전체'],['basic','기본 카드'],['original','클래식 카드'],['token','생성 카드']] as const).filter(([key])=>developer||key!=='token').map(([key,label])=><button type="button" key={key} aria-pressed={set===key} onClick={()=>{setSet(key);setRarity('all');}}>{label}<small>{allSetCounts[key]}</small></button>)}</div>
    <div className="controls"><input type="search" aria-label="카드 이름 또는 효과 검색" title="이름 · 효과 · 종족 · 능력 (여러 검색어 가능)" value={query} onChange={e=>setQuery(e.target.value)} placeholder="카드 이름 또는 효과 검색"/><select aria-label="카드 종류" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">전체 종류</option><option value="minion">하수인</option><option value="spell">주문</option><option value="weapon">무기</option><option value="secret">비밀</option>{developer&&<option value="coin">동전</option>}</select><div className="rarity-filters" role="group" aria-label="카드 등급">{Object.entries({all:'전체',basic:'기본',common:'일반',rare:'희귀',epic:'영웅',legendary:'전설'}).map(([key,label])=><button type="button" key={key} className={`rarity-${key}`} aria-pressed={rarity===key} onClick={()=>setRarity(key)}>{key!=='all'&&<span className="rarity-gem" aria-hidden="true"/>}{label}</button>)}</div><ManaFilter value={cost} onChange={setCost}/><select aria-label="종족" value={tribe} onChange={e=>setTribe(e.target.value)}><option value="all">전체 종족</option>{tribes.map(key=><option key={key} value={key}>{tribeNames[key]}</option>)}</select><label className="new-only-filter"><input type="checkbox" checked={newOnly} onChange={e=>setNewOnly(e.target.checked)}/> NEW 카드만 보기 ({unreadIds.length})</label><button className="secondary" onClick={()=>{setScope('all');setSet('all');setQuery('');setRarity('all');setKind('all');setCost('all');setTribe('all');setNewOnly(false);}}>필터 초기화</button></div>
    </div>
    {!developer&&<small>검색 결과 {shown.length}종 · 수집 {all.length}종</small>}
  </>;
  const developerCounts=<div className="developer-catalog-count"><strong>개발자 모드 · 덱 구성 카드 전체 해금</strong><small>검색 결과 {filteredCount}종 · 전체 {all.length}종</small><small>덱 구성 {collectibleCount}종 · 비수집 {all.length-collectibleCount}종</small></div>;
  return <HoverPreviewProvider resetKey={`${scope}:${set}:${page}`}><section className="panel deck-panel card-browser integrated-browser collection-workspace" data-deck-screen="cards">
    <div className="collection-toolbar catalog-toolbar">{compactFilters&&<LobbyDialog label="카드 필터" icon="⌕">{filters}</LobbyDialog>}{developer&&developerCounts}</div>
    <div className="deck-layout collection-body">{!compactFilters&&<aside className="card-browser-controls catalog-inline-filters"><strong>카드 필터</strong>{filters}</aside>}<div className="book-pane book-with-tabs"><BookTabs active={active} onClass={changeClass}/><CollectionBook cards={result.current?.key===active?result.current.items:[]} size={size} paging={{...result,label:result.current?.key===active?`${active==='neutral'?'공용':className[active as HeroClass]} ${result.current.index+1}/${result.current.pages}장`:'검색 결과 없음',onPage:next=>{setPage(next);setScope('all');}}} renderCard={c=><div className={`collection-item${unread.has(c.id)?' card-new-unread':''}${focusCardId===c.id?' reward-card-focus':''}`} key={c.id}><BattleCard card={c} enabled onClick={()=>openDetail(c)}/>{unread.has(c.id)&&<span className="new-card-badge">NEW</span>}{maxCardCopies(c)>0&&<small className="collection-copy-badge" aria-label={ownedCards?`보유 ${owned?.has(c.id)?maxCardCopies(c):0}장`:`구성 가능 수량 ${maxCardCopies(c)}장`}>{ownedCards&&!owned?.has(c.id)?0:maxCardCopies(c)}</small>}</div>}/></div>
    </div><CollectionDetailDialog dialogRef={detailDialog} item={inspected} catalog={catalog} onClosed={()=>setInspected(null)}/></section></HoverPreviewProvider>;
}

function compatibleDeckEntry(entry:NamedDeck){
  try{validateDeck(entry.deck,catalog);return entry;}
  catch{
    const repaired=repairDeck(catalog,entry.deck);
    if(window.confirm(`호환되지 않는 카드 ${repaired.discarded.length}장을 제외하고 편집하시겠습니까? 원본 저장 덱은 보존됩니다.`))
      return {name:(entry.name+' (복원)').slice(0,40),deck:repaired.deck};
    return null;
  }
}

export function DeckWorkspace({initialScreen='classes',onPlay,developer=false,...props}:DeckEditorProps&{
  initialScreen?:DeckScreen;onPlay?:(deck:Deck)=>void;developer?:boolean;
}){
  const storage=useMemo(()=>props.storage??soloSlotStorage(1),[props.storage]);
  const [screen,setScreen]=useState(initialScreen);
  const [hero,setHero]=useState(props.deck.heroClass);
  const [editName,setEditName]=useState('');
  const build=(entry:NamedDeck)=>{
    props.setDeck(structuredClone(entry.deck));setEditName(entry.name);setScreen('build');
  };
  return <section className="deck-workspace">
    <nav className="deck-workspace-nav" aria-label="덱 관리 메뉴">
      <button type="button" data-deck-nav="classes" aria-pressed={screen==='classes'||screen==='select'} onClick={()=>setScreen('classes')}>직업 리스트</button>
      <button type="button" data-deck-nav="cards" aria-pressed={screen==='cards'} onClick={()=>setScreen('cards')}>카드 보기</button>
    </nav>
    {screen==='classes'&&<div className="deck-class-page" data-deck-screen="classes"><HeroChoice onChoose={value=>{setHero(value);setScreen('select');}}/></div>}
    {screen==='select'&&<div className="deck-class-page" data-deck-screen="select"><ClassDeckPicker key={hero} storage={storage} hero={hero}
      onChangeHero={()=>setScreen('classes')} onStart={onPlay}
      onBuild={value=>build({name:'',deck:{heroClass:value,cards:[]}})} onEdit={entry=>{const valid=compatibleDeckEntry(entry);if(valid)build(valid);}}/></div>}
    {screen==='cards'&&<CardBrowser developer={developer}/>}
    {screen==='build'&&<div data-deck-screen="build">
      <button className="secondary workspace-deck-back" type="button" onClick={()=>setScreen('select')}>← 덱 목록</button>
      <DeckEditor {...props} workspaceMode initialName={editName} strategicPresets={developer}/>
    </div>}
  </section>;
}
export { Battle } from './Battle.tsx';
type OfflineMode='player'|'developer';
type LobbyView='home'|'play'|'decks'|'catalog'|'slots'|'rank'|'quests'|'rewards'|'developer';
type AppProps={initialLobbyView?:LobbyView;standalone?:boolean;workerFactory?:()=>Worker;initialAiProfile?:import('../../../packages/protocol.ts').PublicAiProfile;initialOfflineMode?:OfflineMode};
export function App(props:AppProps={}){
  const [slot,setSlot]=useState<SoloSlot>(()=>props.standalone?readSelectedSlot():1);
  const selectSlot=(next:SoloSlot)=>{rememberSlot(next);setSlot(next);};
  return <AppSession key={slot} {...props} slot={slot} onSlotChange={selectSlot}/>;
}
function AppSession({standalone=false,workerFactory:baseWorkerFactory,initialAiProfile,initialOfflineMode='player',initialLobbyView='home',slot,onSlotChange}:AppProps&{slot:SoloSlot;onSlotChange:(slot:SoloSlot)=>void}){
  const storage=useMemo(()=>soloSlotStorage(slot),[slot]);
  const lossOnExit=standalone&&currentSoloNamespace()==='ui-preview';
  const makeWorker=(target:SoloSlot,developerFree=false)=>{if(!baseWorkerFactory)throw Error('저장 슬롯 작업 스레드가 없습니다.');const worker=baseWorkerFactory();if(standalone&&(developerFree||target!==1||currentSoloNamespace()==='ui-preview'))worker.postMessage({type:'selectSlot',slot:target,...(developerFree?{developerFree:true}:{}),...(currentSoloNamespace()==='ui-preview'?{namespace:'ui-preview'}:{})});return worker;};
  const workerFactory=baseWorkerFactory?()=>makeWorker(slot):undefined;
  const socketRef=useRef<Socket<ServerEvents,ClientEvents>|null>(null);const sessionRef=useRef<Session|null>(standalone?null:readSession());
  const ticketRef=useRef<string|null>(standalone?null:readRoomTicket(sessionStore())),connectionEpoch=useRef(0);
  const workerRef=useRef<Worker|null>(null),localRequestId=useRef(0);
  const releaseRef=useRef<{version?:string;catalog?:string}>({}),reloading=useRef(false);
  const workerWatchdog=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const clearWatchdog=()=>{if(workerWatchdog.current!==undefined){clearTimeout(workerWatchdog.current);workerWatchdog.current=undefined;}};
  const busyRef=useRef(false);
  const [connected,setConnected]=useState(false),[room,setRoom]=useState<RoomView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[code,setCode]=useState('');
  const [workerStalled,setWorkerStalled]=useState(false),workerStalledRef=useRef(false);
  const markWorkerStalled=(message:string)=>{if(workerRef.current){workerStalledRef.current=true;setWorkerStalled(true);setError(message);}};
  const acknowledgeWorker=(clearDelayMessage=false)=>{clearWatchdog();if(workerStalledRef.current&&clearDelayMessage)setError('');workerStalledRef.current=false;setWorkerStalled(false);};
  const [account,setAccount]=useState<AccountView|null>(null);
  const [offlineProfile,setOfflineProfile]=useState<AccountProfile>();
  const [unreadCards,setUnreadCards]=useState<string[]>(()=>syncNewCards(undefined,storage));
  const [rewardPopup,setRewardPopup]=useState<string[]>([]);
  const [catalogFocus,setCatalogFocus]=useState<string>();
  const [promotion,setPromotion]=useState<{before:number;after:number}>();
  const revealedMatches=useRef(new Set<string>());
  const queueRewardReveal=(code:string,rank:number,reward:RankedRewardSummary)=>{
    if(revealedMatches.current.has(code))return;
    revealedMatches.current.add(code);
    const cards=reward.unlockedCards?.filter(id=>!!catalog[id])??[];
    if(cards.length)setRewardPopup(cards);
    if(reward.rankAfter&&reward.rankAfter>rank)setPromotion({before:rank,after:reward.rankAfter});
  };
  useEffect(()=>{
    const next=syncNewCards(offlineProfile,storage);
    setUnreadCards(next);
  },[offlineProfile?.revision,storage]);
  const onViewNewCard=(id:string)=>setUnreadCards(markCardViewed(id,storage));
  const [previewEditHero,setPreviewEditHero]=useState<HeroClass|null>(null);
  const [previewEditName,setPreviewEditName]=useState('');
  const [previewPickerHero,setPreviewPickerHero]=useState<HeroClass|null>(null);
  const [previewPickerName,setPreviewPickerName]=useState<string>();
  const [offlineMode,setOfflineMode]=useState<OfflineMode>(initialOfflineMode);
  const practiceLobby=lossOnExit&&offlineMode==='developer'?'developer':'play';
  const developerDeckStorage=useMemo(()=>soloSlotStorage(slot,undefined,currentSoloNamespace(),'developer'),[slot]);
  const modeDecks=useRef<Partial<Record<OfflineMode,Deck>>>({});
  const localGrowth=useMemo(()=>standalone?offlineGrowth(catalog):undefined,[standalone]);
  const [updatePending,setUpdatePending]=useState(false),[updateBlocked,setUpdateBlocked]=useState(false);
  const [accountSync,setAccountSync]=useState(0),[growthSync,setGrowthSync]=useState(0);const [roomSync,setRoomSync]=useState(0);const [maintenance,setMaintenance]=useState(false);
  const [deck,setDeck]=useState<Deck>(()=>standalone&&initialOfflineMode==='developer'?readDeveloperDraft(catalog,catalogHash,storage):readDraft(catalog,catalogHash,storage,()=>basicDeck(catalog,'warrior')));
  const [freeSelection,setFreeSelection]=useState<FreeMatchSelection>(()=>readFreeMatchSelection(developerDeckStorage,deck.heroClass));
  const [undoDecks,setUndoDecks]=useState<Deck[]>([]),[draftStored,setDraftStored]=useState(true);
  const editDeck=(next:Deck)=>{if(next.heroClass===deck.heroClass&&next.cards.length===deck.cards.length&&next.cards.every((id,i)=>id===deck.cards[i]))return;setUndoDecks(old=>[...old.slice(-19),deck]);setDeck(next);};
  const undo=()=>{const last=undoDecks.at(-1);if(last){setDeck(last);setUndoDecks(old=>old.slice(0,-1));}};
  const initialDraft=useRef({deck,mode:offlineMode});
  const persistedDraft=useRef<{deck:Deck;mode:OfflineMode}|undefined>(undefined);
  useEffect(()=>{
    if(lossOnExit&&!persistedDraft.current&&deck===initialDraft.current.deck&&offlineMode===initialDraft.current.mode){
      persistedDraft.current=initialDraft.current;
      return;
    }
    const stored=standalone&&offlineMode==='developer'?saveDeveloperDraft(deck,catalogHash,storage):saveDraft(deck,catalogHash,storage);
    persistedDraft.current=stored?{deck,mode:offlineMode}:undefined;
    setDraftStored(stored);
  },[deck,offlineMode,standalone,storage]);
  const [soloSettings,setSoloSettings]=useState<SoloSettings>(()=>{const s=readSoloSettings(storage);return standalone?{...s,engine:'device'}:s;});
  const setSolo=<K extends keyof SoloSettings>(key:K,value:SoloSettings[K])=>setSoloSettings(old=>({...old,[key]:value}));
  const {heroClass:botClass,difficulty,engine:botEngine,deviceMode,style:botStyle,first,animationSpeed}=soloSettings;
  const setBotClass=(v:SoloClass)=>setSolo('heroClass',v),setDifficulty=(v:BotDifficulty)=>setSolo('difficulty',v),setBotEngine=(v:'device'|'server')=>setSolo('engine',standalone?'device':v),setDeviceMode=(v:DeviceMode)=>setSolo('deviceMode',v),setBotStyle=(v:SoloStyle)=>setSolo('style',v),setFirst=(v:FirstSelection)=>setSolo('first',v),setAnimationSpeed=(v:AnimationSpeed)=>setSolo('animationSpeed',v);
  const [,setSoloHistory]=useState(()=>readSoloHistory(storage)),[savedMatch,setSavedMatch]=useState<LocalSaveSummary|null>(null),[saveAvailable,setSaveAvailable]=useState<boolean|undefined>(undefined);
  const [saveRetryable,setSaveRetryable]=useState(false);
  const warnLocalExit=!lossOnExit&&shouldWarnLocalExit(room,busy,saveAvailable,saveRetryable);
  useEffect(()=>{if(!warnLocalExit)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[warnLocalExit]);
  const [oldRankedPending,setOldRankedPending]=useState<boolean|undefined>(undefined);
  const [saveProbe,setSaveProbe]=useState(0);
  const growthReady=saveAvailable===undefined?undefined:saveAvailable&&oldRankedPending!==undefined;
  const startSaveProbe=()=>{setSaveAvailable(undefined);setOldRankedPending(undefined);setSaveProbe(n=>n+1);};
  const recheckSave=()=>{if(workerRef.current||busy||saveAvailable===undefined)return;startSaveProbe();};
  const initialSettings=useRef(soloSettings);
  const persistedSettings=useRef<SoloSettings|undefined>(undefined);
  useEffect(()=>{
    if(lossOnExit&&soloSettings===initialSettings.current){persistedSettings.current=soloSettings;return;}
    persistedSettings.current=saveSoloSettings(soloSettings,storage)?soloSettings:undefined;
  },[soloSettings,storage]);
  useEffect(()=>{if(room){const result=resultFromRoom(room,catalogHash);if(result)setSoloHistory(old=>recordSoloResult(result,storage,old));}},[room?.code,room?.state?.phase]);
  useEffect(()=>{let stopped=false,probe:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    const close=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}if(probe){probe.onmessage=null;probe.onerror=null;probe.terminate();probe=undefined;}};
    const finish=(data?:Extract<LocalResponse,{type:'saveInfo'}>)=>{if(stopped)return;stopped=true;close();if(workerRef.current)return;setSaveAvailable(data?.available??false);setSavedMatch(old=>reconcileSaveProbe(old,data));if(standalone){if(data?.profile)setOfflineProfile(old=>!old||data.profile!.revision>=old.revision?data.profile:old);setOldRankedPending(data?.otherActiveRanked);}};
    try{if(!workerFactory)throw Error('Missing worker factory');probe=workerFactory();probe.onmessage=({data}:MessageEvent<LocalResponse>)=>{if(data.type==='saveInfo')finish(data);else if(data.type==='error')finish();};probe.onerror=()=>finish();timer=setTimeout(()=>finish(),5000);probe.postMessage({type:'inspectSave',catalogHash,...(standalone?{catalog}:{}),} satisfies LocalRequest);}catch{finish();}
    return()=>{stopped=true;close();};
  },[saveProbe]);
  const [lobbyView,setLobbyView]=useState<LobbyView>(initialLobbyView);
  const [freeSave,setFreeSave]=useState<{save:LocalSaveSummary|null;available:boolean}>();
  useEffect(()=>{
    if(!lossOnExit||lobbyView!=='developer'||offlineMode!=='developer'||room||busy)return;
    let probe:Worker|undefined;
    const finish=(save:LocalSaveSummary|null,available:boolean)=>{
      probe?.terminate();probe=undefined;
      setFreeSave({save,available});
    };
    const timer=setTimeout(()=>finish(null,false),5000);
    try{
      probe=makeWorker(slot,true);
      probe.onmessage=({data}:MessageEvent<LocalResponse>)=>{
        if(data.type==='saveInfo')finish(data.save,data.available);
        else if(data.type==='error')finish(null,false);
        else return;
        clearTimeout(timer);
      };
      probe.onerror=()=>{clearTimeout(timer);finish(null,false);};
      probe.postMessage({type:'inspectSave',catalogHash} satisfies LocalRequest);
    }catch{clearTimeout(timer);finish(null,false);}
    return ()=>{clearTimeout(timer);probe?.terminate();};
  },[lossOnExit,lobbyView,offlineMode,room,busy,slot,baseWorkerFactory]);
  const [toast,setToast]=useState<{text:string;kind:'success'|'info'}|null>(null);
  useEffect(()=>{
    if(!toast)return;
    const id=setTimeout(()=>setToast(null),2600);
    return ()=>clearTimeout(id);
  },[toast]);
  useEffect(()=>{
    if(!standalone)return;
    try{
      const key='card-duel-local-storage-intro';
      if(!localStorage.getItem(key)){
        localStorage.setItem(key,'1');
        setToast({text:'경기와 덱은 이 브라우저의 선택한 슬롯에 저장됩니다.',kind:'info'});
      }
    }catch{}
  },[standalone]);

  const [landscapeMenu,setLandscapeMenu]=useState<HTMLElement|null>(null);
  const screenScrollRef=useRef<HTMLDivElement|null>(null);
  useLayoutEffect(()=>{
    if(!standalone)return;
    const safety=(event:Event)=>{
      const {respond}=(event as CustomEvent<{respond:(reason:string|null)=>void}>).detail;
      respond(room||workerRef.current||busyRef.current?'진행 중인 대전을 저장하고 메인 메뉴로 돌아오세요.':
        lobbyView!=='home'?'다른 게임 화면의 작업을 저장하고 메인 메뉴로 돌아오세요.':
        saveRetryable||!draftStored||saveAvailable!==true||
          persistedDraft.current?.deck!==deck||persistedDraft.current.mode!==offlineMode||
          persistedSettings.current!==soloSettings?'저장 상태를 확인할 수 없습니다. 저장을 확인한 뒤 다시 시도하세요.':null);
    };
    window.addEventListener('card-duel-update-safety',safety);
    return ()=>window.removeEventListener('card-duel-update-safety',safety);
  },[standalone,room,saveRetryable,draftStored,saveAvailable,lobbyView,offlineMode,deck,soloSettings]);
  useEffect(()=>{
    if(standalone&&lobbyView==='home'&&!room)window.dispatchEvent(new Event('card-duel-update-home'));
  },[standalone,lobbyView,room]);
  const openLobbyView=(next:Exclude<LobbyView,'home'>,restoreFocus=false,cardId?:string)=>{
    setCatalogFocus(cardId);
    setLobbyView(next);screenScrollRef.current?.scrollTo(0,0);
    // A screen-switching action disappears when its old panel unmounts.
    // Return keyboard focus to the persistent navigation tab, not the body.
    if(restoreFocus)requestAnimationFrame(()=>screenScrollRef.current?.querySelector<HTMLButtonElement>(`[data-lobby-tab="${next}"]`)?.focus());
  };
  const previousBattleMounted=useRef(false);
  useEffect(()=>{
    const wasPlaying=previousBattleMounted.current;
    previousBattleMounted.current=!!room;
    if(!wasPlaying||room)return;
    // Returning from a finished, paused or abandoned match unmounts Battle.
    // Move focus to the current menu tab so keyboard users are not stranded
    // on an element that no longer exists. Initial lobby load is unaffected.
    const frame=requestAnimationFrame(()=>screenScrollRef.current?.querySelector<HTMLButtonElement>(`[data-lobby-tab="${lobbyView}"]`)?.focus());
    return ()=>cancelAnimationFrame(frame);
  },[room?.code,lobbyView]);
  const [slotPreviews,setSlotPreviews]=useState<Partial<Record<SoloSlot,LocalSlotOverview|null>>>({});
  useEffect(()=>{
    if(!standalone||!baseWorkerFactory||room||busy||lobbyView!==(lossOnExit?'slots':'play')||saveAvailable===undefined)return;
    let stopped=false,epoch=0,active:{worker:Worker;timer:ReturnType<typeof setTimeout>}|undefined;
    const cancel=()=>{if(active){clearTimeout(active.timer);active.worker.terminate();active=undefined;}};
    const refresh=()=>{if(slotPreviewRefreshAction(!document.hidden,!!active)!=='start')return;const current=++epoch;cancel();setSlotPreviews({});const pending=SOLO_SLOTS.filter(target=>target!==slot);
      const next=()=>{if(stopped||current!==epoch)return;const target=pending.shift();if(target===undefined)return;
        // On memory-constrained mobile devices, never run both other-slot
        // preview workers alongside each other or the active game worker.
        let finished=false;const finish=(value:LocalSlotOverview|null)=>{if(finished||stopped||current!==epoch)return;finished=true;cancel();setSlotPreviews(old=>({...old,[target]:value}));next();};
        try{const worker=makeWorker(target),timer=setTimeout(()=>finish(null),5000);active={worker,timer};worker.onmessage=({data}:MessageEvent<LocalResponse>)=>{if(data.type==='slotInfo')finish(data.overview);else if(data.type==='error')finish(null);};worker.onerror=()=>finish(null);worker.postMessage({type:'inspectSlot',catalogHash,catalog} satisfies LocalRequest);}catch{finish(null);}
      };next();
    };
    const visibility=()=>{if(slotPreviewRefreshAction(!document.hidden,!!active)==='cancel'){++epoch;cancel();}else refresh();};
    refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visibility);return()=>{stopped=true;cancel();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility);};
  },[slot,room?.code,lobbyView,standalone,baseWorkerFactory,busy,saveAvailable]);
  const freshSlot=(target:SoloSlot)=>{const preview=slotPreviews[target];return target!==slot&&!!preview&&!preview.initialized&&!preview.save&&preview.otherSaves===0&&!hasSlotLocalData(target);};
  const nextFresh=SOLO_SLOTS.find(freshSlot);
  const switchOfflineMode=(next:OfflineMode)=>{if(next===offlineMode||busyRef.current||workerRef.current)return;modeDecks.current[offlineMode]=deck;const stored=offlineMode==='developer'?saveDeveloperDraft(deck,catalogHash,storage):saveDraft(deck,catalogHash,storage);setDeck(modeDecks.current[next]??(next==='developer'?readDeveloperDraft(catalog,catalogHash,storage):readDraft(catalog,catalogHash,storage,()=>basicDeck(catalog,'warrior'))));setUndoDecks([]);setOfflineMode(next);setLobbyView(lossOnExit?'developer':'play');setError(stored?'':'현재 편집 덱은 이번 실행에서만 유지됩니다. 브라우저 저장소를 확인하세요.');};
  const switchSlot=(next:SoloSlot)=>{if(next===slot||busyRef.current||workerRef.current||lobbyView!==(lossOnExit?'slots':'play'))return;if(!(offlineMode==='developer'?saveDeveloperDraft(deck,catalogHash,storage):saveDraft(deck,catalogHash,storage))){setError('현재 편집 덱을 저장하지 못했습니다. 저장 공간을 확인하세요.');return;}onSlotChange(next);};
  const changeBusy=(value:boolean)=>{busyRef.current=value;setBusy(value);};
  const saveSession=(value:Session|null)=>{sessionRef.current=value;try{if(value)sessionStorage.setItem(sessionKey,JSON.stringify(value));else sessionStorage.removeItem(sessionKey);}catch{/* Storage may be disabled; current-tab session remains in memory. */}};
  const saveTicket=(value:string|null)=>{ticketRef.current=value;saveRoomTicket(sessionStore(),value);};
  const releaseReady=()=>releaseRef.current.version===project.version&&releaseRef.current.catalog===catalogHash;
  const clearServerRoom=()=>{saveSession(null);saveTicket(null);setRoom(null);setConnected(releaseReady()&&!!socketRef.current?.connected);changeBusy(false);};
  const reconnect=()=>{const socket=socketRef.current;if(!socket)return;setError('');setConnected(false);if(!workerRef.current)changeBusy(false);socket.disconnect().connect();};
  const reloadOnce=()=>{if(reloading.current)return;setConnected(false);setUpdatePending(false);if(!reserveReleaseReload(sessionStore())){setUpdateBlocked(true);return;}reloading.current=true;window.location.reload();};
  const checkRelease=()=>{const {version,catalog:hash}=releaseRef.current,disposition=releaseDisposition(project.version,catalogHash,version,hash,!!workerRef.current);setUpdatePending(disposition==='defer');if(disposition==='reload')reloadOnce();else if(disposition==='defer')setConnected(false);else if(confirmRelease(sessionStore(),project.version,catalogHash,version,hash))setUpdateBlocked(false);return disposition;};
  useEffect(()=>{if(!standalone&&updatePending&&!workerRef.current&&!room&&!busy)reloadOnce();},[updatePending,room,busy]);
  const acceptView=(view:RoomView)=>{if(!workerRef.current&&releaseReady()&&(sessionRef.current?.code===view.code||!!ticketRef.current))setRoom(previous=>mergeRoomView(previous,view));};
  const sync=(socket:Socket<ServerEvents,ClientEvents>,quiet=false)=>{const epoch=connectionEpoch.current;socket.timeout(30000).emit('room:sync',(err,result)=>{if(epoch!==connectionEpoch.current)return;changeBusy(false);if(err){setConnected(false);setError('서버 응답을 받지 못했습니다. 연결 재시도를 누르세요.');return;}if(result.ok){acceptView(result.data);setConnected(true);setError(quiet?'':'서버의 최신 상태를 불러왔습니다.');}else{if(terminalSessionFailure(result.code))clearServerRoom();else setConnected(false);setError(result.error+(terminalSessionFailure(result.code)?'':' 연결 재시도를 누르세요.'));}});};
  useEffect(()=>{
    if(standalone)return()=>{clearWatchdog();workerRef.current?.terminate();workerRef.current=null;};
    const socket:Socket<ServerEvents,ClientEvents>=io({autoConnect:false});socketRef.current=socket;
    socket.on('connect',()=>socket.timeout(20000).emit('account:watch',()=>setAccountSync(n=>n+1)));
    socket.on('account:changed',()=>setAccountSync(n=>n+1));
    socket.on('account:room-changed',()=>setRoomSync(n=>n+1));
    socket.on('server:version',version=>{connectionEpoch.current++;releaseRef.current={version};setConnected(false);checkRelease();});
    socket.on('server:maintenance',setMaintenance);
    socket.on('server:catalog',hash=>{const epoch=++connectionEpoch.current;setGrowthSync(n=>n+1);releaseRef.current.catalog=hash;checkRelease();if(workerRef.current){setConnected(releaseReady());return;}setConnected(false);if(!releaseReady())return;const s=sessionRef.current,ticket=ticketRef.current;if(!s&&!ticket){setRoom(null);setConnected(true);setError('');return;}changeBusy(true);
      const restore=(err:Error|null,result:Result<Session>)=>{if(epoch!==connectionEpoch.current)return;if(err){changeBusy(false);setError('경기 복원 응답이 지연됩니다. 연결 재시도로 다시 복원하세요.');return;}if(!result.ok){changeBusy(false);if(terminalSessionFailure(result.code))clearServerRoom();setError(result.error+(terminalSessionFailure(result.code)?'':' 연결 재시도를 누르세요.'));return;}saveSession(result.data);saveTicket(null);sync(socket,true);};
      if(s)socket.timeout(45000).emit('room:resume',{code:s.code,token:s.token},restore);else socket.timeout(45000).emit('room:recover',{ticket:ticket!},restore);
    });
    socket.on('disconnect',reason=>{connectionEpoch.current++;setConnected(false);if(reason==='io server disconnect')setAccountSync(n=>n+1);if(!workerRef.current)changeBusy(false);});socket.on('connect_error',()=>{setConnected(false);if(!workerRef.current){changeBusy(false);if(sessionRef.current||ticketRef.current)setError('서버에 연결하지 못했습니다. 실행 중인지 확인하세요.');}});
    socket.on('room:view',acceptView);socket.on('room:error',e=>{if(!workerRef.current)setError(e);});socket.on('room:expired',event=>{if(!workerRef.current&&(sessionRef.current?.code===event.code||ticketRef.current)){connectionEpoch.current++;clearServerRoom();setError(event.reason);}});socket.connect();return()=>{connectionEpoch.current++;socket.disconnect();socketRef.current=null;clearWatchdog();workerRef.current?.terminate();workerRef.current=null;};
  },[]);
  const recoverLocalWorker=(message:string)=>{
    acknowledgeWorker();workerRef.current?.terminate();workerRef.current=null;setRoom(null);setSaveRetryable(false);setLobbyView(practiceLobby);changeBusy(false);
    startSaveProbe();setError(message+' 마지막으로 저장된 경기를 다시 확인합니다.');
  };
  const recoverStalledWorker=()=>{
    if(!workerRef.current||!workerStalledRef.current||!window.confirm('기기 AI 작업이 아직 진행 중일 수 있습니다. 작업을 중단하면 확인되지 않은 최신 행동은 사라질 수 있으며 마지막 저장 기록만 복구합니다. 중단하고 저장 경기를 다시 확인할까요?'))return;
    recoverLocalWorker('지연된 기기 AI 작업을 중단했습니다.');
  };
  const startLocalWorker=(initialize:(worker:Worker)=>void,developerFree=false,onFirstView?:()=>void)=>{
    if(workerRef.current||busyRef.current)return;
    if(sessionRef.current||ticketRef.current){setError('기존 서버 대전을 복원하고 나간 뒤 기기 AI 대전을 시작하세요.');return;}
    changeBusy(true);setError('');
    try{
      if(!workerFactory)throw Error('Missing worker factory');
      const worker=developerFree?makeWorker(slot,true):workerFactory();
      const updateSave=(save:LocalSaveSummary|null|undefined,available:boolean|undefined)=>{
        if(developerFree){
          setFreeSave(old=>({save:save===undefined?old?.save??null:save,available:available??old?.available??false}));
        }else{
          if(save!==undefined)setSavedMatch(save);
          if(available!==undefined)setSaveAvailable(available);
        }
      };
      workerRef.current=worker;
      let hasView=false;
      const fail=(message:string)=>{if(workerRef.current!==worker)return;recoverLocalWorker(message);};
      workerWatchdog.current=setTimeout(()=>fail('기기 AI 응답 시간이 초과되었습니다.'),12000);
      worker.onmessage=({data}:MessageEvent<LocalResponse>)=>{
        if(workerRef.current!==worker)return;
        if('requestId'in data&&data.requestId!==undefined&&data.requestId!==localRequestId.current&&data.type!=='view')return;
        setSaveRetryable(!!data.saveRetryable);
        if(standalone&&data.profile)setOfflineProfile(old=>!old||data.profile!.revision>=old.revision?data.profile:old);
        if(data.type==='error'){
          if(data.requestId===undefined||!hasView){fail(data.error);return;}
          updateSave(data.save,data.saveAvailable);
          acknowledgeWorker();
          setError(data.error);changeBusy(false);return;
        }
        if(data.type==='forfeited'){
          const reward=data.profile?.recentMatches?.find(match=>match.matchId===data.save.code&&match.eligible);
          if(reward)queueRewardReveal(data.save.code,reward.rank,reward);
        }
        if(data.type==='paused'||data.type==='discarded'||data.type==='forfeited'){if(data.requestId!==localRequestId.current)return;acknowledgeWorker();worker.terminate();workerRef.current=null;setRoom(null);setLobbyView(practiceLobby);updateSave(data.save,data.type==='paused'||data.type==='forfeited'||(data.type==='discarded'&&data.available));if(data.type==='paused')setToast({text:'경기를 저장했습니다. 대전 준비에서 이어할 수 있습니다.',kind:'success'});else if(data.type==='forfeited')setToast({text:'기존 경기가 패배로 정산되었습니다.',kind:'info'});changeBusy(false);return;}
        if(data.type!=='view')return;
        const ranked=data.view.ranked;
        if(ranked?.reward==='saved'&&ranked.rewardDetails)queueRewardReveal(data.view.code,ranked.rank,ranked.rewardDetails);
        const firstView=!hasView;hasView=true;
        if(firstView)onFirstView?.();
        updateSave(data.save,data.saveAvailable);
        setRoom(previous=>mergeRoomView(previous,data.view));if(localViewAcknowledges(data.requestId,localRequestId.current,firstView,data.view.state?.revision,data.resumed)){acknowledgeWorker(true);changeBusy(false);}
      };
      worker.onerror=()=>fail(standalone?'이 기기에서 AI 작업이 중단되었습니다. 확인되지 않은 최신 행동은 복구되지 않을 수 있습니다.':'이 기기에서 AI 작업이 중단되었습니다.');
      initialize(worker);
    }catch{recoverLocalWorker(standalone?'이 브라우저에서 기기 AI 작업을 시작하지 못했습니다.':'이 브라우저에서 기기 AI 작업을 시작하지 못했습니다. 서버 AI도 선택할 수 있습니다.');}
  };
  const deviceInfo=()=>({cores:navigator.hardwareConcurrency,memoryGb:(navigator as Navigator&{deviceMemory?:number}).deviceMemory});
  const newLocalCode=()=>`LOCAL-${random32().toString(16)}-${random32().toString(16)}`;
  const chooseOfflineRewardPath=(pathId:string)=>{
    if(!workerFactory||busyRef.current||workerRef.current)return;
    changeBusy(true);setError('');
    let worker:Worker|undefined;
    const finish=(error?:string)=>{
      clearTimeout(timer);worker?.terminate();changeBusy(false);
      if(error)setError(error);
    };
    const timer=setTimeout(()=>finish('보상의 길 저장 응답이 지연되고 있습니다.'),10000);
    try{
      worker=workerFactory();
      worker.onmessage=({data}:MessageEvent<LocalResponse>)=>{
        if(data.type==='error'){finish(data.error);return;}
        if(data.type!=='rewardPathSelected'||!data.profile)return;
        setOfflineProfile(previous=>!previous||data.profile!.revision>=previous.revision?data.profile:previous);
        finish();
      };
      worker.onerror=()=>finish('보상의 길을 저장하지 못했습니다.');
      worker.postMessage({type:'selectRewardPath',catalog,pathId} satisfies LocalRequest);
    }catch{finish('보상의 길을 저장하지 못했습니다.');}
  };
  const beginLocal=(config:ResolvedSolo,matchDeck:Deck,ranked=false,developerRank?:number,developerExperiment=false,free?:{opponentDeck:Deck;selection:FreeMatchSelection})=>{
    const developerFree=free!==undefined;
    if(developerFree&&(!standalone||offlineMode!=='developer'||ranked||developerRank!==undefined))return;
    let practiceOpponent:Deck|undefined;
    if(!ranked&&developerRank===undefined&&!developerFree&&account?.role!=='developer'&&(!standalone||offlineMode==='player')){
      if(account){
        const growth=offlineGrowth(catalog);
        practiceOpponent=collectionBotDeck(catalog,growth,config.heroClass,syncOwned(account.profile,growth));
      }else practiceOpponent=basicDeck(catalog,config.heroClass);
    }
    const saved=developerFree?freeSave?.save:savedMatch;
    const available=developerFree?freeSave?.available:saveAvailable;
    if(ranked&&offlineMode==='developer'){setError('유저 모드에서 랭크 대전을 시작하세요.');return;}
    if(ranked&&!growthReady){setError('저장소와 성장 기록을 확인한 뒤 랭크 경기를 시작하세요.');return;}
    if(ranked&&oldRankedPending){setError('이전 카드 버전에서 진행 중인 랭크 경기를 완료한 뒤 다시 시작하세요.');return;}
    if(saved?.rank!==undefined&&saved.phase!=='finished'){setError('진행 중인 랭크 대전을 먼저 이어서 완료하거나 항복하세요.');return;}
    if(available===undefined){setError('저장된 경기를 확인하는 중입니다. 잠시 후 다시 시도하세요.');return;}
    if(saved&&saved.phase!=='finished'&&!window.confirm('새 대전을 시작하면 저장된 진행 중인 경기가 교체됩니다. 새 대전을 시작할까요?'))return;
    startLocalWorker(worker=>{void (initialAiProfile?Promise.resolve(initialAiProfile):localAiProfile(catalogHash)).then(profile=>{
        if(workerRef.current!==worker)return;
        const request:LocalRequest={type:'start',replaceSave:saved,ranked,developerRank,...(developerExperiment?{developerExperiment:true}:{}),input:{catalog,catalogHash,...(free?{developerFree:true as const,developerOpponentDeck:free.opponentDeck}:{}),deck:structuredClone(matchDeck),heroClass:config.heroClass,difficulty:config.difficulty,seed:config.seed,code:newLocalCode(),...(practiceOpponent?{practiceOpponentDeck:practiceOpponent}:{}),style:practiceOpponent?(account?'practice':'starter'):config.style,firstPlayer:config.firstPlayer,deckSeed:config.deckSeed,weights:profile.weights,generation:profile.generation,deviceMode:config.deviceMode,animationSpeed:config.animationSpeed,device:deviceInfo()}};
        worker.postMessage(request);
      }).catch(()=>{if(workerRef.current===worker)recoverLocalWorker('기기 AI를 시작하지 못했습니다.');});},developerFree,free?()=>{
      if(!rememberFreeMatchSelection(developerDeckStorage,free.selection))
        setToast({text:'자유 대전 설정을 기기에 저장하지 못했습니다.',kind:'info'});
    }:undefined);
  };
  const beginDeveloperFree=()=>{
    const config=resolveSolo({...soloSettings,heroClass:freeSelection.opponent,difficulty:freeSelection.difficulty,style:'practice'},random32());
    const saved=readDecks(developerDeckStorage);
    try{
      const player=resolveFreeDeck(catalog,freeSelection.player,freeSelection.playerDeck,saved,deck,config.seed);
      const opponent=resolveFreeDeck(catalog,config.heroClass,freeSelection.opponentDeck,saved,deck,config.deckSeed);
      beginLocal({...config,style:opponent.style},player.deck,false,undefined,false,{opponentDeck:opponent.deck,selection:freeSelection});
    }catch(error){setError(error instanceof Error?error.message:'시험 덱을 시작하지 못했습니다.');}
  };
  const resumeDeveloperFree=()=>{
    const save=freeSave?.save;
    if(offlineMode!=='developer'||!save||!freeSave?.available)return;
    startLocalWorker(worker=>worker.postMessage({type:'resume',catalog,catalogHash,device:deviceInfo(),expectedCode:save.code} satisfies LocalRequest),true);
  };
  const forfeitSaved=()=>{if(!savedMatch||savedMatch.phase==='finished'||saveAvailable!==true||busyRef.current)return;if(!window.confirm('저장된 기존 경기를 패배로 기록하고 새로운 게임을 시작하시겠습니까?'))return;startLocalWorker(worker=>worker.postMessage({type:'forfeitSaved',requestId:localRequestId.current,catalog,catalogHash,expected:savedMatch} satisfies LocalRequest));};
  const resumeLocal=()=>{if(!savedMatch||saveAvailable!==true)return;if(standalone&&(savedMatch.testRank!==undefined&&offlineMode!=='developer'||savedMatch.rank!==undefined&&offlineMode!=='player')){setError('이 저장 경기는 '+(savedMatch.testRank!==undefined?'개발자':'유저')+' 모드에서 이어할 수 있습니다.');return;}startLocalWorker(worker=>worker.postMessage({type:'resume',catalog,catalogHash,device:deviceInfo(),expectedCode:savedMatch.code} satisfies LocalRequest));};
  const localCommand=(type:'pause'|'retrySave'|'discard'|'forfeit')=>{const worker=workerRef.current;if(!worker||busyRef.current)return;changeBusy(true);setError('');clearWatchdog();const requestId=++localRequestId.current;workerWatchdog.current=setTimeout(()=>markWorkerStalled('경기 저장소 응답이 지연되고 있습니다.'),12000);try{worker.postMessage(type==='discard'?{type,requestId,catalogHash}:{type,requestId} satisfies LocalRequest);}catch{recoverLocalWorker('경기 저장 요청을 전달하지 못했습니다.');}};
  const discardSaved=()=>{if(saveAvailable!==true||!savedMatch||savedMatch.rank!==undefined&&savedMatch.phase!=='finished'||busyRef.current||!window.confirm('저장된 경기만 제거할까요? 완료한 대전 기록은 유지됩니다.'))return;startLocalWorker(worker=>worker.postMessage({type:'discard',catalogHash,requestId:++localRequestId.current,expected:savedMatch} satisfies LocalRequest));};
  const begin=(mode:'create'|'join'|'bot'|AccountPlayMode,accountCode?:string,expectedAccountId?:string)=>{
    const accountMode=mode!=='create'&&mode!=='join'&&mode!=='bot';
    if(accountMode&&!expectedAccountId){setError('로그인 계정을 다시 확인하세요.');return;}
    if(mode!=='account-resume')try{validateDeck(deck,catalog);}catch(e){setError((e as Error).message);return;}
    const config=mode==='bot'?resolveSolo(soloSettings,random32()):undefined;
    if(config&&botEngine==='device'){beginLocal(config,deck);return;}
    const socket=socketRef.current;if(!connected||!releaseReady()||!socket?.connected||busyRef.current||sessionRef.current||ticketRef.current)return;setError('');changeBusy(true);
    let ticket:string;try{ticket=newRoomTicket();saveTicket(ticket);}catch(e){changeBusy(false);setError((e as Error).message);return;}
    const epoch=connectionEpoch.current,reply=(err:Error|null,result:Result<Session>)=>{if(epoch!==connectionEpoch.current)return;if(err){changeBusy(false);setConnected(false);setError('방 요청 응답이 지연됩니다. 연결 재시도를 눌러 복구하세요.');return;}if(result.ok){saveSession(result.data);saveTicket(null);sync(socket,true);}else{if(result.code==='serverError'){setConnected(false);}else saveTicket(null);changeBusy(false);if(result.code==='accountChanged')reconnect();setError(result.error);}};
    if(mode==='create')socket.timeout(8000).emit('room:create',{deck,ticket},reply);else if(mode==='ranked')socket.timeout(30000).emit('room:ranked',{deck,ticket,expectedAccountId},reply);else if(mode==='developer-test')socket.timeout(30000).emit('room:developer-test',{deck,rank:Number(accountCode),ticket,expectedAccountId},reply);else if(mode==='owned-create')socket.timeout(30000).emit('room:owned-create',{deck,ticket,expectedAccountId},reply);else if(mode==='owned-join')socket.timeout(30000).emit('room:owned-join',{code:accountCode??'',deck,ticket,expectedAccountId},reply);else if(mode==='owned-match')socket.timeout(30000).emit('room:owned-match',{deck,ticket,expectedAccountId},reply);else if(mode==='account-resume')socket.timeout(30000).emit('room:account-resume',{ticket,expectedAccountId},reply);else if(config)socket.timeout(8000).emit('room:bot',{deck,heroClass:config.heroClass,difficulty:config.difficulty,style:config.style,firstPlayer:config.firstPlayer,deckSeed:config.deckSeed,ticket,expectedAccountId:account?.id},reply);else socket.timeout(8000).emit('room:join',{code,deck,ticket},reply);
  };
  const [intentEpoch,setIntentEpoch]=useState(0);
  const send=(action:Action)=>{if(!room?.state||busyRef.current)return;if(workerRef.current){setError('');changeBusy(true);const command:LocalRequest={type:'act',requestId:++localRequestId.current,revision:room.state.revision,action};clearWatchdog();workerWatchdog.current=setTimeout(()=>markWorkerStalled('기기 AI 응답이 지연되고 있습니다.'),12000);try{workerRef.current.postMessage(command);}catch{recoverLocalWorker('기기 AI 행동 요청을 전달하지 못했습니다.');}return;}const socket=socketRef.current;if(!connected||!releaseReady()||!socket?.connected)return;setError('');changeBusy(true);const epoch=connectionEpoch.current;socket.timeout(room.ranked||room.ownedPvp||room.developerTest?30000:8000).emit('room:action',{revision:room.state.revision,action},(err,r)=>{if(epoch!==connectionEpoch.current)return;if(err){setIntentEpoch(n=>n+1);if(socket.connected)sync(socket);else changeBusy(false);return;}if(r.ok){acceptView(r.data);changeBusy(false);return;}if(r.code==='staleRevision'||r.code==='opponentDisconnected'||r.error.includes('오래된 게임 화면')){setIntentEpoch(n=>n+1);sync(socket);return;}changeBusy(false);if(terminalSessionFailure(r.code))clearServerRoom();setError(r.error);});};
  const leave=()=>{if(workerRef.current){if(busyRef.current)return;if(lossOnExit){localCommand('pause');return;}if(saveRetryable){localCommand('pause');return;}if(room?.ranked&&room.status==='playing'&&saveAvailable){localCommand('pause');return;}if(room?.status==='finished'&&saveAvailable){localCommand('pause');return;}if(shouldConfirmUnstoredResultExit(room,saveAvailable)&&!window.confirm('경기 결과가 저장되지 않았습니다. 지금 나가면 결과를 복구하지 못할 수 있습니다. 그래도 나갈까요?'))return;if(room?.status==='playing'&&!window.confirm('이 경기를 포기하고 저장 데이터를 제거할까요? 이어하려면 저장 후 나가기를 선택하세요.'))return;localCommand('discard');return;}const socket=socketRef.current;if(!connected||!releaseReady()||!socket?.connected||busyRef.current)return;if(room?.status==='playing'&&!window.confirm('방을 나가면 항복 처리됩니다. 나가시겠습니까?'))return;changeBusy(true);const epoch=connectionEpoch.current;socket.timeout(room?.ranked||room?.ownedPvp||room?.developerTest?30000:8000).emit('room:leave',(err,r)=>{if(epoch!==connectionEpoch.current)return;changeBusy(false);if(err){setConnected(false);setError('방 나가기 응답이 지연됩니다. 연결 재시도로 상태를 확인하세요.');return;}if(r.ok){
      const ranked=room?.ranked;
      if(room&&ranked?.reward==='saved'&&ranked.rewardDetails)queueRewardReveal(room.code,ranked.rank,ranked.rewardDetails);
      setLobbyView(room?.state?.phase==='finished'?'decks':'play');clearServerRoom();setError('');
    }else{if(terminalSessionFailure(r.code))clearServerRoom();setError(r.error);}});};
  const onDevice=room?.botEngine==='device';
  const pauseAccount=()=>{const socket=socketRef.current;if(!releaseReady()||!socket?.connected||busyRef.current||!room?.ranked)return;changeBusy(true);socket.timeout(30000).emit('room:account-pause',(err,result)=>{changeBusy(false);if(err){setError('저장 응답이 지연됐습니다. 연결 재시도로 확인하세요.');return;}if(result.ok){clearServerRoom();setLobbyView('play');setError('계정 대전을 서버에 저장했습니다. 다른 기기에서도 이어할 수 있습니다.');}else setError(result.error);});};
  const rematch=()=>{
    const worker=workerRef.current;if(!worker||room?.state?.phase!=='finished'||busyRef.current)return;changeBusy(true);setError('');clearWatchdog();workerWatchdog.current=setTimeout(()=>markWorkerStalled('재대전 응답이 지연됩니다.'),12000);try{worker.postMessage({type:'rematch',code:newLocalCode(),seed:random32(),requestId:++localRequestId.current} satisfies LocalRequest);}catch{recoverLocalWorker('재대전 요청을 전달하지 못했습니다.');}
  };
  const slotManagementContent=<>
      {standalone&&<section className="saved-duel-panel slot-panel" aria-label="로컬 저장 슬롯"><div><strong>저장 슬롯 {slot} · {offlineProfile?`XP ${offlineProfile.xp}`:'기록 확인 중'}</strong><p>빈 슬롯에서 새로 시작하세요. 다른 슬롯의 카드·랭크·덱·경기는 보존됩니다.</p></div>{nextFresh!==undefined&&<button type="button" disabled={busy||lobbyView!==(lossOnExit?'slots':'play')} onClick={()=>switchSlot(nextFresh)}>새로 시작 · 슬롯 {nextFresh}</button>}<div className="slot-grid">{SOLO_SLOTS.map(value=>{const preview=slotPreviews[value],selected=value===slot,profile=selected?offlineProfile:preview,match=selected?savedMatch:preview?.save;return <div className={`slot-tile${selected?' selected':''}`} key={value}><button type="button" aria-pressed={selected} aria-describedby={`slot-${value}-state slot-${value}-progress slot-${value}-match`} className={selected?'chosen':'secondary'} disabled={busy||selected||lobbyView!==(lossOnExit?'slots':'play')} onClick={()=>switchSlot(value)}>슬롯 {value}</button><small id={`slot-${value}-state`}>{selected?'현재 선택':freshSlot(value)?'새로 시작 가능':preview===null?'기록 확인 실패':preview===undefined?'기록 확인 중':'저장 기록'}</small><small id={`slot-${value}-progress`}>{profile?`${rankInfo(profile.rank).name} · XP ${profile.xp}`:'—'}</small><small id={`slot-${value}-match`}>{match?match.phase==='finished'?'지난 경기 결과':'이어할 경기 있음':(selected?oldRankedPending:preview?.otherActiveRanked)?'이전 버전 랭크 진행 중':!selected&&preview?.otherSaves?'이전 버전 경기 있음':profile?'진행 중 경기 없음':'—'}</small></div>;})}</div></section>}
      {standalone&&<nav className="lobby-tabs" aria-label="오프라인 게임 모드"><button className={offlineMode==='player'?'chosen':''} aria-pressed={offlineMode==='player'} disabled={busy} onClick={()=>switchOfflineMode('player')}>유저 모드</button><button className={offlineMode==='developer'?'chosen':''} aria-pressed={offlineMode==='developer'} disabled={busy} onClick={()=>switchOfflineMode('developer')}>개발자 모드</button></nav>}
      {standalone&&localGrowth&&(lossOnExit?lobbyView==='slots':lobbyView==='play')&&(offlineMode==='player'?<OfflineGrowthPanel profile={offlineProfile} growth={localGrowth} onSelectRewardPath={chooseOfflineRewardPath} deck={deck} busy={busy} ready={growthReady} rankBlocked={oldRankedPending} onDeck={editDeck} onStart={()=>beginLocal(resolveSolo(soloSettings,random32()),deck,true)}/>:<OfflineDeveloperPanel growth={localGrowth} deck={deck} busy={busy} onStart={(rank,experiment)=>beginLocal(resolveSolo(soloSettings,random32()),deck,false,rank,experiment)}/>)}
<div className="saved-duel-panel" aria-label="저장된 솔로 대전">{savedMatch?<><div><strong>{savedMatch.phase==='finished'?'지난 대전 결과':savedMatch.rank!==undefined?'진행 중인 랭크 대전':savedMatch.testRank!==undefined?(savedMatch.testExperiment?'진행 중인 실험 AI 시험':'진행 중인 개발자 시험'):'진행 중인 솔로 대전'}</strong><p>{className[savedMatch.heroClass]} vs {className[savedMatch.opponent]} · {savedMatch.difficulty}단계 · {savedMatch.turn}턴 · {new Date(savedMatch.savedAt).toLocaleString('ko-KR')}</p>{savedMatchConfidence(saveAvailable)&&<small role="status" className="warn">{savedMatchConfidence(saveAvailable)}</small>}</div>{!lossOnExit&&<button disabled={busy||saveAvailable===undefined} onClick={resumeLocal}>{saveAvailable===false?'이어하기 재시도':savedMatch.phase==='finished'?'결과 보기':'이어하기'}</button>}<button disabled={busy||saveAvailable!==true||savedMatch.rank!==undefined&&savedMatch.phase!=='finished'} className="secondary" onClick={discardSaved}>저장 경기 제거</button></>:<small>{saveAvailable===undefined?'저장 경기 확인 중…':saveAvailable?'기기 AI 대전은 자동으로 저장됩니다.':'경기 저장소에 접근할 수 없습니다.'}</small>}{workerFactory&&saveAvailable!==undefined&&(savedMatch||!saveAvailable||standalone&&oldRankedPending===undefined)&&<button type="button" className="secondary" disabled={busy} onClick={recheckSave}>저장소 다시 확인</button>}</div></>;
  const battleSaveAvailable=room?.developerFree?freeSave?.available:saveAvailable;
  const gameUpdateMenu=standalone&&typeof document!=='undefined'&&document.querySelector('meta[name="card-duel-build"]')&&
    <button type="button" className="game-update-menu" onClick={()=>window.dispatchEvent(new Event('card-duel-update-open'))}>게임 업데이트</button>;
  return <main className={room?'game-main':lossOnExit?'lobby-main preview-lobby':'lobby-main'} data-game-viewport="landscape"><header className="app-header"><div className="brand"><span className="brand-emblem"><Sigil kind="neutral"/></span><div><h1>Card Duel</h1></div></div><div className="connection"><span className={connected||onDevice||standalone?'good':'warn'}>{onDevice?'● 기기 AI 실행 중':standalone?'● 오프라인 솔로':connected?'● 서버 연결됨':'● 연결 대기'}</span>{!standalone&&!onDevice&&!connected&&!busy&&<button className="secondary" onClick={reconnect}>연결 재시도</button>}</div></header><LandscapeExperience menu={landscapeMenu}/>
    <div className="screen-content" id="card-duel-screen" ref={screenScrollRef}>
    {!room&&<div className="lobby-settings-entry"><LobbyDialog label="설정" icon="⚙"><AudioMixer/>{standalone&&<OfflineStatus/>}<small>Card Duel v{project.version}</small></LobbyDialog></div>}
    {toast&&!error&&!room&&<ToastNotice key={toast.text} kind={toast.kind}>{toast.text}</ToastNotice>}
    {(error||workerStalled)&&<div className="error game-error-toast" role="alert">{error||'기기 AI 작업 응답을 기다리는 중입니다.'}{workerStalled?<><small>응답을 기다리거나 마지막으로 저장된 상태를 복구할 수 있습니다.</small><button type="button" className="secondary" onClick={recoverStalledWorker}>마지막 저장으로 복구</button></>:<button className="secondary" onClick={()=>setError('')}>닫기</button>}</div>}
    {updatePending&&<div className="account-maintenance" role="status">서버에 새 게임 버전이 준비되었습니다. 지금 기기 AI 대전은 유지되며 로비로 돌아가면 최신 버전이 적용됩니다. 카드 설정이 달라진 경우 이전 저장 경기의 이어하기는 제한될 수 있으니 현재 경기를 마치는 것을 권장합니다.</div>}
    {updateBlocked&&!updatePending&&<div className="account-maintenance" role="alert">최신 서버와 화면 버전이 일치하지 않습니다. 반복 새로고침을 막기 위해 자동 갱신을 중단했습니다. 계정 대전은 최신 화면으로 갱신한 뒤 이용하세요. <button type="button" className="secondary" disabled={!!workerRef.current} onClick={()=>window.location.reload()}>최신 화면 다시 불러오기</button></div>}
    {!room&&(rewardPopup.length>0||promotion)&&<RewardReveal cards={rewardPopup} rank={promotion} onClose={()=>{setRewardPopup([]);setPromotion(undefined);}}/>}
    {room?<Battle compactUi={lossOnExit} key={room.code} room={room} send={send} leave={leave} intentEpoch={intentEpoch} connected={connected||onDevice} busy={busy} onRematch={onDevice&&!updatePending&&!room.ranked&&!saveRetryable?rematch:undefined} onPause={onDevice&&(battleSaveAvailable||saveRetryable)?()=>{if(updatePending&&room.status==='playing'&&releaseRef.current.catalog!==catalogHash&&!window.confirm('새 카드 버전에서는 이 저장 경기를 복원하지 못할 수 있습니다. 그래도 저장하고 업데이트할까요?'))return;localCommand('pause');}:room.ranked&&!onDevice?pauseAccount:undefined} onRetrySave={onDevice&&saveRetryable?()=>localCommand('retrySave'):undefined} saveRetryable={onDevice&&saveRetryable} savePending={onDevice&&busy} autoSaved={onDevice?!!battleSaveAvailable:room.ranked||room.ownedPvp||room.developerTest?true:undefined}/>:<>
      {lobbyView==='home'?lossOnExit?<nav ref={setLandscapeMenu} className="lobby-tabs lobby-home" aria-label="게임 메뉴">
    <button type="button" data-lobby-tab="play" onClick={()=>{setPreviewPickerHero(null);setPreviewPickerName(undefined);openLobbyView(practiceLobby,true);}}><Sigil kind="warrior"/>대전</button>
    <button type="button" data-lobby-tab="decks" onClick={()=>{setPreviewEditHero(null);setPreviewPickerHero(null);setPreviewPickerName(undefined);openLobbyView('decks',true);}}><Sigil kind="deck"/>덱 목록</button>
    <button type="button" data-lobby-tab="catalog" onClick={()=>openLobbyView('catalog',true)}><Sigil kind="deck"/>카드 도감</button>
    <button type="button" data-lobby-tab="slots" onClick={()=>openLobbyView('slots',true)}><Sigil kind="neutral"/>슬롯 선택</button>
    <button type="button" data-lobby-tab="rank" onClick={()=>openLobbyView('rank',true)}>🏆 등급</button>
    <button type="button" data-lobby-tab="quests" onClick={()=>openLobbyView('quests',true)}>📜 퀘스트</button>
    <button type="button" data-lobby-tab="rewards" onClick={()=>openLobbyView('rewards',true)}>🎁 경험치 · 카드 획득</button>
    <button type="button" data-lobby-tab="developer" onClick={()=>openLobbyView('developer',true)}>⚙ 개발자 모드</button>
    {gameUpdateMenu}
  </nav>:<nav ref={setLandscapeMenu} className="lobby-tabs lobby-home" aria-label="게임 메뉴"><button type="button" data-lobby-tab="play" onClick={()=>openLobbyView('play',true)}><Sigil kind="warrior"/>대전</button><button type="button" data-lobby-tab="decks" onClick={()=>openLobbyView('decks',true)}><Sigil kind="deck"/>덱 목록</button><button type="button" data-lobby-tab="catalog" onClick={()=>openLobbyView('catalog',true)}><Sigil kind="deck"/>카드 도감</button>{gameUpdateMenu}</nav>:<nav className="lobby-page-nav floating-home" aria-label="현재 화면"><button type="button" className="secondary" data-lobby-tab={lobbyView} onClick={()=>{setLobbyView('home');requestAnimationFrame(()=>screenScrollRef.current?.querySelector<HTMLButtonElement>(`[data-lobby-tab="${lobbyView}"]`)?.focus());}} aria-label="메인으로">{lossOnExit?'⌂':'메인으로'}</button>{!lossOnExit&&<strong>{lobbyView==='play'?'대전':lobbyView==='decks'?'덱 목록':lobbyView==='slots'?'슬롯 · 성장 · 기록':'카드 도감'}</strong>}</nav>}
      <div className="lobby-account" hidden={lobbyView!=='play'}>{!standalone&&!updateBlocked&&<LobbyDialog label="계정"><AccountPanel deck={deck} onLoad={editDeck} onAuthChange={reconnect} connected={connected&&!busy} maintenance={maintenance} syncEpoch={accountSync} growthEpoch={growthSync} roomEpoch={roomSync} onPlay={begin} onAccount={setAccount}/></LobbyDialog>}</div>
      {lossOnExit&&(lobbyView==='play'||lobbyView==='decks'&&!previewEditHero)?(
        lobbyView==='play'&&savedMatch&&savedMatch.phase!=='finished'?
          <SavedMatchGate savedMatch={savedMatch} saveAvailable={saveAvailable} busy={busy} onResume={resumeLocal} onForfeitSaved={forfeitSaved}/>:
        previewPickerHero?<ClassDeckPicker key={previewPickerHero} hero={previewPickerHero} initialName={previewPickerName}
          storage={offlineMode==='developer'?developerDeckStorage:storage} profile={offlineProfile} requireOwned={offlineMode==='player'}
          ready={growthReady} blocked={oldRankedPending} busy={busy}
          onChangeHero={()=>{setPreviewPickerHero(null);setPreviewPickerName(undefined);}}
          onStart={current=>{
            if(offlineMode==='developer'){editDeck(current);openLobbyView('developer',true);return;}
            if(savedMatch&&savedMatch.phase!=='finished'){openLobbyView('play',true);return;}
            editDeck(current);beginLocal(resolveSolo(soloSettings,random32()),current,true);
          }}
          onBuild={hero=>{editDeck({heroClass:hero,cards:[]});setPreviewEditName('');setPreviewPickerName(undefined);setPreviewEditHero(hero);openLobbyView('decks',true);}}
          onEdit={entry=>{const valid=compatibleDeckEntry(entry);if(!valid)return;editDeck(structuredClone(valid.deck));setPreviewEditName(valid.name);setPreviewPickerName(entry.name);setPreviewEditHero(valid.deck.heroClass);openLobbyView('decks',true);}}/>:
        <HeroChoice onChoose={setPreviewPickerHero}/>)
      :lobbyView==='play'?<div className="play-hub"><div className="play-support">
      {savedMatch&&!lossOnExit&&<button disabled={busy||saveAvailable===undefined} onClick={resumeLocal}>{savedMatch.phase==='finished'?'결과 보기':'이어하기'}</button>}
      {!lossOnExit&&<LobbyDialog label="슬롯 · 성장 · 저장 경기">{slotManagementContent}</LobbyDialog>}</div><PlayLobby deck={deck} onClass={c=>{if(c!==deck.heroClass)editDeck(account?.role==='developer'||standalone&&offlineMode==='developer'?practiceDeck(catalog,c):basicDeck(catalog,c));}} botClass={botClass} setBotClass={setBotClass} difficulty={difficulty} setDifficulty={setDifficulty} code={code} setCode={setCode} onBegin={begin} onEdit={()=>openLobbyView('decks',true)} connected={connected} busy={busy} botEngine={botEngine} setBotEngine={setBotEngine} deviceMode={deviceMode} setDeviceMode={setDeviceMode} standalone={standalone} botStyle={botStyle} setBotStyle={setBotStyle} first={first} setFirst={setFirst} animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed} showPractice={!standalone||offlineMode==='developer'} openBotDecks={account?.role==='developer'||standalone&&offlineMode==='developer'}/></div>:lobbyView==='slots'&&lossOnExit?<section className="preview-slot-only" aria-label="슬롯 선택"><div className="preview-slot-grid">{SOLO_SLOTS.map(value=><button type="button" key={value} className={value===slot?'chosen':'secondary'} disabled={busy||value===slot} onClick={()=>switchSlot(value)}>슬롯 {value}{value===slot?' · 선택됨':''}</button>)}</div></section>
    :lobbyView==='rank'&&lossOnExit?<PreviewRank profile={offlineProfile} growth={localGrowth}/>
    :lobbyView==='quests'&&lossOnExit?<PreviewQuestPlaceholder/>
    :lobbyView==='rewards'&&lossOnExit?<PreviewRewards profile={offlineProfile} growth={localGrowth}
      busy={busy||!growthReady} onSelect={chooseOfflineRewardPath} onCatalog={id=>openLobbyView('catalog',true,id)}/>
    :lobbyView==='developer'&&lossOnExit?<PreviewDeveloper mode={offlineMode} onMode={switchOfflineMode}><button type="button" className="secondary" onClick={()=>openLobbyView('catalog',true)}>카드 도감</button><DeveloperFreePlay selection={freeSelection} onSelection={setFreeSelection} saved={readDecks(developerDeckStorage)} draft={deck} catalog={catalog} onEdit={hero=>{setPreviewEditName('');if(deck.heroClass!==hero)editDeck({heroClass:hero,cards:[]});setPreviewEditHero(hero);openLobbyView('decks',true);}} busy={busy} ready={freeSave?.available} onStart={beginDeveloperFree} onResume={freeSave?.save&&freeSave.save.phase!=='finished'?resumeDeveloperFree:undefined}/>{localGrowth&&<OfflineDeveloperPanel growth={localGrowth} deck={deck} busy={busy} onBuild={()=>{setPreviewEditHero(null);setPreviewPickerHero(null);setPreviewPickerName(undefined);openLobbyView('decks',true);}} onStart={(rank,experiment)=>beginLocal(resolveSolo(soloSettings,random32()),deck,false,rank,experiment)}/>}</PreviewDeveloper>
    :lobbyView==='catalog'?<CardBrowser key={catalogFocus??'catalog'} focusCardId={catalogFocus} developer={standalone&&offlineMode==='developer'} unreadIds={lossOnExit&&offlineMode==='player'?unreadCards:[]} onViewed={lossOnExit&&offlineMode==='player'?onViewNewCard:undefined} ownedCards={lossOnExit&&offlineMode==='player'?(offlineProfile?.ownedCards??[]):undefined}/>:lobbyView==='decks'?(lossOnExit?<section className="deck-workspace preview-workspace">
      <div data-deck-screen="build">
        <button className="secondary preview-deck-back" type="button" onClick={()=>{setPreviewPickerHero(deck.heroClass);setPreviewEditHero(null);}}>← 덱 목록</button>
        <DeckEditor workspaceMode initialName={previewEditName} strategicPresets={offlineMode==='developer'} storage={offlineMode==='developer'?developerDeckStorage:storage}
          deck={deck} setDeck={editDeck} undo={undo} undoAvailable={undoDecks.length>0} draftStored={draftStored}
          ownedCards={offlineMode==='player'?(offlineProfile?.ownedCards??[]):undefined} forceOwned={offlineMode==='player'}/>
      </div></section>:<DeckWorkspace developer={standalone?offlineMode==='developer':account?.role==='developer'}
        storage={standalone&&offlineMode==='developer'?developerDeckStorage:storage} onPlay={current=>{editDeck(current);openLobbyView(practiceLobby,true);}}
        deck={deck} setDeck={editDeck} undo={undo} undoAvailable={undoDecks.length>0} draftStored={draftStored}
        ownedCards={standalone?(offlineMode==='player'?(offlineProfile?.ownedCards??[]):undefined):account?.profile.ownedCards} forceOwned={standalone&&offlineMode==='player'}/>):null}
    </>}
    </div>
    <footer>독자 카드 {Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false).length}종 · 9개 직업 · 개발 중인 테스트 버전<small className="reference-notice">자체 제작 일러스트 · 인터넷 이미지 요청 없음</small></footer>
  </main>;
}
