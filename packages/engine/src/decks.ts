import type { Card, Catalog, Deck, HeroClass } from './types.ts';
import { validateDeck } from './engine.ts';
import { HERO_CLASSES, RULES, requireRule, record,maxCardCopies } from './rules.ts';
export function deckCards(catalog:Catalog,heroClass:HeroClass):Exclude<Card,{kind:'coin'}>[] {
  return Object.values(catalog).filter((c):c is Exclude<Card,{kind:'coin'}>=>c.kind!=='coin'&&c.collectible!==false&&(c.class==='neutral'||c.class===heroClass)).sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id));
}
export function starterDeck(catalog:Catalog,heroClass:HeroClass):Deck {
  const legal=deckCards(catalog,heroClass).filter(c=>c.rarity!=='legendary'),chosen=legal.filter(c=>c.class===heroClass).slice(0,7);
  const neutral=legal.filter(c=>c.class==='neutral');
  for(const max of [1,2,3,4,5,6,7,8,9,10]){
    if(chosen.length>=15)break;
    const next=neutral.find(c=>c.cost===max&&!chosen.includes(c));if(next)chosen.push(next);
  }
  for(const c of neutral){if(chosen.length>=15)break;if(!chosen.includes(c))chosen.push(c);}
  const deck:Deck={heroClass,cards:chosen.flatMap(c=>[c.id,c.id])};validateDeck(deck,catalog);return deck;
}

/** Preserve saved decks from old catalog versions. Repair is explicit and never
 * mutates the input; the user can fill the remaining slots in the editor. */
export function repairDeck(catalog:Catalog,raw:unknown):{deck:Deck;discarded:string[]} {
  requireRule(record(raw)&&HERO_CLASSES.some(c=>c===raw.heroClass)&&Array.isArray(raw.cards)&&raw.cards.length<=RULES.deckSize&&raw.cards.every(id=>typeof id==='string'),'잘못된 덱 정보');
  const heroClass=raw.heroClass as HeroClass,legal=new Set(deckCards(catalog,heroClass).map(c=>c.id));
  const cards:string[]=[],discarded:string[]=[],counts=new Map<string,number>();
  for(const id of raw.cards as string[]){const count=counts.get(id)??0;if(!legal.has(id)||count>=maxCardCopies(catalog[id])){discarded.push(id);continue;}cards.push(id);counts.set(id,count+1);}
  return{deck:{heroClass,cards},discarded};
}
export function manaCurve(catalog:Catalog,deck:Deck):number[]{
  const values=Array<number>(11).fill(0);for(const id of deck.cards){const c=catalog[id];if(c?.kind!=='coin'&&c&&Number.isInteger(c.cost)&&c.cost>=0)values[Math.min(10,c.cost)]++;}return values;
}
export function exportDeckCode(catalog:Catalog,deck:Deck):string {
  validateDeck(deck,catalog);return JSON.stringify({v:1,heroClass:deck.heroClass,cards:deck.cards});
}
export function importDeckCode(catalog:Catalog,code:string):Deck {
  requireRule(typeof code==='string'&&code.length<=8192,'덱 공유 코드가 너무 깁니다.');
  let raw:unknown;try{raw=JSON.parse(code);}catch{requireRule(false,'덱 공유 코드 형식이 올바르지 않습니다.');}
  requireRule(record(raw)&&raw.v===1,'지원하지 않는 덱 공유 코드입니다.');
  const deck={heroClass:raw.heroClass,cards:raw.cards} as Deck;validateDeck(deck,catalog);return deck;
}
