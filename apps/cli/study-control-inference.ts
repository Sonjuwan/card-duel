import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { armResults, CONTROL_INFERENCE_ARMS, CONTROL_INFERENCE_GROUPS, controlInferenceJobs } from './control-calibration.ts';
import { isControlInferenceGroup, summarizeControlInference } from './control-inference-study.ts';
import { readControlConfirmation } from './read-control-confirmation.ts';
import { INFERENCE_HORIZONS, INFERENCE_MODES } from './research-models.ts';
import { runResearchFixtures } from './run-research-fixtures.ts';
import { createTrainingPool } from './training-match-pool.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, confirmation: { type: 'string' }, report: { type: 'string' },
  catalog: { type: 'string' }, workers: { type: 'string' }, limit: { type: 'string' },
} });
const workers = Number(values.workers ?? 2), limit = Number(values.limit ?? CONTROL_INFERENCE_GROUPS);
if (!values.checkpoint || !values.confirmation || !values.report || !Number.isInteger(workers) || workers < 1 || workers > 2 ||
    !Number.isInteger(limit) || limit < 1 || limit > CONTROL_INFERENCE_GROUPS) {
  throw new Error('Usage: study:control-inference -- --checkpoint FILE --confirmation FILE --report FILE [--workers 1–2] [--limit GROUPS]');
}
const output = resolve(values.report);
if ([values.checkpoint, values.confirmation].some(path => resolve(path) === output)) throw new Error('Use a separate inference report file');
const source = readControlConfirmation(values.checkpoint, values.confirmation, values.catalog);
const signature = { confirmation: source.signature, protocol: 'control-inference-v1', arms: CONTROL_INFERENCE_ARMS,
  groups: CONTROL_INFERENCE_GROUPS, modes: INFERENCE_MODES, horizons: INFERENCE_HORIZONS };
const report = await runResearchFixtures({
  output, signature, count: CONTROL_INFERENCE_GROUPS, limit, label: 'control-inference', valid: isControlInferenceGroup,
  start() {
    const pool = createTrainingPool(source.version, source.hash, workers);
    return { close: pool.close, async play(index) {
      const jobs = controlInferenceJobs(source.catalog, source.state.seed, source.matrix, source.baseline.weights, index);
      const raw = await pool.run(jobs);
      const group = { arms: armResults(raw), samples: [raw[0].inferenceSamples, raw[1].inferenceSamples] };
      if (!isControlInferenceGroup(group)) throw new Error('Incomplete inference samples');
      return group;
    } };
  },
  summarize: summarizeControlInference,
});
console.log(JSON.stringify(report, null, 2));
