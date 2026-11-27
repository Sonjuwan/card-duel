import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { BOT_WEIGHT_KEYS } from '../../packages/engine/src/index.ts';
import { armResults, CONTROL_EVALUATION_ARMS, CONTROL_EVALUATION_FAMILIES, CONTROL_EVALUATION_GROUPS,
  CONTROL_EVALUATION_RIVALS, CONTROL_PHASE_ARMS, controlEvaluationJobs, controlEvaluationKeys, controlPhaseJobs, isArmResult } from './control-calibration.ts';
import type { ArmResult } from './control-calibration.ts';
import { summarizeControlEvaluation, summarizeControlPhases } from './control-evaluation-study.ts';
import { readControlConfirmation } from './read-control-confirmation.ts';
import { resolveResearchWeights } from './research-models.ts';
import { passesResearchTactics } from './research-tactics.ts';
import { runResearchFixtures } from './run-research-fixtures.ts';
import { createTrainingPool } from './training-match-pool.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, confirmation: { type: 'string' }, report: { type: 'string' },
  catalog: { type: 'string' }, workers: { type: 'string' }, limit: { type: 'string' }, 'phase-study': { type: 'boolean' },
} });
const workers = Number(values.workers ?? 2), limit = Number(values.limit ?? CONTROL_EVALUATION_GROUPS);
if (!values.checkpoint || !values.confirmation || !values.report || !Number.isInteger(workers) || workers < 1 || workers > 2 ||
    !Number.isInteger(limit) || limit < 1 || limit > CONTROL_EVALUATION_GROUPS) {
  throw new Error('Usage: study:control-evaluation -- --checkpoint FILE --confirmation FILE --report FILE [--phase-study] [--workers 1–2] [--limit GROUPS]');
}
const output = resolve(values.report);
if ([values.checkpoint, values.confirmation].some(path => resolve(path) === output)) throw new Error('Use a separate evaluation report file');
const source = readControlConfirmation(values.checkpoint, values.confirmation, values.catalog);
const phase = values['phase-study'];
const armCount = (phase ? CONTROL_PHASE_ARMS.length : CONTROL_EVALUATION_ARMS.length) * CONTROL_EVALUATION_RIVALS.length;
const signature = { confirmation: source.signature, protocol: phase ? 'control-evaluation-phases-v1' : 'control-evaluation-v1',
  ...(phase ? { arms: CONTROL_PHASE_ARMS, effectiveHealth: 15, maximumMana: 5 } : { masks: CONTROL_EVALUATION_ARMS }),
  families: CONTROL_EVALUATION_FAMILIES, opponents: CONTROL_EVALUATION_RIVALS, groups: CONTROL_EVALUATION_GROUPS };
const row = source.matrix.control, weights = source.baseline.weights;
const maxMask = CONTROL_EVALUATION_ARMS.at(-1)!;
const selectedKeys = controlEvaluationKeys(maxMask);
const excludedDifferences = BOT_WEIGHT_KEYS.filter(key => !selectedKeys.includes(key) &&
  Object.values(row).some(model => model[key] !== weights[key]));
const report = await runResearchFixtures({
  output, signature, count: CONTROL_EVALUATION_GROUPS, limit, label: signature.protocol,
  valid: (row): row is ArmResult[] => Array.isArray(row) && row.length === armCount && row.every(isArmResult),
  start() {
    const pool = createTrainingPool(source.version, source.hash, workers);
    return { close: pool.close, async play(index) {
      const makeJobs = phase ? controlPhaseJobs : controlEvaluationJobs;
      return armResults(await pool.run(makeJobs(source.catalog, source.state.seed,
        source.matrix, source.baseline.weights, index)));
    } };
  },
  summarize(rows) {
    if (phase) {
      const jobs = controlPhaseJobs(source.catalog, source.state.seed, source.matrix, weights, 0);
      const fixedTactics = CONTROL_PHASE_ARMS.map((arm, i) => {
        const rule = jobs[2 * i].candidateMixRule;
        return { arm, passed: passesResearchTactics(source.tactical, row, {
          policyVersion: 4, ...(rule ? { weightsForPrior: (prior, view) => resolveResearchWeights(row, weights, prior, rule, view.self) }
            : { fixedWeights: weights }),
        }) };
      });
      return { ...summarizeControlPhases(rows), fixedTactics };
    }
    const fixedTactics = CONTROL_EVALUATION_ARMS.map(mask => ({ mask, passed: passesResearchTactics(source.tactical, row, {
      policyVersion: 4, weightsForPrior: prior => resolveResearchWeights(row, weights, prior,
        { mode: 'cards', keys: controlEvaluationKeys(mask) }),
    }) }));
    return { ...summarizeControlEvaluation(rows), excludedDifferences, fixedTactics };
  },
});
console.log(JSON.stringify(report, null, 2));
