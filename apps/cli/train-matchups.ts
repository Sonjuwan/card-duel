import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { aiCatalogHash, aiWeightFingerprint, saveJsonAtomic } from '../server/ai-profile-store.ts';
import { CardStore } from '../server/card-store.ts';
import { beginMatchupTrial, createMatchupState, MATCHUPS, matchupGroup, matchupJobs, recordMatchupGroup, STAGES } from './matchup-evolution.ts';
import type { MatchupState } from './matchup-evolution.ts';
import { parseMatchupState } from './matchup-checkpoint.ts';
import type { TrainingJob, TrainingResult } from './ai-training-match.ts';
import { passesResearchTactics, TACTICAL_CATALOG } from './research-tactics.ts';
import { trainingBudget } from './training-budget.ts';

const { values } = parseArgs({ options: {
  catalog: { type: 'string' }, output: { type: 'string' }, seed: { type: 'string' },
  groups: { type: 'string' }, workers: { type: 'string' }, status: { type: 'boolean' }, recover: { type: 'boolean' },
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

function runGame(worker: Worker, job: TrainingJob, id: number): Promise<TrainingResult> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.off('message', message);
      worker.off('error', error);
      worker.off('exit', exit);
    };
    const message = (reply: { id: number; result?: TrainingResult; error?: string }) => {
      if (reply.id !== id) return;
      cleanup();
      if (reply.result) resolve(reply.result);
      else reject(new Error(reply.error ?? 'Training worker failed'));
    };
    const error = (failure: Error) => { cleanup(); reject(failure); };
    const exit = (code: number) => error(new Error('Training worker exited ' + code));
    worker.on('message', message);
    worker.once('error', error);
    worker.once('exit', exit);
    try { worker.postMessage({ id, job }); } catch (failure) { cleanup(); reject(failure); }
  });
}

function acquireTrainingLock(): number {
  try { return openSync(lock, 'wx'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  // Serialize stale-lock reclaims. All new acquisitions still use O_EXCL.
  const recovery = lock + '.reclaim';
  const recoveryFd = openSync(recovery, 'wx');
  try {
    let owner: string;
    try { owner = readFileSync(lock, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return openSync(lock, 'wx');
    }
    const pid = Number(owner);
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 0x7fffffff) throw new Error('Matchup lock is active or unreadable');
    try { process.kill(pid, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      unlinkSync(lock);
      return openSync(lock, 'wx');
    }
    throw new Error('Matchup training is already running (PID ' + pid + ')');
  } finally {
    closeSync(recoveryFd);
    unlinkSync(recovery);
  }
}

if (values.status && values.recover) throw new Error('Use either --status or --recover');
if (values.status) {
  show(existsSync(checkpoint) ? readState(checkpoint) : createMatchupState(hash, requestedSeed));
} else {
  mkdirSync(dir, { recursive: true });
  const fd = acquireTrainingLock();
  const pool: Worker[] = [];
  const workerFailures = new Map<Worker, Error>();
  let stop = false;
  const stopAfterGroup = () => { stop = true; };
  try {
    writeFileSync(fd, String(process.pid));
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
      process.on('SIGINT', stopAfterGroup);
      process.on('SIGTERM', stopAfterGroup);
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(new URL('./ai-training-worker.ts', import.meta.url), { workerData: { version, hash } });
        // Per-job listeners reject the active group. An idle worker failure
        // must also be detected before dispatching any further work.
        worker.on('error', error => { workerFailures.set(worker, error); });
        worker.on('exit', code => { if (!workerFailures.has(worker)) workerFailures.set(worker, new Error('Training worker exited ' + code)); });
        pool.push(worker);
      }
      let saved = structuredClone(state);
      let tacticalCatalog: typeof catalog | undefined;
      for (let completed = 0; completed < groups && !stop; completed++) {
        const index = state.cursor, model = state.models[index];
        const trial = model.pending ??= beginMatchupTrial(state, index);
        const jobs = matchupJobs(catalog, state, index, trial);
        const results: TrainingResult[] = [];
        for (let start = 0; start < jobs.length; start += pool.length) {
          const batch = await Promise.all(jobs.slice(start, start + pool.length).map((job, i) => {
            const worker = pool[i], failure = workerFailures.get(worker);
            if (failure) throw failure;
            return runGame(worker, job, start + i);
          }));
          results.push(...batch);
        }
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
    try { await Promise.allSettled(pool.map(worker => worker.terminate())); }
    finally { closeSync(fd); unlinkSync(lock); }
  }
}
