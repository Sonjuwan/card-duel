import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardStore } from '../card-store.ts';
import { aiWeightFingerprint } from '../ai-profile-store.ts';
import { HERO_CLASSES, validateDeck, createGame, getPlayerView } from '../../../packages/engine/src/index.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../../packages/engine/src/deck-strategies.ts';
import { DEFAULT_BOT_WEIGHTS, validateBotWeights } from '../../../packages/engine/src/bot-profile.ts';
import { initialResearchWeights, inferOpponentStrategy, mixInitialResearchWeights } from '../../cli/research-models.ts';
import { playTrainingMatch } from '../../cli/ai-training-match.ts';
import type { TrainingJob } from '../../cli/ai-training-match.ts';

const { catalog } = new CardStore().read('v0.23.0.json');

test('all 36 research decks are legal, deterministic and distinct within each class', () => {
  for (const heroClass of HERO_CLASSES) {
    const fingerprints = new Set<string>();
    for (const strategy of RESEARCH_STRATEGIES) {
      const deck = researchDeck(catalog, heroClass, strategy);
      validateDeck(deck, catalog);
      assert.deepEqual(deck, researchDeck(catalog, heroClass, strategy));
      fingerprints.add(JSON.stringify([...deck.cards].sort()));
    }
    assert.equal(fingerprints.size, 4, heroClass);
  }
});

test('all 16 ordered matchups start with independent, valid weights', () => {
  const fingerprints = new Set<string>();
  for (const own of RESEARCH_STRATEGIES) {
    for (const opponent of RESEARCH_STRATEGIES) {
      const first = initialResearchWeights(own, opponent);
      assert.deepEqual(validateBotWeights(first), first);
      fingerprints.add(aiWeightFingerprint(first));
      const original = first.face;
      first.face = 0;
      assert.equal(initialResearchWeights(own, opponent).face, original);
    }
  }
  assert.equal(fingerprints.size, 16);
});

test('a fixed-deck pair uses the same fixture when candidates swap seats', () => {
  const job: TrainingJob = {
    classes: ['mage', 'warrior'], styles: [false, false],
    fixedDecks: [researchDeck(catalog, 'mage', 'aggro'), researchDeck(catalog, 'warrior', 'big-deck')],
    firstPlayer: 0, candidateSeat: 0, candidate: DEFAULT_BOT_WEIGHTS, opponent: DEFAULT_BOT_WEIGHTS,
    seed: 70381, level: 6, nodes: 24, policyVersion: 2,
  };
  const first = playTrainingMatch(catalog, job);
  const second = playTrainingMatch(catalog, { ...job, candidateSeat: 1 });
  assert.ok(!first.truncated && !second.truncated);
  assert.equal(first.score + second.score, 1);
  assert.equal(first.moves, second.moves);
});

test('opponent inference uses only revealed plays by the opponent and preserves weight scale', () => {
  const decks = RESEARCH_STRATEGIES.map(strategy => researchDeck(catalog, 'mage', strategy));
  const game = createGame(catalog, [decks[0], decks[3]], { seed: 23, firstPlayer: 0 });
  const view = getPlayerView(game, 0);
  const baseline = inferOpponentStrategy(view, 0, catalog);
  assert.deepEqual(Object.values(baseline), [.25, .25, .25, .25]);

  const signature = decks[3].cards.find(id => decks.slice(0, 3).every(deck => !deck.cards.includes(id)));
  assert.ok(signature);
  view.history = [{ turn: 1, player: 0, message: 'public own play', playedCardId: signature },
    { turn: 1, player: 1, message: '비밀 설치' }];
  assert.deepEqual(inferOpponentStrategy(view, 0, catalog), baseline);
  view.history.push({ turn: 2, player: 1, message: 'public opponent play', playedCardId: signature });
  const probabilities = inferOpponentStrategy(view, 0, catalog);
  assert.ok(probabilities['big-deck'] > probabilities.aggro);
  assert.ok(Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-12);

  const weights = mixInitialResearchWeights('aggro', { aggro: 0, midrange: 0, control: 0, 'big-deck': 1 });
  assert.deepEqual(weights, initialResearchWeights('aggro', 'big-deck'));
});
