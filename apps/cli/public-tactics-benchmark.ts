import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { CardStore } from '../server/card-store.ts';
import { aiCatalogHash } from '../server/ai-profile-store.ts';
import { applyAction, createGame, starterDeck } from '../../packages/engine/src/index.ts';
import type { GameState, HeroClass, Minion, PlayerId } from '../../packages/engine/src/index.ts';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { visibleCounterattack } from '../../packages/engine/src/bot-counterattack.ts';
import { exactPublicLethal } from './public-tactics-reference.ts';

const ATTACKERS = ['warrior', 'mage', 'hunter', 'rogue', 'druid'] as const;
const guardCases = ['none', 'taunt', 'shield', 'two', 'mixed'] as const;
const hitPoints = [3, 5, 7, 9, 11] as const;
const attackCases = ['small', 'heavy', 'windfury', 'weapon', 'frozen', 'four'] as const;

function minion(id: string, owner: PlayerId, attack: number, health: number, keywords: Minion['keywords'] = []): Minion {
  return { instanceId: id, cardId: 'recruit', originalOwner: owner, attack, health, maxHealth: health,
    attacksRemaining: 0, keywords };
}
function fixedState(base: GameState, hp: number, guard: typeof guardCases[number], attack: typeof attackCases[number], variant: 0 | 1) {
  const { catalog, ...state } = base;
  const game = { ...structuredClone(state), catalog };
  const own = game.players[0], enemy = game.players[1];
  own.health = Math.max(1, hp - (variant === 0 ? 0 : 2));
  own.armor = hp - own.health;
  own.board = [minion('friendly', 0, 2, 2)];
  if (guard !== 'none') own.board.push(minion('guard', 0, 1, guard === 'taunt' ? 4 : 2,
    guard === 'shield' || guard === 'mixed' ? ['taunt', 'divineShield'] : ['taunt']));
  if (guard === 'two' || guard === 'mixed') own.board.unshift(minion('guard2', 0, 2, guard === 'two' ? 3 : 1, ['taunt']));
  enemy.maxMana = variant === 0 ? 1 : 4;
  const shapes = { small: [1, 2, 2], heavy: [6, 1, 2], windfury: [3, 2, 2], weapon: [2, 2], frozen: [4, 2, 3], four: [1, 2, 3, 4] };
  enemy.board = shapes[attack].map((value, index) => minion('enemy-' + index, 1, value, 2 + index,
    index === 0 && attack === 'windfury' ? ['windfury'] : []));
  if (attack === 'frozen') enemy.board[0].frozenThroughTurn = game.turn + 1;
  if (attack === 'weapon') enemy.weapon = { attack: variant === 0 ? 3 : 5, durability: 2 };
  if (variant === 1) enemy.board.reverse();
  return game;
}

const { values } = parseArgs({ options: { catalog: { type: 'string' }, variant: { type: 'string' }, budget: { type: 'string' } } });
const variant = Number(values.variant ?? '0');
if (variant !== 0 && variant !== 1) throw new Error('Variant must be 0 or 1');
const budget = Number(values.budget ?? '24');
if (!Number.isInteger(budget) || budget < 1 || budget > 24) throw new Error('Budget must be between 1 and 24 transitions');
const { catalog: raw, version } = new CardStore().read(values.catalog);
const catalog = snapshotBattleCatalog(raw);
const mismatches: object[] = [];
const report = {
  version, catalog: aiCatalogHash(raw), variant, budget, positions: 0, lethal: 0, safe: 0, unresolved: 0,
  natural: { truePositive: 0, falsePositive: 0, milliseconds: 0 },
  ordered: { truePositive: 0, falsePositive: 0, milliseconds: 0 },
  planned: { truePositive: 0, falsePositive: 0, milliseconds: 0 },
};
for (const hero of ATTACKERS satisfies readonly HeroClass[]) {
  let opening = createGame(catalog, [starterDeck(catalog, 'mage'), starterDeck(catalog, hero)],
    { seed: variant === 0 ? 917531 : 373807, firstPlayer: 0 });
  for (const actor of [0, 1] as const) opening = applyAction(opening, actor, { type: 'mulligan', replace: [] });
  opening.players[1].hand = [];
  for (const guard of guardCases) for (const attack of attackCases) for (const hp of hitPoints) {
    const state = fixedState(opening, hp, guard, attack, variant);
    report.positions++;
    const truth = exactPublicLethal(state, 0, 100_000);
    if (truth === null) { report.unresolved++; continue; }
    if (truth) report.lethal++; else report.safe++;
    const orders = ['natural', 'ordered', 'planned'] as const;
    const found = {} as Record<typeof orders[number], boolean>;
    for (const order of orders) {
      const at = performance.now();
      found[order] = visibleCounterattack(0, budget, () => false, order)(state);
      report[order].milliseconds += performance.now() - at;
      report[order].truePositive += Number(found[order] && truth);
      report[order].falsePositive += Number(found[order] && !truth);
    }
    if (orders.some(order => truth !== found[order])) mismatches.push({ hero, guard, attack, hp, truth, ...found });
  }
}
console.log(JSON.stringify({ ...report, mismatches }, null, 2));
