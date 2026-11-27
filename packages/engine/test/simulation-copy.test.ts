import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyAction, applySpeculativeAction, createCatalog, createGame, getPlayerView, rankBotActions, starterDeck } from '../src/index.ts';
import { copySimulationData } from '../src/simulation-copy.ts';

test('speculative copy preserves plain state, shared references and undefined fields', () => {
  const shared = { hp: 7, flag: undefined };
  const input = { board: [shared, shared], other: shared, empty: new Array(2) };
  const copied = copySimulationData(input);
  assert.deepEqual(copied, structuredClone(input));
  assert.equal(copied.board[0], copied.board[1]);
  assert.equal(copied.board[0], copied.other);
  copied.other.hp = 1;
  assert.equal(input.other.hp, 7);
});

test('a complete game gives the same states through the authoritative and speculative transitions', () => {
  const catalog = createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json', import.meta.url), 'utf8')));
  let state = createGame(catalog, [starterDeck(catalog, 'warrior'), starterDeck(catalog, 'mage')], { seed: 584199 });
  for (let moves = 0; moves < 400 && state.phase !== 'finished'; moves++) {
    const actor = state.phase === 'mulligan' ? state.players[0].mulliganDone ? 1 : 0 : state.activePlayer;
    const [action] = rankBotActions(getPlayerView(state, actor), state.catalog, actor, 6, { policyVersion: 4, nodeLimit: 24 });
    const played = applyAction(state, actor, action);
    assert.deepEqual(applySpeculativeAction(state, actor, action), played);
    state = played;
  }
  assert.equal(state.phase, 'finished');
});
