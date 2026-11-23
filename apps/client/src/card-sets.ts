import type { Card } from '../../../packages/engine/src/index.ts';
import { maxCardCopies } from '../../../packages/engine/src/index.ts';
import { HISTORICAL_BASIC, HISTORICAL_ORIGINAL } from './card-set-data.ts';
import { displayCardName } from './card-names.ts';
export type CardSet='basic'|'original'|'token';
export type CardSetFilter='all'|'basic'|'original';
export function cardSet(card:Card):CardSet{
  if(card.kind==='coin'||card.collectible===false)return'token';
  if(HISTORICAL_BASIC.has(card.id))return'basic';
  if(HISTORICAL_ORIGINAL.has(card.id))return'original';
  // Newly authored cards have no historical set; classify by their chosen rarity.
  return card.rarity==='basic'?'basic':'original';
}
export function matchesCardSet(card:Card,filter:CardSetFilter){return filter==='all'||cardSet(card)===filter;}
export function cardSetLabel(card:Card){return cardSet(card)==='basic'?'기본 카드':cardSet(card)==='original'?'오리지널 카드':'생성 카드';}
// Presentation only: preserve the catalog and engine's deck order.
const cardNameCollator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
export function sortCardsForDisplay<T extends Card>(cards:readonly T[],classicNames=true):T[]{
  return [...cards].sort((a,b)=>a.cost-b.cost||cardNameCollator.compare(displayCardName(a,classicNames),displayCardName(b,classicNames))||a.id.localeCompare(b.id));
}
export function deckAddReason(card:Card,deckSize:number,copies:number):string|undefined{
  const limit=maxCardCopies(card);
  if(copies>=limit)return `동일 카드 최대 ${limit}장`;
  if(deckSize>=30)return '덱이 30장으로 찼습니다.';
}
