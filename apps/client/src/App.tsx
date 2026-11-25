import {ToastNotice} from './ToastNotice.tsx';
import {OfflineStatus} from './OfflineStatus.tsx';
import {AudioMixer} from './AudioMixer.tsx';
import {LobbyDialog} from './lobby-dialog.tsx';
import { deckManaCurveLabel } from './deck-curve-label.ts';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import {SlotGateway} from './SlotGateway.tsx';
import {SlotDeckLaunch} from './SlotDeckLaunch.tsx';
import {PreviewPlay} from './PreviewPlay.tsx';
import {PreviewRank,PreviewRewards,RewardReveal,PreviewQuestPlaceholder,PreviewDeveloper} from './PreviewProgress.tsx';
import {syncNewCards,markCardViewed} from './new-card-flags.ts';
import {LandscapeExperience} from './LandscapeExperience.tsx';
import { ClassicNamesContext, displayCardName, cardSearchTerms, matchesCardSearch } from './card-names.ts';
import { LocalCardArt, LocalHeroArt } from './local-art.tsx';
import { BookTabs,bookClasses,ManaFilter,CollectionBook,useBookSize, CollectionDetailDialog, showCollectionDetail } from './collection-book.tsx';
import { groupedCollection, collectionPage } from './table-visuals.ts';
import { cardSet, cardSetLabel, matchesCardSet, sortCardsForDisplay, deckAddReason } from './card-sets.ts';
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
import {OfflineGrowthPanel,OfflineDeveloperPanel} from './OfflineGrowthPanel.tsx';
import {backupDeckLibrary,restoreDeckLibrary,readDecks,saveNamedDeck,deleteNamedDeck,withDeckLibraryLock,deckLibraryAfterWriteFailure,checkedDeckLibrary} from './named-decks.ts';
import {watchDeckLibraryChanges} from './deck-library-sync.ts';
import type {NamedDeck} from './named-decks.ts';
import {SOLO_SLOTS,readSelectedSlot,rememberSlot,soloSlotStorage,hasSlotLocalData,slotPreviewRefreshAction,currentSoloNamespace} from './solo-slots.ts';
import {rankInfo} from '../../../packages/progression.ts';
import type {SoloSlot,SlotStorage} from './solo-slots.ts';
import {downloadBackup,androidBackupAvailable,MAX_BACKUP_BYTES} from './backup-io.ts';
import {createSlotBackup,isSlotBackup,growthBackupPart,deckBackupPart,prepareSlotRestore} from './slot-backup.ts';
import {BackupFilePicker} from './BackupFilePicker.tsx';
import project from '../../../package.json';

const sessionKey='card-duel-session-v03';
const random32=()=>typeof globalThis.crypto!=='undefined'?crypto.getRandomValues(new Uint32Array(1))[0]:(Math.random()*4294967296)>>>0;
function readSession():Session|null{try{const s:unknown=JSON.parse(sessionStorage.getItem(sessionKey)??'null');if(!s||typeof s!=='object')return null;const v=s as Session;return typeof v.code==='string'&&/^[A-Z2-9]{6}$/.test(v.code)&&typeof v.token==='string'&&/^[0-9a-f]{64}$/.test(v.token)&&(v.seat===0||v.seat===1)?v:null;}catch{return null;}}
type DeckEditorProps={deck:Deck;setDeck:(deck:Deck)=>void;undo?:()=>void;undoAvailable?:boolean;draftStored?:boolean;initialSet?:CardSetFilter;workspaceMode?:boolean;initialName?:string;ownedCards?:readonly string[];forceOwned?:boolean;storage?:SlotStorage};
/** Keep the displayed named-deck list fresh when another tab updates the
 * same slot, while leaving local unsaved edits and stored bytes untouched. */
function useDeckLibraryAutoRefresh(storage:SlotStorage,saved:NamedDeck[],setSaved:(value:NamedDeck[])=>void,canRefresh:()=>boolean,onChanged:()=>void,onError:(message:string)=>void,onRecovered:(previousError:string)=>void,refreshWhenReady:boolean){
  const latestRef=useRef(saved);latestRef.current=saved;
  const callbacks=useRef({canRefresh,onChanged,onError,onRecovered});callbacks.current={canRefresh,onChanged,onError,onRecovered};
  useEffect(()=>watchDeckLibraryChanges({store:storage,current:()=>latestRef.current,canRefresh:()=>callbacks.current.canRefresh(),onChange:next=>{latestRef.current=next;setSaved(next);callbacks.current.onChanged();},onError:message=>callbacks.current.onError(message),onRecovered:message=>callbacks.current.onRecovered(message)}),[storage,setSaved,refreshWhenReady]);
}
export function DeckEditor(props:DeckEditorProps){
  return <HoverPreviewProvider resetKey={props.deck.heroClass}><DeckEditorView {...props}/></HoverPreviewProvider>;
}
function DeckEditorView({deck,setDeck,undo,undoAvailable=false,draftStored=true,initialSet='all',workspaceMode=false,initialName='',ownedCards,forceOwned=false,storage:providedStorage}:DeckEditorProps){
  const classicNames=useContext(ClassicNamesContext);
  const storage=useMemo(()=>providedStorage??soloSlotStorage(1),[providedStorage]);
  const [inspected,setInspected]=useState<Inspectable|null>(null);
  const [editNotice,setEditNotice]=useState<{key:string;message:string;warning:boolean;cardId?:string}|null>(null);
  const deckKey=(value:Deck)=>JSON.stringify([value.heroClass,value.cards]);
  const notice=editNotice?.key===deckKey(deck)?editNotice:null;
  const showNotice=(message:string,value:Deck,warning=false,cardId?:string)=>setEditNotice({message,key:deckKey(value),warning,cardId});
  useEffect(()=>{if(!editNotice)return;const timer=setTimeout(()=>setEditNotice(null),2600);return()=>clearTimeout(timer);},[editNotice]);
  const detailDialog=useRef<HTMLDialogElement>(null),detailSidebar=useRef<HTMLElement>(null);
  const openDetail=(card:Card)=>{setInspected({card});showCollectionDetail(detailDialog.current,detailSidebar.current);};
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
  const availableRarities=useMemo(()=>new Set(setCards.map(c=>c.rarity)),[setCards]);
  const query=search.trim().toLocaleLowerCase(),terms=useMemo(()=>cardSearchTerms(query),[query]);
  const shown=useMemo(()=>setCards.filter(c=>(kind==='all'||c.kind===kind)&&(filterRarity==='all'||c.rarity===filterRarity)&&(filterCost==='all'||(filterCost==='10plus'?c.cost>=10:c.cost===Number(filterCost)))&&matchesCardSearch(c,terms)),[setCards,kind,filterRarity,filterCost,deck.heroClass,terms]);const curve=manaCurve(catalog,deck);const curveMax=Math.max(1,...curve);
  const activeTab=deckTab==='neutral'?'neutral':deck.heroClass;
  const browseCards=shown.filter(card=>card.class===activeTab);
  const deckRows=legal.filter(card=>counts.has(card.id));
  const kindCounts={minion:0,spell:0,weapon:0,secret:0};for(const id of deck.cards){const c=catalog[id];if(c&&c.kind!=='coin')kindCounts[c.kind]++;}
  const averageCost=deck.cards.length?(curve.reduce((sum,n,i)=>sum+n*i,0)/deck.cards.length).toFixed(1):'0.0';
  const add=(id:string)=>{const card=catalog[id],reason=deckAddReason(card,deck.cards.length,counts.get(id)??0);if(reason){showNotice(`${displayCardName(card,classicNames)} 추가 불가 · ${reason}`,deck,true);return;}const next={...deck,cards:[...deck.cards,id]};setDeck(next);showNotice(`${displayCardName(card,classicNames)} 1장 추가 · ${next.cards.length}/30장`,next,false,id);};
  const remove=(id:string)=>{const copy=[...deck.cards];const index=copy.indexOf(id);if(index>=0){copy.splice(index,1);const next={...deck,cards:copy};setDeck(next);showNotice(`${displayCardName(catalog[id],classicNames)} 1장 제거 · ${next.cards.length}/30장`,next,false,id);}};
  const fill=()=>{try{setDeck(completePracticeDeck(deckCatalog,deck));setStorageMessage(`부족한 ${30-deck.cards.length}장을 추천 카드로 채웠습니다.`);}catch(e){setStorageMessage((e as Error).message);}};
  const recommend=()=>{try{setDeck(strategicDeck(deckCatalog,deck.heroClass,recommendStyle,random32()));}catch(e){setStorageMessage((e as Error).message);}};
  return <section className="panel deck-panel deck-builder">
    <div className="deck-editor-controls">
    <strong>{className[deck.heroClass]} · {deck.cards.length}/30장</strong>
    <LobbyDialog label="덱 관리">
    {owned&&<div className="controls">{forceOwned?<strong>유저 모드 · 보유 카드만 사용</strong>:<label><input type="checkbox" checked={ownedOnly} onChange={e=>setOwnedOnly(e.target.checked)}/> 보유 카드만 보기·추천하기</label>}<small>{restricted?'랭크/계정 대전용 덱':'전체 카드 연습 모드'}</small>{deck.cards.some(id=>!owned.has(id))&&<button className="secondary" onClick={()=>setDeck({...deck,cards:deck.cards.filter(id=>owned.has(id))})}>미보유 카드 제거</button>}</div>}
    <div className="controls">{workspaceMode?<strong>직업 · {className[deck.heroClass]}</strong>:<label>직업<select value={deck.heroClass} onChange={e=>setDeck(practiceDeck(catalog,e.target.value as HeroClass))}>{HERO_CLASSES.map(c=><option key={c} value={c}>{className[c]}</option>)}</select></label>}<label>추천 덱 유형<select value={recommendStyle} onChange={e=>setRecommendStyle(e.target.value as DeckStyle)}>{DECK_STYLES.map(s=><option key={s} value={s}>{DECK_STYLE_LABELS[s]}</option>)}</select></label><button onClick={recommend} title="선택 전략의 30장 추천 덱으로 교체">추천 덱</button><button className="secondary" disabled={deck.cards.length===30} onClick={fill} title="현재 카드를 그대로 유지하고 빈칸만 채웁니다">빈칸 자동 채우기</button><button className="secondary" onClick={()=>setDeck({...deck,cards:[]})}>비우기</button><button className="secondary" disabled={!undoAvailable} onClick={undo}>되돌리기</button><small>{draftStored?'편집 중인 덱 자동 저장':'임시 덱 저장 공간을 사용할 수 없습니다.'}</small></div>
    <div className="power-note">영웅 능력 · {HERO_POWERS[deck.heroClass].name} (2마나) <span>{heroPowerDescription[deck.heroClass]}</span></div>
    <details className="deck-share"><summary>친구와 덱 공유하기</summary><p>공유 코드를 생성해 복사하거나 친구의 코드를 붙여넣어 불러오세요. 완성된 30장 덱만 공유할 수 있습니다.</p><textarea ref={shareRef} aria-label="덱 공유 코드" value={shareCode} onChange={e=>setShareCode(e.target.value)} placeholder="덱 공유 코드를 붙여넣으세요" maxLength={8192}/><div className="controls"><button disabled={deck.cards.length!==30} onClick={()=>{try{setShareCode(exportDeckCode(catalog,deck));setStorageMessage('덱 공유 코드 생성 완료');}catch(e){setStorageMessage((e as Error).message);}}}>공유 코드 만들기</button><button className="secondary" disabled={!shareCode.trim()} onClick={copyShare}>복사</button><button className="secondary" disabled={!shareCode.trim()} onClick={()=>{try{const next=importDeckCode(catalog,shareCode);setDeck(next);setStorageMessage('공유 덱 불러오기 완료');}catch(e){setStorageMessage((e as Error).message);}}}>공유 코드 불러오기</button></div></details>
    </LobbyDialog>

    {notice&&<ToastNotice key={notice.message} kind={notice.warning?'error':'success'}>{notice.message}</ToastNotice>}
    </div>
    <div className="deck-layout"><div className="book-pane"><div className="book-shortcuts">
    <LobbyDialog label="카드 필터"><div className="card-set-tabs" role="group" aria-label="카드 세트">{([["all","전체"],["basic","기본 카드"],["original","클래식 카드"]] as const).map(([key,label])=><button type="button" key={key} data-set-filter={key} aria-pressed={filterSet===key} onClick={()=>{setFilterSet(key);setFilterRarity('all');}}>{label}<small>{legal.filter(c=>matchesCardSet(c,key)).length}</small></button>)}</div><div className="controls"><input type="search" aria-label="카드 이름 또는 효과 검색" title="이름 · 효과 · 종족 · 능력 (여러 검색어 가능)" placeholder="카드 이름 또는 효과 검색" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="카드 종류" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">전체 종류</option><option value="minion">하수인</option><option value="spell">주문</option><option value="weapon">무기</option><option value="secret">비밀</option></select><select aria-label="카드 등급" value={filterRarity} onChange={e=>setFilterRarity(e.target.value)}><option value="all">전체 등급</option>{availableRarities.has('basic')&&<option value="basic">기본</option>}{availableRarities.has('common')&&<option value="common">일반</option>}{availableRarities.has('rare')&&<option value="rare">희귀</option>}{availableRarities.has('epic')&&<option value="epic">영웅</option>}{availableRarities.has('legendary')&&<option value="legendary">전설</option>}</select><ManaFilter value={filterCost} onChange={setFilterCost}/><button className="secondary" onClick={()=>{setSearch('');setKind('all');setFilterRarity('all');setFilterCost('all');setFilterSet('all');}}>필터 초기화</button><small>{shown.length}/{legal.length}종</small></div></LobbyDialog></div><div className="book-with-tabs"><BookTabs classes={[deck.heroClass,'neutral']} active={activeTab} onClass={setDeckTab}/><CollectionBook cards={browseCards} continuous renderCard={c=><div key={c.id} className="collection-item"><BattleCard card={c} enabled={!deckAddReason(c,deck.cards.length,counts.get(c.id)??0)} reason={deckAddReason(c,deck.cards.length,counts.get(c.id)??0)} actionLabel="덱에 추가" onBlocked={()=>add(c.id)} onInspect={setInspected} onClick={()=>add(c.id)}/><small className="collection-set-label"><span className={`set-${cardSet(c)}`}>{cardSetLabel(c)}</span> · {counts.get(c.id)??0}/{maxCardCopies(c)}</small><button type="button" className="secondary deck-card-detail-trigger" aria-label={`${displayCardName(c,classicNames)} 상세 보기`} onClick={()=>openDetail(c)}>상세 보기</button></div>}/></div></div>
    <aside ref={detailSidebar} className="deck-sidebar"><div className="deck-list"><h3>내 덱 <span className="deck-live-count">{deck.cards.length}/30</span></h3><div className="deck-stats"><strong>평균 마나 {averageCost}</strong><span>하수인 {kindCounts.minion} · 주문 {kindCounts.spell}</span><span>무기 {kindCounts.weapon} · 비밀 {kindCounts.secret}</span></div><div className="mana-curve" role="img" aria-label={deckManaCurveLabel(curve)}>{curve.map((n,i)=><div key={i} data-recent={notice?.cardId&&Math.min(10,catalog[notice.cardId].cost)===i||undefined} aria-hidden="true" title={`${i===10?'10+':i}마나 ${n}장`}><small>{n||''}</small><span style={{height:`${Math.max(2,n/curveMax*48)}px`}}/><small>{i===10?'10+':i}</small></div>)}</div><div className="deck-list-scroll">{deckRows.map(c=><div className="deck-entry" data-recent={notice?.cardId===c.id||undefined} key={c.id}><button type="button" className="deck-inspect-row" aria-label={`${displayCardName(c,classicNames)} 상세 보기 · ${counts.get(c.id)}장`} onClick={()=>openDetail(c)}><span className="local-deck-tile"><LocalCardArt card={c}/></span><span className="cost small">{c.cost}</span><span>{displayCardName(c,classicNames)}</span><b>×{counts.get(c.id)}</b></button><button type="button" className="deck-remove" aria-label={`${displayCardName(c,classicNames)} 한 장 제거`} title="한 장 제거" onClick={()=>remove(c.id)}>−</button></div>)}{!deck.cards.length&&<p>카드를 눌러 추가하세요.</p>}</div><div className="controls saved-decks"><input placeholder="저장할 덱 이름" value={deckName} maxLength={40} onChange={e=>setDeckName(e.target.value)}/><button disabled={mutating||deck.cards.length!==30} onClick={save}>덱 저장</button>{!workspaceMode&&<><select value={savedIndex} onChange={e=>setSavedIndex(e.target.value)}><option value="">저장된 덱 ({saved.length})</option>{saved.map((d,i)=><option key={d.name} value={i}>{d.name} · {className[d.deck.heroClass]}</option>)}</select><button className="secondary" disabled={!savedIndex} onClick={load}>불러오기</button><button className="secondary" disabled={mutating||!savedIndex} onClick={removeSaved}>삭제</button></>}{storageMessage&&<small role="status">{storageMessage}</small>}</div></div></aside></div><CollectionDetailDialog dialogRef={detailDialog} item={inspected} catalog={catalog}/>
  </section>;
}
export type DeckScreen='classes'|'saved'|'cards'|'build';
const deckScreens=[['classes','직업 리스트'],['saved','덱 리스트'],['cards','카드 보기'],['build','덱 만들기']] as const;

function PageControls({page,pages,onPage}:{page:number;pages:number;onPage:(page:number)=>void}){
  return <div className="book-shortcuts">
    <button type="button" className="secondary" aria-label="이전 목록" disabled={!page} onClick={()=>onPage(page-1)}>◀</button>
    <span role="status">{page+1}/{pages}</span>
    <button type="button" className="secondary" aria-label="다음 목록" disabled={page+1>=pages} onClick={()=>onPage(page+1)}>▶</button>
  </div>;
}

function CardBrowser({initialClass='all',focusCardId,unreadIds=[],onViewed,ownedCards}:{focusCardId?:string;initialClass?:HeroClass|'all'|'neutral';unreadIds?:readonly string[];onViewed?:(id:string)=>void;ownedCards?:readonly string[]}){
  const classic=useContext(ClassicNamesContext),[scope,setScope]=useState(initialClass),[set,setSet]=useState<CardSetFilter>('all'),[query,setQuery]=useState(''),[rarity,setRarity]=useState('all'),[kind,setKind]=useState('all'),[cost,setCost]=useState('all'),[newOnly,setNewOnly]=useState(false),[page,setPage]=useState(0),[inspected,setInspected]=useState<Inspectable|null>(null);
  const detailDialog=useRef<HTMLDialogElement>(null);
  const openDetail=(card:Card)=>{
    setInspected({card});
    onViewed?.(card.id);
    showCollectionDetail(detailDialog.current,null);
  };
  const all=useMemo(()=>{const owned=ownedCards?new Set(ownedCards):null;return sortCardsForDisplay(Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false&&(!owned||owned.has(c.id))),classic).sort((a,b)=>Number(unreadIds.includes(b.id))-Number(unreadIds.includes(a.id)));},[classic,ownedCards,unreadIds]);
  const [tribe,setTribe]=useState('all');
  const tribes=[...new Set(all.flatMap(c=>c.kind==='minion'&&c.tribe!=='none'?[c.tribe]:[]))];
  const shown=useMemo(()=>{const terms=cardSearchTerms(query);return all.filter(c=>c.kind!=='coin'&&matchesCardSet(c,set)&&(rarity==='all'||c.rarity===rarity)&&(kind==='all'||c.kind===kind)&&(tribe==='all'||c.kind==='minion'&&c.tribe===tribe)&&(cost==='all'||(cost==='10plus'?c.cost>=10:c.cost===Number(cost)))&&(!newOnly||unreadIds.includes(c.id))&&matchesCardSearch(c,terms));},[all,set,rarity,kind,tribe,cost,query,newOnly,unreadIds]);
  const size=useBookSize();
  const groups=bookClasses.map(key=>({key,items:shown.filter(card=>card.kind!=='coin'&&card.class===key)}));
  const spread=groupedCollection(groups,0,size);
  const first=scope==='all'?0:spread.spreads.findIndex(item=>item.key===scope);
  const result=groupedCollection(groups,Math.max(0,first)+page,size);
  const active=scope==='all'?(result.current?.key??'warrior'):scope;
  const focused=useRef<string|undefined>(undefined);
  useEffect(()=>{if(!focusCardId||focused.current===focusCardId)return;const target=spread.spreads.findIndex(p=>p.items.some(c=>c.id===focusCardId));if(target<0)return;focused.current=focusCardId;setScope('all');setPage(target);},[focusCardId,spread]);
  const changeClass=(key:HeroClass|'neutral')=>{
    setScope(key);
    setPage(0);
  };
  const filtersMounted=useRef(false);
  useEffect(()=>{if(!filtersMounted.current){filtersMounted.current=true;return;}setPage(0);setInspected(null);},[set,query,rarity,kind,tribe,cost,newOnly]);
  return <HoverPreviewProvider resetKey={`${scope}:${set}:${page}`}><section className="panel deck-panel card-browser integrated-browser" data-deck-screen="cards">
    <div className="deck-layout"><div className="book-pane book-with-tabs"><BookTabs active={active} onClass={changeClass}/><CollectionBook cards={result.current?.key===active?result.current.items:[]} size={size} paging={{...result,label:result.current?.key===active?`${active==='neutral'?'공용':className[active as HeroClass]} ${result.current.index+1}/${result.current.pages}장`:'검색 결과 없음',onPage:next=>{setPage(next);setScope('all');}}} renderCard={c=><div className={`collection-item${unreadIds.includes(c.id)?' card-new-unread':''}${focusCardId===c.id?' reward-card-focus':''}`} key={c.id}><BattleCard card={c} enabled onInspect={setInspected} onClick={()=>openDetail(c)}/>{unreadIds.includes(c.id)&&<span className="new-card-badge">NEW</span>}<small className="collection-set-label">{cardSetLabel(c)} · ×{maxCardCopies(c)}</small></div>}/></div>
    <aside className="deck-sidebar card-browser-controls"><details className="catalog-filters" open><summary>카드 필터</summary>
    <div className="preview-card-filters">
    <div className="card-set-tabs" role="group" aria-label="카드 세트">{([['all','전체'],['basic','기본 카드'],['original','클래식 카드']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={set===key} onClick={()=>{setSet(key);setRarity('all');}}>{label}<small>{all.filter(c=>matchesCardSet(c,key)).length}</small></button>)}</div>
    <div className="controls"><input type="search" aria-label="카드 이름 또는 효과 검색" title="이름 · 효과 · 종족 · 능력 (여러 검색어 가능)" value={query} onChange={e=>setQuery(e.target.value)} placeholder="카드 이름 또는 효과 검색"/><select aria-label="카드 종류" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">전체 종류</option><option value="minion">하수인</option><option value="spell">주문</option><option value="weapon">무기</option><option value="secret">비밀</option></select><div className="rarity-filters" role="group" aria-label="카드 등급">{Object.entries({all:'전체',basic:'기본',common:'일반',rare:'희귀',epic:'영웅',legendary:'전설'}).map(([key,label])=><button type="button" key={key} className={`rarity-${key}`} aria-pressed={rarity===key} onClick={()=>setRarity(key)}>{key!=='all'&&<span className="rarity-gem" aria-hidden="true"/>}{label}</button>)}</div><ManaFilter value={cost} onChange={setCost}/><select aria-label="종족" value={tribe} onChange={e=>setTribe(e.target.value)}><option value="all">전체 종족</option>{tribes.map(key=><option key={key} value={key}>{tribeNames[key]}</option>)}</select><label className="new-only-filter"><input type="checkbox" checked={newOnly} onChange={e=>setNewOnly(e.target.checked)}/> NEW 카드만 보기 ({unreadIds.length})</label><button className="secondary" onClick={()=>{setScope('all');setSet('all');setQuery('');setRarity('all');setKind('all');setCost('all');setTribe('all');setNewOnly(false);}}>필터 초기화</button></div>
    </div>
    <small>검색 결과 {shown.length}종 · 수집 {all.length}종</small>
    </details></aside></div><CollectionDetailDialog dialogRef={detailDialog} item={inspected} catalog={catalog}/></section></HoverPreviewProvider>;
}

export function DeckWorkspace({initialScreen='classes',onPlay,previewSimple=false,initialClass,...props}:DeckEditorProps&{initialScreen?:DeckScreen;onPlay?:()=>void;previewSimple?:boolean;initialClass?:HeroClass}){
  const storage=useMemo(()=>props.storage??soloSlotStorage(1),[props.storage]);
  const [screen,setScreen]=useState<DeckScreen>(initialScreen),[selected,setSelected]=useState(initialClass??props.deck.heroClass),[browseClass,setBrowseClass]=useState<HeroClass|'all'>('all'),[editName,setEditName]=useState(''),[saved,setSaved]=useState<NamedDeck[]>(()=>readDecks(storage)),[message,setMessage]=useState(()=>initialScreen==='saved'?checkedDeckLibrary([],storage).warning??'':'');
  const classic=useContext(ClassicNamesContext);
  const navigate=(next:DeckScreen)=>{setScreen(next);if(next==='saved'){const checked=checkedDeckLibrary(saved,storage);setSaved(checked.decks);if(checked.warning)setMessage(checked.warning);else setMessage(current=>current.startsWith('저장 덱을 확인할 수 없습니다.')?'저장 덱 확인 완료':current);}if(next==='cards')setBrowseClass('all');};
  const [recommendStyle,setRecommendStyle]=useState<DeckStyle>('practice');
  const create=(recommended:boolean)=>{try{const owned=props.ownedCards?new Set(props.ownedCards):null;const pool=owned?Object.fromEntries(Object.entries(catalog).filter(([id,c])=>c.kind==='coin'||c.collectible===false||owned.has(id))):catalog;props.setDeck(recommended?strategicDeck(pool,selected,recommendStyle,random32()):{heroClass:selected,cards:[]});setEditName('');setScreen('build');}catch(e){setMessage((e as Error).message);}};
  const loadSaved=(entry:NamedDeck,play=false)=>{try{validateDeck(entry.deck,catalog);props.setDeck(structuredClone(entry.deck));setEditName(entry.name);setSelected(entry.deck.heroClass);if(play&&onPlay)onPlay();else setScreen('build');}catch{const repaired=repairDeck(catalog,entry.deck);if(!window.confirm(`호환되지 않는 카드 ${repaired.discarded.length}장을 제외하고 편집하시겠습니까? 원본 저장 덱은 보존됩니다.`))return;props.setDeck(repaired.deck);setEditName((entry.name+' (복원)').slice(0,40));setSelected(entry.deck.heroClass);setScreen('build');}};
  const deleteSaved=async(entry:NamedDeck)=>{if(restoringRef.current||!window.confirm(`${entry.name} 덱을 삭제할까요?`))return;restoringRef.current=true;setRestoring(true);try{setSaved(await withDeckLibraryLock(()=>deleteNamedDeck(entry,storage)));setMessage('저장 덱 삭제 완료');}catch(e){setSaved(current=>deckLibraryAfterWriteFailure(current,storage));setMessage(e instanceof Error?e.message:'저장 공간을 사용할 수 없습니다.');}finally{restoringRef.current=false;setRestoring(false);}};
  const [savedPage,setSavedPage]=useState(0);
  const filteredSaved=previewSimple?saved.filter(entry=>entry.deck.heroClass===selected):saved;
  const savedRows=collectionPage(filteredSaved,savedPage,previewSimple?10:2);
  const [restoring,setRestoring]=useState(false),restoringRef=useRef(false);
  useDeckLibraryAutoRefresh(storage,saved,setSaved,()=>screen==='saved'&&!restoringRef.current,()=>setMessage('다른 탭의 저장 덱 변경을 반영했습니다. 필요한 덱을 다시 선택하세요.'),setMessage,previous=>setMessage(current=>current===previous?'저장 덱 확인 완료':current),screen==='saved'&&!restoring);
  const exportSaved=async()=>{if(restoringRef.current)return;restoringRef.current=true;setRestoring(true);try{await downloadBackup(`card-duel-decks-${new Date().toISOString().slice(0,10)}.json`,backupDeckLibrary(storage));setMessage(androidBackupAvailable()?'저장 덱 백업 파일을 저장했습니다.':'저장 덱 백업 다운로드를 시작했습니다.');}catch(e){setMessage(e instanceof Error?e.message:'백업하지 못했습니다.');}finally{restoringRef.current=false;setRestoring(false);}};
  const restoreSaved=async(file:File)=>{if(restoringRef.current)return;if(file.size>MAX_BACKUP_BYTES){setMessage('덱 백업 파일이 너무 큽니다.');return;}if(!window.confirm('현재 슬롯에 저장 덱 백업을 추가할까요? 기존 덱은 덮어쓰지 않습니다.'))return;restoringRef.current=true;setRestoring(true);try{const raw=JSON.parse(await file.text()),combined=isSlotBackup(raw);if(!combined&&file.size>1024*1024)throw Error('덱 백업 파일이 너무 큽니다.');const result=await withDeckLibraryLock(()=>restoreDeckLibrary(combined?deckBackupPart(raw,offlineGrowth(catalog)):raw,storage));setSaved(result.decks);setMessage(`${result.added}개 추가 · 중복 ${result.duplicates}개 유지 · 이름 충돌 ${result.renamed}개 별도 복원${combined?' · 통합 백업의 덱만 복원했습니다.':''}`);}catch(e){setMessage(e instanceof Error?e.message:'덱 백업을 복원하지 못했습니다.');}finally{restoringRef.current=false;setRestoring(false);}};
  return <section className={`deck-workspace${previewSimple?' preview-workspace':''}`}><nav className="deck-workspace-nav" aria-label="덱 관리 메뉴">{deckScreens.map(([key,label])=><button type="button" key={key} data-deck-nav={key} aria-pressed={screen===key} onClick={()=>navigate(key)}>{label}</button>)}</nav>
  {screen==='classes'&&<section className="panel deck-panel" data-deck-screen="classes"><h2>직업 리스트</h2><p>직업을 고른 뒤 새 덱을 만들거나 해당 직업의 카드를 살펴보세요.</p><div className="hero-gallery workspace-heroes">{HERO_CLASSES.map(c=><button type="button" key={c} className={`class-choice faction-${c}${selected===c?' chosen':''}`} aria-pressed={selected===c} onClick={()=>{setSelected(c);if(previewSimple)setScreen('saved');}}><span className="class-emblem"><LocalHeroArt heroClass={c}/></span><b>{className[c]}</b><small>{deckCards(catalog,c).length}종</small></button>)}</div><div className="selected-deck-banner"><div className={`deck-banner-icon faction-${selected}`}><LocalHeroArt heroClass={selected}/></div><div className="deck-banner-copy"><h3>{className[selected]}</h3><p>{HERO_POWERS[selected].name} · {heroPowerDescription[selected]}</p></div></div><div className="controls"><button onClick={()=>create(false)}>빈 덱 만들기</button><label>추천 덱 유형<select value={recommendStyle} onChange={e=>setRecommendStyle(e.target.value as DeckStyle)}>{DECK_STYLES.map(s=><option key={s} value={s}>{DECK_STYLE_LABELS[s]}</option>)}</select></label><button onClick={()=>create(true)}>추천 덱 만들기</button><button className="secondary" onClick={()=>{setBrowseClass(selected);setScreen('cards');}}>선택 직업 카드 보기</button></div></section>}
  {screen==='saved'&&<section className="panel deck-panel" data-deck-screen="saved"><div className="section-title"><h2>{previewSimple?`${className[selected]} · 내 덱`:'덱 리스트'}</h2><strong>{filteredSaved.length}/20개</strong></div><p>저장한 덱을 선택하거나 편집하세요. 현재 편집 중인 덱은 별도로 자동 저장돼요.</p><div className="controls">{previewSimple?<><button type="button" onClick={()=>create(false)}>＋ 새 덱 만들기</button><button type="button" className="secondary" onClick={()=>create(true)}>보유 카드 추천 덱 만들기</button><button type="button" className="secondary" onClick={()=>setScreen('classes')}>← 다른 직업 선택</button></>:<><button onClick={()=>setScreen('build')}>현재 덱 편집하기</button><button className="secondary" onClick={()=>setScreen('classes')}>새 덱 만들기</button></>}<button className="secondary" disabled={restoring} onClick={()=>void exportSaved()}>저장 덱 백업 다운로드</button><BackupFilePicker label="덱 백업 추가" disabled={restoring} onFile={file=>void restoreSaved(file)} onError={setMessage}/></div>{message&&<p role="status">{message}</p>}<div className="saved-deck-grid">{savedRows.items.map(entry=><article key={entry.name} className="saved-deck-entry"><div className={`deck-banner-icon faction-${entry.deck.heroClass}`}><LocalHeroArt heroClass={entry.deck.heroClass}/></div><div><h3>{entry.name}</h3><p>{className[entry.deck.heroClass]} · {entry.deck.cards.length}/30장</p><LobbyDialog label="덱 카드 목록"><ol>{[...new Set(entry.deck.cards)].sort((a,b)=>(catalog[a]?.cost??99)-(catalog[b]?.cost??99)).map(id=><li key={id}>{catalog[id]?`${catalog[id].cost} · ${displayCardName(catalog[id],classic)}`:id} ×{entry.deck.cards.filter(c=>c===id).length}</li>)}</ol></LobbyDialog><div className="controls"><button onClick={()=>loadSaved(entry)}>불러오기</button>{onPlay&&<button onClick={()=>loadSaved(entry,true)}>대전용 선택</button>}<button className="secondary" disabled={restoring} onClick={()=>deleteSaved(entry)}>삭제</button></div></div></article>)}</div>{savedRows.pages>1&&<PageControls page={savedRows.page} pages={savedRows.pages} onPage={setSavedPage}/>}{!saved.length&&<p className="empty-saved">아직 저장한 덱이 없습니다. 덱 만들기에서 30장을 완성하고 저장하세요.</p>}</section>}
  {screen==='cards'&&<CardBrowser key={browseClass} initialClass={browseClass}/>}
  {screen==='build'&&<div data-deck-screen="build">{previewSimple&&<button className="secondary preview-deck-back" type="button" onClick={()=>setScreen('saved')}>← 덱 목록으로</button>}<DeckEditor {...props} workspaceMode initialName={editName}/></div>}
  </section>;
}
export { Battle } from './Battle.tsx';
type OfflineMode='player'|'developer';
type LobbyView='home'|'play'|'decks'|'catalog'|'slots'|'rank'|'quests'|'rewards'|'developer';
type AppProps={initialLobbyView?:LobbyView;standalone?:boolean;workerFactory?:()=>Worker;initialAiProfile?:import('../../../packages/protocol.ts').PublicAiProfile;initialOfflineMode?:OfflineMode};
export function App(props:AppProps={}){
  const previewGate=!!props.standalone&&currentSoloNamespace()==='ui-preview'&&!!props.workerFactory;
  const [slot,setSlot]=useState<SoloSlot>(()=>props.standalone?readSelectedSlot():1);
  const [slotChosen,setSlotChosen]=useState(!previewGate);
  const selectSlot=(next:SoloSlot)=>{rememberSlot(next);setSlot(next);setSlotChosen(true);};
  if(!slotChosen&&props.workerFactory)return <SlotGateway workerFactory={props.workerFactory} onSelect={selectSlot}/>;
  return <AppSession key={slot} {...props} initialLobbyView={previewGate?'home':props.initialLobbyView} slot={slot} onSlotChange={selectSlot} onReturnToSlots={previewGate?()=>setSlotChosen(false):undefined}/>;
}
function AppSession({standalone=false,workerFactory:baseWorkerFactory,initialAiProfile,initialOfflineMode='player',initialLobbyView='home',slot,onSlotChange,onReturnToSlots}:AppProps&{slot:SoloSlot;onSlotChange:(slot:SoloSlot)=>void;onReturnToSlots?:()=>void}){
  const storage=useMemo(()=>soloSlotStorage(slot),[slot]);
  const lossOnExit=standalone&&currentSoloNamespace()==='ui-preview';
  const makeWorker=(target:SoloSlot)=>{if(!baseWorkerFactory)throw Error('저장 슬롯 작업 스레드가 없습니다.');const worker=baseWorkerFactory();if(standalone&&(target!==1||currentSoloNamespace()==='ui-preview'))worker.postMessage({type:'selectSlot',slot:target,...(currentSoloNamespace()==='ui-preview'?{namespace:'ui-preview'}:{})});return worker;};
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
  const unreadRef=useRef(unreadCards);
  const [rewardPopup,setRewardPopup]=useState<string[]>([]);
  const [catalogFocus,setCatalogFocus]=useState<string>();
  const previousRank=useRef<number|undefined>(undefined);
  const [promotion,setPromotion]=useState<{before:number;after:number}>();
  useEffect(()=>{
    const next=syncNewCards(offlineProfile,storage);
    const gained=next.filter(id=>!unreadRef.current.includes(id));
    unreadRef.current=next;setUnreadCards(next);
    if(gained.length)setRewardPopup(previous=>[...new Set([...previous,...gained])]);
    if(offlineProfile){
      const before=previousRank.current;
      previousRank.current=offlineProfile.rank;
      if(before!==undefined&&offlineProfile.rank>before&&room)setPromotion({before,after:offlineProfile.rank});
    }
  },[offlineProfile?.revision,storage]);
  const onViewNewCard=(id:string)=>{const next=markCardViewed(id,storage);unreadRef.current=next;setUnreadCards(next);};
  const [previewEditHero,setPreviewEditHero]=useState<HeroClass|null>(null);
  const [offlineMode,setOfflineMode]=useState<OfflineMode>(initialOfflineMode);
  const modeDecks=useRef<Partial<Record<OfflineMode,Deck>>>({});
  const localGrowth=useMemo(()=>standalone?offlineGrowth(catalog):undefined,[standalone]);
  const [updatePending,setUpdatePending]=useState(false),[updateBlocked,setUpdateBlocked]=useState(false);
  const [accountSync,setAccountSync]=useState(0),[growthSync,setGrowthSync]=useState(0);const [roomSync,setRoomSync]=useState(0);const [maintenance,setMaintenance]=useState(false);
  const [deck,setDeck]=useState<Deck>(()=>standalone&&initialOfflineMode==='developer'?readDeveloperDraft(catalog,catalogHash,storage):readDraft(catalog,catalogHash,storage));
  const [undoDecks,setUndoDecks]=useState<Deck[]>([]),[draftStored,setDraftStored]=useState(true);
  const editDeck=(next:Deck)=>{if(next.heroClass===deck.heroClass&&next.cards.length===deck.cards.length&&next.cards.every((id,i)=>id===deck.cards[i]))return;setUndoDecks(old=>[...old.slice(-19),deck]);setDeck(next);};
  const undo=()=>{const last=undoDecks.at(-1);if(last){setDeck(last);setUndoDecks(old=>old.slice(0,-1));}};
  useEffect(()=>{setDraftStored(standalone&&offlineMode==='developer'?saveDeveloperDraft(deck,catalogHash,storage):saveDraft(deck,catalogHash,storage));},[deck,offlineMode]);
  const [soloSettings,setSoloSettings]=useState<SoloSettings>(()=>{const s=readSoloSettings(storage);return standalone?{...s,engine:'device'}:s;});
  const setSolo=<K extends keyof SoloSettings>(key:K,value:SoloSettings[K])=>setSoloSettings(old=>({...old,[key]:value}));
  const {heroClass:botClass,difficulty,engine:botEngine,deviceMode,style:botStyle,first,animationSpeed}=soloSettings;
  const setBotClass=(v:SoloClass)=>setSolo('heroClass',v),setDifficulty=(v:BotDifficulty)=>setSolo('difficulty',v),setBotEngine=(v:'device'|'server')=>setSolo('engine',standalone?'device':v),setDeviceMode=(v:DeviceMode)=>setSolo('deviceMode',v),setBotStyle=(v:SoloStyle)=>setSolo('style',v),setFirst=(v:FirstSelection)=>setSolo('first',v),setAnimationSpeed=(v:AnimationSpeed)=>setSolo('animationSpeed',v);
  const [soloHistory,setSoloHistory]=useState(()=>readSoloHistory(storage)),[savedMatch,setSavedMatch]=useState<LocalSaveSummary|null>(null),[saveAvailable,setSaveAvailable]=useState<boolean|undefined>(undefined);
  const [saveRetryable,setSaveRetryable]=useState(false);
  const warnLocalExit=!lossOnExit&&shouldWarnLocalExit(room,busy,saveAvailable,saveRetryable);
  useEffect(()=>{if(!warnLocalExit)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[warnLocalExit]);
  const [oldRankedPending,setOldRankedPending]=useState<boolean|undefined>(undefined);
  const [saveProbe,setSaveProbe]=useState(0);
  const growthReady=saveAvailable===undefined?undefined:saveAvailable&&oldRankedPending!==undefined;
  const startSaveProbe=()=>{setSaveAvailable(undefined);setOldRankedPending(undefined);setSaveProbe(n=>n+1);};
  const recheckSave=()=>{if(workerRef.current||busy||saveAvailable===undefined)return;startSaveProbe();};
  useEffect(()=>{saveSoloSettings(soloSettings,storage);},[soloSettings]);
  useEffect(()=>{if(room){const result=resultFromRoom(room,catalogHash);if(result)setSoloHistory(old=>recordSoloResult(result,storage,old));}},[room?.code,room?.state?.phase]);
  useEffect(()=>{let stopped=false,probe:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    const close=()=>{if(timer!==undefined)clearTimeout(timer);probe?.terminate();};
    const finish=(data?:Extract<LocalResponse,{type:'saveInfo'}>)=>{if(stopped)return;stopped=true;close();if(workerRef.current)return;setSaveAvailable(data?.available??false);setSavedMatch(old=>reconcileSaveProbe(old,data));if(standalone){if(data?.profile)setOfflineProfile(old=>!old||data.profile!.revision>=old.revision?data.profile:old);setOldRankedPending(data?.otherActiveRanked);}};
    try{if(!workerFactory)throw Error('Missing worker factory');probe=workerFactory();probe.onmessage=({data}:MessageEvent<LocalResponse>)=>{if(data.type==='saveInfo')finish(data);else if(data.type==='error')finish();};probe.onerror=()=>finish();timer=setTimeout(()=>finish(),5000);probe.postMessage({type:'inspectSave',catalogHash,...(standalone?{catalog}:{}),} satisfies LocalRequest);}catch{finish();}
    return()=>{stopped=true;close();};
  },[saveProbe]);
  const [lobbyView,setLobbyView]=useState<LobbyView>(initialLobbyView);
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

  const screenScrollRef=useRef<HTMLDivElement|null>(null);
  const openLobbyView=(next:Exclude<LobbyView,'home'>,restoreFocus=false)=>{
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
  const switchOfflineMode=(next:OfflineMode)=>{if(next===offlineMode||busyRef.current||workerRef.current)return;modeDecks.current[offlineMode]=deck;const stored=offlineMode==='developer'?saveDeveloperDraft(deck,catalogHash,storage):saveDraft(deck,catalogHash,storage);setDeck(modeDecks.current[next]??(next==='developer'?readDeveloperDraft(catalog,catalogHash,storage):readDraft(catalog,catalogHash,storage)));setUndoDecks([]);setOfflineMode(next);setLobbyView(lossOnExit?'developer':'play');setError(stored?'':'현재 편집 덱은 이번 실행에서만 유지됩니다. 브라우저 저장소를 확인하세요.');};
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
    acknowledgeWorker();workerRef.current?.terminate();workerRef.current=null;setRoom(null);setSaveRetryable(false);setLobbyView('play');changeBusy(false);
    startSaveProbe();setError(message+' 마지막으로 저장된 경기를 다시 확인합니다.');
  };
  const recoverStalledWorker=()=>{
    if(!workerRef.current||!workerStalledRef.current||!window.confirm('기기 AI 작업이 아직 진행 중일 수 있습니다. 작업을 중단하면 확인되지 않은 최신 행동은 사라질 수 있으며 마지막 저장 기록만 복구합니다. 중단하고 저장 경기를 다시 확인할까요?'))return;
    recoverLocalWorker('지연된 기기 AI 작업을 중단했습니다.');
  };
  const startLocalWorker=(initialize:(worker:Worker)=>void)=>{
    if(workerRef.current||busyRef.current)return;
    if(sessionRef.current||ticketRef.current){setError('기존 서버 대전을 복원하고 나간 뒤 기기 AI 대전을 시작하세요.');return;}
    changeBusy(true);setError('');
    try{
      if(!workerFactory)throw Error('Missing worker factory');
      const worker=workerFactory();
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
          if(data.save!==undefined)setSavedMatch(data.save);if(data.saveAvailable!==undefined)setSaveAvailable(data.saveAvailable);
          acknowledgeWorker();
          setError(data.error);changeBusy(false);return;
        }
        if(data.type==='paused'||data.type==='discarded'||data.type==='forfeited'){if(data.requestId!==localRequestId.current)return;acknowledgeWorker();worker.terminate();workerRef.current=null;setRoom(null);setLobbyView('play');setSavedMatch(data.save);setSaveAvailable(data.type==='paused'||data.type==='forfeited'||(data.type==='discarded'&&data.available));if(data.type==='paused')setToast({text:'경기를 저장했습니다. 대전 준비에서 이어할 수 있습니다.',kind:'success'});else if(data.type==='forfeited')setToast({text:'기존 경기가 패배로 정산되었습니다.',kind:'info'});changeBusy(false);return;}
        if(data.type!=='view')return;
        const firstView=!hasView;hasView=true;
        if(data.save!==undefined)setSavedMatch(data.save);if(data.saveAvailable!==undefined)setSaveAvailable(data.saveAvailable);
        setRoom(previous=>mergeRoomView(previous,data.view));if(localViewAcknowledges(data.requestId,localRequestId.current,firstView,data.view.state?.revision,data.resumed)){acknowledgeWorker(true);changeBusy(false);}
      };
      worker.onerror=()=>fail(standalone?'이 기기에서 AI 작업이 중단되었습니다. 확인되지 않은 최신 행동은 복구되지 않을 수 있습니다.':'이 기기에서 AI 작업이 중단되었습니다.');
      initialize(worker);
    }catch{recoverLocalWorker(standalone?'이 브라우저에서 기기 AI 작업을 시작하지 못했습니다.':'이 브라우저에서 기기 AI 작업을 시작하지 못했습니다. 서버 AI도 선택할 수 있습니다.');}
  };
  const deviceInfo=()=>({cores:navigator.hardwareConcurrency,memoryGb:(navigator as Navigator&{deviceMemory?:number}).deviceMemory});
  const newLocalCode=()=>`LOCAL-${random32().toString(16)}-${random32().toString(16)}`;
  const growthBackup=async(file?:File,combined=false)=>{
    if(!standalone||!workerFactory||busyRef.current||workerRef.current)return;
    if(file&&file.size>MAX_BACKUP_BYTES){setError('성장 백업 파일이 너무 큽니다.');return;}
    changeBusy(true);setError('');let worker:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    let finished=false;
    const finish=(message:string)=>{if(finished)return;finished=true;if(timer!==undefined)clearTimeout(timer);worker?.terminate();changeBusy(false);setError(message);};
    try{
      const raw=file?JSON.parse(await file.text()):undefined,combinedImport=isSlotBackup(raw),growth=localGrowth!;
      const prepared=combinedImport?prepareSlotRestore(raw,growth,storage):undefined;
      const payload:LocalRequest=file?{type:'restoreGrowth',catalog,backup:prepared?.growth??growthBackupPart(raw,growth)}:{type:'exportGrowth',catalog};
      const details=prepared?`성장+덱 통합 백업(원본 슬롯 ${prepared.sourceSlot}, 덱 ${prepared.preview.added}개 추가 예정)을 저장 슬롯 ${slot}에 복원할까요?`:`저장 슬롯 ${slot}에 성장 백업을 복원할까요?`;
      if(file&&!window.confirm(`${details} 이미 진행한 기록이나 기존 저장 덱은 덮어쓰지 않습니다.`)){finish('');return;}
      const named=combined&&!file?backupDeckLibrary(storage):undefined;
      worker=workerFactory();worker.onmessage=({data}:MessageEvent<LocalResponse>)=>{if(finished)return;if(data.type==='error'){finish(data.error);return;}if(data.profile)setOfflineProfile(data.profile);
        if(data.type==='growthBackup'){if(timer!==undefined){clearTimeout(timer);timer=undefined;}worker?.terminate();worker=undefined;const label=named?'성장+덱 통합':'성장';void Promise.resolve().then(()=>downloadBackup(`card-duel-${named?'backup':'growth'}-slot-${slot}-${new Date().toISOString().slice(0,10)}.json`,named?createSlotBackup(slot,data.backup,named,growth):data.backup)).then(()=>finish(`${label} 백업 ${androidBackupAvailable()?'파일을 저장했습니다.':'다운로드를 시작했습니다.'}`)).catch(e=>finish(e instanceof Error?e.message:'백업을 저장하지 못했습니다.'));}
        else if(data.type==='growthRestored'){
          if(!prepared){finish('성장 백업을 복원했습니다.');return;}
          if(timer!==undefined){clearTimeout(timer);timer=undefined;}worker?.terminate();worker=undefined;
          void withDeckLibraryLock(()=>prepared.restoreDecks()).then(result=>finish(`통합 백업의 성장 기록을 복원했습니다. 저장 덱 ${result.added}개 추가 · 중복 ${result.duplicates}개 유지 · 이름 충돌 ${result.renamed}개 별도 복원`)).catch(e=>finish(`성장 기록은 복원됐지만 덱 추가는 실패했습니다. 덱 리스트에서 같은 백업 파일로 다시 추가하세요. (${e instanceof Error?e.message:'덱 저장소 오류'})`));
        }};worker.onerror=()=>finish('성장 백업 작업을 완료하지 못했습니다.');timer=setTimeout(()=>finish('성장 저장소 응답이 지연되었습니다. 다시 확인하세요.'),10000);worker.postMessage(payload);
    }catch(e){finish(e instanceof Error?e.message:'성장 백업 파일을 열 수 없습니다.');}
  };
  const beginLocal=(config:ResolvedSolo,matchDeck:Deck,ranked=false,developerRank?:number,developerExperiment=false)=>{
    if(ranked&&!growthReady){setError('저장소와 성장 기록을 확인한 뒤 랭크 경기를 시작하세요.');return;}
    if(ranked&&oldRankedPending){setError('이전 카드 버전에서 진행 중인 랭크 경기를 완료한 뒤 다시 시작하세요.');return;}
    if(savedMatch?.rank!==undefined&&savedMatch.phase!=='finished'){setError('진행 중인 랭크 대전을 먼저 이어서 완료하거나 항복하세요.');return;}
    if(saveAvailable===undefined){setError('저장된 경기를 확인하는 중입니다. 잠시 후 다시 시도하세요.');return;}
    if(savedMatch&&savedMatch.phase!=='finished'&&!window.confirm('새 대전을 시작하면 저장된 진행 중인 경기가 교체됩니다. 새 대전을 시작할까요?'))return;
    startLocalWorker(worker=>{void (initialAiProfile?Promise.resolve(initialAiProfile):localAiProfile(catalogHash)).then(profile=>{
        if(workerRef.current!==worker)return;
        const request:LocalRequest={type:'start',replaceSave:savedMatch,ranked,developerRank,...(developerExperiment?{developerExperiment:true}:{}),input:{catalog,catalogHash,deck:structuredClone(matchDeck),heroClass:config.heroClass,difficulty:config.difficulty,seed:config.seed,code:newLocalCode(),style:config.style,firstPlayer:config.firstPlayer,deckSeed:config.deckSeed,weights:profile.weights,generation:profile.generation,deviceMode:config.deviceMode,animationSpeed:config.animationSpeed,device:deviceInfo()}};
        worker.postMessage(request);
      }).catch(()=>{if(workerRef.current===worker)recoverLocalWorker('기기 AI를 시작하지 못했습니다.');});});
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
    if(mode==='create')socket.timeout(8000).emit('room:create',{deck,ticket},reply);else if(mode==='ranked')socket.timeout(30000).emit('room:ranked',{deck,ticket,expectedAccountId},reply);else if(mode==='developer-test')socket.timeout(30000).emit('room:developer-test',{deck,rank:Number(accountCode),ticket,expectedAccountId},reply);else if(mode==='owned-create')socket.timeout(30000).emit('room:owned-create',{deck,ticket,expectedAccountId},reply);else if(mode==='owned-join')socket.timeout(30000).emit('room:owned-join',{code:accountCode??'',deck,ticket,expectedAccountId},reply);else if(mode==='owned-match')socket.timeout(30000).emit('room:owned-match',{deck,ticket,expectedAccountId},reply);else if(mode==='account-resume')socket.timeout(30000).emit('room:account-resume',{ticket,expectedAccountId},reply);else if(config)socket.timeout(8000).emit('room:bot',{deck,heroClass:config.heroClass,difficulty:config.difficulty,style:config.style,firstPlayer:config.firstPlayer,deckSeed:config.deckSeed,ticket},reply);else socket.timeout(8000).emit('room:join',{code,deck,ticket},reply);
  };
  const [intentEpoch,setIntentEpoch]=useState(0);
  const send=(action:Action)=>{if(!room?.state||busyRef.current)return;if(workerRef.current){setError('');changeBusy(true);const command:LocalRequest={type:'act',requestId:++localRequestId.current,revision:room.state.revision,action};clearWatchdog();workerWatchdog.current=setTimeout(()=>markWorkerStalled('기기 AI 응답이 지연되고 있습니다.'),12000);try{workerRef.current.postMessage(command);}catch{recoverLocalWorker('기기 AI 행동 요청을 전달하지 못했습니다.');}return;}const socket=socketRef.current;if(!connected||!releaseReady()||!socket?.connected)return;setError('');changeBusy(true);const epoch=connectionEpoch.current;socket.timeout(room.ranked||room.ownedPvp||room.developerTest?30000:8000).emit('room:action',{revision:room.state.revision,action},(err,r)=>{if(epoch!==connectionEpoch.current)return;if(err){setIntentEpoch(n=>n+1);if(socket.connected)sync(socket);else changeBusy(false);return;}if(r.ok){acceptView(r.data);changeBusy(false);return;}if(r.code==='staleRevision'||r.code==='opponentDisconnected'||r.error.includes('오래된 게임 화면')){setIntentEpoch(n=>n+1);sync(socket);return;}changeBusy(false);if(terminalSessionFailure(r.code))clearServerRoom();setError(r.error);});};
  const leave=()=>{if(workerRef.current){if(busyRef.current)return;if(lossOnExit){localCommand('pause');return;}if(saveRetryable){localCommand('pause');return;}if(room?.ranked&&room.status==='playing'&&saveAvailable){localCommand('pause');return;}if(room?.status==='finished'&&saveAvailable){localCommand('pause');return;}if(shouldConfirmUnstoredResultExit(room,saveAvailable)&&!window.confirm('경기 결과가 저장되지 않았습니다. 지금 나가면 결과를 복구하지 못할 수 있습니다. 그래도 나갈까요?'))return;if(room?.status==='playing'&&!window.confirm('이 경기를 포기하고 저장 데이터를 제거할까요? 이어하려면 저장 후 나가기를 선택하세요.'))return;localCommand('discard');return;}const socket=socketRef.current;if(!connected||!releaseReady()||!socket?.connected||busyRef.current)return;if(room?.status==='playing'&&!window.confirm('방을 나가면 항복 처리됩니다. 나가시겠습니까?'))return;changeBusy(true);const epoch=connectionEpoch.current;socket.timeout(room?.ranked||room?.ownedPvp||room?.developerTest?30000:8000).emit('room:leave',(err,r)=>{if(epoch!==connectionEpoch.current)return;changeBusy(false);if(err){setConnected(false);setError('방 나가기 응답이 지연됩니다. 연결 재시도로 상태를 확인하세요.');return;}if(r.ok){setLobbyView(room?.state?.phase==='finished'?'decks':'play');clearServerRoom();setError('');}else{if(terminalSessionFailure(r.code))clearServerRoom();setError(r.error);}});};
  const onDevice=room?.botEngine==='device';
  const pauseAccount=()=>{const socket=socketRef.current;if(!releaseReady()||!socket?.connected||busyRef.current||!room?.ranked)return;changeBusy(true);socket.timeout(30000).emit('room:account-pause',(err,result)=>{changeBusy(false);if(err){setError('저장 응답이 지연됐습니다. 연결 재시도로 확인하세요.');return;}if(result.ok){clearServerRoom();setLobbyView('play');setError('계정 대전을 서버에 저장했습니다. 다른 기기에서도 이어할 수 있습니다.');}else setError(result.error);});};
  const rematch=()=>{
    const worker=workerRef.current;if(!worker||room?.state?.phase!=='finished'||busyRef.current)return;changeBusy(true);setError('');clearWatchdog();workerWatchdog.current=setTimeout(()=>markWorkerStalled('재대전 응답이 지연됩니다.'),12000);try{worker.postMessage({type:'rematch',code:newLocalCode(),seed:random32(),requestId:++localRequestId.current} satisfies LocalRequest);}catch{recoverLocalWorker('재대전 요청을 전달하지 못했습니다.');}
  };
  const slotManagementContent=<>
      {standalone&&<section className="saved-duel-panel slot-panel" aria-label="로컬 저장 슬롯"><div><strong>저장 슬롯 {slot} · {offlineProfile?`XP ${offlineProfile.xp}`:'기록 확인 중'}</strong><p>빈 슬롯에서 새로 시작하세요. 다른 슬롯의 카드·랭크·덱·경기는 보존됩니다.</p></div>{nextFresh!==undefined&&<button type="button" disabled={busy||lobbyView!==(lossOnExit?'slots':'play')} onClick={()=>switchSlot(nextFresh)}>새로 시작 · 슬롯 {nextFresh}</button>}<div className="slot-grid">{SOLO_SLOTS.map(value=>{const preview=slotPreviews[value],selected=value===slot,profile=selected?offlineProfile:preview,match=selected?savedMatch:preview?.save;return <div className={`slot-tile${selected?' selected':''}`} key={value}><button type="button" aria-pressed={selected} aria-describedby={`slot-${value}-state slot-${value}-progress slot-${value}-match`} className={selected?'chosen':'secondary'} disabled={busy||selected||lobbyView!==(lossOnExit?'slots':'play')} onClick={()=>switchSlot(value)}>슬롯 {value}</button><small id={`slot-${value}-state`}>{selected?'현재 선택':freshSlot(value)?'새로 시작 가능':preview===null?'기록 확인 실패':preview===undefined?'기록 확인 중':'저장 기록'}</small><small id={`slot-${value}-progress`}>{profile?`${rankInfo(profile.rank).name} · XP ${profile.xp}`:'—'}</small><small id={`slot-${value}-match`}>{match?match.phase==='finished'?'지난 경기 결과':'이어할 경기 있음':(selected?oldRankedPending:preview?.otherActiveRanked)?'이전 버전 랭크 진행 중':!selected&&preview?.otherSaves?'이전 버전 경기 있음':profile?'진행 중 경기 없음':'—'}</small></div>;})}</div></section>}
      {standalone&&<nav className="lobby-tabs" aria-label="오프라인 게임 모드"><button className={offlineMode==='player'?'chosen':''} aria-pressed={offlineMode==='player'} disabled={busy} onClick={()=>switchOfflineMode('player')}>유저 모드</button><button className={offlineMode==='developer'?'chosen':''} aria-pressed={offlineMode==='developer'} disabled={busy} onClick={()=>switchOfflineMode('developer')}>개발자 모드</button></nav>}
      {standalone&&localGrowth&&(lossOnExit?lobbyView==='slots':lobbyView==='play')&&(offlineMode==='player'?<OfflineGrowthPanel profile={offlineProfile} growth={localGrowth} deck={deck} busy={busy} ready={growthReady} rankBlocked={oldRankedPending} onDeck={editDeck} onStart={()=>beginLocal(resolveSolo(soloSettings,random32()),deck,true)} onBackup={()=>void growthBackup()} onCombinedBackup={()=>void growthBackup(undefined,true)} onRestore={file=>void growthBackup(file)} onRestoreError={setError}/>:<OfflineDeveloperPanel growth={localGrowth} deck={deck} busy={busy} onStart={(rank,experiment)=>beginLocal(resolveSolo(soloSettings,random32()),deck,false,rank,experiment)}/>)}
<div className="saved-duel-panel" aria-label="저장된 솔로 대전">{savedMatch?<><div><strong>{savedMatch.phase==='finished'?'지난 대전 결과':savedMatch.rank!==undefined?'진행 중인 랭크 대전':savedMatch.testRank!==undefined?(savedMatch.testExperiment?'진행 중인 실험 AI 시험':'진행 중인 개발자 시험'):'진행 중인 솔로 대전'}</strong><p>{className[savedMatch.heroClass]} vs {className[savedMatch.opponent]} · {savedMatch.difficulty}단계 · {savedMatch.turn}턴 · {new Date(savedMatch.savedAt).toLocaleString('ko-KR')}</p>{savedMatchConfidence(saveAvailable)&&<small role="status" className="warn">{savedMatchConfidence(saveAvailable)}</small>}</div>{!lossOnExit&&<button disabled={busy||saveAvailable===undefined} onClick={resumeLocal}>{saveAvailable===false?'이어하기 재시도':savedMatch.phase==='finished'?'결과 보기':'이어하기'}</button>}<button disabled={busy||saveAvailable!==true||savedMatch.rank!==undefined&&savedMatch.phase!=='finished'} className="secondary" onClick={discardSaved}>저장 경기 제거</button></>:<small>{saveAvailable===undefined?'저장 경기 확인 중…':saveAvailable?'기기 AI 대전은 자동으로 저장됩니다.':'경기 저장소에 접근할 수 없습니다.'}</small>}{workerFactory&&saveAvailable!==undefined&&(savedMatch||!saveAvailable||standalone&&oldRankedPending===undefined)&&<button type="button" className="secondary" disabled={busy} onClick={recheckSave}>저장소 다시 확인</button>}</div></>;
  return <main className={room?'game-main':lossOnExit?'lobby-main preview-lobby':'lobby-main'} data-game-viewport="landscape"><header className="app-header"><div className="brand"><span className="brand-emblem"><Sigil kind="neutral"/></span><div><h1>Card Duel</h1></div></div><div className="connection">{onReturnToSlots&&!room&&lobbyView==='slots'&&<button type="button" className="secondary slot-return" disabled={busy} onClick={onReturnToSlots}>슬롯 {slot} 변경</button>}<span className={connected||onDevice||standalone?'good':'warn'}>{onDevice?'● 기기 AI 실행 중':standalone?'● 오프라인 솔로':connected?'● 서버 연결됨':'● 연결 대기'}</span>{!standalone&&!onDevice&&!connected&&!busy&&<button className="secondary" onClick={reconnect}>연결 재시도</button>}</div><LandscapeExperience/></header>
    <div className="screen-content" id="card-duel-screen" ref={screenScrollRef}>
    {!room&&<div className="lobby-settings-entry"><LobbyDialog label="설정" icon="⚙"><AudioMixer/>{standalone&&<OfflineStatus/>}<small>Card Duel v{project.version}</small></LobbyDialog></div>}
    {toast&&!error&&<ToastNotice key={toast.text} kind={toast.kind}>{toast.text}</ToastNotice>}
    {(error||workerStalled)&&<div className="error game-error-toast" role="alert">{error||'기기 AI 작업 응답을 기다리는 중입니다.'}{workerStalled?<><small>응답을 기다리거나 마지막으로 저장된 상태를 복구할 수 있습니다.</small><button type="button" className="secondary" onClick={recoverStalledWorker}>마지막 저장으로 복구</button></>:<button className="secondary" onClick={()=>setError('')}>닫기</button>}</div>}
    {updatePending&&<div className="account-maintenance" role="status">서버에 새 게임 버전이 준비되었습니다. 지금 기기 AI 대전은 유지되며 로비로 돌아가면 최신 버전이 적용됩니다. 카드 설정이 달라진 경우 이전 저장 경기의 이어하기는 제한될 수 있으니 현재 경기를 마치는 것을 권장합니다.</div>}
    {updateBlocked&&!updatePending&&<div className="account-maintenance" role="alert">최신 서버와 화면 버전이 일치하지 않습니다. 반복 새로고침을 막기 위해 자동 갱신을 중단했습니다. 계정 대전은 최신 화면으로 갱신한 뒤 이용하세요. <button type="button" className="secondary" disabled={!!workerRef.current} onClick={()=>window.location.reload()}>최신 화면 다시 불러오기</button></div>}
    {!room&&(rewardPopup.length>0||promotion)&&<RewardReveal cards={rewardPopup} rank={promotion} onCatalog={id=>{setCatalogFocus(id);setRewardPopup([]);setPromotion(undefined);openLobbyView('catalog',true);}} onClose={()=>{setRewardPopup([]);setPromotion(undefined);}}/>}
    {room?<Battle compactUi={lossOnExit} key={room.code} room={room} send={send} leave={leave} intentEpoch={intentEpoch} connected={connected||onDevice} busy={busy} onRematch={onDevice&&!updatePending&&!room.ranked&&!saveRetryable?rematch:undefined} onPause={onDevice&&(saveAvailable||saveRetryable)?()=>{if(updatePending&&room.status==='playing'&&releaseRef.current.catalog!==catalogHash&&!window.confirm('새 카드 버전에서는 이 저장 경기를 복원하지 못할 수 있습니다. 그래도 저장하고 업데이트할까요?'))return;localCommand('pause');}:room.ranked&&!onDevice?pauseAccount:undefined} onRetrySave={onDevice&&saveRetryable?()=>localCommand('retrySave'):undefined} saveRetryable={onDevice&&saveRetryable} savePending={onDevice&&busy} lastSavedAt={onDevice&&saveAvailable===true&&savedMatch?.code===room.code?savedMatch.savedAt:undefined} autoSaved={onDevice?!!saveAvailable:room.ranked||room.ownedPvp||room.developerTest?true:undefined}/>:<>
      {lobbyView==='home'?lossOnExit?<nav className="lobby-tabs lobby-home" aria-label="게임 메뉴">
    <button type="button" data-lobby-tab="play" onClick={()=>openLobbyView('play',true)}><Sigil kind="warrior"/>대전</button>
    <button type="button" data-lobby-tab="catalog" onClick={()=>openLobbyView('catalog',true)}><Sigil kind="deck"/>카드 도감</button>
    <button type="button" data-lobby-tab="slots" onClick={()=>openLobbyView('slots',true)}><Sigil kind="neutral"/>슬롯 선택</button>
    <button type="button" data-lobby-tab="rank" onClick={()=>openLobbyView('rank',true)}>🏆 등급</button>
    <button type="button" data-lobby-tab="quests" onClick={()=>openLobbyView('quests',true)}>📜 퀘스트</button>
    <button type="button" data-lobby-tab="rewards" onClick={()=>openLobbyView('rewards',true)}>🎁 경험치 · 카드 획득</button>
    <button type="button" data-lobby-tab="developer" onClick={()=>openLobbyView('developer',true)}>⚙ 개발자 모드</button>
  </nav>:<nav className="lobby-tabs lobby-home" aria-label="게임 메뉴"><button type="button" data-lobby-tab="play" onClick={()=>openLobbyView('play',true)}><Sigil kind="warrior"/>대전</button><button type="button" data-lobby-tab="decks" onClick={()=>openLobbyView('decks',true)}><Sigil kind="deck"/>덱 만들기</button><button type="button" data-lobby-tab="catalog" onClick={()=>openLobbyView('catalog',true)}><Sigil kind="deck"/>카드 도감</button></nav>:<nav className="lobby-page-nav floating-home" aria-label="현재 화면"><button type="button" className="secondary" data-lobby-tab={lobbyView} onClick={()=>{setLobbyView('home');requestAnimationFrame(()=>screenScrollRef.current?.querySelector<HTMLButtonElement>(`[data-lobby-tab="${lobbyView}"]`)?.focus());}} aria-label="메인으로">{lossOnExit?'⌂':'메인으로'}</button>{!lossOnExit&&<strong>{lobbyView==='play'?'대전':lobbyView==='decks'?'덱 만들기':lobbyView==='slots'?'슬롯 · 성장 · 기록':'카드 도감'}</strong>}</nav>}
      <div className="lobby-account" hidden={lobbyView!=='play'}>{!standalone&&!updateBlocked&&<LobbyDialog label="계정"><AccountPanel deck={deck} onLoad={editDeck} onAuthChange={reconnect} connected={connected&&!busy} maintenance={maintenance} syncEpoch={accountSync} growthEpoch={growthSync} roomEpoch={roomSync} onPlay={begin} onAccount={setAccount}/></LobbyDialog>}</div>
      {lobbyView==='play'&&lossOnExit?<PreviewPlay storage={storage} profile={offlineProfile} deck={deck} ready={growthReady} blocked={oldRankedPending} busy={busy} onDeck={editDeck} onStart={()=>beginLocal(resolveSolo(soloSettings,random32()),deck,true)} onBuild={hero=>{setPreviewEditHero(hero);openLobbyView('decks',true);}} savedMatch={savedMatch} saveAvailable={saveAvailable} onResume={resumeLocal} onForfeitSaved={forfeitSaved}/>:lobbyView==='play'?<div className="play-hub"><div className="play-support">
      {lossOnExit&&offlineMode==='player'&&<SlotDeckLaunch slot={slot} storage={storage} profile={offlineProfile} deck={deck} ready={growthReady} blocked={oldRankedPending} busy={busy} onDeck={editDeck} onManage={()=>openLobbyView('decks',true)} onStart={()=>beginLocal(resolveSolo(soloSettings,random32()),deck,true)}/>}
      {savedMatch&&!lossOnExit&&<button disabled={busy||saveAvailable===undefined} onClick={resumeLocal}>{savedMatch.phase==='finished'?'결과 보기':'이어하기'}</button>}
      {!lossOnExit&&<LobbyDialog label="슬롯 · 성장 · 저장 경기">{slotManagementContent}</LobbyDialog>}</div><PlayLobby deck={deck} onClass={c=>{if(c!==deck.heroClass)editDeck(practiceDeck(catalog,c));}} botClass={botClass} setBotClass={setBotClass} difficulty={difficulty} setDifficulty={setDifficulty} code={code} setCode={setCode} onBegin={begin} onEdit={()=>openLobbyView('decks',true)} connected={connected} busy={busy} botEngine={botEngine} setBotEngine={setBotEngine} deviceMode={deviceMode} setDeviceMode={setDeviceMode} standalone={standalone} botStyle={botStyle} setBotStyle={setBotStyle} first={first} setFirst={setFirst} history={soloHistory} animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed} showPractice={!standalone||offlineMode==='developer'}/></div>:lobbyView==='slots'&&lossOnExit?<section className="preview-slot-only" aria-label="슬롯 선택"><div className="preview-slot-grid">{SOLO_SLOTS.map(value=><button type="button" key={value} className={value===slot?'chosen':'secondary'} disabled={busy||value===slot} onClick={()=>switchSlot(value)}>슬롯 {value}{value===slot?' · 선택됨':''}</button>)}</div></section>
    :lobbyView==='rank'&&lossOnExit?<PreviewRank profile={offlineProfile} growth={localGrowth}/>
    :lobbyView==='quests'&&lossOnExit?<PreviewQuestPlaceholder/>
    :lobbyView==='rewards'&&lossOnExit?<><PreviewRewards profile={offlineProfile} growth={localGrowth}/><div className="preview-reward-backups"><button className="secondary" disabled={busy||!growthReady} onClick={()=>void growthBackup()}>성장 기록 백업</button><button className="secondary" disabled={busy||!growthReady} onClick={()=>void growthBackup(undefined,true)}>성장+덱 통합 백업</button><BackupFilePicker label="미진행 슬롯에 성장 백업 복원" disabled={busy||!growthReady||offlineProfile?.revision!==0} onFile={file=>void growthBackup(file)} onError={setError}/></div></>
    :lobbyView==='developer'&&lossOnExit?<PreviewDeveloper mode={offlineMode} onMode={switchOfflineMode}>{localGrowth&&<OfflineDeveloperPanel growth={localGrowth} deck={deck} busy={busy} onStart={(rank,experiment)=>beginLocal(resolveSolo(soloSettings,random32()),deck,false,rank,experiment)}/>}</PreviewDeveloper>
    :lobbyView==='catalog'?<CardBrowser key={catalogFocus??'catalog'} focusCardId={catalogFocus} unreadIds={lossOnExit?unreadCards:[]} onViewed={lossOnExit?onViewNewCard:undefined} ownedCards={lossOnExit&&offlineMode==='player'?(offlineProfile?.ownedCards??[]):undefined}/>:lobbyView==='decks'?<DeckWorkspace key={previewEditHero??'choose'} previewSimple={lossOnExit} initialClass={previewEditHero??undefined} initialScreen={lossOnExit?(previewEditHero?'saved':'classes'):'classes'} storage={storage} onPlay={()=>openLobbyView('play',true)} deck={deck} setDeck={editDeck} undo={undo} undoAvailable={undoDecks.length>0} draftStored={draftStored} ownedCards={standalone?(offlineMode==='player'?offlineProfile?.ownedCards:undefined):account?.profile.ownedCards} forceOwned={standalone&&offlineMode==='player'}/>:null}
    </>}
    </div>
    <footer>독자 카드 {Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false).length}종 · 9개 직업 · 개발 중인 테스트 버전<small className="reference-notice">자체 제작 일러스트 · 인터넷 이미지 요청 없음</small></footer>
  </main>;
}
