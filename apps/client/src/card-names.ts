import {createContext,useContext} from 'react';
import type {Card,Catalog} from '../../../packages/engine/src/index.ts';
import {REFERENCE_CARDS} from './reference-art-data.ts';
import {keywords,tribes} from './data.ts';

/** The player UI uses classic labels while engine data retains original names. */
export const ClassicNamesContext=createContext(true);
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


const historyNames=new WeakMap<Catalog,{names:Map<string,string>;pattern:RegExp}>();
/** Translate names already present in public history without changing saves. */
export function classicHistoryText(text:string,catalog:Catalog):string{
  let labels=historyNames.get(catalog);
  if(!labels){
    const names=new Map(Object.values(catalog).flatMap(card=>{
      const name=displayCardName(card,true);
      return name===card.name?[]:[[card.name,name] as const];
    }));
    const escaped=[...names.keys()].sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    if(!escaped.length)return text;
    labels={names,pattern:new RegExp(escaped.join('|'),'gu')};
    historyNames.set(catalog,labels);
  }
  return text.replace(labels.pattern,name=>labels.names.get(name)??name);
}
