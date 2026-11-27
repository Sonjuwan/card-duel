import { createHash } from 'node:crypto';
import { cardRoles, deckCards, DEFAULT_BOT_WEIGHTS, HERO_CLASSES, maxCardCopies, validateDeck } from '../../packages/engine/src/index.ts';
import type { Catalog, Deck, HeroClass } from '../../packages/engine/src/index.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../packages/engine/src/deck-strategies.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import { researchCardPool } from './card-value.ts';
import type { CardValueObservation, CardValuePair } from './card-value.ts';

const protocol = {
  fixtureVersion: 'research-decks-v1/closest-legal-card-v1',
  classCoverage: 'own-and-opponent-strategies/class-card; all-classes-and-own-strategies/neutral',
  policyVersion: 2, level: 6, nodes: 24,
} as const;
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function cardValueProtocol(seed: number, repeats: number) {
  return { ...protocol, seed, repeats, hash: fingerprint({ ...protocol, seed, repeats }) };
}

export function substitutionDecks(catalog: Catalog, reference: Deck, cardId: string) {
  const card = catalog[cardId];
  const eligible = deckCards(catalog, reference.heroClass);
  if (!card || !eligible.some(candidate => candidate.id === cardId)) {
    throw new Error(`Card ${cardId} is ineligible for ${reference.heroClass}`);
  }
  const roles = cardRoles(card, catalog);
  const closest = eligible.filter(candidate => candidate.id !== cardId).map(candidate => {
    const role = cardRoles(candidate, catalog);
    const roleGap = Object.entries(roles).reduce((sum, [key, value]) =>
      sum + Math.abs(value - role[key as keyof typeof role]), 0);
    return { candidate, distance: 2 * Math.abs(card.cost - candidate.cost) + (card.kind === candidate.kind ? 0 : 6) +
      .35 * roleGap / (1 + card.cost / 3) };
  }).sort((a, b) => a.distance - b.distance || a.candidate.id.localeCompare(b.candidate.id));

  const shell = reference.cards.filter(id => id !== cardId);
  const removedIndex = shell.length === 30 ? shell.indexOf(closest.find(entry => shell.includes(entry.candidate.id))!.candidate.id) : -1;
  const removed = removedIndex === -1 ? undefined : shell.splice(removedIndex, 1)[0];
  const choose = () => closest.find(({ candidate }) =>
    shell.filter(id => id === candidate.id).length < maxCardCopies(candidate))?.candidate.id;
  while (shell.length < 29) {
    const filler = choose();
    if (!filler) throw new Error(`No legal substitute for ${cardId}`);
    shell.push(filler);
  }
  const replacement = removed ?? choose();
  if (!replacement) throw new Error(`No legal substitute for ${cardId}`);

  const control = { heroClass: reference.heroClass, cards: [...shell, replacement] };
  const treatment = { heroClass: reference.heroClass, cards: [...shell, cardId] };
  validateDeck(control, catalog);
  validateDeck(treatment, catalog);
  return { control, treatment, replacement };
}

/** Own decks, opposing decks, weights, and seeds are frozen before each four-game trial. */
export function prepareCardValueTrials(source: Catalog, seed: number, repeats: number) {
  const catalog = snapshotBattleCatalog(source);
  const pool = new Map(researchCardPool(catalog).map(card => [card.id, card]));
  const decks = new Map(HERO_CLASSES.map(hero =>
    [hero, RESEARCH_STRATEGIES.map(strategy => researchDeck(catalog, hero, strategy))] as const));
  return (cardId: string): CardValueObservation => {
    const card = pool.get(cardId);
    if (!card) throw new Error(`Unknown eligible card: ${cardId}`);
    const classes: readonly HeroClass[] = card.class === 'neutral' ? HERO_CLASSES : [card.class];
    const pairs: CardValuePair[] = [];
    const fixtures = [];
    for (let repeat = 0; repeat < repeats; repeat++) {
      for (const hero of classes) {
        const heroIndex = HERO_CLASSES.indexOf(hero);
        for (const [ownIndex, strategy] of RESEARCH_STRATEGIES.entries()) {
          const { control, treatment, replacement } = substitutionDecks(catalog, decks.get(hero)![ownIndex], cardId);
          const opposite = card.class === 'neutral' ? [(heroIndex + ownIndex + repeat) % 4] : [0, 1, 2, 3];
          for (const enemyIndex of opposite) {
            const opponentStrategy: ResearchStrategy = RESEARCH_STRATEGIES[enemyIndex];
            const opponentClass = HERO_CLASSES[(heroIndex + ownIndex * 2 + enemyIndex * 3 + repeat + 1) % HERO_CLASSES.length];
            const opponent = decks.get(opponentClass)![enemyIndex];
            const shuffleSeed = (seed + Math.imul(1 + repeat * 144 + heroIndex * 16 + ownIndex * 4 + enemyIndex, 0x9e3779b1)) >>> 0;
            fixtures.push({ control, treatment, opponent, shuffleSeed, strategy, opponentStrategy });
            const pair: CardValuePair = { pilotClass: hero, opponentClass, strategy, opponentStrategy, replacement, seed: shuffleSeed,
              control: [0, 0], treatment: [0, 0], truncated: 0, seen: 0, played: 0 };
            for (const [mode, own] of [['control', control], ['treatment', treatment]] as const) {
              const scores: [number, number] = [0, 0];
              for (const candidateSeat of [0, 1] as const) {
                const fixedDecks: [Deck, Deck] = candidateSeat === 0 ? [own, opponent] : [opponent, own];
                const result = playTrainingMatch(catalog, {
                  seed: shuffleSeed, firstPlayer: 0, classes: [fixedDecks[0].heroClass, fixedDecks[1].heroClass],
                  styles: [false, false], fixedDecks, candidateSeat, candidate: DEFAULT_BOT_WEIGHTS, opponent: DEFAULT_BOT_WEIGHTS,
                  level: protocol.level, nodes: protocol.nodes, policyVersion: protocol.policyVersion,
                }, mode === 'treatment' ? { focusCard: cardId } : undefined);
                scores[candidateSeat] = result.score;
                pair.truncated += Number(result.truncated);
                pair.seen += Number(result.focusExposure?.seen ?? false);
                pair.played += Number(result.focusExposure?.played ?? false);
              }
              pair[mode] = scores;
            }
            pairs.push(pair);
          }
        }
      }
    }
    return { cardId, fixtureHash: fingerprint(fixtures), plannedPairs: fixtures.length, pairs };
  };
}
