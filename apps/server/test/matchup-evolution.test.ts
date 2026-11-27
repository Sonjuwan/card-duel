import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CardStore } from '../card-store.ts';
import { aiCatalogHash, aiWeightFingerprint } from '../ai-profile-store.ts';
import { validateDeck, RESEARCH_STRATEGIES } from '../../../packages/engine/src/index.ts';
import { beginMatchupTrial, createMatchupState, evaluateMatchupStage, MATCHUPS, matchupJobs, recordMatchupGroup, STAGES } from '../../cli/matchup-evolution.ts';
import type { MatchupGroup } from '../../cli/matchup-evolution.ts';
import { parseMatchupState } from '../../cli/matchup-checkpoint.ts';
import { initialResearchRow } from '../../cli/research-models.ts';
import { passesResearchTactics } from '../../cli/research-tactics.ts';

const { catalog } = new CardStore().read('v0.23.0.json');
const hash = aiCatalogHash(catalog);
const fixed = () => createMatchupState(hash, 8765);
const winning: MatchupGroup = { candidate: [1, 1], control: [0, 0], truncated: 0 };
const tied: MatchupGroup = { candidate: [1, 0], control: [1, 0], truncated: 0 };

test('all 16 matchup trials keep each pilot deck, rival row, seed and seat fixed within comparisons', () => {
  const state = fixed();
  const seeds = new Set<number>();
  for (const [index, { own, opponent }] of MATCHUPS.entries()) {
    const trial = beginMatchupTrial(state, index);
    for (const [stage] of STAGES.entries()) {
      const jobs = matchupJobs(catalog, state, index, { ...trial, stage });
      assert.equal(jobs.length, 4);
      assert.ok(!seeds.has(jobs[0].seed));
      seeds.add(jobs[0].seed);
      for (const seat of [0, 1] as const) {
        const base = jobs[seat], fresh = jobs[seat + 2];
        assert.equal(base.candidateSeat, seat);
        assert.equal(fresh.policyVersion, 4);
        assert.equal(base.seed, fresh.seed);
        assert.equal(base.firstPlayer, fresh.firstPlayer);
        assert.deepEqual(base.fixedDecks, fresh.fixedDecks);
        assert.deepEqual(base.researchRows!.opponent, fresh.researchRows!.opponent);
        assert.deepEqual(fresh.researchRows!.candidate[opponent], trial.candidate);
        assert.notDeepEqual(fresh.researchRows!.candidate[opponent], base.researchRows!.candidate[opponent]);
        for (const strategy of RESEARCH_STRATEGIES.filter(value => value !== opponent)) {
          assert.deepEqual(base.researchRows!.candidate[strategy], fresh.researchRows!.candidate[strategy]);
        }
        assert.equal(base.candidateStrategy, undefined);
        for (const deck of fresh.fixedDecks!) validateDeck(deck, catalog);
      }
      assert.deepEqual(jobs[0].fixedDecks, [...jobs[1].fixedDecks!].reverse());
      assert.deepEqual(jobs[0].researchRows!.candidate, initialResearchRow(own));
    }
  }
});

test('partially completed round-robin trials resume identical next fixtures without sharing counters', () => {
  const state = fixed();
  const open = (index: number) => { state.models[index].pending = beginMatchupTrial(state, index); };
  for (let index = 0; index < MATCHUPS.length; index++) {
    open(index);
    recordMatchupGroup(state, index, tied, () => assert.fail('screen cannot promote'));
  }
  assert.equal(state.cursor, 0);
  assert.ok(state.models.every(model => model.games === 4 && model.pending?.results.length === 1));
  const restored = parseMatchupState(JSON.parse(JSON.stringify(state)), hash);
  assert.deepEqual(matchupJobs(catalog, restored, 0, restored.models[0].pending!),
    matchupJobs(catalog, state, 0, state.models[0].pending!));
  recordMatchupGroup(restored, 0, tied, () => assert.fail('screen cannot promote'));
  assert.equal(restored.models[0].games, 8);
  assert.equal(restored.models[1].games, 4);
  assert.throws(() => parseMatchupState(restored, 'another-card-hash'), /incompatible/);
  restored.models[1].pending!.results[0] = { ...tied, candidate: [0, .9] };
  assert.throws(() => parseMatchupState(restored, hash), /incompatible/);
});

test('promotion requires newly seeded stages, statistical evidence and the actual fixed tactics', () => {
  const state = fixed(), index = 0, model = state.models[index];
  const fingerprint = aiWeightFingerprint(model.weights);
  const gate = (accept: boolean) => {
    model.pending = beginMatchupTrial(state, index);
    for (const [stage, config] of STAGES.entries()) {
      for (let group = 0; group < config.groups; group++) {
        state.cursor = index;
        recordMatchupGroup(state, index, winning, row => {
          assert.equal(stage, 2);
          return accept && passesResearchTactics(catalog, row);
        });
      }
      assert.equal(model.promotions.length, stage === 2 && accept ? 1 : 0);
    }
  };
  gate(false);
  assert.equal(model.promotions.length, 0);
  assert.equal(model.last?.tactics, 'failed');
  assert.equal(aiWeightFingerprint(model.weights), fingerprint);
  gate(true);
  assert.equal(model.last?.tactics, 'passed');
  assert.equal(model.promotions[0].attempt, 1);
  assert.equal(aiWeightFingerprint(model.promotions[0].previous), fingerprint);
  assert.notEqual(aiWeightFingerprint(model.weights), fingerprint);
  assert.equal(model.games, 2 * (32 + 128 + 512));
  assert.equal(model.validationGames, 2 * (128 + 512));
  assert.ok(state.models.slice(1).every(other => other.games === 0 && other.promotions.length === 0));
  assert.deepEqual(parseMatchupState(JSON.parse(JSON.stringify(state)), hash), state);
});

test('cut-off games, tiny lucky improvements and reference regressions fail the final judge', () => {
  const trial = { ...beginMatchupTrial(fixed(), 0), stage: 2, results: Array<MatchupGroup>(128).fill(tied) };
  trial.results[0] = winning;
  assert.equal(evaluateMatchupStage(trial, 0).passed, false);
  trial.results.fill(winning);
  trial.results[15] = { ...winning, truncated: 1 };
  assert.equal(evaluateMatchupStage(trial, 0).passed, false);
  trial.results.forEach((_, index) => {
    trial.results[index] = index % 4 === 3 ? { candidate: [0, 0], control: [1, 1], truncated: 0 } : winning;
  });
  const report = evaluateMatchupStage(trial, 0);
  assert.ok(report.gain > 0);
  assert.ok(report.p < report.alpha);
  assert.ok(report.referenceGain < 0);
  assert.equal(report.passed, false);
});
