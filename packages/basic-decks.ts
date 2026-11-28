import presets from '../data/progression/basic-decks.json' with {type:'json'};
import {completePracticeDeck, validateDeck} from './engine/src/index.ts';
import type {Catalog, Deck, HeroClass} from './engine/src/index.ts';

export function basicDeck(catalog: Catalog, heroClass: HeroClass): Deck {
  const cards = presets[heroClass].filter(id=>{
    const card = catalog[id];
    return card && card.kind !== 'coin' && card.rarity === 'basic' && card.collectible !== false
      && (card.class === heroClass || card.class === 'neutral');
  }).flatMap(id=>[id,id]);
  const deck = {heroClass,cards};
  if (cards.length === 30) {
    validateDeck(deck,catalog);
    return deck;
  }
  const basicCatalog = Object.fromEntries(Object.entries(catalog).filter(([,card])=>card.kind!=='coin'&&card.rarity==='basic'));
  return completePracticeDeck(basicCatalog,deck);
}
