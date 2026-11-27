import { counterattackFixture, FIXED_LETHAL_REPLY, playFixedTacticalTurn, RESEARCH_TACTICAL_PRIORS } from '../../cli/research-tactics.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardStore } from '../card-store.ts';
import { aiWeightFingerprint } from '../ai-profile-store.ts';
import { HERO_CLASSES, validateDeck, applyAction, createGame, getPlayerView } from '../../../packages/engine/src/index.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../../packages/engine/src/deck-strategies.ts';
import { DEFAULT_BOT_WEIGHTS, validateBotWeights } from '../../../packages/engine/src/bot-profile.ts';
import { initialResearchWeights, inferOpponentStrategy, mixInitialResearchWeights } from '../../cli/research-models.ts';
import { playTrainingMatch } from '../../cli/ai-training-match.ts';
import { benchmarkDeck, researchSplitSeed } from '../../cli/research-benchmark-decks.ts';
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

test('validation recipes produce legal decks outside the reference sets', () => {
  const fingerprint = (cards: string[]) => JSON.stringify([...cards].sort());
  for (const heroClass of HERO_CLASSES) {
    const references = new Set(RESEARCH_STRATEGIES.map(strategy => fingerprint(researchDeck(catalog, heroClass, strategy).cards)));
    for (const strategy of RESEARCH_STRATEGIES) {
      const development = benchmarkDeck(catalog, heroClass, strategy, 'development', researchSplitSeed.development);
      const holdout = benchmarkDeck(catalog, heroClass, strategy, 'holdout', researchSplitSeed.holdout);
      validateDeck(development, catalog);
      validateDeck(holdout, catalog);
      assert.ok(!references.has(fingerprint(development.cards)));
      assert.ok(!references.has(fingerprint(holdout.cards)));
      assert.notEqual(fingerprint(development.cards), fingerprint(holdout.cards));
      assert.deepEqual(holdout, benchmarkDeck(catalog, heroClass, strategy, 'holdout', researchSplitSeed.holdout));
    }
  }
});

test('public action evidence records paid mana and legal attack choice without exposing secrets', () => {
  let game = createGame(catalog, [researchDeck(catalog, 'mage', 'aggro'), researchDeck(catalog, 'warrior', 'midrange')],
    { seed: 31, firstPlayer: 0 });
  for (const actor of [0, 1] as const) game = applyAction(game, actor, { type: 'mulligan', replace: [] });
  game.players[0].hand = [
    { instanceId: 'hidden-secret', cardId: 'ice_block' },
    { instanceId: 'visible-spell', cardId: 'flame_sphere', costDiscount: 2 },
  ];
  game.players[0].mana = 10;
  game.players[0].board = [{ instanceId: 'attacker', cardId: 'recruit', attack: 1, health: 3, maxHealth: 3,
    attacksRemaining: 1, originalOwner: 0 }];
  game.players[1].board = [{ instanceId: 'blocker', cardId: 'recruit', attack: 1, health: 3, maxHealth: 3,
    attacksRemaining: 0, originalOwner: 1, keywords: ['taunt'] }];

  game = applyAction(game, 0, { type: 'playCard', instanceId: 'hidden-secret' });
  const opponentView = getPlayerView(game, 1);
  const install = opponentView.history.find(event => event.message === '비밀 설치');
  assert.ok(install);
  assert.equal(install.playedCardId, undefined);
  assert.equal(install.evidence, undefined);
  assert.equal(JSON.stringify(opponentView).includes('ice_block'), false);

  game = applyAction(game, 0, { type: 'playCard', instanceId: 'visible-spell', target: { kind: 'hero', player: 1 } });
  assert.deepEqual(getPlayerView(game, 1).history.find(event => event.playedCardId === 'flame_sphere')?.evidence,
    { kind: 'card', manaPaid: catalog.flame_sphere.cost - 2, target: 'enemy-hero' });

  const attack = { type: 'attack', attackerId: 'attacker', target: { kind: 'minion', instanceId: 'blocker' } };
  const forced = applyAction(game, 0, attack);
  assert.deepEqual(getPlayerView(forced, 1).history.find(event => event.evidence?.kind === 'attack')?.evidence,
    { kind: 'attack', target: 'minion', couldChooseEither: false });
  game.players[1].board[0].keywords = [];
  const optional = applyAction(game, 0, attack);
  assert.deepEqual(getPlayerView(optional, 1).history.find(event => event.evidence?.kind === 'attack')?.evidence,
    { kind: 'attack', target: 'minion', couldChooseEither: true });
});

test('only optional attacks change the action model and old history still provides card evidence', () => {
  const decks = [researchDeck(catalog, 'mage', 'aggro'), researchDeck(catalog, 'warrior', 'control')] as const;
  const game = createGame(catalog, [...decks], { seed: 23, firstPlayer: 0 });
  const view = getPlayerView(game, 0);
  view.history = [{ turn: 2, player: 1, message: 'forced attack',
    evidence: { kind: 'attack', target: 'minion', couldChooseEither: false } }];
  const predict = () => inferOpponentStrategy(view, 0, catalog, 'actions');
  assert.deepEqual(predict(), { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 });

  view.history.push({ turn: 4, player: 1, message: 'optional attack',
    evidence: { kind: 'attack', target: 'hero', couldChooseEither: true } });
  assert.ok(predict().aggro > predict().control);

  view.history = [{ turn: 4, player: 1, message: 'old play', playedCardId: decks[1].cards[0] }];
  assert.deepEqual(predict(), inferOpponentStrategy(view, 0, catalog, 'profile'));
});

test('fixed lethal reply distinguishes search policies and control-weight mixtures', () => {
  const game = counterattackFixture(catalog);
  assert.equal(applyAction(playFixedTacticalTurn(game, 2), 1, FIXED_LETHAL_REPLY).winner, 1);
  assert.equal(playFixedTacticalTurn(game, 3).players[1].board.length, 0);

  for (const probabilities of RESEARCH_TACTICAL_PRIORS) {
    const weights = mixInitialResearchWeights('control', probabilities);
    assert.equal(applyAction(playFixedTacticalTurn(game, 3, weights), 1, FIXED_LETHAL_REPLY).winner, 1);
    const defended = playFixedTacticalTurn(game, 4, weights);
    assert.equal(defended.phase, 'playing');
    assert.equal(defended.activePlayer, 1);
    assert.equal(defended.players[1].board.length, 0);
    assert.ok(defended.players[0].health > 0);
  }
});
