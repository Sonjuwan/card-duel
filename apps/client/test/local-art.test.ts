import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalog,HERO_CLASSES,HERO_TOKENS} from '../../../packages/engine/src/index.ts';
import {ART_OVERRIDES,ART_PALETTES,ART_SUBJECTS,artSeed,cardArtRecipe,heroArtRecipe,powerArtRecipe} from '../src/local-art-model.ts';
import type {Card} from '../../../packages/engine/src/index.ts';
const cards=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.22.0.json',import.meta.url),'utf8')));
const all=Object.values({...cards,...Object.fromEntries(HERO_TOKENS.map(c=>[c.id,c]))});
test('every active card and engine token produces a stable local art recipe',()=>{
  assert.equal(all.length,380);
  assert.equal(new Set(all.map(c=>artSeed(c.id))).size,all.length);
  for(const c of all){
    const recipe=cardArtRecipe(c);
    assert.deepEqual(cardArtRecipe(structuredClone(c)),recipe);
    assert.ok(ART_SUBJECTS.includes(recipe.subject),c.id);
    assert.equal(ART_PALETTES[recipe.theme].length,5,c.id);
    assert.ok(recipe.variant>=0&&recipe.variant<=6,c.id);
  }
  assert.ok(new Set(all.map(c=>cardArtRecipe(c).subject)).size>=40);
});
test('historical-name corrections have the intended recognizable art',()=>{
  for(const [id,[subject,theme]] of Object.entries(ART_OVERRIDES)){
    assert.ok(cards[id],id);const result=cardArtRecipe(cards[id]);assert.equal(result.subject,subject,id);assert.equal(result.theme,theme,id);
  }
  assert.equal(cardArtRecipe(cards.wolf).subject,'raptor');
  assert.equal(cardArtRecipe(cards.flame_sphere).subject,'fireball');
  assert.equal(cardArtRecipe(cards.forest_sheep).subject,'sheep');
  assert.equal(cardArtRecipe(cards.rust_collector).subject,'slime');
});
test('balance editing and newly created cards do not require artwork training or external lookup',()=>{
  const original=cards.wolf;
  const changed={...original,cost:8,attack:7,health:4,name:'사용자가 바꾼 이름',description:'사용자가 바꾼 능력'} as Card;
  assert.deepEqual(cardArtRecipe(changed),cardArtRecipe(original));
  const custom={...cards.wolf,id:'my_new_beast',name:'새로운 카드'} as Card;
  const r=cardArtRecipe(custom);assert.equal(r.subject,'beast');assert.notEqual(r.seed,cardArtRecipe(original).seed);
});
test('nine hero portraits and powers have separate unique deterministic seeds',()=>{
 const all=HERO_CLASSES.flatMap(c=>[heroArtRecipe(c),powerArtRecipe(c)]);
 assert.equal(all.length,18);assert.equal(new Set(all.map(r=>r.seed)).size,18);
 for(const c of HERO_CLASSES){assert.equal(heroArtRecipe(c).hero,true);assert.equal(powerArtRecipe(c).hero,false);assert.notEqual(heroArtRecipe(c).seed,powerArtRecipe(c).seed);}
});
