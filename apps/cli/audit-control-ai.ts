import { readControlConfirmation } from './read-control-confirmation.ts';
import { parseArgs } from 'node:util';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { auditControlDecision } from './control-decision-audit.ts';
import { controlConfirmationJobs } from './control-calibration.ts';
import { MATCHUPS } from './matchup-evolution.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, report: { type: 'string' }, catalog: { type: 'string' },
  seat: { type: 'string' },
} });
if (!values.checkpoint || !values.report || (values.seat !== undefined && !['0', '1'].includes(values.seat))) {
  throw new Error('Usage: audit:control-ai -- --checkpoint FILE --report COMPLETE_CONFIRMATION_FILE [--catalog VERSION] [--seat 0|1]');
}
const { catalog: raw, state, baseline, matrix, profile, rows } =
  readControlConfirmation(values.checkpoint, values.report, values.catalog);
const catalog = snapshotBattleCatalog(raw);
for (const [index, row] of rows.entries()) {
  const cell = MATCHUPS[index % MATCHUPS.length];
  if (cell.own !== 'control') continue;
  const [, candidate, incumbent] = row;
  if (candidate.truncated || incumbent.truncated) continue;
  const jobs = controlConfirmationJobs(catalog, state.seed, matrix, baseline.weights, profile, index);
  for (const seat of [0, 1] as const) {
    if (values.seat !== undefined && Number(values.seat) !== seat) continue;
    if (candidate.scores[seat] === incumbent.scores[seat]) continue;
    const audit = auditControlDecision(catalog, jobs[4 + seat], jobs[2 + seat]);
    if (audit.incumbent.truncated || audit.candidate.truncated || audit.incumbent.score !== incumbent.scores[seat] ||
        audit.candidate.score !== candidate.scores[seat]) throw new Error('Confirmation result did not reproduce at fixture ' + index);
    console.log(JSON.stringify({ index, cell, seat, seed: jobs[2 + seat].seed, ...audit }));
  }
}
