import type {AccountProfile, GrowthView} from './account-protocol.ts';
import {basicDeck} from './basic-decks.ts';
import {rewardPaths} from './reward-road.ts';
import {cardRoles} from './engine/src/deck-strategies.ts';
import {deckCards,maxCardCopies,validateDeck} from './engine/src/index.ts';
import type {Card,Catalog,Deck,HeroClass} from './engine/src/index.ts';

type DeckCard = Exclude<Card,{kind:'coin'}>;
const bucket = (card:DeckCard) => Math.min(7,card.cost);
const earlyBody = (card:DeckCard) => Number(card.kind==='minion' && card.cost<=3 && !card.noAttack);

export function collectionBotDeck(catalog:Catalog,growth:GrowthView,heroClass:HeroClass,profile:Pick<AccountProfile,'ownedCards'>):Deck {
  const deck = basicDeck(catalog,heroClass);
  const owned = new Set(profile.ownedCards);
  const pool = deckCards(catalog,heroClass).filter(card=>owned.has(card.id));
  const available = new Map(pool.map(card=>[card.id,card]));
  const unlockOrder = rewardPaths(growth).flatMap(path=>path.unlocks.map(card=>card.cardId));
  const order = new Map(unlockOrder.map((id,index)=>[id,index]));
  const candidates = pool.filter(card=>card.rarity!=='basic').sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity)||a.id.localeCompare(b.id));
  if (!candidates.length) return deck;

  const cards = deck.cards.map(id=>catalog[id] as DeckCard);
  const role = new Map(pool.map(card=>[card.id,cardRoles(card,catalog)]));
  const targetCurve = Array<number>(8).fill(0);
  const counts = new Map<string,number>();
  for (const card of cards) {
    targetCurve[bucket(card)]++;
    counts.set(card.id,(counts.get(card.id)??0)+1);
    if (!role.has(card.id)) role.set(card.id,cardRoles(card,catalog));
  }
  const curve = [...targetCurve];
  let early = cards.reduce((count,card)=>count+earlyBody(card),0);
  const minimumEarly = Math.max(0,early-2);
  const coverage = (card:DeckCard) => {
    const info = role.get(card.id)!;
    return [
      Number(info.removal>=2.5),
      Number(info.removal>=4.5 && card.kind!=='weapon'),
      Number(info.draw>=1),
      Number(card.cost>=5 && info.reach+info.value+info.tempo>=6)
    ];
  };
  const coverageTargets = cards.map(coverage).reduce((sum,row)=>sum.map((x,i)=>x+row[i]),[0,0,0,0]);
  let covered = [...coverageTargets];
  const curveLoss = (index:number,change:number) => Math.abs(curve[index]+change-targetCurve[index])-Math.abs(curve[index]-targetCurve[index]);
  const value = (card:DeckCard,other:DeckCard) => {
    const r = role.get(card.id)!;
    const tribe = card.kind==='minion' ? card.tribe : 'none';
    const allies = tribe==='none' ? 0 : cards.filter(c=>c.kind==='minion'&&c.tribe===tribe).length-Number(other.kind==='minion'&&other.tribe===tribe);
    const classBonus = card.class===heroClass ? .3+.06*r.synergy : 0;
    return (r.tempo*.8+r.removal*.65+r.draw*.8+r.sustain*.32+r.reach*.36+r.value*.65)/(1+card.cost*.32)
      +classBonus+Math.min(4,allies)*.11;
  };

  for (const candidate of candidates) {
    const nextCoverage = coverage(candidate);
    while ((counts.get(candidate.id)??0)<maxCardCopies(candidate)) {
      let best = -1, bestGain = .25;
      const newBucket = bucket(candidate);
      for (const [index,current] of cards.entries()) {
        if (candidate.id===current.id || early+earlyBody(candidate)-earlyBody(current)<minimumEarly) continue;
        const oldBucket = bucket(current);
        const nextCurveLoss = oldBucket===newBucket ? 0 : curveLoss(oldBucket,-1)+curveLoss(newBucket,1);
        const oldCoverage = coverage(current);
        const coverageGain = nextCoverage.reduce((score,amount,i)=>{
          const target = coverageTargets[i];
          return score+Math.min(target+1,covered[i]+amount-oldCoverage[i])-Math.min(target+1,covered[i]);
        },0);
        const gain = value(candidate,current)-value(current,current)+coverageGain*.45
          -nextCurveLoss*.36-Math.abs(candidate.cost-current.cost)*.22-(counts.get(candidate.id)??0)*.18;
        if (gain>bestGain) { best=index;bestGain=gain; }
      }
      if (best<0) break;
      const old = cards[best];
      const oldCoverage = coverage(old);
      covered = covered.map((value,i)=>value+nextCoverage[i]-oldCoverage[i]);
      curve[bucket(old)]--;
      curve[newBucket]++;
      early += earlyBody(candidate)-earlyBody(old);
      counts.set(old.id,counts.get(old.id)!-1);
      counts.set(candidate.id,(counts.get(candidate.id)??0)+1);
      cards[best] = candidate;
    }
  }
  deck.cards = cards.map(card=>card.id);
  validateDeck(deck,catalog);
  if (deck.cards.some(id=>!available.has(id))) throw Error('AI 덱에 미보유 카드가 있습니다.');
  return deck;
}
