import { BOT_WEIGHT_KEYS, DEFAULT_BOT_WEIGHTS } from '../../packages/engine/src/bot-profile.ts';
import type { BotWeights } from '../../packages/engine/src/bot-profile.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../packages/engine/src/deck-strategies.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';
import type { Catalog, HeroClass, PlayerId, PlayerView } from '../../packages/engine/src/types.ts';

const strategyWeights: Record<ResearchStrategy, Partial<BotWeights>> = {
  aggro: { face: .27, initiative: .28, attack: 1.31, hand: 1.35 },
  midrange: { body: 1.35, trade: .24, durability: 1.02, initiative: .32 },
  control: { lowHealth: 1.4, criticalHealth: 2.65, hand: 2, fatigue: .58 },
  'big-deck': { mana: .88, durability: 1.06, ability: 1.25, handQuality: .48 },
};

const matchupWeights: Record<ResearchStrategy, Record<ResearchStrategy, Partial<BotWeights>>> = {
  aggro: {
    aggro: { trade: .18 }, midrange: { body: 1.28 },
    control: { face: .36 }, 'big-deck': { face: .38 },
  },
  midrange: {
    aggro: { lowHealth: 1.38 }, midrange: { trade: .28 },
    control: { hand: 1.86 }, 'big-deck': { attack: 1.38 },
  },
  control: {
    aggro: { criticalHealth: 3.15 }, midrange: { trade: .24 },
    control: { fatigue: .78 }, 'big-deck': { handQuality: .53 },
  },
  'big-deck': {
    aggro: { lowHealth: 1.56 }, midrange: { body: 1.35 },
    control: { hand: 1.94 }, 'big-deck': { durability: 1.21 },
  },
};

export function initialResearchWeights(own: ResearchStrategy, opponent: ResearchStrategy): BotWeights {
  return { ...DEFAULT_BOT_WEIGHTS, ...strategyWeights[own], ...matchupWeights[own][opponent] };
}

type StrategyEvidence = Record<ResearchStrategy, ReadonlyMap<string, number>>;
const evidenceCache = new WeakMap<Catalog, Map<HeroClass, StrategyEvidence>>();

function evidenceFor(catalog: Catalog, heroClass: HeroClass): StrategyEvidence {
  let byClass = evidenceCache.get(catalog);
  if (!byClass) {
    byClass = new Map();
    evidenceCache.set(catalog, byClass);
  }
  const existing = byClass.get(heroClass);
  if (existing) return existing;

  const cardCounts = (strategy: ResearchStrategy) => {
    const counts = new Map<string, number>();
    for (const id of researchDeck(catalog, heroClass, strategy).cards) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  };
  const counts = {
    aggro: cardCounts('aggro'), midrange: cardCounts('midrange'),
    control: cardCounts('control'), 'big-deck': cardCounts('big-deck'),
  };
  byClass.set(heroClass, counts);
  return counts;
}

/** Start uniformly and compare revealed plays to the four class-specific reference decks. */
export function inferOpponentStrategy(
  view: Pick<PlayerView, 'opponent' | 'history'>, actor: PlayerId, catalog: Catalog,
): Record<ResearchStrategy, number> {
  const evidence = evidenceFor(catalog, view.opponent.heroClass);
  const played = view.history.flatMap(event =>
    event.player !== actor && event.playedCardId ? [event.playedCardId] : []);

  const likelihood = (strategy: ResearchStrategy) => played.reduce((total, cardId) =>
    total + .45 * Math.log(1 + (evidence[strategy].get(cardId) ?? 0)), 0);
  const logs = RESEARCH_STRATEGIES.map(likelihood);
  const maximum = Math.max(...logs);
  const values = logs.map(log => Math.exp(log - maximum));
  const sum = values.reduce((total, value) => total + value, 0);
  // Keep a small uniform prior contribution for cards generated or obtained during play.
  return {
    aggro: .025 + .9 * values[0] / sum,
    midrange: .025 + .9 * values[1] / sum,
    control: .025 + .9 * values[2] / sum,
    'big-deck': .025 + .9 * values[3] / sum,
  };
}

export function mixInitialResearchWeights(
  own: ResearchStrategy, probabilities: Readonly<Record<ResearchStrategy, number>>,
): BotWeights {
  const result = initialResearchWeights(own, 'aggro');
  const matchup = RESEARCH_STRATEGIES.map(strategy => ({
    probability: probabilities[strategy], weights: initialResearchWeights(own, strategy),
  }));
  for (const key of BOT_WEIGHT_KEYS) {
    result[key] = matchup.reduce((total, model) => total + model.weights[key] * model.probability, 0);
  }
  return result;
}
