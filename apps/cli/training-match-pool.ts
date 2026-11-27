import { Worker } from 'node:worker_threads';
import type { TrainingJob, TrainingResult } from './ai-training-match.ts';

function runSeat(worker: Worker, jobs: readonly TrainingJob[], id: number): Promise<TrainingResult[]> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.off('message', message);
      worker.off('error', error);
      worker.off('exit', exit);
    };
    const message = (reply: { id: number; results?: TrainingResult[]; error?: string }) => {
      if (reply.id !== id) return;
      cleanup();
      if (reply.results?.length === jobs.length) resolve(reply.results);
      else reject(new Error(reply.error ?? 'Training worker failed'));
    };
    const error = (failure: Error) => { cleanup(); reject(failure); };
    const exit = (code: number) => error(new Error('Training worker exited ' + code));
    worker.on('message', message);
    worker.once('error', error);
    worker.once('exit', exit);
    try { worker.postMessage({ id, jobs }); } catch (failure) { cleanup(); reject(failure); }
  });
}

export function createTrainingPool(version: string, hash: string, count: number) {
  const failures = new Map<Worker, Error>();
  const pool: Worker[] = [];
  const close = () => Promise.allSettled(pool.map(worker => worker.terminate()));

  try {
    for (let i = 0; i < Math.min(count, 2); i++) {
      const worker = new Worker(new URL('./ai-training-worker.ts', import.meta.url), { workerData: { version, hash } });
      worker.on('error', error => { failures.set(worker, error); });
      worker.on('exit', code => {
        if (!failures.has(worker)) failures.set(worker, new Error('Training worker exited ' + code));
      });
      pool.push(worker);
    }
  } catch (error) {
    void close();
    throw error;
  }

  return {
    async run(jobs: readonly TrainingJob[]) {
      if (jobs.length < 4 || jobs.length % 2 !== 0 ||
          jobs.some((job, index) => job.candidateSeat !== index % 2)) {
        throw new Error('A matched fixture needs complete seat pairs');
      }
      const pair = (seat: 0 | 1) => {
        const worker = pool[seat % pool.length], failure = failures.get(worker);
        if (failure) throw failure;
        return runSeat(worker, jobs.filter((_, index) => index % 2 === seat), seat);
      };
      const [first, second] = pool.length === 1 ? [await pair(0), await pair(1)] : await Promise.all([pair(0), pair(1)]);
      return first.flatMap((result, index) => [result, second[index]]);
    },
    close,
  };
}
