import type { ReactNode } from 'react';
import type { Card } from '../../../packages/engine/src/index.ts';

/** A visible spread has two leaves, each three columns by two rows. */
export function CollectionBook<T extends Card>({cards,renderCard}:{cards:readonly T[];renderCard:(card:T)=>ReactNode}){
  return <div className="collection classic-collection collection-book" aria-label="카드책 펼침">
    {cards.length===0?<p className="empty-collection">검색 결과가 없습니다. 검색어나 필터를 바꿔 보세요.</p>:
      [0,1].map(leaf=><div key={leaf} className="collection-leaf" data-book-page={leaf===0?'left':'right'} aria-label={leaf===0?'왼쪽 페이지':'오른쪽 페이지'}>{cards.slice(leaf*6,leaf*6+6).map(c=>renderCard(c))}{Array.from({length:Math.max(0,6-cards.slice(leaf*6,leaf*6+6).length)},(_,i)=><span key={`empty-${i}`} className="collection-blank" aria-hidden="true"/>)}</div>)}
  </div>;
}
