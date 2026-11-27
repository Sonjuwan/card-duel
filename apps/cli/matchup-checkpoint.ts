import { validateBotWeights, RESEARCH_STRATEGIES } from '../../packages/engine/src/index.ts';
import { aiWeightFingerprint } from '../server/ai-profile-store.ts';
import { isMatchupGroup, MATCHUPS, MATCHUP_PROTOCOL, STAGES } from './matchup-evolution.ts';
import type { MatchupState, TrialEvidence } from './matchup-evolution.ts';
import type { ResearchWeightRow } from './research-models.ts';

const count = (n: unknown, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
const rate = (n: unknown, low = -1): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= low && n <= 1;
const row = (weights: ResearchWeightRow | null) =>
  !!weights && RESEARCH_STRATEGIES.every(strategy => validateBotWeights(weights[strategy]) !== null);

function evidence(value: TrialEvidence | null, stage: number) {
  return !!value && value.groups === STAGES[stage]?.groups && rate(value.gain) && rate(value.referenceGain) &&
    Array.isArray(value.seatGains) && value.seatGains.length === 2 && value.seatGains.every(gain => rate(gain)) &&
    count(value.wins, value.groups) && count(value.losses, value.groups - value.wins) &&
    count(value.truncated, value.groups * 4) && rate(value.p, 0) && rate(value.alpha, 0) &&
    typeof value.passed === 'boolean';
}

export function parseMatchupState(raw: unknown, hash: string): MatchupState {
  const data = raw as Partial<MatchupState> | null;
  if (data?.schema !== 1 || data.protocol !== MATCHUP_PROTOCOL || data.catalogHash !== hash ||
      !count(data.seed, 0xffffffff) || !count(data.cursor, MATCHUPS.length - 1) ||
      !Array.isArray(data.models) || data.models.length !== MATCHUPS.length ||
      !data.models.every((model, index) => {
        if (!model || !validateBotWeights(model.weights) || !count(model.games) || model.games % 4 !== 0 ||
            !count(model.validationGames, model.games) || model.validationGames % 4 !== 0 ||
            !count(model.attempts, model.games / 4) ||
            (model.last !== null && (!model.last || !evidence(model.last.evidence, model.last.stage) ||
              ![null, 'passed', 'failed'].includes(model.last.tactics))) ||
            !Array.isArray(model.promotions) ||
            !model.promotions.every((promotion, n) => promotion && validateBotWeights(promotion.previous) &&
              count(promotion.attempt, model.attempts - 1) && (n === 0 || promotion.attempt > model.promotions[n-1].attempt) &&
              typeof promotion.at === 'string' && Number.isFinite(Date.parse(promotion.at)) &&
              evidence(promotion.evidence, STAGES.length-1) && promotion.evidence.passed)) return false;
        if (model.pending === null) return true;
        const pending = model.pending;
        return pending && count(pending.stage, STAGES.length - 1) &&
          ['fine', 'medium', 'wide'].includes(pending.mutation) && validateBotWeights(pending.candidate) &&
          row(pending.ownRow) && row(pending.opposingRow) && row(pending.priorOpposingRow) &&
          aiWeightFingerprint(pending.ownRow[MATCHUPS[index].opponent]) === aiWeightFingerprint(model.weights) &&
          Array.isArray(pending.results) && pending.results.length < STAGES[pending.stage].groups &&
          pending.results.length * 4 <= model.games && pending.results.every(isMatchupGroup);
      })) throw new Error('Invalid or incompatible matchup checkpoint');
  return data as MatchupState;
}
