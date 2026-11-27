import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CardStore } from '../card-store.ts';
import { aiCatalogHash } from '../ai-profile-store.ts';
import { DEFAULT_BOT_WEIGHTS, validateDeck } from '../../../packages/engine/src/index.ts';
import { createMatchupState, MATCHUPS, beginMatchupTrial, matchupJobs } from '../../cli/matchup-evolution.ts';
import type { MatchupGroup } from '../../cli/matchup-evolution.ts';
import { benchmarkDeck } from '../../cli/research-benchmark-decks.ts';
import { passesResearchTactics } from '../../cli/research-tactics.ts';
import { evaluateIntegrated, RELEASE_GROUPS, releaseJobs, snapshotIntegrated } from '../../cli/integrated-ai-validation.ts';

const { catalog } = new CardStore().read('v0.23.0.json');
const state = () => createMatchupState(aiCatalogHash(catalog), 20261128);
const tactics = { aggro: true, midrange: true, control: true, 'big-deck': true } as const;
const won: MatchupGroup = { candidate: [1, 1], control: [0, 0], truncated: 0 };
const lost: MatchupGroup = { candidate: [0, 0], control: [1, 1], truncated: 0 };
const tied: MatchupGroup = { candidate: [1, 0], control: [1, 0], truncated: 0 };

test('freezes only the 16 incumbent weights and never reads a pending candidate into the matrix', () => {
  const checkpoint = state(), before = snapshotIntegrated(checkpoint);
  checkpoint.models[0].pending = beginMatchupTrial(checkpoint, 0);
  assert.deepEqual(snapshotIntegrated(checkpoint), before);
  checkpoint.models[0].weights.face += .01;
  assert.notEqual(snapshotIntegrated(checkpoint).fingerprint, before.fingerprint);
  assert.notEqual(before.matrix.aggro.aggro.face, checkpoint.models[0].weights.face);
  assert.equal(before.cells.length, 16);
});

test('release fixtures reserve distinct seeds and decks and compare both policies under equal conditions', () => {
  const checkpoint = state(), { matrix } = snapshotIntegrated(checkpoint);
  const seeds = new Set<number>();
  for (const [index, cell] of MATCHUPS.entries()) {
    let trial = beginMatchupTrial(checkpoint, index);
    for (const stage of [0, 1, 2]) {
      trial = { ...trial, stage };
      seeds.add(matchupJobs(catalog, checkpoint, index, trial)[0].seed);
    }
    const jobs = releaseJobs(catalog, checkpoint.seed, matrix, DEFAULT_BOT_WEIGHTS, index);
    assert.ok(!seeds.has(jobs[0].seed));
    for (const seat of [0, 1] as const) {
      const control = jobs[seat], candidate = jobs[seat + 2];
      const pilot = candidate.fixedDecks![seat];
      validateDeck(pilot, catalog);
      assert.equal(candidate.seed, control.seed);
      assert.equal(candidate.firstPlayer, control.firstPlayer);
      assert.equal(candidate.candidateSeat, seat);
      assert.deepEqual(candidate.fixedDecks, control.fixedDecks);
      assert.equal(candidate.opponentPolicyVersion, 2);
      assert.equal(candidate.policyVersion, 4);
      assert.equal(control.policyVersion, 2);
      assert.equal(control.researchRows, undefined);
      assert.deepEqual(candidate.researchRows, { candidate: matrix[cell.own] });
      for (const split of ['development', 'holdout'] as const) {
        const reference = benchmarkDeck(catalog, pilot.heroClass, cell.own, split, candidate.seed);
        assert.notDeepEqual(reference.cards, pilot.cards);
      }
    }
  }
});

test('release gate requires complete, legal paired evidence, tactical safety and improvement without local regression', () => {
  const rows = Array<MatchupGroup>(RELEASE_GROUPS).fill(won);
  assert.ok(evaluateIntegrated(rows, tactics).eligible);
  assert.throws(() => evaluateIntegrated([{ ...won, candidate: [NaN, 1] }], tactics), /Invalid release/);
  assert.equal(evaluateIntegrated(rows, tactics).games, 576);
  assert.deepEqual(evaluateIntegrated(rows.slice(0, 16), tactics).reasons, ['incomplete']);
  assert.ok(evaluateIntegrated(rows, { ...tactics, control: false }).reasons.includes('fixed-tactics'));
  assert.ok(evaluateIntegrated(Array(RELEASE_GROUPS).fill(tied), tactics).reasons.includes('insufficient-overall-improvement'));
  rows[0] = { ...won, truncated: 1 };
  assert.ok(evaluateIntegrated(rows, tactics).reasons.includes('truncated'));
  for (let index = 0; index < RELEASE_GROUPS; index += 16) rows[index] = lost;
  assert.ok(evaluateIntegrated(rows, tactics).reasons.includes('matchup-regression'));
  assert.ok(!evaluateIntegrated(rows, tactics).eligible);
});

test('guarded candidate keeps existing thresholds and uses a separate confirmation split', () => {
  const checkpoint = state(), { matrix } = snapshotIntegrated(checkpoint);
  const previousSeeds = new Set(Array.from({ length: RELEASE_GROUPS }, (_, index) =>
    releaseJobs(catalog, checkpoint.seed, matrix, DEFAULT_BOT_WEIGHTS, index)[0].seed));
  for (const [index, cell] of MATCHUPS.entries()) {
    const jobs = releaseJobs(catalog, checkpoint.seed, matrix, DEFAULT_BOT_WEIGHTS, index, true);
    assert.ok(!previousSeeds.has(jobs[0].seed));
    const guarded = cell.own === 'midrange' || cell.own === 'control';
    for (const seat of [0, 1] as const) {
      const control = jobs[seat], treatment = jobs[seat + 2], pilot = treatment.fixedDecks![seat];
      assert.equal(treatment.policyVersion, guarded ? 5 : 4);
      assert.equal(treatment.researchRows?.candidate, guarded ? undefined : matrix[cell.own]);
      assert.equal(control.policyVersion, 2);
      assert.equal(control.nodes, treatment.nodes);
      assert.equal(control.seed, treatment.seed);
      assert.deepEqual(control.fixedDecks, treatment.fixedDecks);
      const previous = benchmarkDeck(catalog, pilot.heroClass, cell.own, 'release', treatment.seed);
      assert.notDeepEqual(previous.cards, pilot.cards);
      if (guarded) {
        assert.ok(passesResearchTactics(catalog, matrix[cell.own], { policyVersion: 5, fixedWeights: DEFAULT_BOT_WEIGHTS }));
      }
    }
  }
});
