import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { aiCatalogHash, AI_RELEASE_ROOT, aiWeightFingerprint, readChampion, saveJsonAtomic } from '../server/ai-profile-store.ts';
import { RESEARCH_STRATEGIES } from '../../packages/engine/src/index.ts';
import type { ResearchStrategy } from '../../packages/engine/src/index.ts';
import { CardStore } from '../server/card-store.ts';
import { parseMatchupState } from './matchup-checkpoint.ts';
import { isMatchupGroup, matchupGroup } from './matchup-evolution.ts';
import type { MatchupGroup } from './matchup-evolution.ts';
import { evaluateIntegrated, RELEASE_GROUPS, RELEASE_SUITE, releaseJobs, releaseProfile, snapshotIntegrated, WEAK_STRATEGY_CANDIDATE } from './integrated-ai-validation.ts';
import { passesResearchTactics, TACTICAL_CATALOG } from './research-tactics.ts';
import { createTrainingPool } from './training-match-pool.ts';
import { acquireTrainingLock } from './training-run-lock.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, report: { type: 'string' }, catalog: { type: 'string' },
  workers: { type: 'string' }, limit: { type: 'string' }, candidate: { type: 'string' },
} });
const workers = Number(values.workers ?? 1), limit = Number(values.limit ?? RELEASE_GROUPS);
if (!values.checkpoint || !values.report || !Number.isInteger(workers) || workers < 1 || workers > 4 ||
    !Number.isInteger(limit) || limit < 1 || limit > RELEASE_GROUPS ||
    (values.candidate !== undefined && values.candidate !== WEAK_STRATEGY_CANDIDATE)) {
  throw new Error('Usage: verify:integrated-ai -- --checkpoint FILE --report FILE [--catalog VERSION] [--workers 1–4] [--limit GROUPS] [--candidate weak-fixed-guarded-v1]');
}
const holdout = values.candidate === WEAK_STRATEGY_CANDIDATE;
const reportPath = resolve(values.report);
if (resolve(values.checkpoint) === reportPath) throw new Error('Report and research checkpoint must use separate files');
const store = new CardStore(), { catalog, version } = store.read(values.catalog), hash = aiCatalogHash(catalog);
const state = parseMatchupState(JSON.parse(readFileSync(values.checkpoint, 'utf8')), hash);
if (state.models.some(model => (model.pending?.stage ?? 0) > 0)) throw new Error('Finish active candidate validation before freezing the matrix');

const baseline = readChampion(hash, AI_RELEASE_ROOT);
if (!baseline) throw new Error('No shipped baseline for this card catalog');
const snapshot = snapshotIntegrated(state);
const tacticalCatalog = store.read(TACTICAL_CATALOG).catalog;
const signature = { suite: RELEASE_SUITE, version, catalogHash: hash, seed: state.seed,
  matrix: snapshot.fingerprint, baseline: aiWeightFingerprint(baseline.weights),
  tacticalCatalogHash: aiCatalogHash(tacticalCatalog),
  ...(holdout ? { candidate: WEAK_STRATEGY_CANDIDATE, split: 'confirmation',
    profiles: Object.fromEntries(RESEARCH_STRATEGIES.map(own => [own, releaseProfile(own, true)])) } : {}) };
const tactics = Object.fromEntries(RESEARCH_STRATEGIES.map(own => {
  const profile = releaseProfile(own, holdout);
  return [own, passesResearchTactics(tacticalCatalog, snapshot.matrix[own], { policyVersion: profile.policyVersion,
    ...(profile.useMatrix ? {} : { fixedWeights: baseline.weights }),
  })];
})) as Record<ResearchStrategy, boolean>;
const release = acquireTrainingLock(reportPath + '.lock');
let pool: ReturnType<typeof createTrainingPool> | undefined;
let stop = false;
const stopAfterGroup = () => { stop = true; };
process.on('SIGINT', stopAfterGroup);
process.on('SIGTERM', stopAfterGroup);
try {
  const results: MatchupGroup[] = [];
  if (existsSync(reportPath)) {
    const old = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (!old || JSON.stringify(old.signature) !== JSON.stringify(signature) || !Array.isArray(old.results) ||
        old.results.length > RELEASE_GROUPS || !old.results.every(isMatchupGroup)) {
      throw new Error('The saved report is incompatible with this matrix or release suite');
    }
    results.push(...old.results);
  }
  const makeReport = () => ({ signature, cells: snapshot.cells, weights: snapshot.matrix, tactics, results,
    evaluation: evaluateIntegrated(results, tactics),
  });
  if (results.length < RELEASE_GROUPS) {
    pool = createTrainingPool(version, hash, workers);
    const end = Math.min(RELEASE_GROUPS, results.length + limit);
    while (!stop && results.length < end) {
      const jobs = releaseJobs(catalog, state.seed, snapshot.matrix, baseline.weights, results.length, holdout);
      results.push(matchupGroup(await pool.run(jobs)));
      saveJsonAtomic(reportPath, makeReport());
      if (results.length % 16 === 0) console.error(`Release fixtures ${results.length}/${RELEASE_GROUPS}`);
    }
  }
  const report = makeReport();
  saveJsonAtomic(reportPath, report);
  console.log(JSON.stringify(report.evaluation, null, 2));
} finally {
  process.off('SIGINT', stopAfterGroup);
  process.off('SIGTERM', stopAfterGroup);
  try { await pool?.close(); } finally { release(); }
}
