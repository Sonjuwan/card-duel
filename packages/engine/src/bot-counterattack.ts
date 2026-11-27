import { applySpeculativeAction, RuleError } from './engine.ts';
import { hasKeyword } from './effects.ts';
import { getHeroPower } from './hero-powers.ts';
import { candidates } from './simulate.ts';
import type { Action, GameState, PlayerId } from './types.ts';

function canReachLethal(state: GameState, defender: PlayerId): boolean {
  const opponent = state.players[1 - defender], own = state.players[defender];
  const weapon = opponent.weapon?.cardId && state.catalog[opponent.weapon.cardId];
  if (weapon && weapon.kind === 'weapon' && weapon.beforeAttack?.length) return true;
  if (state.players.some(player => player.board.some(minion => {
    const card = state.catalog[minion.cardId];
    return !minion.silenced && card.kind === 'minion' &&
      (card.startTurn?.length || card.endTurn?.length || card.endAnyTurn?.length);
  }))) return true;

  const power = getHeroPower(opponent);
  const modifiers = opponent.board.reduce((product, minion) => {
    const card = state.catalog[minion.cardId];
    return product * (card.kind === 'minion' && !minion.silenced ? card.spellAndPowerMultiplier ?? 1 : 1);
  }, 1);
  const powerDamage = power.effects.reduce((sum, effect) =>
    sum + (effect.kind === 'damage' ? effect.amount * modifiers : 0), 0);
  const powerAttack = power.effects.reduce((sum, effect) =>
    sum + (effect.kind === 'heroAttack' ? effect.amount : effect.kind === 'equip' ? effect.attack : 0), 0);
  const attack = opponent.board.reduce((sum, minion) =>
    sum + minion.attack * (hasKeyword(minion, 'windfury') ? 2 : 1), 0);
  const heroAttack = Math.max(opponent.weapon?.attack ?? 0, 0) + opponent.heroAttack + powerAttack;
  return attack + heroAttack * (weapon && weapon.kind === 'weapon' && weapon.windfury ? 2 : 1) + powerDamage >= own.health + own.armor;
}

/** A bounded search for a concrete next-turn kill using visible resources.
 * Failure to find a line isn't a proof of safety. */
export function visibleCounterattack(defender: PlayerId, limit: number, expired: () => boolean) {
  const opponent: PlayerId = defender === 0 ? 1 : 0;
  let remaining = limit;

  function step(state: GameState, actor: PlayerId, action: Action): GameState | undefined {
    try {
      const next = applySpeculativeAction(state.history.length ? { ...state, history: [] } : state, actor, action);
      return next.rng === state.rng ? next : undefined;
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      return undefined;
    }
  }

  return (state: GameState): boolean => {
    if (state.phase !== 'playing' || state.pendingChoice || remaining <= 0 || expired() ||
        !canReachLethal(state, defender)) return false;

    // Bound both total work and the fraction any one candidate can consume.
    let positionBudget = Math.min(24, remaining);
    function search(position: GameState): boolean {
      if (position.phase === 'finished') return position.winner === opponent;
      if (position.activePlayer !== opponent || position.pendingChoice || positionBudget <= 0 ||
          remaining <= 0 || expired() || !canReachLethal(position, defender)) return false;
      const players: GameState['players'] = [...position.players];
      // Keep the public hand/deck counts in the simulation. Only candidate
      // generation suppresses hand plays so no unknown card can prove lethal.
      players[opponent] = { ...players[opponent], hand: [] };
      const guards = new Set(players[defender].board.filter(minion =>
        !minion.immuneThisTurn && !hasKeyword(minion, 'stealth') && hasKeyword(minion, 'taunt'))
        .map(minion => minion.instanceId));
      for (const action of candidates({ ...position, players }, opponent)) {
        if (action.type === 'attack' || action.type === 'heroAttack') {
          if (guards.size && (action.target.kind !== 'minion' || !guards.has(action.target.instanceId))) continue;
        } else if (action.type !== 'heroPower') continue;
        if (positionBudget <= 0 || remaining <= 0 || expired()) break;
        positionBudget--;
        remaining--;
        const next = step(position, opponent, action);
        if (next && search(next)) return true;
      }
      return false;
    }

    if (state.activePlayer === opponent) return search(state);
    positionBudget--;
    remaining--;
    const nextTurn = step(state, defender, { type: 'endTurn' });
    return nextTurn !== undefined && search(nextTurn);
  };
}
