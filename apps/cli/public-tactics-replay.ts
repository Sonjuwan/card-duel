import { performance } from 'node:perf_hooks';
import { projectBotPosition } from '../../packages/engine/src/bot.ts';
import { visibleCounterattack } from '../../packages/engine/src/bot-counterattack.ts';
import { getHeroPower } from '../../packages/engine/src/hero-powers.ts';
import type { Catalog, PlayerView } from '../../packages/engine/src/index.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import type { TrainingJob } from './ai-training-match.ts';
import { exactPublicLethal } from './public-tactics-reference.ts';

export const PUBLIC_PROBE_ORDERS = ['natural', 'ordered', 'planned'] as const;
export const PUBLIC_PROBE_BUDGETS = [12, 24] as const;
export const PUBLIC_ORACLE_LIMIT = 12_000;
export const REPLAY_BENCH_ARMS = ['release', 'integrated'] as const;
type Sample = { move: number; headroom: number; turn: number; view: PlayerView };
type ProofSample = Omit<Sample, 'view'> & { stage: 'first' | 'pass' | 'first-and-pass'; truth: boolean | null;
  probes: { order: typeof PUBLIC_PROBE_ORDERS[number]; budget: typeof PUBLIC_PROBE_BUDGETS[number]; detected: boolean; milliseconds: number }[] };
export type PublicReplayResult = { truncated: boolean; observations: ProofSample[] };

function estimateHeadroom(view: PlayerView) {
  const { opponent, self } = view;
  const nextTurnAttack = opponent.board.reduce((total, minion) => total + minion.attack *
    (minion.keywords?.includes('windfury') ? 2 : 1), opponent.weapon?.attack ?? 0);
  const directPower = getHeroPower(opponent).effects.reduce((total, effect) => total +
    (effect.kind === 'damage' || effect.kind === 'heroAttack' ? effect.amount : effect.kind === 'equip' ? effect.attack : 0), 0);
  return self.health + self.armor - nextTurnAttack - directPower;
}

export function replayPublicTactics(catalog: Catalog, job: TrainingJob): PublicReplayResult {
  let first: Sample | undefined, pass: Sample | undefined, turn = -1, move = -1;
  const better = (a: Sample, b: Sample | undefined) => !b || a.headroom <= b.headroom;
  const match = playTrainingMatch(catalog, job, {
    observeAction(view, actor, action) {
      move++;
      if (actor !== job.candidateSeat || view.phase !== 'playing' || view.choicePending) return;
      const sample = { move, headroom: estimateHeadroom(view), turn: view.turn, view };
      if (turn !== view.turn) {
        turn = view.turn;
        if (better(sample, first)) first = sample;
      }
      if (action.type === 'endTurn' && better(sample, pass)) pass = sample;
    },
  });
  const selected: { sample: Sample; stage: ProofSample['stage'] }[] = [];
  if (first && pass?.move === first.move) selected.push({ sample: first, stage: 'first-and-pass' });
  else {
    if (first) selected.push({ sample: first, stage: 'first' });
    if (pass) selected.push({ sample: pass, stage: 'pass' });
  }
  const observations = selected.map(({ sample: { view, ...metadata }, stage }) => {
    const projected = projectBotPosition(view, catalog, job.candidateSeat);
    const truth = exactPublicLethal(projected, job.candidateSeat, PUBLIC_ORACLE_LIMIT);
    const probes = PUBLIC_PROBE_ORDERS.flatMap(order => PUBLIC_PROBE_BUDGETS.map(budget => {
      const start = performance.now();
      const detected = visibleCounterattack(job.candidateSeat, budget, () => false, order)(projected);
      return { order, budget, detected, milliseconds: performance.now() - start };
    }));
    return { ...metadata, stage, truth, probes };
  });
  return { truncated: match.truncated, observations };
}

export function isPublicReplayResult(value: unknown): value is PublicReplayResult {
  const result = value as Partial<PublicReplayResult> | null;
  return !!result && typeof result.truncated === 'boolean' && Array.isArray(result.observations) && result.observations.length <= 2 &&
    result.observations.every(row => row && Number.isInteger(row.move) && row.move >= 0 && Number.isInteger(row.turn) &&
      row.turn > 0 && Number.isFinite(row.headroom) && ['first', 'pass', 'first-and-pass'].includes(row.stage) &&
      (row.truth === null || typeof row.truth === 'boolean') && Array.isArray(row.probes) &&
      row.probes.length === PUBLIC_PROBE_ORDERS.length * PUBLIC_PROBE_BUDGETS.length && row.probes.every((probe, index) =>
        probe && probe.order === PUBLIC_PROBE_ORDERS[Math.floor(index / PUBLIC_PROBE_BUDGETS.length)] &&
        probe.budget === PUBLIC_PROBE_BUDGETS[index % PUBLIC_PROBE_BUDGETS.length] && typeof probe.detected === 'boolean' &&
        Number.isFinite(probe.milliseconds) && probe.milliseconds >= 0));
}

export function summarizePublicReplay(rows: readonly PublicReplayResult[][]) {
  const games = rows.flat();
  const boards = games.flatMap(game => game.truncated ? [] : game.observations);
  const lethal = boards.filter(board => board.truth === true).length;
  const safe = boards.filter(board => board.truth === false).length;
  const probes = PUBLIC_PROBE_ORDERS.flatMap(order => PUBLIC_PROBE_BUDGETS.map(budget => {
    let truePositive = 0, falsePositive = 0;
    const timings = boards.map(board => {
      const probe = board.probes.find(probe => probe.order === order && probe.budget === budget)!;
      truePositive += Number(probe.detected && board.truth === true);
      falsePositive += Number(probe.detected && board.truth === false);
      return probe.milliseconds;
    }).sort((a, b) => a - b);
    return { order, budget, truePositive, falsePositive, p50ms: timings[Math.ceil(timings.length * .5) - 1] ?? null,
      p95ms: timings[Math.ceil(timings.length * .95) - 1] ?? null };
  }));
  return { groups: rows.length, games: games.length, truncated: games.filter(game => game.truncated).length,
    positions: boards.length, lethal, safe, unresolved: boards.length - lethal - safe, probes };
}
