import {useRef} from 'react';
import type { ReactNode, RefObject, KeyboardEvent } from 'react';
import type { Card, Catalog } from '../../../packages/engine/src/index.ts';
import { BattleCard, CardInspector } from './battle-pieces.tsx';
import type { Inspectable } from './battle-pieces.tsx';
import { HERO_CLASSES } from '../../../packages/engine/src/index.ts';
import type { HeroClass } from '../../../packages/engine/src/index.ts';
import { className } from './data.ts';
import { collectionNavigation } from './table-visuals.ts';

export function useBookSize(){return 8;}

export const bookClasses=[...HERO_CLASSES,'neutral'] as const;
const initials=['전','주','도','성','냥','드','흑','마','사','공'];
type BookClass=HeroClass|'neutral';
export function BookTabs({classes=bookClasses,active,onClass}:{classes?:readonly BookClass[];active?:string;onClass:(key:BookClass)=>void}){
  return <nav className="book-class-tabs" aria-label="카드 직업">{classes.map(key=>
    <button type="button" key={key} className={`faction-${key}`} aria-label={key==='neutral'?'공용':className[key]} aria-pressed={active===key} onClick={()=>onClass(key)}>{initials[bookClasses.indexOf(key)]}</button>
  )}</nav>;
}
export function ManaFilter({value,onChange}:{value:string;onChange:(value:string)=>void}){
  return <div className="book-mana-filter" role="group" aria-label="카드 비용">
    {['all',...Array.from({length:10},(_,i)=>String(i)),'10plus'].map(key=><button key={key} type="button" aria-pressed={value===key} aria-label={key==='all'?'전체 마나':key==='10plus'?'10마나 이상':`${key}마나`} onClick={()=>onChange(key)}>{key==='all'?'전체':key==='10plus'?'10+':key}</button>)}
  </div>;
}

type BookNavigation={page:number;pages:number;label:string;onPage:(page:number)=>void};
export function CollectionBook<T extends Card>({cards,renderCard,size=8,paging,continuous=false}:{cards:readonly T[];renderCard:(card:T)=>ReactNode;size?:number;paging?:BookNavigation;continuous?:boolean}){
  const perLeaf=size/2;
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  const navigate=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!(event.target instanceof HTMLElement)||!event.target.matches('button.battle-card'))return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const controls=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button.battle-card')];
    const next=collectionNavigation(event.key,controls.indexOf(event.target as HTMLButtonElement),controls.map(card=>card.getBoundingClientRect()));
    if(next!==null){event.preventDefault();event.stopPropagation();controls[next].focus();}
  };
  const turn=(direction:number)=>{
    const next=paging?paging.page+direction:-1;
    if(paging&&next>=0&&next<paging.pages)paging.onPage(next);
  };
  return <div className={`collection-spread${continuous?' deck-card-scroll':''}`} onKeyDown={event=>{
    if(paging&&event.target instanceof HTMLElement&&event.target.matches('.book-edge')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();turn(event.key==='ArrowLeft'?-1:1);}
  }}>
  {paging&&<button type="button" className="book-edge secondary" disabled={paging.page===0} onClick={()=>turn(-1)} aria-label="이전 페이지">◀</button>}
  <div className={`collection classic-collection collection-book${continuous?' collection-continuous':''}`} data-book-size={size} onTouchStart={event=>{
      const touch=event.touches[0];
      swipeStart.current=event.touches.length===1?{x:touch.clientX,y:touch.clientY}:null;
    }} onTouchCancel={()=>{swipeStart.current=null;}} onTouchEnd={event=>{
      const start=swipeStart.current;
      swipeStart.current=null;
      if(!start||event.touches.length)return;
      const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
      if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)turn(dx<0?1:-1);
    }} role="group" aria-label="카드책 펼침" aria-description="방향키로 카드 이동, Home과 End로 첫 카드와 마지막 카드 이동" onKeyDown={navigate}>
    {cards.length===0?<p className="empty-collection">검색 결과가 없습니다. 검색어나 필터를 바꿔 보세요.</p>:
      continuous?cards.map(renderCard):[0,1].map(leaf=><div key={`${paging?.page??0}:${leaf}`} className="collection-leaf" data-book-page={leaf===0?'left':'right'} aria-label={leaf===0?'왼쪽 페이지':'오른쪽 페이지'}>{cards.slice(leaf*perLeaf,leaf*perLeaf+perLeaf).map(c=>renderCard(c))}{Array.from({length:Math.max(0,perLeaf-cards.slice(leaf*perLeaf,leaf*perLeaf+perLeaf).length)},(_,i)=><span key={`empty-${i}`} className="collection-blank" aria-hidden="true"/>)}</div>)}
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
