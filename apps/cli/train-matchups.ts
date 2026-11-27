import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createTrainingPool } from './training-match-pool.ts';
import { acquireTrainingLock } from './training-run-lock.ts';
import { aiCatalogHash, aiWeightFingerprint, saveJsonAtomic } from '../server/ai-profile-store.ts';
import { CardStore } from '../server/card-store.ts';
import { beginMatchupTrial, createMatchupState, MATCHUPS, matchupGroup, matchupJobs, recordMatchupGroup, STAGES } from './matchup-evolution.ts';
import type { MatchupState } from './matchup-evolution.ts';
import { parseMatchupState } from './matchup-checkpoint.ts';
import { passesResearchTactics, TACTICAL_CATALOG } from './research-tactics.ts';
import { trainingBudget } from './training-budget.ts';

const { values } = parseArgs({ options: {
  catalog: { type: 'string' }, output: { type: 'string' }, seed: { type: 'string' },
  groups: { type: 'string' }, workers: { type: 'string' }, status: { type: 'boolean' }, recover: { type: 'boolean' }, 'finish-validation': { type: 'boolean' },
} });
function integer(value: string | undefined, fallback: number, min: number, max: number, label: string) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max || !value.trim()) throw new Error('Invalid --' + label);
  return n;
}
const cardStore = new CardStore();
const { catalog, version } = cardStore.read(values.catalog);
const hash = aiCatalogHash(catalog);
const dir = join(resolve(values.output ?? fileURLToPath(new URL('../../data/ai-research/', import.meta.url))), 'matchups-v1', hash);
const checkpoint = join(dir, 'checkpoint.json'), previous = join(dir, 'checkpoint.previous.json'), lock = join(dir, 'train.lock');
const requestedSeed = integer(values.seed, 20261128, 0, 0xffffffff, 'seed');
const groups = integer(values.groups, Infinity, 1, Number.MAX_SAFE_INTEGER, 'groups');
const defaultWorkers = trainingBudget(availableParallelism(), totalmem() / 1024 ** 3).workers;
const workerCount = integer(values.workers, Math.min(defaultWorkers, 4), 1, 4, 'workers');

function readState(path: string) {
  return parseMatchupState(JSON.parse(readFileSync(path, 'utf8')), hash);
}

function show(state: MatchupState) {
  console.log(JSON.stringify({ version, catalogHash: hash, protocol: state.protocol, seed: state.seed, next: MATCHUPS[state.cursor],
    models: state.models.map((model, index) => ({ ...MATCHUPS[index], games: model.games, validationGames: model.validationGames,
      attempts: model.attempts, promotions: model.promotions.length, champion: aiWeightFingerprint(model.weights),
      active: model.pending ? { stage: STAGES[model.pending.stage].name, groups: model.pending.results.length,
        total: STAGES[model.pending.stage].groups, candidate: aiWeightFingerprint(model.pending.candidate) } : null,
      last: model.last })),
  }, null, 2));
}

if ([values.status, values.recover, values['finish-validation']].filter(Boolean).length > 1) {
  throw new Error('Use only one of --status, --recover or --finish-validation');
}
if (values.status) {
  show(existsSync(checkpoint) ? readState(checkpoint) : createMatchupState(hash, requestedSeed));
} else {
  mkdirSync(dir, { recursive: true });
  const release = acquireTrainingLock(lock);
  let pool: ReturnType<typeof createTrainingPool> | undefined;
  let stop = false;
  const stopAfterGroup = () => { stop = true; };
  try {
    let state: MatchupState;
    if (values.recover) {
      let valid = true;
      try { readState(checkpoint); } catch { valid = false; }
      if (valid) throw new Error('Current matchup checkpoint is valid');
      const backup = readState(previous);
      if (existsSync(checkpoint)) {
        const damaged = readFileSync(checkpoint);
        writeFileSync(join(dir, 'checkpoint.damaged-' + Date.now() + '.json'), damaged, { flag: 'wx' });
      }
      saveJsonAtomic(checkpoint, backup);
      show(backup);
    } else {
      state = existsSync(checkpoint) ? readState(checkpoint) : createMatchupState(hash, requestedSeed);
      if (values.seed !== undefined && state.seed !== requestedSeed) throw new Error('Checkpoint seed differs. Use a separate --output for a new experiment');
      if (values['finish-validation'] && !existsSync(checkpoint)) throw new Error('A saved matchup checkpoint is required');
      process.on('SIGINT', stopAfterGroup);
      process.on('SIGTERM', stopAfterGroup);
      pool = createTrainingPool(version, hash, workerCount);
      let saved = structuredClone(state);
      let tacticalCatalog: typeof catalog | undefined;
      for (let completed = 0; completed < groups && !stop; completed++) {
        if (values['finish-validation']) {
          const indices = MATCHUPS.map((_, offset) => (state.cursor + offset) % MATCHUPS.length);
          const next = indices.find(index => (state.models[index].pending?.stage ?? 0) > 0);
          if (next === undefined) break;
          state.cursor = next;
        }
        const index = state.cursor, model = state.models[index];
        const trial = model.pending ??= beginMatchupTrial(state, index);
        const jobs = matchupJobs(catalog, state, index, trial);
        const results = await pool.run(jobs);
        recordMatchupGroup(state, index, matchupGroup(results), row => {
          tacticalCatalog ??= cardStore.read(TACTICAL_CATALOG).catalog;
          return passesResearchTactics(tacticalCatalog, row);
        });
        saveJsonAtomic(previous, saved);
        saveJsonAtomic(checkpoint, state);
        saved = structuredClone(state);
        const { own, opponent } = MATCHUPS[index], last = model.last;
        console.error(`${own} × ${opponent} · ${model.games} games · ${model.promotions.length} promotions` +
          (trial === model.pending && trial.results.length ? ` · ${STAGES[trial.stage].name} ${trial.results.length}/${STAGES[trial.stage].groups}` :
            last ? ` · ${STAGES[last.stage].name} gain ${(last.evidence.gain * 100).toFixed(2)}pp` : ''));
      }
      show(state);
    }
  } finally {
    process.off('SIGINT', stopAfterGroup);
    process.off('SIGTERM', stopAfterGroup);
    try { await pool?.close(); }
    finally { release(); }
  }
}
