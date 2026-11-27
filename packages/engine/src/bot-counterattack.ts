import { applySpeculativeAction, RuleError } from './engine.ts';
import { hasKeyword } from './effects.ts';
import { getHeroPower } from './hero-powers.ts';
import { candidates } from './simulate.ts';
import type { Action, GameState, PlayerId } from './types.ts';

export type CounterattackOrder = 'natural' | 'ordered' | 'planned';

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

function leastGuardDamage(health: number, attacks: number[]): number {
  if (health <= 0) return 0;
  // Card effects can inflate health well beyond a normal guard. Keep the
  // ranking work bounded and leave the legality and proof to the engine.
  if (health > 32 || !Number.isInteger(health) || attacks.some(attack => !Number.isInteger(attack))) return health;
  const costs = new Float64Array(health + 1).fill(Infinity);
  costs[0] = 0;
  for (const attack of attacks) {
    for (let dealt = health - 1; dealt >= 0; dealt--) {
      const next = Math.min(health, dealt + attack);
      costs[next] = Math.min(costs[next], costs[dealt] + attack);
    }
  }
  return Number.isFinite(costs[health]) ? costs[health] : health + 5;
}

function orderedReply(position: GameState, opponent: PlayerId, actions: Action[], planned: boolean): Action[] {
  const attacker = position.players[opponent], defender = position.players[1 - opponent];
  const power = getHeroPower(attacker);
  const multiplier = attacker.board.reduce((product, minion) => {
    const card = position.catalog[minion.cardId];
    return product * (card.kind === 'minion' && !minion.silenced ? card.spellAndPowerMultiplier ?? 1 : 1);
  }, 1);
  const damage = power.effects.reduce((sum, effect) => sum + (effect.kind === 'damage' ? effect.amount * multiplier : 0), 0);
  const facePower = power.effects.some(effect => effect.kind === 'damage' && effect.target === 'enemyHero');
  const increasesAttack = power.effects.some(effect => effect.kind === 'equip' || effect.kind === 'heroAttack');
  const minions = new Map(attacker.board.map(minion => [minion.instanceId, minion]));
  const powerAttack = power.effects.reduce((sum, effect) =>
    sum + (effect.kind === 'heroAttack' ? effect.amount : effect.kind === 'equip' ? effect.attack : 0), 0);
  const heroAttack = attacker.heroAttack + (attacker.weapon?.attack ?? 0);
  const seen = new Set<string>();
  const attackSources = planned ? actions.flatMap(action => {
    if (action.type === 'attack') {
      if (seen.has(action.attackerId)) return [];
      seen.add(action.attackerId);
      const minion = minions.get(action.attackerId)!;
      return Array.from({ length: Math.min(2, minion.attacksRemaining) }, () => ({ id: minion.instanceId, damage: minion.attack }));
    }
    if (action.type === 'heroAttack' && !seen.has('hero')) {
      seen.add('hero');
      return [{ id: 'hero', damage: heroAttack }];
    }
    if (action.type === 'heroPower' && !seen.has('power') && (damage > 0 || increasesAttack)) {
      seen.add('power');
      return [{ id: 'power', damage: facePower ? 0 : damage + powerAttack }];
    }
    return [];
  }) : [];
  const score = (action: Action) => {
    if (action.type === 'heroPower' && !action.target) return facePower ? 1000 + damage : increasesAttack ? 400 : 0;
    if (action.type !== 'attack' && action.type !== 'heroAttack' && action.type !== 'heroPower') return 0;
    const minion = action.type === 'attack' ? minions.get(action.attackerId) : undefined;
    const attack = action.type === 'attack' ? minion?.attack ?? 0 : action.type === 'heroAttack' ? heroAttack : damage;
    if (action.target?.kind === 'hero') return action.target.player === opponent || attack === 0 ? 0 : 1000 + attack;
    const target = action.target;
    const guard = target?.kind === 'minion' ? defender.board.find(minion => minion.instanceId === target.instanceId) : undefined;
    if (!guard || attack === 0) return 0;
    const priority = hasKeyword(guard, 'taunt') ? 500 : 1;
    if (planned && priority === 500 && !guard.immuneThisTurn) {
      const source = minion?.instanceId ?? (action.type === 'heroAttack' ? 'hero' : 'power');
      const shield = hasKeyword(guard, 'divineShield');
      const guardCard = position.catalog[guard.cardId];
      const freezes = !guard.silenced && guardCard.kind === 'minion' && guardCard.freezeOnCombatDamage;
      const lost = minion && !minion.immuneThisTurn && guard.attack > 0 && !hasKeyword(minion, 'divineShield') &&
        (guard.attack >= minion.health || hasKeyword(guard, 'poisonous') || freezes) ? minion.attacksRemaining - 1 : 0;
      let used = 1 + lost;
      const remaining = attackSources.filter(entry => entry.damage > 0 && (entry.id !== source || used-- <= 0));
      const poisoned = minion !== undefined && hasKeyword(minion, 'poisonous');
      const need = shield ? guard.health : poisoned ? 0 : guard.health - attack;
      const cost = attack * (1 + lost) + leastGuardDamage(need, remaining.map(entry => entry.damage));
      return priority - cost + (need <= 0 ? .25 : .1);
    }
    if (hasKeyword(guard, 'divineShield')) return priority + 50 - attack;
    return priority + (attack >= guard.health ? 100 - attack : attack);
  };
  return actions.map(action => ({ action, score: score(action) }))
    .sort((a, b) => b.score - a.score).map(entry => entry.action);
}

/** A bounded search for a concrete next-turn kill using visible resources.
 * Failure to find a line isn't a proof of safety. */
export function visibleCounterattack(defender: PlayerId, limit: number, expired: () => boolean, order: CounterattackOrder = 'natural') {
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
    const visited = order !== 'natural' ? new Set<string>() : undefined;
    function search(position: GameState): boolean {
      if (position.phase === 'finished') return position.winner === opponent;
      if (position.activePlayer !== opponent || position.pendingChoice || positionBudget <= 0 ||
          remaining <= 0 || expired() || !canReachLethal(position, defender)) return false;
      if (visited) {
        const { catalog: _, history: _history, ...dynamic } = position;
        const key = JSON.stringify(dynamic);
        if (visited.has(key)) return false;
        visited.add(key);
      }
      const players: GameState['players'] = [...position.players];
      // Keep the public hand/deck counts in the simulation. Only candidate
      // generation suppresses hand plays so no unknown card can prove lethal.
      players[opponent] = { ...players[opponent], hand: [] };
      const guards = new Set(players[defender].board.filter(minion =>
        !minion.immuneThisTurn && !hasKeyword(minion, 'stealth') && hasKeyword(minion, 'taunt'))
        .map(minion => minion.instanceId));
      const legalCandidates = candidates({ ...position, players }, opponent).filter(action => {
        if (action.type === 'attack' || action.type === 'heroAttack') {
          return guards.size === 0 || (action.target.kind === 'minion' && guards.has(action.target.instanceId));
        }
        return action.type === 'heroPower';
      });
      const replies = order === 'natural' ? legalCandidates : orderedReply(position, opponent, legalCandidates, order === 'planned');
      for (const action of replies) {
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
