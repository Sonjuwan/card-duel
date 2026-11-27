import { aiCatalogHash } from '../server/ai-profile-store.ts';
import { CardStore } from '../server/card-store.ts';
import { DEFAULT_BOT_WEIGHTS, HERO_CLASSES } from '../../packages/engine/src/index.ts';
import type { Deck, PlayerView } from '../../packages/engine/src/index.ts';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../packages/engine/src/deck-strategies.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import type { TrainingJob } from './ai-training-match.ts';
import { benchmarkDeck, RESEARCH_SPLITS, researchSplitSeed } from './research-benchmark-decks.ts';
import { INFERENCE_MODES, inferOpponentStrategy } from './research-models.ts';
import type { InferenceMode } from './research-models.ts';
import { pairedScoreStats } from './paired-benchmark-stats.ts';

const split = RESEARCH_SPLITS.find(split => split === (process.argv[2] ?? 'holdout'));
const pairsPerMatchup = Number(process.argv[3] ?? 9);
const comparison = process.argv.slice(4);
const isMode = (value: string): value is InferenceMode => INFERENCE_MODES.some(mode => mode === value);
if (!split || !Number.isSafeInteger(pairsPerMatchup) || pairsPerMatchup < 1 || pairsPerMatchup > 100 ||
    (comparison.length !== 0 && (comparison.length !== 2 || !comparison.every(isMode)))) {
  throw new Error('Usage: npm run benchmark:inference -- [development|holdout] [1–100 fixtures per matchup] [candidateMode opponentMode]');
}
const duelModes = comparison.length === 2 ? comparison as [InferenceMode, InferenceMode] : undefined;
const { catalog: cardCatalog, version } = new CardStore().read();
const catalog = snapshotBattleCatalog(cardCatalog);
const splitSeed = researchSplitSeed[split];
const turns = [2, 4, 6] as const;
const horizons = [...turns, 'last'] as const;
type Horizon = typeof horizons[number];
type Probabilities = ReturnType<typeof inferOpponentStrategy>;
type Observations = Map<Horizon, PlayerView>;

function score(actual: ResearchStrategy, probabilities: Probabilities) {
  const best = Math.max(...Object.values(probabilities));
  const tied = Object.values(probabilities).filter(value => value === best).length;
  return {
    accuracy: probabilities[actual] === best ? 1 / tied : 0,
    brier: RESEARCH_STRATEGIES.reduce((sum, strategy) =>
      sum + (probabilities[strategy] - Number(strategy === actual)) ** 2, 0),
  };
}

function sharedCopies(a: Deck, b: Deck): number {
  const remaining = [...b.cards];
  let count = 0;
  for (const card of a.cards) {
    const index = remaining.indexOf(card);
    if (index < 0) continue;
    remaining.splice(index, 1);
    count++;
  }
  return count;
}

console.log(JSON.stringify({ version, catalogHash: aiCatalogHash(cardCatalog), split, fixturesPerMatchup: pairsPerMatchup,
  seed: splitSeed, level: 6, nodes: 24, policyVersion: 2,
  method: duelModes ? 'Seat-swapped duels, same decks, RNG seed and first seat in both games.' :
    'Fixed gameplay policies, score both seats at the first decision in each requested round and the last decision.',
  ...(duelModes ? { candidateMode: duelModes[0], opponentMode: duelModes[1] } : {}) }));
const metrics = new Map(horizons.map(horizon => [horizon, INFERENCE_MODES.map(mode =>
  ({ mode, samples: 0, accuracy: 0, brier: 0 }))]));
const pairScores: [number, number][] = [];
let fixtures = 0, games = 0, truncated = 0, highestReferenceOverlap = 0, totalReferenceOverlap = 0;
for (const [a, own] of RESEARCH_STRATEGIES.entries()) {
  for (const [b, opponent] of RESEARCH_STRATEGIES.entries()) {
    const strategies = [own, opponent] as const;
    for (let i = 0; i < pairsPerMatchup; i++) {
      const classes: TrainingJob['classes'] = [HERO_CLASSES[(i + a) % 9], HERO_CLASSES[(i * 5 + b + 3) % 9]];
      const seed = (splitSeed + (4 * a + b) * 100003 + i * 3167) >>> 0;
      const decks: [Deck, Deck] = [
        benchmarkDeck(catalog, classes[0], own, split, (seed ^ 0x63194d81) >>> 0),
        benchmarkDeck(catalog, classes[1], opponent, split, (seed ^ 0x39d793a5) >>> 0),
      ];
      fixtures++;
      for (const seat of [0, 1] as const) {
        const overlap = sharedCopies(researchDeck(catalog, classes[seat], strategies[seat]), decks[seat]);
        highestReferenceOverlap = Math.max(highestReferenceOverlap, overlap);
        totalReferenceOverlap += overlap;
      }
      const job: TrainingJob = { classes, styles: [false, false], fixedDecks: decks, seed,
        firstPlayer: (i + a + b) % 2 === 0 ? 0 : 1, candidateSeat: 0,
        candidate: DEFAULT_BOT_WEIGHTS, opponent: DEFAULT_BOT_WEIGHTS, level: 6, nodes: 24, policyVersion: 2 };
      if (duelModes) {
        const [candidateInference, opponentInference] = duelModes;
        const scores: [number, number] = [0, 0];
        for (const candidateSeat of [0, 1] as const) {
          const result = playTrainingMatch(catalog, {
            ...job, candidateSeat, candidateStrategy: strategies[candidateSeat],
          }, {
            candidateInference,
            opponentResearch: { strategy: strategies[1 - candidateSeat], inference: opponentInference },
          });
          scores[candidateSeat] = result.score;
          games++;
          truncated += Number(result.truncated);
        }
        pairScores.push(scores);
        continue;
      }

      const observations: [Observations, Observations] = [new Map(), new Map()];
      const result = playTrainingMatch(catalog, job, {
        observeDecision(view, actor) {
          if (view.phase !== 'playing') return;
          const round = Math.ceil(view.turn / 2);
          const series = observations[actor];
          series.set('last', view);
          for (const turn of turns) {
            if (round === turn && !series.has(turn)) series.set(turn, view);
          }
        },
      });
      games++;
      if (result.truncated) {
        truncated++;
        continue;
      }
      for (const seat of [0, 1] as const) {
        for (const [horizon, view] of observations[seat]) {
          for (const aggregate of metrics.get(horizon)!) {
            const probabilities = inferOpponentStrategy(view, seat, catalog, aggregate.mode);
            const { accuracy, brier } = score(strategies[1 - seat], probabilities);
            aggregate.samples++;
            aggregate.accuracy += accuracy;
            aggregate.brier += brier;
          }
        }
      }
    }
  }
}

console.log(JSON.stringify({ fixtures, games, truncated, highestReferenceOverlap, meanReferenceOverlap: totalReferenceOverlap / (2 * fixtures) }));
if (duelModes) {
  const outcomes = pairScores.flat();
  const wins = outcomes.filter(score => score === 1).length;
  const losses = outcomes.filter(score => score === 0).length;
  const draws = outcomes.length - wins - losses - truncated;
  console.log(JSON.stringify({ wins, losses, draws, pairScores,
    ...(truncated === 0 ? pairedScoreStats(pairScores) : { scoreRate: null }) }));
} else {
  for (const [horizon, aggregates] of metrics) {
    for (const { mode, samples, accuracy, brier } of aggregates) {
      console.log(JSON.stringify({ horizon, mode, samples, accuracy: samples ? accuracy / samples : null, brier: samples ? brier / samples : null }));
    }
  }
}
