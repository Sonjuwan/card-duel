import type { ReactNode, RefObject, KeyboardEvent } from 'react';
import type { Card, Catalog } from '../../../packages/engine/src/index.ts';
import { CardInspector } from './battle-pieces.tsx';
import type { Inspectable } from './battle-pieces.tsx';
import { LocalCardArt } from './local-art.tsx';
import { collectionNavigation } from './table-visuals.ts';

/** A visible spread has two leaves, each three columns by two rows. */
export function CollectionBook<T extends Card>({cards,renderCard}:{cards:readonly T[];renderCard:(card:T)=>ReactNode}){
  const navigate=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!(event.target instanceof HTMLElement)||!event.target.matches('button.battle-card'))return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const controls=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button.battle-card')];
    const next=collectionNavigation(event.key,controls.indexOf(event.target as HTMLButtonElement),controls.map(card=>card.getBoundingClientRect()));
    if(next!==null){event.preventDefault();event.stopPropagation();controls[next].focus();}
  };
  return <div className="collection classic-collection collection-book" role="group" aria-label="카드책 펼침" aria-description="방향키로 카드 이동, Home과 End로 첫 카드와 마지막 카드 이동" onKeyDown={navigate}>
    {cards.length===0?<p className="empty-collection">검색 결과가 없습니다. 검색어나 필터를 바꿔 보세요.</p>:
      [0,1].map(leaf=><div key={leaf} className="collection-leaf" data-book-page={leaf===0?'left':'right'} aria-label={leaf===0?'왼쪽 페이지':'오른쪽 페이지'}>{cards.slice(leaf*6,leaf*6+6).map(c=>renderCard(c))}{Array.from({length:Math.max(0,6-cards.slice(leaf*6,leaf*6+6).length)},(_,i)=><span key={`empty-${i}`} className="collection-blank" aria-hidden="true"/>)}</div>)}
  </div>;
}

/** Shared by the read-only collection and deck editor; a detail action never
 * changes the deck. Older mobile browsers fall back to the inline inspector. */
export function showCollectionDetail(dialog:HTMLDialogElement|null,sidebar:HTMLElement|null){
  if(!window.matchMedia('(max-width:820px)').matches)return;
  if(dialog&&typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}
  else sidebar?.scrollIntoView({block:'nearest'});
}
export function CollectionDetailDialog({dialogRef,item,catalog}:{dialogRef:RefObject<HTMLDialogElement|null>;item:Inspectable|null;catalog:Catalog}){
  return <dialog ref={dialogRef} className="collection-detail-dialog" aria-label="카드 확대 상세"><div className="collection-detail-header"><h3>카드 확대 상세</h3><button type="button" className="secondary" onClick={()=>dialogRef.current?.close()}>닫기</button></div>{item&&<><div className="collection-detail-art"><LocalCardArt card={item.card}/></div><CardInspector item={item} catalog={catalog}/></>}</dialog>;
}
