import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CardStore } from '../card-store.ts';
import { HERO_CLASSES, validateDeck } from '../../../packages/engine/src/index.ts';
import type { Catalog } from '../../../packages/engine/src/index.ts';
import { researchDeck } from '../../../packages/engine/src/deck-strategies.ts';
import { buildCardValueReport, readCardValueObservation, researchCardPool } from '../../cli/card-value.ts';
import type { CardValueObservation, CardValuePair } from '../../cli/card-value.ts';
import { substitutionDecks } from '../../cli/card-value-trials.ts';
import { cardValueCsv, cardValueHtml } from '../../cli/card-value-export.ts';

const { catalog } = new CardStore().read('v0.23.0.json');
const pool = researchCardPool(catalog);
const basicNeutral = pool.find(card => card.rarity === 'basic' && card.class === 'neutral')!;
const basicClass = pool.find(card => card.rarity === 'basic' && card.class === 'mage')!;
const legendary = pool.find(card => card.rarity === 'legendary' && card.class === 'warrior')!;
const rare = pool.find(card => card.rarity === 'rare' && card.class === 'neutral')!;
const token = Object.values(catalog).find(card => card.kind !== 'coin' && card.collectible === false)!;
const miniature: Catalog = Object.fromEntries([basicNeutral, basicClass, legendary, rare, token].map(card => [card.id, card]));
const info = { cardVersion: 'original', catalogHash: 'v1', modelHash: 'fixed-ai', protocolHash: 'same-protocol' };

function observation(cardId: string, effect: -1 | 0 | .5 | 1, samples = 16, plannedPairs = samples) {
  const control = effect === -1 ? [1, 1] : [0, 0];
  const treatment = effect === 1 ? [1, 1] : effect === .5 ? [1, 0] : [0, 0];
  const pair: CardValuePair = {
    pilotClass: 'mage', opponentClass: 'warrior', strategy: 'control', opponentStrategy: 'aggro', replacement: 'substitute',
    seed: 0, control: [control[0], control[1]], treatment: [treatment[0], treatment[1]], truncated: 0, seen: 2, played: 1,
  };
  return { cardId, fixtureHash: `fixture-${cardId}`, plannedPairs,
    pairs: Array.from({ length: samples }, (_, seed) => ({ ...pair, seed })) } satisfies CardValueObservation;
}
const initial = () => buildCardValueReport(miniature, info, [
  observation(basicNeutral.id, .5, 36), observation(basicClass.id, 0),
  observation(legendary.id, -1), observation(rare.id, 1),
]);
const row = (report: ReturnType<typeof initial>, id: string) => report.rows.find(card => card.id === id)!;

test('all basic cards count equally on one signed scale across classes and rarities', () => {
  const report = initial();
  assert.equal(report.baseline.rawDelta, .25);
  assert.equal(report.byRarity.find(group => group.rarity === 'basic')!.mean, 100);
  assert.equal(row(report, basicNeutral.id).currentScore, 125);
  assert.equal(row(report, basicClass.id).currentScore, 75);
  assert.equal(row(report, rare.id).currentScore, 175);
  assert.equal(row(report, legendary.id).currentScore, -25);
  assert.equal(row(report, legendary.id).rawDelta, -1);
  assert.equal(row(report, basicNeutral.id).pairs.length, 36);
  assert.equal(report.byClass.find(group => group.cardClass === 'neutral')!.mean, 150);
  assert.ok(!report.rows.some(card => card.id === token.id));
});

test('missing basic evidence and truncated trials withhold points and retain valid raw evidence', () => {
  const incomplete = observation(basicClass.id, .5, 16);
  incomplete.pairs[7].truncated = 1;
  const report = buildCardValueReport(miniature, info, [
    incomplete, observation(basicNeutral.id, .5, 36), observation(legendary.id, -1),
  ]);
  assert.equal(report.baseline.rawDelta, null);
  assert.equal(row(report, basicClass.id).samples, 15);
  assert.equal(row(report, basicClass.id).rawDelta, .5);
  assert.equal(row(report, basicClass.id).status, 'insufficient-samples');
  assert.equal(row(report, legendary.id).status, 'baseline-pending');
  assert.ok(report.rows.every(card => card.currentScore === null));
});

test('current and fixed scales distinguish patch drift and preserve compatible raw results', () => {
  const previous = initial();
  const update = { ...info, cardVersion: 'patch', catalogHash: 'v2' };
  const newCard = { ...rare, id: 'new_rare_card' };
  const patched = { ...miniature, [newCard.id]: newCard };
  const sameFixtures = observation(legendary.id, -1);
  const changedFixtures = { ...observation(rare.id, 1), fixtureHash: 'different-fixture' };
  const report = buildCardValueReport(patched, update, [
    observation(basicNeutral.id, 1, 36), observation(basicClass.id, .5), sameFixtures,
    changedFixtures, observation(newCard.id, .5),
  ], previous);
  assert.equal(report.baseline.rawDelta, .75);
  assert.equal(report.byRarity.find(group => group.rarity === 'basic')!.mean, 100);
  assert.equal(row(report, legendary.id).currentScore, -75);
  assert.equal(row(report, legendary.id).fixedScore, -25);
  assert.equal(row(report, legendary.id).matchedPatchDelta, 0);
  assert.equal(row(report, rare.id).fixedScore, null);
  assert.equal(row(report, newCard.id).currentScore, 75);
  assert.equal(row(report, newCard.id).fixedScore, null);
  assert.throws(() => buildCardValueReport(patched, { ...update, modelHash: 'new-model' }, [], previous), /different method/);
  assert.throws(() => buildCardValueReport(patched, update, [], { ...previous, method: 'legacy-per-rarity' }), /different method/);
});

test('all-legal research pool and matched decks honor classes and copy rules with no account context', () => {
  assert.deepEqual(new Set(pool.map(card => card.rarity)), new Set(['basic', 'common', 'rare', 'epic', 'legendary']));
  const original = JSON.stringify(catalog);
  for (const hero of HERO_CLASSES) {
    const stock = researchDeck(catalog, hero, 'midrange');
    const chosen = pool.find(card => card.rarity === 'legendary' && card.class === hero)!;
    for (const testCard of [chosen, basicNeutral]) {
      const { control, treatment, replacement } = substitutionDecks(catalog, stock, testCard.id);
      validateDeck(control, catalog);
      validateDeck(treatment, catalog);
      assert.ok(!control.cards.includes(testCard.id));
      assert.equal(treatment.cards.filter(id => id === testCard.id).length, 1);
      assert.equal(control.cards.at(-1), replacement);
      assert.deepEqual(control.cards.slice(0, -1), treatment.cards.slice(0, -1));
    }
  }
  assert.throws(() => substitutionDecks(catalog, researchDeck(catalog, 'mage', 'control'), legendary.id), /ineligible/);
  assert.equal(JSON.stringify(catalog), original);
});

test('HTML and Excel-compatible CSV exports identify the common scale and escape card names', () => {
  const renamed = { ...miniature, [rare.id]: { ...rare, name: '=1+2 <script> "custom"' } };
  const report = buildCardValueReport(renamed, info, [
    observation(basicNeutral.id, .5, 36), observation(basicClass.id, 0), observation(rare.id, 1),
  ]);
  const csv = cardValueCsv(report);
  const html = cardValueHtml(report);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(`"'=1+2 <script> ""custom"""`));
  assert.ok(html.includes('기본 카드 전체 평균 100점'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(csv.includes('현재 상대 가치'));
});

test('raw checkpoints only resume the named card with complete, valid game data', () => {
  const sample = { ...observation(rare.id, 0), fixtureHash: 'f'.repeat(64) };
  const copy: unknown = JSON.parse(JSON.stringify(sample));
  assert.deepEqual(readCardValueObservation(copy, rare.id), sample);
  assert.throws(() => readCardValueObservation(copy, legendary.id), /Invalid saved/);
  assert.throws(() => readCardValueObservation({ ...sample, pairs: sample.pairs.slice(1) }, rare.id), /Invalid saved/);
  assert.throws(() => readCardValueObservation({ ...sample, pairs: sample.pairs.map(pair =>
    ({ ...pair, control: [0, .9] })) }, rare.id), /Invalid saved/);
});
