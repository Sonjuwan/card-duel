import {createContext,useContext} from 'react';
import type {Card} from '../../../packages/engine/src/index.ts';
import {REFERENCE_CARDS} from './reference-art-data.ts';
import {keywords,tribes} from './data.ts';

/** Names can be switched without changing the underlying card id or art. */
export const ClassicNamesContext=createContext(false);
export function displayCardName(card:Card,classic:boolean):string{
  return classic?(REFERENCE_CARDS[card.id]?.name??card.name):card.name;
}
export function useCardName(card:Card):string{return displayCardName(card,useContext(ClassicNamesContext));}

// Search both names regardless of the display preference, and accept words in any order.
const normalizeSearch=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().trim();
export function cardSearchTerms(query:string):string[]{return normalizeSearch(query).split(/\s+/u).filter(Boolean);}
export function matchesCardSearch(card:Card,terms:readonly string[]):boolean{
  if(!terms.length)return true;
  const fields=[card.id,card.name,displayCardName(card,true)];
  if(card.kind!=='coin')fields.push(card.description);
  if(card.kind==='minion'){
    fields.push(tribes[card.tribe],...((card.keywords??[]).map(k=>keywords[k])));
    if(card.battlecry?.length)fields.push('전투의 함성');
    if(card.deathrattle?.length)fields.push('죽음의 메아리');
  }
  if(card.kind==='weapon'&&card.battlecry?.length)fields.push('전투의 함성');
  const normalized=fields.map(field=>normalizeSearch(field).replace(/[\s_-]+/gu,''));
  return terms.every(term=>normalized.some(field=>field.includes(term.replace(/[\s_-]+/gu,''))));
}
