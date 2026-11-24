import {useSyncExternalStore} from 'react';
import type { ReactNode, RefObject, KeyboardEvent } from 'react';
import type { Card, Catalog } from '../../../packages/engine/src/index.ts';
import { BattleCard, CardInspector } from './battle-pieces.tsx';
import type { Inspectable } from './battle-pieces.tsx';
import { collectionNavigation } from './table-visuals.ts';

const compactBook='(orientation:landscape) and (max-height: 700px)';
const phoneBook='(orientation:landscape) and (max-height: 480px)';
function subscribeBook(callback:()=>void){
  const media=[compactBook,phoneBook].map(query=>window.matchMedia(query));
  media.forEach(query=>query.addEventListener('change',callback));
  return ()=>media.forEach(query=>query.removeEventListener('change',callback));
}
export function useBookSize(){
  return useSyncExternalStore(subscribeBook,()=>window.matchMedia(phoneBook).matches?4:window.matchMedia(compactBook).matches?4:8,()=>8);
}

type BookNavigation={page:number;pages:number;label:string;onPage:(page:number)=>void};
export function CollectionBook<T extends Card>({cards,renderCard,size=8,paging}:{cards:readonly T[];renderCard:(card:T)=>ReactNode;size?:number;paging?:BookNavigation}){
  const perLeaf=size/2;
  const navigate=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!(event.target instanceof HTMLElement)||!event.target.matches('button.battle-card'))return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const controls=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button.battle-card')];
    const next=collectionNavigation(event.key,controls.indexOf(event.target as HTMLButtonElement),controls.map(card=>card.getBoundingClientRect()));
    if(next!==null){event.preventDefault();event.stopPropagation();controls[next].focus();}
  };
  const turn=(direction:number)=>paging?.onPage(Math.min(paging.pages-1,Math.max(0,paging.page+direction)));
  return <div className="collection-spread" onKeyDown={event=>{
    if(paging&&event.target instanceof HTMLElement&&event.target.matches('.book-edge')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();turn(event.key==='ArrowLeft'?-1:1);}
  }}>
  {paging&&<button type="button" className="book-edge secondary" disabled={paging.page===0} onClick={()=>turn(-1)} aria-label="이전 페이지">◀</button>}
  <div className="collection classic-collection collection-book" data-book-size={size} role="group" aria-label="카드책 펼침" aria-description="방향키로 카드 이동, Home과 End로 첫 카드와 마지막 카드 이동" onKeyDown={navigate}>
    {cards.length===0?<p className="empty-collection">검색 결과가 없습니다. 검색어나 필터를 바꿔 보세요.</p>:
      [0,1].map(leaf=><div key={leaf} className="collection-leaf" data-book-page={leaf===0?'left':'right'} aria-label={leaf===0?'왼쪽 페이지':'오른쪽 페이지'}>{cards.slice(leaf*perLeaf,leaf*perLeaf+perLeaf).map(c=>renderCard(c))}{Array.from({length:Math.max(0,perLeaf-cards.slice(leaf*perLeaf,leaf*perLeaf+perLeaf).length)},(_,i)=><span key={`empty-${i}`} className="collection-blank" aria-hidden="true"/>)}</div>)}
  </div>
  {paging&&<button type="button" className="book-edge secondary" disabled={paging.page>=paging.pages-1} onClick={()=>turn(1)} aria-label="다음 페이지">▶</button>}
  {paging&&<span className="book-page-status" role="status" aria-live="polite" aria-atomic="true">{paging.label}</span>}
  </div>;
}

/** Shared by the read-only collection and deck editor; a detail action never
 * changes the deck. Older mobile browsers fall back to the inline inspector. */
export function showCollectionDetail(dialog:HTMLDialogElement|null,sidebar:HTMLElement|null){
  if(dialog&&typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}
  else sidebar?.scrollIntoView({block:'nearest'});
}
export function CollectionDetailDialog({dialogRef,item,catalog}:{dialogRef:RefObject<HTMLDialogElement|null>;item:Inspectable|null;catalog:Catalog}){
  return <dialog ref={dialogRef} className="collection-detail-dialog" aria-label="카드 확대 상세"><div className="collection-detail-header"><h3>카드 확대 상세</h3><button type="button" className="secondary" onClick={()=>dialogRef.current?.close()}>닫기</button></div>{item&&<><div className="collection-detail-body"><div className="collection-detail-card"><BattleCard card={item.card}/></div><CardInspector item={item} catalog={catalog}/></div></>}</dialog>;
}
