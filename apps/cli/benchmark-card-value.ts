import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { aiCatalogHash, aiWeightFingerprint, saveJsonAtomic } from '../server/ai-profile-store.ts';
import { CardStore } from '../server/card-store.ts';
import { DEFAULT_BOT_WEIGHTS } from '../../packages/engine/src/index.ts';
import { buildCardValueReport, CARD_VALUE_METHOD, readCardValueObservation, researchCardPool } from './card-value.ts';
import type { CardValueObservation } from './card-value.ts';
import { cardValueProtocol, prepareCardValueTrials } from './card-value-trials.ts';
import { cardValueCsv, cardValueHtml } from './card-value-export.ts';

const { values } = parseArgs({ options: {
  catalog: { type: 'string' }, card: { type: 'string', multiple: true }, all: { type: 'boolean' },
  seed: { type: 'string', default: '20261127' }, repeats: { type: 'string', default: '1' },
  reference: { type: 'string' }, format: { type: 'string', default: 'json' },
  'samples-dir': { type: 'string' }, 'export-only': { type: 'boolean' },
} });
const seed = Number(values.seed), repeats = Number(values.repeats);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isSafeInteger(repeats) || repeats < 1 ||
    (values.all === true) === Boolean(values.card?.length) || !['json', 'csv', 'html'].includes(values.format) ||
    (values['export-only'] && !values['samples-dir'])) {
  throw new Error('Usage: npm run benchmark:card-value -- (--all | --card CARD_ID [--card CARD_ID]) [--catalog FILE] [--seed N] [--repeats N] [--reference REPORT.json] [--format json|csv|html] [--samples-dir DIR] [--export-only]');
}
const { version, catalog } = new CardStore().read(values.catalog);
const eligible = new Set(researchCardPool(catalog).map(card => card.id));
const cards = values.all ? [...eligible] : [...new Set(values.card)];
for (const id of cards) if (!eligible.has(id)) throw new Error(`Card cannot be evaluated in this catalog: ${id}`);
const protocol = cardValueProtocol(seed, repeats);
const info = { cardVersion: version, catalogHash: aiCatalogHash(catalog),
  modelHash: aiWeightFingerprint(DEFAULT_BOT_WEIGHTS), protocolHash: protocol.hash };
const reference: unknown = values.reference ? JSON.parse(readFileSync(values.reference, 'utf8')) : undefined;
if (reference !== undefined) buildCardValueReport(catalog, info, [], reference);
const cache = values['samples-dir'] && join(values['samples-dir'], CARD_VALUE_METHOD,
  info.catalogHash, info.modelHash, info.protocolHash);
if (cache && !values['export-only']) mkdirSync(cache, { recursive: true });
let evaluateCard: ReturnType<typeof prepareCardValueTrials> | undefined;
const results: CardValueObservation[] = [];
for (const [index, id] of cards.entries()) {
  const path = cache ? join(cache, id + '.json') : undefined;
  if (path && existsSync(path)) {
    results.push(readCardValueObservation(JSON.parse(readFileSync(path, 'utf8')), id));
    continue;
  }
  if (values['export-only']) continue;
  evaluateCard ??= prepareCardValueTrials(catalog, seed, repeats);
  const result = evaluateCard(id);
  if (path) saveJsonAtomic(path, result);
  console.error(`[${index + 1}/${cards.length}] ${id}: ${result.pairs.filter(pair => !pair.truncated).length}/${result.plannedPairs} valid groups`);
  results.push(result);
}
const report = buildCardValueReport(catalog, info, results, reference);
if (values.format === 'csv') process.stdout.write(cardValueCsv(report));
else if (values.format === 'html') console.log(cardValueHtml(report));
else console.log(JSON.stringify({ ...report, protocol }, null, 2));
