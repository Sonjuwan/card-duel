import { applyAction, createGame, DEFAULT_BOT_WEIGHTS, getPlayerView, rankBotActions, starterDeck } from '../../packages/engine/src/index.ts';
import type { BotWeights, Catalog, GameState, Minion, PlayerId } from '../../packages/engine/src/index.ts';
import { visibleCounterattack } from '../../packages/engine/src/bot-counterattack.ts';
import { mixResearchWeights } from './research-models.ts';
import type { ResearchWeightRow } from './research-models.ts';

const piece = (instanceId: string, attack: number, health: number, originalOwner: PlayerId): Minion => ({
  instanceId, cardId: 'recruit', attack, health, maxHealth: health, attacksRemaining: 1, originalOwner,
});

export const TACTICAL_CATALOG = 'v0.23.0.json';
export const RESEARCH_TACTICAL_PRIORS = [
  { aggro: .25, midrange: .25, control: .25, 'big-deck': .25 },
  { aggro: .65, midrange: .15, control: .10, 'big-deck': .10 },
] as const;
export const FIXED_LETHAL_REPLY = { type: 'attack', attackerId: 'enemy0', target: { kind: 'hero', player: 0 } } as const;

export function counterattackFixture(catalog: Catalog): GameState {
  let game = createGame(catalog, [starterDeck(catalog, 'mage'), starterDeck(catalog, 'warrior')], { seed: 35, firstPlayer: 0 });
  for (const actor of [0, 1] as const) game = applyAction(game, actor, { type: 'mulligan', replace: [] });
  game.revision = 143;
  Object.assign(game.players[0], { health: 6, mana: 7, maxMana: 7,
    board: [piece('own0', 2, 5, 0), piece('own1', 6, 6, 0)],
    hand: [{ instanceId: 'hand0', cardId: 'blizzard' }, { instanceId: 'hand1', cardId: 'flame_sphere' }] });
  Object.assign(game.players[1], { health: 22, maxMana: 7, board: [piece('enemy0', 6, 2, 1)], hand: [],
    deck: [{ instanceId: 'enemy-draw', cardId: 'wisp' }] });
  return game;
}

export function playFixedTacticalTurn(game: GameState, policyVersion: 2 | 3 | 4, weights: Readonly<BotWeights> = DEFAULT_BOT_WEIGHTS): GameState {
  let state = game;
  for (let step = 0; step < 10 && state.activePlayer === 0 && state.phase === 'playing'; step++) {
    const [action] = rankBotActions(getPlayerView(state, 0), state.catalog, 0, 25,
      { policyVersion, weights, nodeLimit: 65, responseLimit: 5 });
    if (!action) throw new Error('Fixed tactical fixture has no legal action');
    state = applyAction(state, 0, action);
  }
  return state;
}

export function passesResearchTactics(catalog: Catalog, row: ResearchWeightRow): boolean {
  const counterattack = counterattackFixture(catalog);
  const immediate = structuredClone(counterattack);
  immediate.players[1].health = 6;

  return RESEARCH_TACTICAL_PRIORS.every(prior => {
    const weights = mixResearchWeights(row, prior);
    const defended = playFixedTacticalTurn(counterattack, 4, weights);
    const survived = defended.winner === 0 || (defended.phase === 'playing' && defended.activePlayer === 1 &&
      !visibleCounterattack(0, 128, () => false)(defended));
    return survived && playFixedTacticalTurn(immediate, 4, weights).winner === 0;
  });
}
