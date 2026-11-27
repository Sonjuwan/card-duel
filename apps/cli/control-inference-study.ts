import { RESEARCH_STRATEGIES } from '../../packages/engine/src/deck-strategies.ts';
import { CONTROL_CELLS, CONTROL_INFERENCE_ARMS, isArmResult, pairedArms } from './control-calibration.ts';
import type { ArmResult } from './control-calibration.ts';
import type { InferenceSamples } from './ai-training-match.ts';
import { MATCHUPS } from './matchup-evolution.ts';
import { INFERENCE_HORIZONS, INFERENCE_MODES } from './research-models.ts';

export type ControlInferenceGroup = { arms: ArmResult[]; samples: [InferenceSamples, InferenceSamples] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isControlInferenceGroup(value: unknown): value is ControlInferenceGroup {
  if (!isRecord(value) || !Array.isArray(value.arms) || value.arms.length !== CONTROL_INFERENCE_ARMS.length ||
      !value.arms.every(isArmResult) || !Array.isArray(value.samples) || value.samples.length !== 2) return false;
  return value.samples.every(sample => isRecord(sample) && Object.keys(sample).every(key =>
    INFERENCE_HORIZONS.some(round => String(round) === key)) && Object.values(sample).every(modes =>
    isRecord(modes) && INFERENCE_MODES.every(mode => {
      const probabilities = modes[mode];
      if (!isRecord(probabilities)) return false;
      const values = RESEARCH_STRATEGIES.map(strategy => Number(probabilities[strategy]));
      return values.every((value, index) => value === probabilities[RESEARCH_STRATEGIES[index]] && value > 0 && value <= 1) &&
        Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-9;
    })));
}

export function summarizeControlInference(groups: readonly ControlInferenceGroup[]) {
  const rows = groups.map(group => group.arms);
  const comparisons = CONTROL_INFERENCE_ARMS.flatMap((arm, i) => i === 0 ? [] : [{ arm,
    vsFixed: pairedArms(rows, 0, i), vsUniform: pairedArms(rows, 1, i), vsCurrent: pairedArms(rows, 2, i),
    byOpponent: CONTROL_CELLS.map((cell, index) => ({ opponent: MATCHUPS[cell].opponent,
      vsCurrent: pairedArms(rows.filter((_, fixture) => fixture % CONTROL_CELLS.length === index), 2, i) })),
  }]);
  const observationMetrics = INFERENCE_HORIZONS.flatMap(round => INFERENCE_MODES.flatMap(mode =>
    ['all', ...RESEARCH_STRATEGIES].map(opponent => {
      let samples = 0, accuracy = 0, confidence = 0, brier = 0, logLoss = 0;
      for (const [index, group] of groups.entries()) {
        const actual = MATCHUPS[CONTROL_CELLS[index % CONTROL_CELLS.length]].opponent;
        if (group.arms[0].truncated || (opponent !== 'all' && actual !== opponent)) continue;
        for (const seat of group.samples) {
          const probabilities = seat[round]?.[mode];
          if (!probabilities) continue;
          const best = Math.max(...Object.values(probabilities));
          const tied = Object.values(probabilities).filter(value => value === best).length;
          samples++;
          accuracy += probabilities[actual] === best ? 1 / tied : 0;
          confidence += best;
          brier += RESEARCH_STRATEGIES.reduce((sum, strategy) =>
            sum + (probabilities[strategy] - Number(strategy === actual)) ** 2, 0);
          logLoss -= Math.log(probabilities[actual]);
        }
      }
      return { round, mode, opponent, samples, accuracy: samples ? accuracy / samples : null,
        confidence: samples ? confidence / samples : null, brier: samples ? brier / samples : null,
        logLoss: samples ? logLoss / samples : null };
    })));
  return { groups: rows.length, games: rows.length * CONTROL_INFERENCE_ARMS.length * 2, comparisons, observationMetrics };
}
