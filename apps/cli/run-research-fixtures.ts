import { existsSync, readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { saveJsonAtomic } from '../server/ai-profile-store.ts';
import { acquireTrainingLock } from './training-run-lock.ts';

type FixtureRun<T> = { play: (index: number) => T | Promise<T>; close?: () => Promise<unknown> };

export async function runResearchFixtures<T, Summary extends object>(settings: {
  output: string; signature: object; count: number; limit: number; label: string;
  valid: (row: unknown, index: number) => row is T;
  start: () => FixtureRun<T>;
  summarize: (rows: readonly T[]) => Summary;
}): Promise<{ signature: object } & Summary> {
  const { output, signature, count, limit, label } = settings;
  const unlock = acquireTrainingLock(output + '.lock');
  let run: FixtureRun<T> | undefined;
  let stop = false;
  const stopAfterGroup = () => { stop = true; };
  process.on('SIGINT', stopAfterGroup);
  process.on('SIGTERM', stopAfterGroup);
  try {
    let rows: T[] = [];
    if (existsSync(output)) {
      const saved = JSON.parse(readFileSync(output, 'utf8'));
      if (JSON.stringify(saved?.signature) !== JSON.stringify(signature) || !Array.isArray(saved.rows) ||
          saved.rows.length > count || !saved.rows.every(settings.valid)) {
        throw new Error('Incompatible ' + label + ' report');
      }
      rows = saved.rows;
    }
    if (rows.length < count) {
      run = settings.start();
      const end = Math.min(count, rows.length + limit);
      while (!stop && rows.length < end) {
        const row = await run.play(rows.length);
        if (!settings.valid(row, rows.length)) throw new Error('Invalid ' + label + ' result at fixture ' + rows.length);
        rows.push(row);
        saveJsonAtomic(output, { signature, rows });
        if (rows.length % 12 === 0) console.error(`${label} ${rows.length}/${count}`);
        await setImmediate();
      }
    }
    const report = { signature, ...settings.summarize(rows) };
    saveJsonAtomic(output, { ...report, rows });
    return report;
  } finally {
    process.off('SIGINT', stopAfterGroup);
    process.off('SIGTERM', stopAfterGroup);
    try { await run?.close?.(); } finally { unlock(); }
  }
}
