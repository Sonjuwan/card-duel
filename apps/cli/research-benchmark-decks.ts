import { deckCards, maxCardCopies, validateDeck } from '../../packages/engine/src/index.ts';
import type { Card, Catalog, Deck, Effect, HeroClass } from '../../packages/engine/src/index.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';

// Counts of minions and other cards at 0–1, 2, 3–4, 5–6, and 7+ mana.
const recipes: Record<ResearchStrategy, readonly (readonly [number, number])[]> = {
  aggro: [[6, 2], [8, 3], [6, 3], [1, 1], [0, 0]],
  midrange: [[3, 1], [5, 2], [9, 3], [4, 2], [1, 0]],
  control: [[1, 2], [2, 4], [3, 6], [3, 5], [3, 1]],
  'big-deck': [[2, 2], [2, 3], [3, 4], [4, 2], [7, 1]],
};

export const RESEARCH_SPLITS = ['development', 'holdout'] as const;
export type ResearchSplit = typeof RESEARCH_SPLITS[number];
export const researchSplitSeed = { development: 179424673, holdout: 15485863 } satisfies Record<ResearchSplit, number>;
const manaBand = (cost: number) => cost <= 1 ? 0 : cost === 2 ? 1 : cost <= 4 ? 2 : cost <= 6 ? 3 : 4;

function priority(card: Card, strategy: ResearchStrategy): number {
  if (card.kind === 'minion') {
    const stats = (card.attack + card.health) / (2 + card.cost);
    if (strategy === 'aggro') return stats + .5 * Number(card.keywords?.includes('charge'));
    if (strategy === 'control') return stats + .5 * Number(card.keywords?.includes('taunt'));
    if (strategy === 'big-deck') return .14 * (card.attack + card.health) + .3 * Number(!!card.deathrattle);
    return stats + .35 * Number(!!card.battlecry);
  }
  if (card.kind === 'weapon') return card.attack * (strategy === 'aggro' ? .48 : .29);
  const kinds = new Set('effects' in card ? card.effects?.map(effect => effect.kind) : []);
  const preferred: Effect['kind'][] = strategy === 'aggro' ? ['damage', 'buff', 'heroAttack']
    : strategy === 'midrange' ? ['damage', 'buff', 'summon']
    : strategy === 'control' ? ['destroy', 'damage', 'heal', 'armor', 'draw', 'freeze', 'brawl']
    : ['gainCrystal', 'gainMana', 'draw', 'heal', 'destroy'];
  return preferred.filter(kind => kinds.has(kind)).length * .65;
}

/** The fixtures use separate quotas and selection rules from the AI's reference decks. */
export function benchmarkDeck(catalog: Catalog, heroClass: HeroClass, strategy: ResearchStrategy, split: ResearchSplit | 'release' | 'confirmation', seed: number): Deck {
  let state = seed >>> 0;
  const pool = deckCards(catalog, heroClass);
  // Distinct reserved slots keep the release fixtures outside both training holdouts.
  const anchorIndex = split === 'development' ? 0 : split === 'holdout' ? 1 : split === 'release' ? 2 : 3;
  const required = Math.max(2, anchorIndex + 1);
  const anchors = pool.filter(card => card.kind === 'minion' && manaBand(card.cost) === 2 && card.attack >= 2).slice(0, required);
  if (anchors.length < required) throw new Error(`Not enough mid-curve minions for the ${heroClass} validation fixtures`);
  const anchor = anchors[anchorIndex];
  const excluded = new Set(anchors.filter(card => card !== anchor).map(card => card.id));
  const ranked = pool.filter(card => !excluded.has(card.id)).map(card => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const score = priority(card, strategy) + .25 * Number(card.class === heroClass) + 1.5 * state / 2 ** 32;
    return { card, score };
  }).sort((a, b) => b.score - a.score).map(entry => entry.card);

  const cards = [anchor.id];
  const counts = new Map<string, number>([[anchor.id, 1]]);
  const take = (pool: readonly Card[], count: number) => {
    for (const copies of [1, 2]) {
      for (const card of pool) {
        if (count <= 0) return;
        const used = counts.get(card.id) ?? 0;
        if (used >= Math.min(maxCardCopies(card), copies)) continue;
        counts.set(card.id, used + 1);
        cards.push(card.id);
        count--;
      }
    }
  };

  for (const [band, [minions, support]] of recipes[strategy].entries()) {
    const pool = ranked.filter(card => manaBand(card.cost) === band);
    take(pool.filter(card => card.kind === 'minion'), minions - Number(band === 2));
    take(pool.filter(card => card.kind !== 'minion'), support);
  }
  take(ranked, 30 - cards.length);
  const deck = { heroClass, cards: cards.sort() };
  validateDeck(deck, catalog);
  return deck;
}
