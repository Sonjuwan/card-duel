import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { aiCatalogHash, aiWeightFingerprint, AI_RELEASE_ROOT, readChampion } from '../server/ai-profile-store.ts';
import { CardStore } from '../server/card-store.ts';
import { RESEARCH_STRATEGIES } from '../../packages/engine/src/index.ts';
import type { Action, PlayerId, PlayerView } from '../../packages/engine/src/index.ts';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { parseMatchupState } from './matchup-checkpoint.ts';
import { isMatchupGroup, MATCHUPS, matchupGroup } from './matchup-evolution.ts';
import { mixResearchWeights } from './research-models.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import { RELEASE_GROUPS, RELEASE_SUITE, releaseJobs, snapshotIntegrated } from './integrated-ai-validation.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, report: { type: 'string' }, strategy: { type: 'string' }, catalog: { type: 'string' }, guarded: { type: 'boolean' },
} });
const strategy = RESEARCH_STRATEGIES.find(own => own === values.strategy);
if (!values.checkpoint || !values.report || !strategy) {
  throw new Error('Usage: diagnose:integrated-ai -- --checkpoint FILE --report FILE --strategy STRATEGY [--catalog VERSION] [--guarded]');
}
const store = new CardStore();
const { catalog: cardCatalog, version } = store.read(values.catalog);
const hash = aiCatalogHash(cardCatalog);
const catalog = snapshotBattleCatalog(cardCatalog);
const state = parseMatchupState(JSON.parse(readFileSync(values.checkpoint, 'utf8')), hash);
const snapshot = snapshotIntegrated(state), baseline = readChampion(hash, AI_RELEASE_ROOT);
const original = JSON.parse(readFileSync(values.report, 'utf8'));
if (!baseline || original?.signature?.version !== version || original.signature.catalogHash !== hash ||
    original.signature.seed !== state.seed || original.signature.matrix !== snapshot.fingerprint ||
    original.signature.baseline !== aiWeightFingerprint(baseline.weights) ||
    JSON.stringify(original.signature.suite) !== JSON.stringify(RELEASE_SUITE) ||
    !Array.isArray(original.results) || original.results.length !== RELEASE_GROUPS || !original.results.every(isMatchupGroup)) {
  throw new Error('The original release report does not match the checkpoint and catalog');
}
type Step = { actor: PlayerId; action: Action; view: PlayerView };
function describe(step: Step) {
  const { action, view, actor } = step;
  return {
    turn: view.turn, actor, action,
    card: action.type === 'playCard' ? view.self.hand.find(card => card.instanceId === action.instanceId)?.cardId : undefined,
    mana: view.self.mana, health: [view.self.health + view.self.armor, view.opponent.health + view.opponent.armor],
    board: [view.self.board.map(card => card.cardId), view.opponent.board.map(card => card.cardId)],
  };
}

const comparisons = [
  { name: 'p2-fixed', policy: 2, weights: 'fixed' }, { name: 'p3-fixed', policy: 3, weights: 'fixed' },
  { name: 'p4-fixed', policy: 4, weights: 'fixed' }, { name: 'p4-uniform', policy: 4, weights: 'uniform' },
  { name: 'p2-inferred', policy: 2, weights: 'inferred' }, { name: 'p3-inferred', policy: 3, weights: 'inferred' },
  { name: 'p5-fixed', policy: 5, weights: 'fixed' }, { name: 'p4-inferred', policy: 4, weights: 'inferred' },
] as const;
const arms = values.guarded ? comparisons.filter(arm => ['p2-fixed', 'p5-fixed', 'p4-inferred'].includes(arm.name)) : comparisons;
for (const [index, result] of original.results.entries()) {
  const cell = MATCHUPS[index % MATCHUPS.length];
  if (cell.own !== strategy || result.truncated ||
      result.candidate[0] + result.candidate[1] >= result.control[0] + result.control[1]) continue;
  const jobs = releaseJobs(catalog, state.seed, snapshot.matrix, baseline.weights, index);
  const cacheBySeat = [new Map<string, Action[]>(), new Map<string, Action[]>()];
  const output = arms.map(arm => ({
    ...arm,
    games: [0, 1].map(seat => {
      const control = jobs[seat], trace: Step[] = [];
      const result = playTrainingMatch(catalog, {
        ...control, policyVersion: arm.policy,
        candidate: arm.weights === 'uniform'
          ? mixResearchWeights(snapshot.matrix[strategy], { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 })
          : control.candidate,
        ...(arm.weights === 'inferred' ? { researchRows: jobs[seat + 2].researchRows } : {}),
      }, { reuseDecisions: cacheBySeat[seat], observeAction: (view, actor, action) => { trace.push({ view, actor, action }); } });
      return { result, trace };
    }),
  }));
  const replay = matchupGroup([...output[0].games, ...output[output.length - 1].games].map(game => game.result));
  if (JSON.stringify(replay) !== JSON.stringify(result)) throw new Error('Original release group did not reproduce: ' + index);
  const baselineGames = output[0].games;
  console.log(JSON.stringify({ index, cell, seed: jobs[0].seed, original: replay, arms: output.map(arm => ({
    name: arm.name, games: arm.games.map((game, seat) => {
      const reference = baselineGames[seat].trace;
      const difference = game.trace.findIndex((step, move) =>
        JSON.stringify(step.action) !== JSON.stringify(reference[move]?.action) || step.actor !== reference[move]?.actor);
      return { ...game.result, firstChange: difference === -1 ? null : {
        move: difference + 1, previous: reference[difference] ? describe(reference[difference]) : null,
        next: describe(game.trace[difference]),
      } };
    }),
  })) }));
}
