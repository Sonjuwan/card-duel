import { BOT_WEIGHT_KEYS, HERO_CLASSES, RESEARCH_STRATEGIES } from '../../packages/engine/src/index.ts';
import type { BotWeights, Catalog, PlayerId } from '../../packages/engine/src/index.ts';
import type { BotWeightKey } from '../../packages/engine/src/bot-profile.ts';
import { integratedFixtureDecks, RELEASE_GROUPS, RELEASE_SUITE } from './integrated-ai-validation.ts';
import type { IntegratedMatrix } from './integrated-ai-validation.ts';
import { fixtureSeed, MATCHUPS, positiveSignTail, RELEASE_FIXTURE_START } from './matchup-evolution.ts';
import type { ResearchWeightRow } from './research-models.ts';
import type { TrainingJob, TrainingResult } from './ai-training-match.ts';

export const CONTROL_STRENGTHS = [0, .25, .5, .75, 1] as const;
export type ControlProfile = { policy: 4 | 5; strength: typeof CONTROL_STRENGTHS[number] };
export const CONTROL_PROFILES: readonly ControlProfile[] = ([4, 5] as const).flatMap(policy =>
  CONTROL_STRENGTHS.map(strength => ({ policy, strength })));
export const CONTROL_CELLS = MATCHUPS.flatMap(({ own }, index) => own === 'control' ? [index] : []);
export const CONTROL_DEVELOPMENT_GROUPS = CONTROL_CELLS.length * HERO_CLASSES.length * 3;
export const CONTROL_INCUMBENT = CONTROL_PROFILES.findIndex(profile => profile.policy === 4 && profile.strength === 1);
export const CONTROL_STRESS_GROUPS = CONTROL_CELLS.length * HERO_CLASSES.length * 3;
export const CONTROL_STRESS_OPPONENTS = ['release', 'integrated', 'guarded-fixed'] as const;
export const CONTROL_STRESS_ARMS = ['incumbent', 'selected', 'ordered'] as const;
export const CONTROL_INFERENCE_GROUPS = CONTROL_DEVELOPMENT_GROUPS;
export const CONTROL_TACTICS_GROUPS = CONTROL_CELLS.length * HERO_CLASSES.length;
export const CONTROL_REPLY_GROUPS = CONTROL_DEVELOPMENT_GROUPS;
export const CONTROL_REPLY_ARMS = ['natural-beam', 'planned-beam', 'natural-finalists', 'planned-finalists'] as const;
export const CONTROL_HYBRID_ARMS = ['natural-beam', 'planned-beam', 'natural-hybrid', 'planned-hybrid'] as const;
export const CONTROL_REPLY_RIVALS = ['release', 'integrated'] as const;
export const CONTROL_EVALUATION_FAMILIES = [
  { name: 'survival', keys: ['lowHealth', 'criticalHealth'] },
  { name: 'resources', keys: ['hand', 'handQuality', 'fatigue'] },
  { name: 'trades', keys: ['trade'] },
] as const satisfies readonly { name: string; keys: readonly BotWeightKey[] }[];
export const CONTROL_EVALUATION_GROUPS = CONTROL_DEVELOPMENT_GROUPS;
export const CONTROL_EVALUATION_ARMS = Array.from({ length: 2 ** CONTROL_EVALUATION_FAMILIES.length }, (_, mask) => mask);
export const CONTROL_EVALUATION_RIVALS = CONTROL_REPLY_RIVALS;
export const CONTROL_PHASE_ARMS = ['fixed', 'always', 'survival-when-low', 'resources-after-five', 'both-gated'] as const;
export const CONTROL_INFERENCE_ARMS = ['fixed', 'uniform', 'cards', 'profile', 'actions', 'attenuate-posterior', 'attenuate-row'] as const;
export const CONTROL_PROTOCOL = 'control-calibration-v1';
const DEVELOPMENT_OFFSET = 2 * RELEASE_GROUPS;
const CONFIRMATION_OFFSET = DEVELOPMENT_OFFSET + CONTROL_DEVELOPMENT_GROUPS;
const STRESS_OFFSET = CONFIRMATION_OFFSET + RELEASE_GROUPS;
const INFERENCE_OFFSET = STRESS_OFFSET + CONTROL_STRESS_GROUPS;
const TACTICS_OFFSET = INFERENCE_OFFSET + CONTROL_INFERENCE_GROUPS;
const REPLY_OFFSET = TACTICS_OFFSET + CONTROL_TACTICS_GROUPS;
const EVALUATION_OFFSET = REPLY_OFFSET + CONTROL_REPLY_GROUPS;
const HYBRID_OFFSET = EVALUATION_OFFSET + CONTROL_EVALUATION_GROUPS;
const PHASE_OFFSET = HYBRID_OFFSET + CONTROL_REPLY_GROUPS;
export type ArmResult = { scores: [number, number]; truncated: number };
export type DevelopmentResult = ArmResult[];

export function applyControlProfile(base: BotWeights, row: ResearchWeightRow, profile: ControlProfile):
  Pick<TrainingJob, 'policyVersion' | 'researchRows'> {
  if (profile.strength === 0) return { policyVersion: profile.policy };
  if (profile.strength === 1) return { policyVersion: profile.policy, researchRows: { candidate: row } };
  const candidate = {} as Record<keyof ResearchWeightRow, BotWeights>;
  for (const opponent of RESEARCH_STRATEGIES) {
    const weights = { ...base };
    for (const key of BOT_WEIGHT_KEYS) weights[key] += profile.strength * (row[opponent][key] - base[key]);
    candidate[opponent] = weights;
  }
  return { policyVersion: profile.policy, researchRows: { candidate } };
}

type Arm = Pick<TrainingJob, 'policyVersion' | 'researchRows' | 'counterattackOrder' | 'opponentPolicyVersion' |
  'opponentResearchRow' | 'candidateMixRule' | 'sampleCandidateInference' | 'counterattackSchedule'>;
type ControlOpponent = typeof CONTROL_STRESS_OPPONENTS[number];
function controlOpponentRow(matrix: IntegratedMatrix, index: number) {
  const { opponent } = MATCHUPS[CONTROL_CELLS[index % CONTROL_CELLS.length]];
  return matrix[opponent];
}

function withControlOpponents(arms: Arm[], opponents: readonly ControlOpponent[], row: ResearchWeightRow): Arm[] {
  return opponents.flatMap(opponent => {
    if (opponent === 'release') return arms;
    const settings: Arm = opponent === 'integrated' ? { opponentPolicyVersion: 4, opponentResearchRow: row }
      : { opponentPolicyVersion: 5 };
    return arms.map(arm => ({ ...arm, ...settings }));
  });
}
const splitOffsets = { 'control-development': DEVELOPMENT_OFFSET, 'control-confirmation': CONFIRMATION_OFFSET,
  'control-stress': STRESS_OFFSET, 'control-inference': INFERENCE_OFFSET, 'control-tactics': TACTICS_OFFSET,
  'control-reply-schedule': REPLY_OFFSET, 'control-evaluation': EVALUATION_OFFSET, 'control-reply-hybrid': HYBRID_OFFSET,
  'control-evaluation-phases': PHASE_OFFSET };
function fixtureArms(catalog: Catalog, trainingSeed: number, index: number,
  split: keyof typeof splitOffsets, baseline: BotWeights, arms: Arm[]): TrainingJob[] {
  const cells = split === 'control-confirmation' ? MATCHUPS.map((_, i) => i) : CONTROL_CELLS;
  const cell = cells[index % cells.length], block = Math.floor(index / cells.length);
  const seed = fixtureSeed(trainingSeed, RELEASE_FIXTURE_START + splitOffsets[split] + index);
  const decks = integratedFixtureDecks(catalog, cell, block, seed, split);
  return arms.flatMap(arm => ([0, 1] as const).map(candidateSeat => {
    const fixedDecks: TrainingJob['fixedDecks'] = candidateSeat === 0 ? decks : [decks[1], decks[0]];
    return {
      seed, candidateSeat, firstPlayer: (block + cell) % 2 as PlayerId, fixedDecks,
      styles: [false, false], classes: [fixedDecks[0].heroClass, fixedDecks[1].heroClass],
      candidate: baseline, opponent: baseline, level: RELEASE_SUITE.level, nodes: RELEASE_SUITE.nodes,
      opponentPolicyVersion: RELEASE_SUITE.baselinePolicy, ...arm,
    };
  }));
}

export function controlDevelopmentJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_DEVELOPMENT_GROUPS) throw new Error('Invalid development fixture');
  return fixtureArms(catalog, seed, index, 'control-development', baseline, CONTROL_PROFILES.map(profile =>
    applyControlProfile(baseline, matrix.control, profile)));
}

export function controlConfirmationJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights,
  profile: ControlProfile, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= RELEASE_GROUPS) throw new Error('Invalid confirmation fixture');
  const { own } = MATCHUPS[index % MATCHUPS.length];
  const incumbent = { policyVersion: RELEASE_SUITE.policyVersion, researchRows: { candidate: matrix[own] } };
  const candidate = own === 'control' ? applyControlProfile(baseline, matrix.control, profile) : incumbent;
  return fixtureArms(catalog, seed, index, 'control-confirmation', baseline, [
    { policyVersion: RELEASE_SUITE.baselinePolicy }, candidate, ...(own === 'control' ? [incumbent] : []),
  ]);
}

export function controlStressJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights,
  profile: ControlProfile, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_STRESS_GROUPS) throw new Error('Invalid stress fixture');
  const selected = applyControlProfile(baseline, matrix.control, profile);
  const incumbent: Arm = { policyVersion: 4, researchRows: { candidate: matrix.control } };
  const arms = [incumbent, selected, { ...selected, counterattackOrder: 'ordered' as const }];
  return fixtureArms(catalog, seed, index, 'control-stress', baseline,
    withControlOpponents(arms, CONTROL_STRESS_OPPONENTS, controlOpponentRow(matrix, index)));
}

export function controlInferenceJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_INFERENCE_GROUPS) throw new Error('Invalid inference fixture');
  const matchup: Arm = { policyVersion: 4, researchRows: { candidate: matrix.control } };
  const arms: Record<typeof CONTROL_INFERENCE_ARMS[number], Arm> = {
    fixed: { policyVersion: 4, sampleCandidateInference: true },
    uniform: { ...matchup, candidateMixRule: { mode: 'uniform' } },
    cards: matchup,
    profile: { ...matchup, candidateMixRule: { mode: 'profile' } },
    actions: { ...matchup, candidateMixRule: { mode: 'actions' } },
    'attenuate-posterior': { ...matchup, candidateMixRule: { mode: 'cards', attenuation: 'posterior' } },
    'attenuate-row': { ...matchup, candidateMixRule: { mode: 'cards', attenuation: 'row' } },
  };
  return fixtureArms(catalog, seed, index, 'control-inference', baseline, CONTROL_INFERENCE_ARMS.map(arm => arms[arm]));
}

export function controlTacticsJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_TACTICS_GROUPS) throw new Error('Invalid tactics fixture');
  const incumbent: Arm = { policyVersion: 4, researchRows: { candidate: matrix.control } };
  return fixtureArms(catalog, seed, index, 'control-tactics', baseline,
    withControlOpponents([incumbent], CONTROL_REPLY_RIVALS, controlOpponentRow(matrix, index)));
}

export function controlReplyScheduleJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights,
  index: number, hybrid = false) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_REPLY_GROUPS) throw new Error('Invalid reply schedule fixture');
  const unchanged: Arm = { policyVersion: 4, researchRows: { candidate: matrix.control } };
  const scheduled: Arm = { ...unchanged, counterattackSchedule: hybrid ? 'hybrid' : 'finalists' };
  const arms: Arm[] = [unchanged, { ...unchanged, counterattackOrder: 'planned' }, scheduled,
    { ...scheduled, counterattackOrder: 'planned' }];
  return fixtureArms(catalog, seed, index, hybrid ? 'control-reply-hybrid' : 'control-reply-schedule', baseline,
    withControlOpponents(arms, CONTROL_REPLY_RIVALS, controlOpponentRow(matrix, index)));
}

export function controlEvaluationJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_EVALUATION_GROUPS) throw new Error('Invalid control evaluation fixture');
  const arms: Arm[] = CONTROL_EVALUATION_ARMS.map(mask => ({
    policyVersion: 4,
    ...(mask === 0 ? {} : { researchRows: { candidate: matrix.control }, candidateMixRule: { mode: 'cards',
      keys: controlEvaluationKeys(mask) } }),
  }));
  return fixtureArms(catalog, seed, index, 'control-evaluation', baseline,
    withControlOpponents(arms, CONTROL_EVALUATION_RIVALS, controlOpponentRow(matrix, index)));
}

export function controlEvaluationKeys(mask: number): BotWeightKey[] {
  return CONTROL_EVALUATION_FAMILIES.flatMap((family, i) => mask & (1 << i) ? family.keys : []);
}

export function controlPhaseJobs(catalog: Catalog, seed: number, matrix: IntegratedMatrix, baseline: BotWeights, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CONTROL_EVALUATION_GROUPS) throw new Error('Invalid control phase fixture');
  const survival = CONTROL_EVALUATION_FAMILIES[0].keys;
  const resources = CONTROL_EVALUATION_FAMILIES[1].keys;
  const activeAtLowHealth = { keys: survival, activeWhen: 'health-15' as const };
  const activeAtFiveMana = { keys: resources, activeWhen: 'mana-5' as const };
  const policies: Record<typeof CONTROL_PHASE_ARMS[number], Arm> = {
    fixed: { policyVersion: 4 },
    always: { policyVersion: 4, researchRows: { candidate: matrix.control },
      candidateMixRule: { mode: 'cards', keys: [...survival, ...resources] } },
    'survival-when-low': { policyVersion: 4, researchRows: { candidate: matrix.control },
      candidateMixRule: { mode: 'cards', keys: resources, gates: [activeAtLowHealth] } },
    'resources-after-five': { policyVersion: 4, researchRows: { candidate: matrix.control },
      candidateMixRule: { mode: 'cards', keys: survival, gates: [activeAtFiveMana] } },
    'both-gated': { policyVersion: 4, researchRows: { candidate: matrix.control },
      candidateMixRule: { mode: 'cards', keys: [], gates: [activeAtLowHealth, activeAtFiveMana] } },
  };
  return fixtureArms(catalog, seed, index, 'control-evaluation-phases', baseline,
    withControlOpponents(CONTROL_PHASE_ARMS.map(arm => policies[arm]), CONTROL_EVALUATION_RIVALS, controlOpponentRow(matrix, index)));
}

export function armResults(results: readonly TrainingResult[]): ArmResult[] {
  const arms: ArmResult[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const [a, b] = [results[i], results[i + 1]];
    if (!a || !b) throw new Error('Missing seat result');
    arms.push({ scores: [a.score, b.score], truncated: Number(a.truncated) + Number(b.truncated) });
  }
  if (!arms.every(isArmResult)) throw new Error('Invalid seat result');
  return arms;
}

export function isArmResult(value: unknown): value is ArmResult {
  const arm = value as Partial<ArmResult> | null;
  return !!arm && Array.isArray(arm.scores) && arm.scores.length === 2 &&
    arm.scores.every(score => score === 0 || score === .5 || score === 1) &&
    (arm.truncated === 0 || arm.truncated === 1 || arm.truncated === 2);
}

export const armMean = (arm: ArmResult) => (arm.scores[0] + arm.scores[1]) / 2;

export function pairedArms(rows: readonly ArmResult[][], reference: number, candidate: number) {
  const deltas = rows.flatMap(row => row[reference].truncated || row[candidate].truncated ? []
    : [armMean(row[candidate]) - armMean(row[reference])]);
  return summarizeArmDeltas(deltas);
}

export function summarizeArmDeltas(deltas: readonly number[]) {
  const better = deltas.filter(value => value > 0).length, worse = deltas.filter(value => value < 0).length;
  return { groups: deltas.length, gain: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null,
    better, worse, p: positiveSignTail(better, worse) };
}

export function summarizeControlDevelopment(rows: readonly DevelopmentResult[], tactics: readonly boolean[]) {
  if (rows.length > CONTROL_DEVELOPMENT_GROUPS || rows.some(row =>
    row.length !== CONTROL_PROFILES.length || !row.every(isArmResult))) throw new Error('Invalid development results');
  const comparisons = CONTROL_PROFILES.map((profile, i) => {
    let total = 0, valid = 0, better = 0, worse = 0;
    const strata = CONTROL_CELLS.map(cell => ({ opponent: MATCHUPS[cell].opponent, total: 0, groups: 0 }));
    for (const [index, arms] of rows.entries()) {
      const reference = arms[CONTROL_INCUMBENT], trial = arms[i];
      if (reference.truncated || trial.truncated) continue;
      const delta = armMean(trial) - armMean(reference);
      valid++;
      total += delta;
      better += Number(delta > 0);
      worse += Number(delta < 0);
      const stratum = strata[index % strata.length];
      stratum.total += delta;
      stratum.groups++;
    }
    return { ...profile, valid, gain: valid ? total / valid : null, better, worse,
      tactics: tactics[i] === true, strata };
  });
  function contrast(from: number, to: number) {
    const deltas = rows.flatMap(arms => arms[from].truncated || arms[to].truncated
      ? [] : [armMean(arms[to]) - armMean(arms[from])]);
    return {
      from: CONTROL_PROFILES[from], to: CONTROL_PROFILES[to], groups: deltas.length,
      gain: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null,
      better: deltas.filter(delta => delta > 0).length, worse: deltas.filter(delta => delta < 0).length,
    };
  }
  const size = CONTROL_STRENGTHS.length;
  const contrasts = {
    policy: CONTROL_STRENGTHS.map((_, index) => contrast(index, size + index)),
    mixing: CONTROL_PROFILES.flatMap((profile, index) => profile.strength === 0 ? [] : [contrast(index - 1, index)]),
  };
  // The incumbent supplies the paired development comparator. Freeze just one
  // changed profile; the untouched confirmation suite makes the final decision.
  const selected = rows.length === CONTROL_DEVELOPMENT_GROUPS
    ? comparisons.filter((profile, i) => i !== CONTROL_INCUMBENT && profile.tactics && profile.valid === rows.length)
      .sort((a, b) => b.gain! - a.gain! || b.strength - a.strength || a.policy - b.policy)[0] ?? null
    : null;
  return { groups: rows.length, comparisons, contrasts, selected: selected ? { policy: selected.policy, strength: selected.strength } : null };
}
