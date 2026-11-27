import { applyAction, createGame, DEFAULT_BOT_WEIGHTS, getPlayerView, rankBotActions, starterDeck } from '../../packages/engine/src/index.ts';
import type { BotOptions, BotWeights, Catalog, GameState, Minion, PlayerId, PlayerView } from '../../packages/engine/src/index.ts';
import { visibleCounterattack } from '../../packages/engine/src/bot-counterattack.ts';
import { mixResearchWeights } from './research-models.ts';
import type { ResearchWeightRow, StrategyProbabilities } from './research-models.ts';

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

type CounterattackSettings = Pick<BotOptions, 'counterattackOrder' | 'counterattackSchedule'>;
export function playFixedTacticalTurn(game: GameState, policyVersion: 2 | 3 | 4 | 5,
  weights: Readonly<BotWeights> | ((view: PlayerView) => Readonly<BotWeights>) = DEFAULT_BOT_WEIGHTS,
  search?: CounterattackSettings): GameState {
  let state = game;
  for (let step = 0; step < 10 && state.activePlayer === 0 && state.phase === 'playing'; step++) {
    const view = getPlayerView(state, 0);
    const [action] = rankBotActions(view, state.catalog, 0, 25,
      { policyVersion, weights: typeof weights === 'function' ? weights(view) : weights, nodeLimit: 65, responseLimit: 5, ...search });
    if (!action) throw new Error('Fixed tactical fixture has no legal action');
    state = applyAction(state, 0, action);
  }
  return state;
}

export function passesResearchTactics(catalog: Catalog, row: ResearchWeightRow, settings?: CounterattackSettings & {
  policyVersion: 4 | 5; fixedWeights?: Readonly<BotWeights>; weightsForPrior?: (prior: StrategyProbabilities, view: PlayerView) => BotWeights;
}): boolean {
  const counterattack = counterattackFixture(catalog);
  const immediate = structuredClone(counterattack);
  immediate.players[1].health = 6;

  const policy = settings?.policyVersion ?? 4;
  const search = { counterattackOrder: settings?.counterattackOrder, counterattackSchedule: settings?.counterattackSchedule };
  return RESEARCH_TACTICAL_PRIORS.every(prior => {
    const resolver = settings?.weightsForPrior;
    const weights = settings?.fixedWeights ?? (resolver ? (view: PlayerView) => resolver(prior, view) : mixResearchWeights(row, prior));
    const defended = playFixedTacticalTurn(counterattack, policy, weights, search);
    const survived = defended.winner === 0 || (defended.phase === 'playing' && defended.activePlayer === 1 &&
      !visibleCounterattack(0, 128, () => false)(defended));
    return survived && playFixedTacticalTurn(immediate, policy, weights, search).winner === 0;
  });
}
