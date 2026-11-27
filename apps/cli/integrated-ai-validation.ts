import { createHash } from 'node:crypto';
import { aiWeightFingerprint } from '../server/ai-profile-store.ts';
import { HERO_CLASSES, RESEARCH_STRATEGIES } from '../../packages/engine/src/index.ts';
import type { BotWeights, Catalog, Deck, ResearchStrategy } from '../../packages/engine/src/index.ts';
import { fixtureSeed, isMatchupGroup, MATCHUPS, positiveSignTail, RELEASE_FIXTURE_START, rowFor } from './matchup-evolution.ts';
import type { MatchupState, MatchupGroup } from './matchup-evolution.ts';
import { benchmarkDeck } from './research-benchmark-decks.ts';
import type { ResearchWeightRow } from './research-models.ts';
import type { TrainingJob } from './ai-training-match.ts';

export const RELEASE_SUITE = {
  protocol: 'integrated-release-v1', groupsPerMatchup: 9, level: 25, nodes: 96,
  policyVersion: 4, baselinePolicy: 2, minimumGain: .02, maximumStrategyLoss: .02, alpha: .05,
} as const;
export const RELEASE_GROUPS = MATCHUPS.length * RELEASE_SUITE.groupsPerMatchup;
export type IntegratedMatrix = Record<ResearchStrategy, ResearchWeightRow>;

export function snapshotIntegrated(state: MatchupState) {
  const matrix: IntegratedMatrix = structuredClone({
    aggro: rowFor(state, 'aggro'), midrange: rowFor(state, 'midrange'),
    control: rowFor(state, 'control'), 'big-deck': rowFor(state, 'big-deck'),
  });
  const cells = MATCHUPS.map(({ own, opponent }, index) => ({
    own, opponent, weights: aiWeightFingerprint(matrix[own][opponent]), promotions: state.models[index].promotions.length,
  }));
  const fingerprint = createHash('sha256').update(JSON.stringify(cells.map(cell => cell.weights))).digest('hex');
  return { matrix, cells, fingerprint };
}

export function releaseJobs(catalog: Catalog, trainingSeed: number, matrix: IntegratedMatrix,
  baseline: BotWeights, index: number): TrainingJob[] {
  if (!Number.isInteger(index) || index < 0 || index >= RELEASE_GROUPS) throw new Error('Invalid release fixture index');
  const cell = index % MATCHUPS.length, block = Math.floor(index / MATCHUPS.length);
  const { own, opponent } = MATCHUPS[cell];
  const seed = fixtureSeed(trainingSeed, RELEASE_FIXTURE_START + index);
  const pilot = benchmarkDeck(catalog, HERO_CLASSES[(cell + block) % HERO_CLASSES.length], own, 'release', (seed ^ 0x530fce3a) >>> 0);
  const rival = benchmarkDeck(catalog, HERO_CLASSES[(cell * 2 + block * 5 + 4) % HERO_CLASSES.length], opponent, 'release', (seed ^ 0xde9060a1) >>> 0);
  const jobs: TrainingJob[] = [];
  for (const treatment of [false, true]) {
    for (const candidateSeat of [0, 1] as const) {
      const fixedDecks: [Deck, Deck] = candidateSeat === 0 ? [pilot, rival] : [rival, pilot];
      jobs.push({ seed, firstPlayer: (block + cell) % 2 === 0 ? 0 : 1, candidateSeat, fixedDecks,
        classes: [fixedDecks[0].heroClass, fixedDecks[1].heroClass], styles: [false, false],
        candidate: baseline, opponent: baseline, level: RELEASE_SUITE.level, nodes: RELEASE_SUITE.nodes,
        policyVersion: treatment ? RELEASE_SUITE.policyVersion : RELEASE_SUITE.baselinePolicy,
        opponentPolicyVersion: RELEASE_SUITE.baselinePolicy,
        ...(treatment ? { researchRows: { candidate: matrix[own] } } : {}),
      });
    }
  }
  return jobs;
}

function summarize(groups: readonly MatchupGroup[]) {
  let wins = 0, losses = 0, truncated = 0, total = 0, valid = 0;
  for (const group of groups) {
    truncated += group.truncated;
    if (group.truncated) continue;
    valid++;
    const delta = (group.candidate[0] + group.candidate[1] - group.control[0] - group.control[1]) / 2;
    total += delta;
    wins += Number(delta > 0);
    losses += Number(delta < 0);
  }
  return { groups: groups.length, valid, truncated, gain: valid ? total / valid : null,
    better: wins, worse: losses, tied: valid - wins - losses,
    improvementP: positiveSignTail(wins, losses), regressionP: positiveSignTail(losses, wins) };
}

export function evaluateIntegrated(results: readonly MatchupGroup[], tactics: Record<ResearchStrategy, boolean>) {
  if (results.length > RELEASE_GROUPS || !results.every(isMatchupGroup)) throw new Error('Invalid release fixture results');
  const overall = summarize(results);
  const matchups = MATCHUPS.map((pair, i) => ({ ...pair, ...summarize(results.filter((_, index) => index % MATCHUPS.length === i)) }));
  const strategies = RESEARCH_STRATEGIES.map(own => ({ own,
    ...summarize(results.filter((_, index) => MATCHUPS[index % MATCHUPS.length].own === own)) }));
  const reasons: string[] = [];
  if (results.length !== RELEASE_GROUPS) reasons.push('incomplete');
  if (!RESEARCH_STRATEGIES.every(own => tactics[own] === true)) reasons.push('fixed-tactics');
  if (overall.truncated > 0) reasons.push('truncated');
  if (results.length === RELEASE_GROUPS) {
    if ((overall.gain ?? -Infinity) < RELEASE_SUITE.minimumGain || overall.improvementP > RELEASE_SUITE.alpha) {
      reasons.push('insufficient-overall-improvement');
    }
    if (strategies.some(strategy => (strategy.gain ?? -Infinity) < -RELEASE_SUITE.maximumStrategyLoss)) reasons.push('strategy-regression');
    if (matchups.some(cell => cell.regressionP <= RELEASE_SUITE.alpha / MATCHUPS.length)) reasons.push('matchup-regression');
  }
  return { eligible: reasons.length === 0, reasons, games: results.length * 4, overall, strategies, matchups };
}
