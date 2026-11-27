import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { CONTROL_TACTICS_GROUPS, controlTacticsJobs } from './control-calibration.ts';
import { isPublicReplayResult, PUBLIC_ORACLE_LIMIT, PUBLIC_PROBE_BUDGETS, PUBLIC_PROBE_ORDERS,
  REPLAY_BENCH_ARMS, replayPublicTactics, summarizePublicReplay } from './public-tactics-replay.ts';
import type { PublicReplayResult } from './public-tactics-replay.ts';
import { readControlConfirmation } from './read-control-confirmation.ts';
import { runResearchFixtures } from './run-research-fixtures.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, confirmation: { type: 'string' }, report: { type: 'string' },
  catalog: { type: 'string' }, limit: { type: 'string' },
} });
const limit = Number(values.limit ?? CONTROL_TACTICS_GROUPS);
if (!values.checkpoint || !values.confirmation || !values.report || !Number.isInteger(limit) || limit < 1 || limit > CONTROL_TACTICS_GROUPS) {
  throw new Error('Usage: benchmark:public-tactics-replay -- --checkpoint FILE --confirmation FILE --report FILE [--limit GROUPS]');
}
const output = resolve(values.report);
if ([values.checkpoint, values.confirmation].some(path => resolve(path) === output)) throw new Error('Use a separate replay report file');
const source = readControlConfirmation(values.checkpoint, values.confirmation, values.catalog);
const catalog = snapshotBattleCatalog(source.catalog);
const signature = { confirmation: source.signature, protocol: 'public-tactics-replay-v1', groups: CONTROL_TACTICS_GROUPS,
  arms: REPLAY_BENCH_ARMS, orders: PUBLIC_PROBE_ORDERS, budgets: PUBLIC_PROBE_BUDGETS, oracleLimit: PUBLIC_ORACLE_LIMIT };
const report = await runResearchFixtures({
  output, signature, count: CONTROL_TACTICS_GROUPS, limit, label: 'public-tactics-replay',
  valid: (row): row is PublicReplayResult[] => Array.isArray(row) && row.length === REPLAY_BENCH_ARMS.length * 2 && row.every(isPublicReplayResult),
  start: () => ({ play: index => controlTacticsJobs(catalog, source.state.seed, source.matrix, source.baseline.weights, index)
    .map(job => replayPublicTactics(catalog, job)) }),
  summarize: summarizePublicReplay,
});
console.log(JSON.stringify(report, null, 2));
