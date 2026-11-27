import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { armResults, CONTROL_CELLS, CONTROL_HYBRID_ARMS, CONTROL_REPLY_ARMS, CONTROL_REPLY_GROUPS, CONTROL_REPLY_RIVALS,
  controlReplyScheduleJobs, isArmResult, pairedArms } from './control-calibration.ts';
import type { ArmResult } from './control-calibration.ts';
import { MATCHUPS } from './matchup-evolution.ts';
import { readControlConfirmation } from './read-control-confirmation.ts';
import { passesResearchTactics } from './research-tactics.ts';
import { runResearchFixtures } from './run-research-fixtures.ts';
import { createTrainingPool } from './training-match-pool.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, confirmation: { type: 'string' }, report: { type: 'string' },
  catalog: { type: 'string' }, workers: { type: 'string' }, limit: { type: 'string' }, hybrid: { type: 'boolean' },
} });
const workers = Number(values.workers ?? 2), limit = Number(values.limit ?? CONTROL_REPLY_GROUPS);
if (!values.checkpoint || !values.confirmation || !values.report || !Number.isInteger(workers) || workers < 1 || workers > 2 ||
    !Number.isInteger(limit) || limit < 1 || limit > CONTROL_REPLY_GROUPS) {
  throw new Error('Usage: study:control-reply-schedule -- --checkpoint FILE --confirmation FILE --report FILE [--hybrid] [--workers 1–2] [--limit GROUPS]');
}
const output = resolve(values.report);
if ([values.checkpoint, values.confirmation].some(path => resolve(path) === output)) throw new Error('Use a separate schedule report file');
const source = readControlConfirmation(values.checkpoint, values.confirmation, values.catalog);
const arms = values.hybrid ? CONTROL_HYBRID_ARMS : CONTROL_REPLY_ARMS;
const armCount = arms.length * CONTROL_REPLY_RIVALS.length;
const protocol = values.hybrid ? 'control-reply-hybrid-v1' : 'control-reply-schedule-v1';
const signature = { confirmation: source.signature, protocol, arms,
  opponents: CONTROL_REPLY_RIVALS, groups: CONTROL_REPLY_GROUPS };
const report = await runResearchFixtures({
  output, signature, count: CONTROL_REPLY_GROUPS, limit, label: protocol,
  valid: (row): row is ArmResult[] => Array.isArray(row) && row.length === armCount && row.every(isArmResult),
  start() {
    const pool = createTrainingPool(source.version, source.hash, workers);
    return { close: pool.close, async play(index) {
      const jobs = controlReplyScheduleJobs(source.catalog, source.state.seed, source.matrix, source.baseline.weights, index, values.hybrid);
      return armResults(await pool.run(jobs));
    } };
  },
  summarize(rows) {
    const fixedTactics = controlReplyScheduleJobs(source.catalog, source.state.seed, source.matrix, source.baseline.weights, 0, values.hybrid)
      .filter((_, i) => i < 2 * arms.length && i % 2 === 0).map((job, i) => ({
        arm: arms[i], passed: passesResearchTactics(source.tactical, source.matrix.control, {
          policyVersion: 4, counterattackOrder: job.counterattackOrder, counterattackSchedule: job.counterattackSchedule,
        }),
      }));
    const groups = CONTROL_REPLY_RIVALS.map((opponent, index) => {
      const from = index * arms.length;
      const comparisons = [
        ['order-with-beam', 0, 1], ['allocation-with-natural', 0, 2],
        [values.hybrid ? 'order-with-hybrid' : 'order-with-finalists', 2, 3], ['allocation-with-planned', 1, 3], ['both-vs-current', 0, 3],
      ] as const;
      return { opponent, comparisons: comparisons.map(([change, a, b]) => ({ change, ...pairedArms(rows, from + a, from + b) })),
        byDeck: CONTROL_CELLS.map((cell, i) => ({ strategy: MATCHUPS[cell].opponent,
          ...pairedArms(rows.filter((_, index) => index % CONTROL_CELLS.length === i), from, from + 3) })),
      };
    });
    return { groups: rows.length, games: rows.length * armCount * 2, fixedTactics, comparisons: groups };
  },
});
console.log(JSON.stringify(report, null, 2));
