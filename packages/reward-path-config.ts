import {HERO_CLASSES} from './engine/src/index.ts';
import type {Card, HeroClass, Rarity} from './engine/src/index.ts';
import type {CardUnlock, RewardPath} from './account-protocol.ts';
import {ORIGINAL_REWARD_PATH, rewardPathId} from './reward-road.ts';
import configuredPaths from '../data/progression/reward-paths.json' with {type:'json'};

const rarities = ['basic','common','rare','epic','legendary'] as const;
type DeckCard = Exclude<Card,{kind:'coin'}>;
type CardClass = HeroClass | 'neutral';
export interface RewardPathDefinition {
  id: string;
  name: string;
  cardIds?: readonly string[];
  order: Partial<Record<Rarity,Partial<Record<CardClass,readonly string[]>>>>;
  xpCosts?: Readonly<Record<string,number>>;
  afterCompletion: RewardPath['afterCompletion'];
}
export const DEFAULT_REWARD_PATHS: readonly RewardPathDefinition[] = configuredPaths as RewardPathDefinition[];

function orderCards(cards: DeckCard[], order: RewardPathDefinition['order']): DeckCard[] {
  const byId = new Map(cards.map(card=>[card.id,card]));
  const result: DeckCard[] = [];
  for (const rarity of rarities) {
    const queues = [...HERO_CLASSES,'neutral' as const].map(hero=>{
      const ids = order[rarity]?.[hero] ?? [];
      const seen = new Set<string>();
      const predefined: DeckCard[] = [];
      for (const id of ids) {
        if (seen.has(id)) throw Error(`Duplicate reward card: ${id}`);
        seen.add(id);
        const card = byId.get(id);
        if (!card) continue;
        if (card.rarity !== rarity || card.class !== hero) throw Error(`Reward card in wrong queue: ${id}`);
        predefined.push(card);
      }
      const unlisted = cards.filter(card=>card.rarity===rarity && card.class===hero && !seen.has(card.id));
      return [...predefined,...unlisted.sort((a,b)=>a.id.localeCompare(b.id))];
    });
    const neutral = queues.pop()!;
    const rounds = Math.max(1,...queues.map(queue=>queue.length));
    for (let round=0;round<rounds;round++) {
      for (const queue of queues) if (queue[round]) result.push(queue[round]);
      const from = Math.floor(round*neutral.length/rounds);
      const to = Math.floor((round+1)*neutral.length/rounds);
      result.push(...neutral.slice(from,to));
    }
  }
  return result;
}

// Keep the first two card milestones and the original completion XP. With all
// Basic cards granted immediately, distribute the remaining milestones across
// the existing XP curve.
function originalXpCosts(cardCount:number,legacy:readonly CardUnlock[]) {
  if(cardCount<3||cardCount>=legacy.length)return legacy.map((card,i)=>card.xp-(legacy[i-1]?.xp??0));
  const milestones=Array.from({length:cardCount},(_,i)=>{
    const previousIndex=i<2?i:1+Math.floor((i-1)*(legacy.length-2)/(cardCount-2));
    return legacy[previousIndex].xp;
  });
  return milestones.map((xp,i)=>xp-(milestones[i-1]??0));
}

export function buildRewardPaths(
  cards: DeckCard[],
  starter: ReadonlySet<string>,
  legacyXp: readonly CardUnlock[],
  xpCost: (power:number)=>number,
  overrides: Readonly<Record<string,number>>,
  definitions: readonly RewardPathDefinition[]
): RewardPath[] {
  const [original,...expansions] = definitions;
  if (original?.id !== ORIGINAL_REWARD_PATH || original.cardIds) throw Error('Original reward path must be registered first');
  const usedSets = new Set<string>();
  const usedCards = new Set<string>();
  const catalogIds = new Set(cards.map(card=>card.id));
  for (const path of definitions) {
    if (!rewardPathId(path.id) || usedSets.has(path.id) || !path.name.trim()
      || !['accumulate','cap'].includes(path.afterCompletion)) throw Error(`Invalid reward path: ${path.id}`);
    usedSets.add(path.id);
  }
  for (const path of expansions) {
    if (!path.cardIds?.length) throw Error(`Missing cards for reward path: ${path.id}`);
    for (const id of path.cardIds) {
      if (!catalogIds.has(id) || usedCards.has(id)) throw Error(`Invalid or duplicate reward set card: ${id}`);
      usedCards.add(id);
    }
  }
  return definitions.map(path=>{
    const assigned = path.cardIds ? new Set(path.cardIds) : undefined;
    const members = cards.filter(card=>assigned ? assigned.has(card.id) : !usedCards.has(card.id));
    const pathCards = orderCards(members.filter(card=>!starter.has(card.id)),path.order);
    const originalCosts=path.id===ORIGINAL_REWARD_PATH?originalXpCosts(pathCards.length,legacyXp):[];
    let xp = 0;
    const unlocks = pathCards.map((card,index)=>{
      const power = overrides[card.id] ?? 2+Math.floor(index*24/pathCards.length);
      const cost = path.xpCosts?.[card.id] ?? originalCosts[index] ?? xpCost(power);
      if (!Number.isSafeInteger(cost) || cost < 1 || !Number.isSafeInteger(xp+cost)) throw Error(`Invalid reward XP: ${card.id}`);
      xp += cost;
      return {cardId:card.id,power,xp};
    });
    return {id:path.id,name:path.name,cardIds:members.map(card=>card.id).sort(),unlocks,afterCompletion:path.afterCompletion};
  });
}
