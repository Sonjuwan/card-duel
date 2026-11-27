import { HERO_CLASSES, deckCards } from '../../packages/engine/src/index.ts';
import type { Catalog, HeroClass } from '../../packages/engine/src/index.ts';
import { RESEARCH_STRATEGIES } from '../../packages/engine/src/deck-strategies.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';

export const CARD_VALUE_METHOD = 'paired-substitution-basic-mean-v1';
const rarities = ['basic', 'common', 'rare', 'epic', 'legendary'] as const;
export const researchCardPool = (catalog: Catalog) =>
  [...new Map(HERO_CLASSES.flatMap(hero => deckCards(catalog, hero).map(card => [card.id, card] as const))).values()]
    .sort((a, b) => a.id.localeCompare(b.id));

type GamePoints = readonly [number, number];
export interface CardValuePair {
  pilotClass: HeroClass;
  opponentClass: HeroClass;
  strategy: ResearchStrategy;
  opponentStrategy: ResearchStrategy;
  replacement: string;
  seed: number;
  control: GamePoints;
  treatment: GamePoints;
  truncated: number;
  seen: number;
  played: number;
}

export interface CardValueObservation {
  cardId: string;
  fixtureHash: string;
  plannedPairs: number;
  pairs: CardValuePair[];
}

export function readCardValueObservation(input: unknown, cardId: string): CardValueObservation {
  const validPoints = (points: unknown) => Array.isArray(points) && points.length === 2 &&
    points.every(score => score === 0 || score === .5 || score === 1);
  const integer = (value: unknown, min: number, max: number) => typeof value === 'number' &&
    Number.isSafeInteger(value) && value >= min && value <= max;
  const data = input as Partial<CardValueObservation> | null;
  if (data?.cardId !== cardId || typeof data.fixtureHash !== 'string' || !/^[a-f0-9]{64}$/.test(data.fixtureHash) ||
      !Array.isArray(data.pairs) || !integer(data.plannedPairs, 16, Number.MAX_SAFE_INTEGER) || data.plannedPairs !== data.pairs.length ||
      data.pairs.some(pair => !pair || !HERO_CLASSES.includes(pair.pilotClass) || !HERO_CLASSES.includes(pair.opponentClass) ||
        !RESEARCH_STRATEGIES.includes(pair.strategy) || !RESEARCH_STRATEGIES.includes(pair.opponentStrategy) ||
        typeof pair.replacement !== 'string' || !integer(pair.seed, 0, 0xffffffff) ||
        !validPoints(pair.control) || !validPoints(pair.treatment) || !integer(pair.truncated, 0, 4) ||
        !integer(pair.seen, 0, 2) || !integer(pair.played, 0, pair.seen))) {
    throw new Error(`Invalid saved card value observations for ${cardId}`);
  }
  return data as CardValueObservation;
}

interface EvaluationInfo {
  cardVersion: string;
  catalogHash: string;
  modelHash: string;
  protocolHash: string;
}

const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const onScale = (delta: number, basicMean: number) => 100 + 100 * (delta - basicMean);

function summarize(pairs: readonly CardValuePair[]) {
  const valid = pairs.filter(pair => pair.truncated === 0);
  if (!valid.length) return { samples: 0, rawDelta: null, raw95: null, seen: 0, played: 0 };
  const deltas = valid.map(pair => (pair.treatment[0] + pair.treatment[1] - pair.control[0] - pair.control[1]) / 2);
  const rawDelta = average(deltas);
  // Conservative pointwise bound for paired differences in [-1, 1].
  const margin = Math.sqrt(2 * Math.log(40) / valid.length);
  return {
    samples: valid.length,
    rawDelta,
    raw95: [Math.max(-1, rawDelta - margin), Math.min(1, rawDelta + margin)] as const,
    seen: valid.reduce((sum, pair) => sum + pair.seen, 0),
    played: valid.reduce((sum, pair) => sum + pair.played, 0),
  };
}

function groupSummary(rows: readonly { id: string; currentScore: number | null; samples: number }[]) {
  const scored = rows.flatMap(row => row.currentScore === null ? [] : [{ id: row.id, value: row.currentScore }])
    .sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  const scores = scored.map(row => row.value);
  const mean = scores.length ? average(scores) : null;
  const middle = Math.floor(scores.length / 2);
  return {
    cards: rows.length, scored: scores.length, samples: rows.reduce((sum, row) => sum + row.samples, 0),
    mean, median: !scores.length ? null : scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2,
    min: scores[0] ?? null, max: scores.at(-1) ?? null,
    lowestCard: scored[0]?.id ?? null, highestCard: scored.at(-1)?.id ?? null,
    shareAboveBasicMean: scores.length ? scores.filter(value => value > 100).length / scores.length : null,
    standardDeviation: mean === null ? null : Math.sqrt(average(scores.map(value => (value - mean) ** 2))),
    distribution: scores,
  };
}

export function buildCardValueReport(catalog: Catalog, info: EvaluationInfo, observations: readonly CardValueObservation[],
  reference?: unknown) {
  const pool = researchCardPool(catalog);
  const byCard = new Map(observations.map(observation => [observation.cardId, observation]));
  if (byCard.size !== observations.length || observations.some(observation => !pool.some(card => card.id === observation.cardId))) {
    throw new Error('Card evaluation contains duplicate or ineligible observations');
  }
  const drafts = pool.map(card => {
    const source = byCard.get(card.id);
    const pairs = source?.pairs ?? [];
    const summary = summarize(pairs);
    const plannedPairs = source?.plannedPairs ?? 0;
    return {
      id: card.id, name: card.name, rarity: card.rarity, class: card.class, cost: card.cost,
      fixtureHash: source?.fixtureHash ?? null, plannedPairs, pairs, ...summary,
      ready: plannedPairs >= 16 && summary.samples === plannedPairs,
    };
  });
  const basic = drafts.filter(card => card.rarity === 'basic');
  const readyBasic = basic.filter(card => card.ready && card.rawDelta !== null);
  const basicMean = basic.length > 0 && readyBasic.length === basic.length
    ? average(readyBasic.map(card => card.rawDelta!)) : null;
  const fixed = readReference(reference, info);
  const fixedRows = new Map(fixed?.rows?.map(row => [row.id, row]) ?? []);
  const rows = drafts.map(row => {
    const score = (raw: number | null, mean: number | null) => row.ready && raw !== null && mean !== null
      ? onScale(raw, mean) : null;
    const referenceRow = fixedRows.get(row.id);
    const comparable = row.fixtureHash !== null && row.fixtureHash === referenceRow?.fixtureHash && referenceRow.ready;
    const currentScore = score(row.rawDelta, basicMean);
    return {
      ...row, currentScore,
      status: !row.ready ? 'insufficient-samples' : basicMean === null ? 'baseline-pending' : 'estimated',
      fixedScore95: !comparable || !row.ready || !row.raw95 ? null
        : row.raw95.map(raw => onScale(raw, fixed!.baseline.rawDelta)),
      currentScore95ConditionalOnBaseline: currentScore === null || !row.raw95 ? null : row.raw95.map(raw => onScale(raw, basicMean!)),
      fixedScore: comparable ? score(row.rawDelta, fixed?.baseline.rawDelta ?? null) : null,
      matchedPatchDelta: comparable && row.ready && row.rawDelta !== null && referenceRow.rawDelta !== null
        ? row.rawDelta - referenceRow.rawDelta : null,
      byClass: Array.from(new Set(row.pairs.map(pair => pair.pilotClass)), pilotClass => {
        const stats = summarize(row.pairs.filter(pair => pair.pilotClass === pilotClass));
        return { pilotClass, ...stats, score: score(stats.rawDelta, basicMean) };
      }),
      byStrategy: Array.from(new Set(row.pairs.map(pair => pair.strategy)), strategy => {
        const stats = summarize(row.pairs.filter(pair => pair.strategy === strategy));
        return { strategy, ...stats, score: score(stats.rawDelta, basicMean) };
      }),
      byOpponentStrategy: Array.from(new Set(row.pairs.map(pair => pair.opponentStrategy)), opponentStrategy => {
        const stats = summarize(row.pairs.filter(pair => pair.opponentStrategy === opponentStrategy));
        return { opponentStrategy, ...stats, score: score(stats.rawDelta, basicMean) };
      }),
    };
  }).sort((a, b) => (b.currentScore ?? -Infinity) - (a.currentScore ?? -Infinity) || a.id.localeCompare(b.id));

  return {
    method: CARD_VALUE_METHOD, cardPool: 'all-legal-collectible', ...info,
    baseline: { basicCards: basic.length, evaluatedBasicCards: readyBasic.length, rawDelta: basicMean },
    fixedBaseline: fixed ? { version: fixed.cardVersion, catalogHash: fixed.catalogHash, rawDelta: fixed.baseline.rawDelta } : null,
    rows,
    byRarity: rarities.map(rarity => ({ rarity, ...groupSummary(rows.filter(row => row.rarity === rarity)) })),
    byClass: (['neutral', ...HERO_CLASSES] as const).map(cardClass => ({
      cardClass, ...groupSummary(rows.filter(row => row.class === cardClass)),
      byRarity: rarities.map(rarity => ({ rarity, ...groupSummary(rows.filter(row => row.class === cardClass && row.rarity === rarity)) })),
    })),
  };
}

type Reference = Pick<EvaluationInfo, 'cardVersion' | 'catalogHash'> & {
  baseline: { rawDelta: number };
  rows: { id: string; fixtureHash: string | null; ready: boolean; rawDelta: number | null }[];
};

function readReference(input: unknown, info: EvaluationInfo): Reference | null {
  if (input === undefined) return null;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid card value reference');
  const report = input as Record<string, unknown>;
  if (report.method !== CARD_VALUE_METHOD || report.cardPool !== 'all-legal-collectible' ||
      report.modelHash !== info.modelHash || report.protocolHash !== info.protocolHash) {
    throw new Error('Card value reference uses a different method, model, or evaluation protocol');
  }
  if (typeof report.cardVersion !== 'string' || typeof report.catalogHash !== 'string' || !Array.isArray(report.rows)) {
    throw new Error('Invalid card value reference');
  }
  const basics = report.rows.filter(row => row?.rarity === 'basic');
  const validRaw = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1;
  if (!basics.length || basics.some(row => row.ready !== true || !validRaw(row.rawDelta)) ||
      report.rows.some(row => !row || typeof row.id !== 'string' ||
        (row.fixtureHash !== null && typeof row.fixtureHash !== 'string') || typeof row.ready !== 'boolean' ||
        (row.rawDelta !== null && !validRaw(row.rawDelta)))) {
    throw new Error('Card value reference needs complete baseline observations');
  }
  const baseline = average(basics.map(row => row.rawDelta));
  const declared = report.baseline as { basicCards?: unknown; evaluatedBasicCards?: unknown; rawDelta?: unknown } | undefined;
  if (declared?.basicCards !== basics.length || declared.evaluatedBasicCards !== basics.length ||
      !validRaw(declared.rawDelta) || Math.abs(declared.rawDelta - baseline) > 1e-12) {
    throw new Error('Card value reference baseline is incomplete or inconsistent');
  }
  if (new Set(report.rows.map(row => row.id)).size !== report.rows.length) {
    throw new Error('Card value reference contains duplicate cards');
  }
  return { cardVersion: report.cardVersion, catalogHash: report.catalogHash, baseline: { rawDelta: baseline }, rows: report.rows };
}
