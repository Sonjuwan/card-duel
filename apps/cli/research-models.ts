import { BOT_WEIGHT_KEYS, DEFAULT_BOT_WEIGHTS } from '../../packages/engine/src/bot-profile.ts';
import type { BotWeights } from '../../packages/engine/src/bot-profile.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../packages/engine/src/deck-strategies.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';
import type { Card, Catalog, HeroClass, PlayerId, PlayerView, PublicEvent } from '../../packages/engine/src/types.ts';

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

export const INFERENCE_MODES = ['uniform', 'cards', 'profile', 'actions'] as const;
export type InferenceMode = typeof INFERENCE_MODES[number];
type LogEvidence = [aggro: number, midrange: number, control: number, bigDeck: number];
type StrategyProbabilities = Record<ResearchStrategy, number>;

function profileEvidence(card: Card): LogEvidence {
  if (card.kind === 'minion') {
    if (card.cost <= 2 && card.attack >= card.health) return [.38, .10, -.18, -.13];
    if (card.cost >= 7) return [-.45, -.25, .08, .55];
    if (card.cost >= 3 && card.cost <= 5) return [-.04, .25, -.18, -.10];
  }
  if (card.kind === 'spell' && card.cost >= 3) return [-.13, -.09, .29, .05];
  return [0, 0, 0, 0];
}

function playEvidence(card: Card, event: PublicEvent): LogEvidence {
  const action = event.evidence;
  if (action?.kind !== 'card') return [0, 0, 0, 0];
  if (card.kind === 'minion') {
    if (card.cost >= 7 && action.manaPaid <= 5) return [-.08, -.06, 0, .27];
    if (event.turn <= 6 && action.manaPaid <= 2 && card.cost <= 2) return [.20, .12, -.08, -.09];
  }
  if (card.kind === 'spell' || card.kind === 'minion' || card.kind === 'weapon') {
    const choices = 'choices' in card ? card.choices : undefined;
    const chosen = action.choice === undefined ? undefined : choices?.[action.choice];
    const effects = chosen?.effects ?? (card.kind === 'spell' ? card.effects : card.battlecry);
    if (effects?.some(effect => effect.kind === 'gainCrystal')) return [-.18, -.10, .03, .44];
    const damage = effects?.some(effect => effect.kind === 'damage');
    if (action.target === 'enemy-hero' && damage) return [.36, .06, -.15, -.16];
    if ((action.target === 'enemy-minion' && damage) ||
        effects?.some(effect => ['brawl', 'destroy', 'heal', 'healFull', 'armor'].includes(effect.kind))) {
      return [-.13, -.02, .28, .09];
    }
  }
  return [0, 0, 0, 0];
}

/** Use only public history and the opponent's public class. */
export function inferOpponentStrategy(
  view: Pick<PlayerView, 'opponent' | 'history'>, actor: PlayerId, catalog: Catalog,
  mode: InferenceMode = 'cards',
): StrategyProbabilities {
  if (mode === 'uniform') return { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 };
  const evidence = evidenceFor(catalog, view.opponent.heroClass);
  const logs: LogEvidence = [0, 0, 0, 0];
  const add = (signal: LogEvidence) => {
    for (const [index, value] of signal.entries()) logs[index] += value;
  };
  let flexibleAttacks = 0, faceAttacks = 0;
  for (const event of view.history) {
    if (event.player === actor) continue;
    if (event.playedCardId) {
      const id = event.playedCardId;
      for (const [index, strategy] of RESEARCH_STRATEGIES.entries()) {
        logs[index] += .45 * Math.log(1 + (evidence[strategy].get(id) ?? 0));
      }
      const card = catalog[id];
      if (card && mode !== 'cards') {
        add(profileEvidence(card));
        if (mode === 'actions') add(playEvidence(card, event));
      }
    }
    if (mode !== 'actions') continue;
    if (event.evidence?.kind === 'attack' && event.evidence.couldChooseEither) {
      flexibleAttacks++;
      faceAttacks += Number(event.evidence.target === 'hero');
    }
    if (event.evidence?.kind === 'heroPower' && event.turn <= 6 && event.evidence.manaPaid >= 2) {
      add([-.15, -.08, .10, .08]);
    }
  }
  if (flexibleAttacks > 0) {
    // Shrink toward neutral when there are few choices. Repeated swings must not dominate card evidence.
    const preference = (faceAttacks - .5 * flexibleAttacks) / (3 + flexibleAttacks);
    add([1.6 * preference, 0, -1.35 * preference, -.35 * preference]);
  }
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
