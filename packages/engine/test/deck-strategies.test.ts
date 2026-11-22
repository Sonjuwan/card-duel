import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalog,strategicDeck,DECK_STYLES,HERO_CLASSES,validateDeck,cardRoles,deckCards,manaCurve} from '../src/index.ts';
const source=JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8'));
const catalog=createCatalog(source);
test('seven AI deck styles are valid for all nine classes with distinct deterministic seeds',()=>{
  for(const cls of HERO_CLASSES){
    const decks=DECK_STYLES.map(s=>strategicDeck(catalog,cls,s,753));
    for(const deck of decks){validateDeck(deck,catalog);assert.equal(deck.cards.length,30);assert.equal(manaCurve(catalog,deck).reduce((a,b)=>a+b,0),30);}
    assert.equal(new Set(decks.map(d=>JSON.stringify([...d.cards].sort()))).size,DECK_STYLES.length);
    const aggression=decks[DECK_STYLES.indexOf('aggression')],control=decks[DECK_STYLES.indexOf('control')];
    const mana=(d:typeof aggression)=>d.cards.reduce((n,id)=>n+catalog[id].cost,0);
    assert.ok(mana(aggression)<mana(control),cls);
    assert.deepEqual(strategicDeck(catalog,cls,'control',753),control);
    assert.notDeepEqual(strategicDeck(catalog,cls,'control',497),control);
  }
});
test('role analysis uses current stats and declared effects, not card IDs',()=>{
  const c=catalog.flame_sphere;assert.ok(c.kind==='spell');
  const strengthened={...c,effects:[{kind:'damage' as const,target:'chosen' as const,amount:8}]};
  assert.ok(cardRoles(strengthened,catalog).removal>cardRoles(c,catalog).removal);
  const minion=catalog.ragnaros;assert.ok(minion.kind==='minion');
  assert.ok(cardRoles(minion,catalog).reach>cardRoles(catalog.ogre,catalog).reach);
  const wisp=catalog.wisp;assert.ok(wisp.kind==='minion');const newCard={...wisp,id:'brand_new_card'};
  assert.deepEqual(cardRoles(newCard,catalog),cardRoles(catalog.wisp,catalog));
  for(const c of deckCards(catalog,'mage'))assert.ok(Object.values(cardRoles(c,catalog)).every(Number.isFinite));
});
