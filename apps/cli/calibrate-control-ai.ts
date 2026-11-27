import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RELEASE_GROUPS } from './integrated-ai-validation.ts';
import { armResults, CONTROL_DEVELOPMENT_GROUPS, controlConfirmationJobs, controlDevelopmentJobs, isArmResult,
  summarizeControlDevelopment } from './control-calibration.ts';
import type { ArmResult } from './control-calibration.ts';
import { confirmationArmCount, confirmationSignature, confirmControlTactics, developmentArmCount, developmentSignature,
  developControlTactics, evaluateControlEvidence, loadControlEvidence, readControlDevelopment } from './control-evidence.ts';
import { runResearchFixtures } from './run-research-fixtures.ts';
import { createTrainingPool } from './training-match-pool.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, report: { type: 'string' }, catalog: { type: 'string' },
  development: { type: 'string' }, workers: { type: 'string' }, limit: { type: 'string' },
} });
const count = values.development ? RELEASE_GROUPS : CONTROL_DEVELOPMENT_GROUPS;
const workers = Number(values.workers ?? 2), limit = Number(values.limit ?? count);
if (!values.checkpoint || !values.report || !Number.isInteger(workers) || workers < 1 || workers > 2 ||
    !Number.isInteger(limit) || limit < 1 || limit > count || values.development === '') {
  throw new Error('Usage: calibrate:control-ai -- --checkpoint FILE --report FILE [--development COMPLETE_DEVELOPMENT_FILE] [--workers 1–2] [--limit GROUPS]');
}
const output = resolve(values.report);
if ([values.checkpoint, values.development].some(path => path && resolve(path) === output)) {
  throw new Error('The report must be separate from the input files');
}
const source = loadControlEvidence(values.checkpoint, values.catalog);
const { catalog, state, version, hash, matrix, baseline } = source;
const profileTactics = developControlTactics(source);
const development = values.development ? readControlDevelopment(values.development, source, profileTactics) : undefined;
const signature = development ? confirmationSignature(source, development.selected, development.hash) : developmentSignature(source);
const expectedArms = development ? confirmationArmCount : developmentArmCount;
const report = await runResearchFixtures({
  output, signature, count, limit, label: signature.split,
  valid: (row, index): row is ArmResult[] => Array.isArray(row) && row.length === expectedArms(index) && row.every(isArmResult),
  start() {
    const pool = createTrainingPool(version, hash, workers);
    return { close: pool.close, async play(index) {
      const jobs = development ? controlConfirmationJobs(catalog, state.seed, matrix, baseline.weights, development.selected, index)
        : controlDevelopmentJobs(catalog, state.seed, matrix, baseline.weights, index);
      return armResults(await pool.run(jobs));
    } };
  },
  summarize(rows) {
    if (!development) return summarizeControlDevelopment(rows, profileTactics);
    const { selected, groups } = development;
    const tactics = confirmControlTactics(source, selected, profileTactics);
    return { development: { selected, groups }, tactics, ...evaluateControlEvidence(rows, tactics) };
  },
});
console.log(JSON.stringify(report, null, 2));
