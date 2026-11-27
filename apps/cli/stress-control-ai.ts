import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CONTROL_STRESS_ARMS, CONTROL_STRESS_GROUPS, CONTROL_STRESS_OPPONENTS,
  armResults, controlStressJobs, isArmResult, pairedArms } from './control-calibration.ts';
import type { ArmResult } from './control-calibration.ts';
import { readControlConfirmation } from './read-control-confirmation.ts';
import { runResearchFixtures } from './run-research-fixtures.ts';
import { createTrainingPool } from './training-match-pool.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, confirmation: { type: 'string' }, report: { type: 'string' },
  catalog: { type: 'string' }, workers: { type: 'string' }, limit: { type: 'string' },
} });
const workers = Number(values.workers ?? 2), limit = Number(values.limit ?? CONTROL_STRESS_GROUPS);
if (!values.checkpoint || !values.confirmation || !values.report || !Number.isInteger(workers) || workers < 1 || workers > 2 ||
    !Number.isInteger(limit) || limit < 1 || limit > CONTROL_STRESS_GROUPS) {
  throw new Error('Usage: stress:control-ai -- --checkpoint FILE --confirmation FILE --report FILE [--workers 1–2] [--limit GROUPS]');
}
const output = resolve(values.report);
if ([values.checkpoint, values.confirmation].some(path => resolve(path) === output)) throw new Error('Use a separate stress report file');
const source = readControlConfirmation(values.checkpoint, values.confirmation, values.catalog);
const signature = { confirmation: source.signature, protocol: 'control-cross-opponent-v1',
  opponents: CONTROL_STRESS_OPPONENTS, arms: CONTROL_STRESS_ARMS, groups: CONTROL_STRESS_GROUPS };
const armCount = CONTROL_STRESS_ARMS.length * CONTROL_STRESS_OPPONENTS.length;
const report = await runResearchFixtures({
  output, signature, count: CONTROL_STRESS_GROUPS, limit, label: 'control-stress',
  valid: (row): row is ArmResult[] => Array.isArray(row) && row.length === armCount && row.every(isArmResult),
  start() {
    const pool = createTrainingPool(source.version, source.hash, workers);
    return { close: pool.close, async play(index) {
      const jobs = controlStressJobs(source.catalog, source.state.seed, source.matrix, source.baseline.weights, source.profile, index);
      return armResults(await pool.run(jobs));
    } };
  },
  summarize(rows) {
    const comparisons = CONTROL_STRESS_OPPONENTS.map((opponent, index) => {
      const start = index * CONTROL_STRESS_ARMS.length;
      return { opponent, selectedVsIncumbent: pairedArms(rows, start, start + 1),
        orderedVsSelected: pairedArms(rows, start + 1, start + 2) };
    });
    return { games: rows.length * armCount * 2, comparisons };
  },
});
console.log(JSON.stringify(report, null, 2));
