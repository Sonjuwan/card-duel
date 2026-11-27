import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CardStore } from '../card-store.ts';
import { aiCatalogHash } from '../ai-profile-store.ts';
import { DEFAULT_BOT_WEIGHTS, HERO_CLASSES } from '../../../packages/engine/src/index.ts';
import { auditControlDecision } from '../../cli/control-decision-audit.ts';
import { applyControlProfile, CONTROL_DEVELOPMENT_GROUPS, CONTROL_INCUMBENT, CONTROL_PROFILES,
  CONTROL_STRESS_GROUPS, controlConfirmationJobs, controlDevelopmentJobs, controlInferenceJobs, controlStressJobs,
  controlEvaluationJobs, controlPhaseJobs, controlReplyScheduleJobs, controlTacticsJobs, summarizeControlDevelopment } from '../../cli/control-calibration.ts';
import type { ArmResult } from '../../cli/control-calibration.ts';
import { releaseJobs, RELEASE_GROUPS, snapshotIntegrated } from '../../cli/integrated-ai-validation.ts';
import { createMatchupState, MATCHUPS } from '../../cli/matchup-evolution.ts';
import { benchmarkDeck } from '../../cli/research-benchmark-decks.ts';
import { attenuatedResearchWeights, mixResearchWeights, resolveResearchWeights } from '../../cli/research-models.ts';
import { isControlInferenceGroup, summarizeControlInference } from '../../cli/control-inference-study.ts';
import { summarizeControlEvaluation } from '../../cli/control-evaluation-study.ts';
import { runResearchFixtures } from '../../cli/run-research-fixtures.ts';

const { catalog } = new CardStore().read('v0.23.0.json');
const checkpoint = createMatchupState(aiCatalogHash(catalog), 20261128);
const { matrix } = snapshotIntegrated(checkpoint);
const baseline = DEFAULT_BOT_WEIGHTS;

test('control development pairs the 10 profiles and balances roles across new deck and seed fixtures', () => {
  const arm = applyControlProfile(baseline, matrix.control, { policy: 5, strength: .25 });
  assert.equal(arm.policyVersion, 5);
  assert.equal(arm.researchRows?.candidate.aggro.hand,
    baseline.hand + .25 * (matrix.control.aggro.hand - baseline.hand));
  assert.deepEqual(applyControlProfile(baseline, matrix.control, { policy: 5, strength: 0 }), { policyVersion: 5 });
  assert.equal(applyControlProfile(baseline, matrix.control, { policy: 4, strength: 1 }).researchRows?.candidate, matrix.control);
  const old = new Set(Array.from({ length: RELEASE_GROUPS }, (_, index) =>
    [releaseJobs(catalog, checkpoint.seed, matrix, baseline, index)[0].seed,
      releaseJobs(catalog, checkpoint.seed, matrix, baseline, index, true)[0].seed]).flat());
  const seen = new Set<number>(), classes = new Map<string, number>();
  for (let index = 0; index < CONTROL_DEVELOPMENT_GROUPS; index++) {
    const jobs = controlDevelopmentJobs(catalog, checkpoint.seed, matrix, baseline, index);
    assert.equal(jobs.length, 20);
    assert.ok(!old.has(jobs[0].seed) && !seen.has(jobs[0].seed));
    seen.add(jobs[0].seed);
    const opponent = MATCHUPS[8 + index % 4].opponent;
    const hero = jobs[0].classes[0], key = hero + '/' + opponent;
    classes.set(key, (classes.get(key) ?? 0) + 1);
    for (const [i, job] of jobs.entries()) {
      assert.equal(job.opponentPolicyVersion, 2);
      assert.equal(job.seed, jobs[0].seed);
      assert.equal(job.candidateSeat, i % 2);
      assert.deepEqual(job.fixedDecks, jobs[i % 2].fixedDecks);
    }
    const confirm = controlConfirmationJobs(catalog, checkpoint.seed, matrix, baseline, { policy: 5, strength: .5 }, index);
    assert.ok(!old.has(confirm[0].seed) && !seen.has(confirm[0].seed));
    assert.notDeepEqual(benchmarkDeck(catalog, hero, 'control', 'control-confirmation', jobs[0].seed).cards,
      jobs[0].fixedDecks![0].cards);
  }
  assert.equal(classes.size, HERO_CLASSES.length * 4);
  assert.ok([...classes.values()].every(value => value === 3));
});

test('confirmation only changes control and evaluates its frozen incumbent in the same seats', () => {
  for (const [index, cell] of MATCHUPS.entries()) {
    const jobs = controlConfirmationJobs(catalog, checkpoint.seed, matrix, baseline, { policy: 5, strength: .25 }, index);
    assert.equal(jobs[0].policyVersion, 2);
    assert.equal(jobs.length, cell.own === 'control' ? 6 : 4);
    assert.equal(jobs[2].policyVersion, cell.own === 'control' ? 5 : 4);
    assert.equal(jobs[2].level, jobs[0].level);
    assert.equal(jobs[2].nodes, jobs[0].nodes);
    assert.deepEqual(jobs[2].fixedDecks, jobs[0].fixedDecks);
    if (cell.own === 'control') {
      assert.equal(jobs[4].policyVersion, 4);
      assert.equal(jobs[4].researchRows?.candidate, matrix.control);
    } else assert.equal(jobs[2].researchRows?.candidate, matrix[cell.own]);
  }
});

test('the exploratory selector freezes one legal profile only after a complete development sample', () => {
  const tied: ArmResult = { scores: [1, 0], truncated: 0 };
  const won: ArmResult = { scores: [1, 1], truncated: 0 };
  const make = () => CONTROL_PROFILES.map((_, i) => [5, 7, 8].includes(i) ? won : tied);
  const rows = Array.from({ length: CONTROL_DEVELOPMENT_GROUPS }, make);
  const tactics = CONTROL_PROFILES.map((_, i) => i !== 8);
  assert.equal(summarizeControlDevelopment(rows.slice(1), tactics).selected, null);
  assert.deepEqual(summarizeControlDevelopment(rows, tactics).selected, { policy: 5, strength: .5 });
  rows[0][7] = { ...won, truncated: 1 };
  const result = summarizeControlDevelopment(rows, tactics);
  assert.deepEqual(result.selected, { policy: 5, strength: 0 });
  assert.equal(result.comparisons[CONTROL_INCUMBENT].gain, 0);
  for (const contrast of result.contrasts.policy) assert.equal(contrast.from.strength, contrast.to.strength);
  for (const contrast of result.contrasts.mixing) assert.equal(contrast.from.policy, contrast.to.policy);
});

test('first-action audit intervenes on the actual matched state and rejects a different fixture', () => {
  const job = releaseJobs(catalog, checkpoint.seed, matrix, baseline, 37)[0];
  const candidate = { ...job, policyVersion: 3 as const };
  const result = auditControlDecision(catalog, job, candidate);
  assert.equal(result.incumbent.score, 1);
  assert.equal(result.candidate.score, 0);
  assert.equal(result.firstChange?.incumbent.card, 'hungry_crab');
  assert.equal(result.firstChange?.candidate.card, '__coin');
  assert.ok(result.intervention);
  assert.equal(result.intervention.candidateWithIncumbentAction.truncated, false);
  assert.throws(() => auditControlDecision(catalog, job, { ...candidate, seed: candidate.seed + 1 }), /matched fixture/);
});

test('stress and inference use new fixtures and isolate which side changes', () => {
  const seed = checkpoint.seed, profile = { policy: 4, strength: 0 } as const;
  const prior = new Set<number>();
  for (let index = 0; index < RELEASE_GROUPS; index++) {
    prior.add(controlConfirmationJobs(catalog, seed, matrix, baseline, profile, index)[0].seed);
    if (index < CONTROL_DEVELOPMENT_GROUPS) prior.add(controlDevelopmentJobs(catalog, seed, matrix, baseline, index)[0].seed);
  }
  for (let i = 0; i < CONTROL_STRESS_GROUPS; i++) {
    const stress = controlStressJobs(catalog, seed, matrix, baseline, profile, i);
    const inference = controlInferenceJobs(catalog, seed, matrix, baseline, i);
    for (const jobs of [stress, inference]) {
      assert.ok(!prior.has(jobs[0].seed));
      prior.add(jobs[0].seed);
      for (const [j, job] of jobs.entries()) {
        assert.equal(job.seed, jobs[0].seed);
        assert.equal(job.firstPlayer, jobs[0].firstPlayer);
        assert.equal(job.candidateSeat, j % 2);
        assert.deepEqual(job.fixedDecks, jobs[j % 2].fixedDecks);
      }
    }
    assert.notDeepEqual(stress[0].fixedDecks, inference[0].fixedDecks);
    assert.deepEqual(stress.filter((_, j) => j % 2 === 0).map(job => [job.opponentPolicyVersion, job.counterattackOrder]),
      [2, 4, 5].flatMap(policy => [[policy, undefined], [policy, undefined], [policy, 'ordered']]));
    const strategy = MATCHUPS[8 + i % 4].opponent;
    assert.equal(stress[8].opponentResearchRow, matrix[strategy]);
    assert.equal(stress[2].researchRows, undefined);
    assert.deepEqual(inference.filter((_, j) => j % 2 === 0).map(job => job.candidateMixRule),
      [undefined, { mode: 'uniform' }, undefined, { mode: 'profile' }, { mode: 'actions' },
        { mode: 'cards', attenuation: 'posterior' }, { mode: 'cards', attenuation: 'row' }]);
    assert.ok(inference.every(job => job.policyVersion === 4 && job.opponentPolicyVersion === 2));
  }
});

test('confidence attenuation distinguishes the fixed weights and the uniform row without an opponent label', () => {
  const prior = { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 };
  const concentrated = { aggro: .925, midrange: .025, control: .025, 'big-deck': .025 };
  assert.deepEqual(attenuatedResearchWeights(matrix.control, baseline, prior, 'row'), baseline);
  assert.deepEqual(attenuatedResearchWeights(matrix.control, baseline, prior, 'posterior'), mixResearchWeights(matrix.control, prior));
  const full = mixResearchWeights(matrix.control, concentrated);
  assert.ok(Math.abs(attenuatedResearchWeights(matrix.control, baseline, concentrated, 'row').hand - full.hand) < 1e-12);
  const sample = { 2: { uniform: prior, cards: concentrated, profile: concentrated, actions: concentrated } };
  const arms = Array.from({ length: 7 }, () => ({ scores: [1, 0], truncated: 0 }));
  const group = { arms, samples: [sample, sample] };
  assert.ok(isControlInferenceGroup(group));
  if (!isControlInferenceGroup(group)) throw new Error('Invalid test sample');
  const measurements = summarizeControlInference([group]).observationMetrics;
  assert.equal(measurements.find(metric => metric.round === 2 && metric.mode === 'cards' && metric.opponent === 'aggro')?.accuracy, 1);
  assert.equal(measurements.find(metric => metric.round === 2 && metric.mode === 'uniform' && metric.opponent === 'all')?.brier, .75);
  assert.equal(measurements.find(metric => metric.round === 8 && metric.mode === 'cards')?.brier, null);
  assert.equal(isControlInferenceGroup({ arms, samples: [{ 3: sample[2] }, sample] }), false);
});

test('reply scheduling and weight ablation use different fixtures and isolate the intended changes', () => {
  const seed = checkpoint.seed;
  const [tactical] = controlTacticsJobs(catalog, seed, matrix, baseline, 8);
  const replies = controlReplyScheduleJobs(catalog, seed, matrix, baseline, 8);
  const ablation = controlEvaluationJobs(catalog, seed, matrix, baseline, 8);
  const hybrid = controlReplyScheduleJobs(catalog, seed, matrix, baseline, 8, true);
  const phases = controlPhaseJobs(catalog, seed, matrix, baseline, 8);
  assert.equal(new Set([tactical.seed, replies[0].seed, ablation[0].seed, hybrid[0].seed, phases[0].seed]).size, 5);
  assert.notDeepEqual(tactical.fixedDecks, replies[0].fixedDecks);
  assert.notDeepEqual(replies[0].fixedDecks, ablation[0].fixedDecks);
  assert.ok(replies.every(job => job.policyVersion === 4 && job.researchRows?.candidate === matrix.control));
  assert.deepEqual(replies.slice(0, 8).filter((_, i) => i % 2 === 0).map(job => [job.counterattackOrder, job.counterattackSchedule]),
    [[undefined, undefined], ['planned', undefined], [undefined, 'finalists'], ['planned', 'finalists']]);
  assert.deepEqual(hybrid.slice(0, 8).filter((_, i) => i % 2 === 0).map(job => [job.counterattackOrder, job.counterattackSchedule]),
    [[undefined, undefined], ['planned', undefined], [undefined, 'hybrid'], ['planned', 'hybrid']]);
  assert.deepEqual(ablation[2].candidateMixRule, { mode: 'cards', keys: ['lowHealth', 'criticalHealth'] });
  assert.deepEqual(ablation[4].candidateMixRule, { mode: 'cards', keys: ['hand', 'handQuality', 'fatigue'] });
  assert.deepEqual(ablation[8].candidateMixRule, { mode: 'cards', keys: ['trade'] });
  assert.ok(ablation.slice(16).every(job => job.opponentResearchRow === matrix.aggro));
  const weights = resolveResearchWeights(matrix.control, baseline, { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 },
    ablation[2].candidateMixRule);
  assert.equal(weights.hand, baseline.hand);
  assert.ok(weights.lowHealth > baseline.lowHealth);
  const reference: ArmResult = { scores: [1, 0], truncated: 0 }, won: ArmResult = { scores: [1, 1], truncated: 0 };
  const { comparisons } = summarizeControlEvaluation([Array.from({ length: 16 }, (_, i) => i % 2 === 1 ? won : reference)]);
  assert.deepEqual(comparisons.map(group => group.mainEffects.map(effect => [effect.groups, effect.gain])),
    [[[1, .5], [1, 0], [1, 0]], [[1, .5], [1, 0], [1, 0]]]);
});

test('phase gates use inclusive public health and mana thresholds and preserve other weights', () => {
  const { candidateMixRule } = controlPhaseJobs(catalog, checkpoint.seed, matrix, baseline, 0)[8];
  const prior = { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 };
  const resolveAt = (health: number, armor: number, maxMana: number) =>
    resolveResearchWeights(matrix.control, baseline, prior, candidateMixRule, { health, armor, maxMana });
  assert.deepEqual(resolveAt(14, 2, 4), baseline);
  assert.ok(resolveAt(14, 1, 4).lowHealth > baseline.lowHealth);
  assert.equal(resolveAt(14, 1, 4).hand, baseline.hand);
  assert.equal(resolveAt(20, 0, 5).lowHealth, baseline.lowHealth);
  assert.ok(resolveAt(20, 0, 5).hand > baseline.hand);
  assert.equal(resolveAt(12, 0, 5).trade, baseline.trade);
});

test('research fixture reports resume from a whole completed group and reject a different suite', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'control-fixture-'));
  try {
    const output = join(dir, 'report.json'), played: number[] = [];
    const settings = { output, signature: { revision: 1 }, count: 3, limit: 1, label: 'test-fixture',
      valid: (row: unknown, index: number): row is number => row === index,
      start: () => ({ play: (index: number) => { played.push(index); return index; } }),
      summarize: (rows: readonly number[]) => ({ groups: rows.length }),
    };
    assert.equal((await runResearchFixtures(settings)).groups, 1);
    assert.equal((await runResearchFixtures({ ...settings, limit: 3 })).groups, 3);
    assert.deepEqual(played, [0, 1, 2]);
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')).rows, played);
    await assert.rejects(runResearchFixtures({ ...settings, signature: { revision: 2 } }), /Incompatible/);
    assert.deepEqual(played, [0, 1, 2]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
