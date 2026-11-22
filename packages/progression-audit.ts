import {HERO_CLASSES,botSearchConfig} from './engine/src/index.ts';
import type {Catalog} from './engine/src/index.ts';
import type {GrowthView} from './account-protocol.ts';
import {deckPowerTotal,rankedBotDeck} from './progression.ts';

export const RANK_AUDIT_SEEDS=[0,42,123,0xffffffff] as const;
export type RankDeckAudit={
  rank:number;deckPower:number;intelligence:number;minimum:number;maximum:number;mean:number;
  increased:number;unchanged:number;decreased:number;search:ReturnType<typeof botSearchConfig>|null;
};
export interface RankedDeckAudit{checked:number;seeds:number[];compared:number;increased:number;unchanged:number;decreased:number;rows:RankDeckAudit[]}
/** Configuration-level evidence, not a prediction of actual wins. Compare
 * identical class/seed pairs across adjacent ranks. Keep custom rank tuning
 * possible; plateaus and regressions are visible, not silently overridden. */
export function auditRankedDecks(catalog:Catalog,growth:GrowthView):RankedDeckAudit{
  const powers=new Map(growth.unlocks.map(card=>[card.cardId,card.power])),starter=new Set(growth.starterIds),previous=new Map<string,number>(),rows:RankDeckAudit[]=[];
  let checked=0,increased=0,unchanged=0,decreased=0;
  for(const rank of growth.ranks){
    const totals:number[]=[];let more=0,equal=0,less=0;
    for(const seed of RANK_AUDIT_SEEDS)for(const hero of HERO_CLASSES){
      const deck=rankedBotDeck(catalog,growth,hero,rank.deckPower,seed);
      if(deck.cards.some(id=>!starter.has(id)&&((powers.get(id)??Infinity)>rank.deckPower)))throw new Error('랭크 AI 덱에 해당 단계보다 높은 카드가 있습니다.');
      const total=deckPowerTotal(deck,growth),key=seed+':'+hero,last=previous.get(key);totals.push(total);previous.set(key,total);checked++;
      if(last!==undefined){if(total>last)more++;else if(total===last)equal++;else less++;}
    }
    increased+=more;unchanged+=equal;decreased+=less;
    rows.push({rank:rank.rank,deckPower:rank.deckPower,intelligence:rank.intelligence,minimum:Math.min(...totals),maximum:Math.max(...totals),mean:Math.round(totals.reduce((a,b)=>a+b,0)/totals.length*10)/10,increased:more,unchanged:equal,decreased:less,search:rank.intelligence>=6?botSearchConfig(rank.intelligence):null});
  }
  return {checked,seeds:[...RANK_AUDIT_SEEDS],compared:increased+unchanged+decreased,increased,unchanged,decreased,rows};
}
