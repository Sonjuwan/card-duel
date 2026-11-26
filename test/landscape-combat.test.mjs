import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const css=readFileSync(new URL('../apps/client/src/landscape-combat.css',import.meta.url),'utf8');
const client=readFileSync(new URL('../apps/client/src/main.tsx',import.meta.url),'utf8');
const solo=readFileSync(new URL('../apps/client/src/offline-main.tsx',import.meta.url),'utf8');
const shared=readFileSync(new URL('../apps/client/src/game-styles.ts',import.meta.url),'utf8');
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');

test('mobile landscape rules cannot accidentally replace portrait or desktop layouts',()=>{
  assert.match(css,/@media\s*\(pointer:coarse\)\s*and\s*\(orientation:landscape\)\s*and\s*\(max-height:540px\)/);
  assert.doesNotMatch(css,/^\.battle-arena\s*\{/m); // no top-level unscoped battlefield geometry
});
test('both installed and standalone apps load landscape rules after combat effects',()=>{
  for(const source of [client,solo]){
    assert.match(source,/import '\.\/game-styles\.ts';/);
    const fx=shared.indexOf("import './battle-fx.css';"),layout=shared.indexOf("import './landscape-combat.css';");
    assert.ok(fx>=0&&layout>fx);
  }
});
test('enemy and friendly hero remain centrally aligned above and below their minion rows',()=>{
  const enemy=battle.indexOf('className="hero-zone enemy-hero-zone"');
  const enemyBoard=battle.indexOf('className="arena-board enemy-board"');
  const friendlyBoard=battle.indexOf('className={`arena-board friendly-board');
  const self=battle.indexOf('className="hero-zone self-hero-zone"');
  const hand=battle.indexOf('className="own-hand"');
  assert.ok(enemy>=0&&enemy<enemyBoard&&enemyBoard<friendlyBoard&&friendlyBoard<self&&self<hand);
  assert.match(css,/\.battle \.arena-field>\.hero-zone\{[^}]*justify-content:center/);
});
test('hand is always compact but selected/focused card expands without board relayout',()=>{
  assert.match(css,/grid-template-rows:clamp\(6px,2dvh,16px\) var\(--landscape-hero-h\) minmax\(0,1fr\)/);
  assert.match(css,/\.battle \.arena-field \.hand-card-slot:has\(>\.battle-card\.is-selected\)/);
  assert.match(css,/\.battle \.arena-field \.hand-card-slot:has\(>\.battle-card:focus-visible\)>\.battle-card/);
  assert.match(css,/\.battle \.arena-field \.battle-hand\{[^}]*overflow:visible/);
  assert.doesNotMatch(css,/overflow-x:auto;overflow-y:visible/);
});
test('turn button remains touch sized and reading mode honors motion preferences',()=>{
  assert.match(css,/\.battle \.arena-right \.turn-control \.end-turn\{min-height:44px/);
  assert.match(css,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\) and \(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.battle \.arena-field \.hand-card-slot:has\(>\.battle-card\.is-selected\)>\.battle-card \.card-copy/);
});
