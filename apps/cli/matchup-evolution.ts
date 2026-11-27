import { BOT_WEIGHT_KEYS, DEFAULT_BOT_WEIGHTS, HERO_CLASSES, RESEARCH_STRATEGIES, researchDeck } from '../../packages/engine/src/index.ts';
import type { BotWeights, Catalog, Deck, PlayerId, ResearchStrategy } from '../../packages/engine/src/index.ts';
import { benchmarkDeck } from './research-benchmark-decks.ts';
import { initialResearchWeights, initialResearchRow } from './research-models.ts';
import type { ResearchWeightRow } from './research-models.ts';
import type { TrainingJob, TrainingResult } from './ai-training-match.ts';

export const MATCHUP_PROTOCOL = 'visible-counterattack-4/cards/paired-1';
export const MATCHUPS = RESEARCH_STRATEGIES.flatMap(own => RESEARCH_STRATEGIES.map(opponent => ({ own, opponent })));
export const STAGES = [
  { name: 'screen', groups: 8, level: 6, nodes: 24 },
  { name: 'verify', groups: 32, level: 11, nodes: 44 },
  { name: 'final', groups: 128, level: 25, nodes: 96 },
] as const;
const groupsPerTrial = STAGES.reduce((total, stage) => total + stage.groups, 0);

export interface MatchupGroup {
  control: [number, number];
  candidate: [number, number];
  truncated: number;
}
export interface PendingTrial {
  candidate: BotWeights;
  mutation: 'fine' | 'medium' | 'wide';
  ownRow: ResearchWeightRow;
  opposingRow: ResearchWeightRow;
  priorOpposingRow: ResearchWeightRow;
  stage: number;
  results: MatchupGroup[];
}
export interface TrialEvidence {
  groups: number;
  gain: number;
  seatGains: [number, number];
  referenceGain: number;
  wins: number;
  losses: number;
  truncated: number;
  p: number;
  alpha: number;
  passed: boolean;
}
export interface MatchupModel {
  weights: BotWeights;
  games: number;
  validationGames: number;
  attempts: number;
  pending: PendingTrial | null;
  last: { stage: number; evidence: TrialEvidence; tactics: 'passed' | 'failed' | null } | null;
  promotions: { previous: BotWeights; attempt: number; evidence: TrialEvidence; at: string }[];
}
export interface MatchupState {
  schema: 1;
  protocol: typeof MATCHUP_PROTOCOL;
  catalogHash: string;
  seed: number;
  cursor: number;
  models: MatchupModel[];
}

export function createMatchupState(catalogHash: string, seed: number): MatchupState {
  return {
    schema: 1, protocol: MATCHUP_PROTOCOL, catalogHash, seed, cursor: 0,
    models: MATCHUPS.map(({ own, opponent }) => ({ weights: initialResearchWeights(own, opponent),
      games: 0, validationGames: 0, attempts: 0, pending: null, last: null, promotions: [] })),
  };
}

function rowFor(state: MatchupState, own: ResearchStrategy, prior = false): ResearchWeightRow {
  const base = RESEARCH_STRATEGIES.indexOf(own) * RESEARCH_STRATEGIES.length;
  const initial = initialResearchRow(own);
  const weights = (strategy: ResearchStrategy) => {
    const model = state.models[base + RESEARCH_STRATEGIES.indexOf(strategy)];
    return prior ? model.promotions.at(-1)?.previous ?? initial[strategy] : model.weights;
  };
  return { aggro: weights('aggro'), midrange: weights('midrange'), control: weights('control'), 'big-deck': weights('big-deck') };
}

function fixtureSeed(seed: number, ordinal: number): number {
  if (ordinal > 0xffffffff) throw new Error('Matchup fixture seed space exhausted');
  return (seed + Math.imul(ordinal, 0x9e3779b1)) >>> 0;
}

export function beginMatchupTrial(state: MatchupState, index: number): PendingTrial {
  const { own, opponent } = MATCHUPS[index], model = state.models[index];
  let rng = fixtureSeed(state.seed ^ 0x9efb0219, model.attempts * MATCHUPS.length + index);
  const random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 2 ** 32;
  };
  const scale = random();
  const mutation = scale < .6 ? 'fine' : scale < .9 ? 'medium' : 'wide';
  const [count, radius] = mutation === 'fine' ? [3, .14] : mutation === 'medium' ? [6, .36] : [10, .7];
  const keys = [...BOT_WEIGHT_KEYS], candidate = { ...model.weights };
  for (let i = 0; i < count; i++) {
    const key = keys.splice(Math.floor(random() * keys.length), 1)[0];
    const limit = DEFAULT_BOT_WEIGHTS[key];
    candidate[key] = Math.max(.25 * limit, Math.min(4 * limit, candidate[key] * Math.exp((2 * random() - 1) * radius)));
  }
  return { candidate, mutation, ownRow: rowFor(state, own), opposingRow: rowFor(state, opponent), priorOpposingRow: rowFor(state, opponent, true), stage: 0, results: [] };
}

export function matchupJobs(catalog: Catalog, state: MatchupState, index: number, trial: PendingTrial): TrainingJob[] {
  const model = state.models[index], group = trial.results.length;
  const stage = STAGES[trial.stage], { own, opponent } = MATCHUPS[index];
  if (!stage || group >= stage.groups) throw new Error('Completed matchup stage');
  const offset = STAGES.slice(0, trial.stage).reduce((sum, entry) => sum + entry.groups, 0);
  const seed = fixtureSeed(state.seed, (model.attempts * MATCHUPS.length + index) * groupsPerTrial + offset + group);
  const hero = HERO_CLASSES[(group + index + model.attempts) % HERO_CLASSES.length];
  const other = HERO_CLASSES[(group * 5 + index * 2 + model.attempts + 3) % HERO_CLASSES.length];
  const deck = (role: ResearchStrategy, cls: typeof hero, salt: number) => trial.stage === 0
    ? researchDeck(catalog, cls, role)
    : benchmarkDeck(catalog, cls, role, trial.stage === 1 ? 'development' : 'holdout', (seed ^ salt) >>> 0);
  const pilot = deck(own, hero, 0x63194d81), rival = deck(opponent, other, 0x39d793a5);
  const opposingRow = group % 8 === 3 ? initialResearchRow(opponent)
    : group % 8 === 7 ? trial.priorOpposingRow : trial.opposingRow;
  const treatment = { ...trial.ownRow, [opponent]: trial.candidate };
  const jobs: TrainingJob[] = [];
  for (const candidateRow of [trial.ownRow, treatment]) {
    for (const candidateSeat of [0, 1] as const) {
      const fixedDecks: [Deck, Deck] = candidateSeat === 0 ? [pilot, rival] : [rival, pilot];
      const firstPlayer: PlayerId = (group + index) % 2 === 0 ? 0 : 1;
      jobs.push({ seed, firstPlayer, candidateSeat, fixedDecks, styles: [false, false],
        classes: [fixedDecks[0].heroClass, fixedDecks[1].heroClass], opponent: DEFAULT_BOT_WEIGHTS,
        candidate: DEFAULT_BOT_WEIGHTS, level: stage.level, nodes: stage.nodes, policyVersion: 4,
        researchRows: { candidate: candidateRow, opponent: opposingRow },
      });
    }
  }
  return jobs;
}

export function matchupGroup(results: readonly TrainingResult[]): MatchupGroup {
  if (results.length !== 4) throw new Error('A matched fixture needs four games');
  return { control: [results[0].score, results[1].score], candidate: [results[2].score, results[3].score],
    truncated: results.filter(result => result.truncated).length };
}

function positiveSignTail(wins: number, losses: number): number {
  const trials = wins + losses;
  let mass = 2 ** -trials, tail = 0;
  for (let k = 0; k <= trials; k++) {
    if (k >= wins) tail += mass;
    mass *= (trials - k) / (k + 1);
  }
  return Math.min(1, tail);
}

export function evaluateMatchupStage(trial: PendingTrial, attempt: number): TrialEvidence {
  const groups = STAGES[trial.stage].groups;
  if (trial.results.length !== groups) throw new Error('Matchup stage is incomplete');
  const seatGains: [number, number] = [0, 0];
  let wins = 0, losses = 0, truncated = 0, referenceDelta = 0, referenceGroups = 0;
  for (const [index, group] of trial.results.entries()) {
    truncated += group.truncated;
    if (group.truncated) continue;
    const first = group.candidate[0] - group.control[0], second = group.candidate[1] - group.control[1];
    seatGains[0] += first;
    seatGains[1] += second;
    if (index % 4 === 3) {
      referenceDelta += (first + second) / 2;
      referenceGroups++;
    }
    wins += Number(first + second > 0);
    losses += Number(first + second < 0);
  }
  const valid = trial.results.filter(group => group.truncated === 0).length;
  seatGains[0] /= Math.max(1, valid);
  seatGains[1] /= Math.max(1, valid);
  const gain = (seatGains[0] + seatGains[1]) / 2, p = positiveSignTail(wins, losses);
  // Across 16 cells, sum 1/(n(n+1)) = 1 across repeated attempts in the same experiment.
  const alpha = .05 / (MATCHUPS.length * (attempt + 1) * (attempt + 2));
  const referenceGain = referenceDelta / Math.max(1, referenceGroups);
  const final = trial.stage === STAGES.length - 1;
  const passed = truncated === 0 && (final ? gain >= .02 && referenceGain >= 0 && seatGains.every(seat => seat >= 0) && p <= alpha : gain > 0);
  return { groups, gain, seatGains, referenceGain, wins, losses, truncated, p, alpha, passed };
}

export function recordMatchupGroup(state: MatchupState, index: number, group: MatchupGroup,
  verifyTactics: (row: ResearchWeightRow) => boolean) {
  const model = state.models[index], trial = model.pending;
  if (!trial || index !== state.cursor) throw new Error('Result is outside the active matchup turn');
  trial.results.push(group);
  model.games += 4;
  if (trial.stage > 0) model.validationGames += 4;
  if (trial.results.length === STAGES[trial.stage].groups) {
    const evidence = evaluateMatchupStage(trial, model.attempts);
    const final = trial.stage === STAGES.length - 1;
    const tactics = final && evidence.passed
      ? verifyTactics({ ...trial.ownRow, [MATCHUPS[index].opponent]: trial.candidate }) ? 'passed' : 'failed'
      : null;
    model.last = { stage: trial.stage, evidence, tactics };
    if (evidence.passed && !final) {
      trial.stage++;
      trial.results = [];
    } else {
      if (tactics === 'passed') {
        model.promotions.push({ previous: model.weights, attempt: model.attempts, evidence, at: new Date().toISOString() });
        model.weights = trial.candidate;
      }
      model.attempts++;
      model.pending = null;
    }
  }
  state.cursor = (index + 1) % MATCHUPS.length;
}
