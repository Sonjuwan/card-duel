import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
const load=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const battle=load('../apps/client/src/Battle.tsx');
const pieces=load('../apps/client/src/battle-pieces.tsx');

const hover=load('../apps/client/src/hover-context.ts');
const portal=load('../apps/client/src/hover-preview.tsx');
test('hand and battlefield inspection shares a release-to-close preview',()=>{
  assert.match(pieces,/useCardHover\(info,BATTLE_HOLD_DELAY\)/);
  assert.match(hover,/onPointerUp:[^\n]+clear\(\)/);
  assert.match(hover,/onPointerCancel:[^\n]+clear\(\)/);
  assert.match(portal,/e.key==='Escape'\)close\(\)/);
});
test('short pointer clicks do not create a hand selection or a board inspector',()=>{
  assert.doesNotMatch(battle,/peekCardId|onInspectTap|selectHandCard\(/);
  assert.match(battle,/onClick=\{keyboard=>\{if\(keyboard\)applyIntent/);
});
test('the touch hand exposes whether its panel is expanded',()=>{
  assert.match(battle,/className="folded-hand" aria-expanded=\{handOpen&&hand.length>0\}/);
});
