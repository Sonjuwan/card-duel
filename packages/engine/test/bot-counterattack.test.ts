import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { applyAction, createCatalog, createGame, getPlayerView, rankBotActions, starterDeck } from '../src/index.ts';
import { visibleCounterattack } from '../src/bot-counterattack.ts';
import type { HeroClass, Minion, PlayerId } from '../src/types.ts';

const catalog = createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json', import.meta.url), 'utf8')));
function opening(enemy: HeroClass = 'warrior') {
  const decks = [starterDeck(catalog, 'mage'), starterDeck(catalog, enemy)] as const;
  let game = createGame(catalog, [...decks], { seed: 42, firstPlayer: 0 });
  for (const actor of [0, 1] as const) game = applyAction(game, actor, { type: 'mulligan', replace: [] });
  game.players[0].board = [];
  game.players[1].board = [];
  game.players[1].hand = [];
  game.players[1].maxMana = 1;
  return game;
}
const piece = (instanceId: string, originalOwner: PlayerId, attack: number, health: number): Minion => ({
  instanceId, originalOwner, cardId: 'recruit', attack, health, maxHealth: health, attacksRemaining: 0,
});
const threat = (game: ReturnType<typeof opening>, limit = 128) => visibleCounterattack(0, limit, () => false)(game);

test('visible reply checks legal windfury attacks, divine shield, armor and freeze', () => {
  const game = opening();
  game.players[0].health = 4;
  game.players[0].armor = 1;
  game.players[1].board = [{ ...piece('twice', 1, 3, 5), keywords: ['windfury'] }];
  assert.equal(threat(game), true);
  const guard = { ...piece('guard', 0, 0, 2), keywords: ['taunt'] as Minion['keywords'] };
  game.players[0].board = [guard];
  assert.equal(threat(game), false);
  game.players[0].health = 2;
  assert.equal(threat(game), true);
  guard.keywords = ['taunt', 'divineShield'];
  assert.equal(threat(game), false);
  game.players[0].board = [];
  game.players[1].board[0].frozenThroughTurn = game.turn + 1;
  assert.equal(threat(game), false);
});

test('visible reply uses public hero powers and weapons, never hypothetical hand cards', () => {
  const game = opening('mage');
  game.players[0].health = 4;
  game.players[1].weapon = { attack: 3, durability: 1 };
  assert.equal(threat(game), true);
  game.players[1].maxMana = 0;
  game.players[1].hand = [{ instanceId: 'unknown', cardId: 'flame_sphere', costDiscount: 20 }];
  assert.equal(threat(game), false);
  const before = rankBotActions(getPlayerView(game, 0), game.catalog, 0, 25, { policyVersion: 4, nodeLimit: 30 });
  game.players[1].hand[0].cardId = 'wisp';
  game.rng ^= 609;
  assert.deepEqual(rankBotActions(getPlayerView(game, 0), game.catalog, 0, 25, { policyVersion: 4, nodeLimit: 30 }), before);
});

test('a known win this turn still ranks ahead of defense', () => {
  const game = opening();
  game.players[0].health = 3;
  game.players[1].health = 3;
  game.players[1].board = [piece('enemy', 1, 5, 5)];
  game.players[0].board = [{ ...piece('attacker', 0, 3, 4), attacksRemaining: 1 }];
  const [action] = rankBotActions(getPlayerView(game, 0), game.catalog, 0, 25, { policyVersion: 4, nodeLimit: 24 });
  assert.equal(applyAction(game, 0, action).winner, 0);
});
