import { armMean, CONTROL_EVALUATION_ARMS, CONTROL_EVALUATION_FAMILIES, CONTROL_EVALUATION_RIVALS,
  CONTROL_PHASE_ARMS, pairedArms, summarizeArmDeltas } from './control-calibration.ts';
import type { ArmResult } from './control-calibration.ts';

export function summarizeControlEvaluation(rows: readonly ArmResult[][]) {
  const size = CONTROL_EVALUATION_ARMS.length;
  const comparisons = CONTROL_EVALUATION_RIVALS.map((opponent, index) => {
    const offset = index * size;
    const complete = rows.filter(row => row.slice(offset, offset + size).every(arm => arm.truncated === 0));
    const mainEffects = CONTROL_EVALUATION_FAMILIES.map((family, i) => {
      const bit = 1 << i;
      const masks = CONTROL_EVALUATION_ARMS.filter(mask => (mask & bit) === 0);
      const changes = complete.map(row => {
        const means = row.slice(offset, offset + size).map(armMean);
        return masks.reduce((sum, mask) => sum + means[mask | bit] - means[mask], 0) / masks.length;
      });
      return { family: family.name, ...summarizeArmDeltas(changes),
        atFixed: pairedArms(rows, offset, offset + bit), atAllFamilies: pairedArms(rows, offset + (size - 1 - bit), offset + size - 1) };
    });
    const variants = CONTROL_EVALUATION_ARMS.map(mask => ({ mask,
      families: CONTROL_EVALUATION_FAMILIES.flatMap((family, i) => mask & (1 << i) ? [family.name] : []),
      vsFixed: pairedArms(rows, offset, offset + mask), vsAllFamilies: pairedArms(rows, offset + size - 1, offset + mask),
    }));
    return { opponent, completeGroups: complete.length, mainEffects, variants };
  });
  return { groups: rows.length, games: rows.length * size * CONTROL_EVALUATION_RIVALS.length * 2, comparisons };
}

export function summarizeControlPhases(rows: readonly ArmResult[][]) {
  const count = CONTROL_PHASE_ARMS.length;
  const comparisons = CONTROL_EVALUATION_RIVALS.map((opponent, index) => {
    const start = index * count;
    const changes = [['survival-gate', 1, 2], ['resource-gate', 1, 3], ['survival-gate-with-late-resources', 3, 4],
      ['resource-gate-with-late-survival', 2, 4], ['both-gates', 1, 4]] as const;
    return { opponent,
      effects: changes.map(([change, a, b]) => ({ change, ...pairedArms(rows, start + a, start + b) })),
      variants: CONTROL_PHASE_ARMS.map((arm, i) => ({ arm, vsFixed: pairedArms(rows, start, start + i) })),
    };
  });
  return { groups: rows.length, games: rows.length * count * CONTROL_EVALUATION_RIVALS.length * 2, comparisons };
}
