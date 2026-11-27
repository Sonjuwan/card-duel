import { applyAction, candidates, RuleError } from '../../packages/engine/src/index.ts';
import type { GameState, PlayerId } from '../../packages/engine/src/index.ts';

/** Independent exhaustive reference. Unknown RNG branches cannot establish
 * a proof. Return null if the reference itself cannot resolve the position. */
export function exactPublicLethal(start: GameState, defender: PlayerId, limit: number): boolean | null {
  const opponent: PlayerId = defender === 0 ? 1 : 0;
  const visited = new Set<string>();
  let budget = limit;
  let exhausted = false;
  function solve(game: GameState): boolean {
    if (game.phase === 'finished') return game.winner === opponent;
    if (game.activePlayer !== opponent || game.pendingChoice) return false;
    const { catalog: _, history: _history, ...position } = game;
    const key = JSON.stringify(position);
    if (visited.has(key)) return false;
    visited.add(key);
    const players: GameState['players'] = [...game.players];
    players[opponent] = { ...players[opponent], hand: [] };
    for (const action of candidates({ ...game, players }, opponent)) {
      if (action.type !== 'attack' && action.type !== 'heroAttack' && action.type !== 'heroPower') continue;
      if (budget-- <= 0) { exhausted = true; return false; }
      try {
        const next = applyAction({ ...game, history: [] }, opponent, action);
        if (next.rng === game.rng && solve(next)) return true;
      } catch (error) { if (!(error instanceof RuleError)) throw error; }
    }
    return false;
  }
  if (start.phase !== 'playing' || start.pendingChoice) return null;
  const before = start.activePlayer === opponent ? start : applyAction(start, defender, { type: 'endTurn' });
  if (before.rng !== start.rng) return null;
  return solve(before) ? true : exhausted ? null : false;
}
