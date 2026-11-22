import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completePracticeDeck,createCatalog,HERO_CLASSES,manaCurve,practiceDeck,starterDeck,validateDeck} from '../src/index.ts';
import type {Deck} from '../src/index.ts';
const data=JSON.parse(readFileSync(new URL('../../../data/cards/v0.20.0.json',import.meta.url),'utf8'));
const catalog=createCatalog(data);

test('all nine human practice decks have 30 legal cards, class identity and playable early curve',()=>{for(const heroClass of HERO_CLASSES){const before=starterDeck(catalog,heroClass),d=practiceDeck(catalog,heroClass),curve=manaCurve(catalog,d);validateDeck(d,catalog);assert.equal(d.cards.length,30);assert.equal(new Set(d.cards).size,15);assert.equal(d.cards.filter(id=>catalog[id].kind==='minion').length>=16,true,heroClass);assert.ok(curve[0]+curve[1]+curve[2]>=8,heroClass);assert.equal(d.cards.filter(id=>catalog[id].kind!=='coin'&&catalog[id].class===heroClass).length,16,heroClass);assert.deepEqual(practiceDeck(catalog,heroClass),d);assert.deepEqual(starterDeck(catalog,heroClass),before);}});
test('auto complete preserves every selected card and order, including a fully completed custom deck',()=>{const partial:Deck={heroClass:'mage',cards:['wisp','wolf','wisp','arcane_barrier','blizzard']};const previous=structuredClone(partial),next=completePracticeDeck(catalog,partial);assert.deepEqual(partial,previous);assert.deepEqual(next.cards.slice(0,partial.cards.length),previous.cards);validateDeck(next,catalog);assert.deepEqual(completePracticeDeck(catalog,next),next);});
test('auto complete supports older and modified catalogues without preset IDs',()=>{const legacy=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.8.0.json',import.meta.url),'utf8')));for(const heroClass of HERO_CLASSES)validateDeck(practiceDeck(legacy,heroClass),legacy);});
test('auto complete refuses illegal partial cards instead of silently dropping them',()=>{assert.throws(()=>completePracticeDeck(catalog,{heroClass:'mage',cards:['iron_axe']}),/제거/);assert.throws(()=>completePracticeDeck(catalog,{heroClass:'mage',cards:['wisp','wisp','wisp']}),/제거/);});
