import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
const load=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const battle=load('../apps/client/src/Battle.tsx');
const pieces=load('../apps/client/src/battle-pieces.tsx');

test('a non-playable hand card is dismissible by Escape regardless of active turn',()=>{
  const start=battle.indexOf('const targetKeys=');
  const close=battle.indexOf('setPeekCardId(null);return;',start);
  const inactive=battle.indexOf('if(!active||currentDrag',start);
  assert.ok(start>=0&&close>start&&close<inactive);
  assert.match(battle.slice(start,close),/e\.key==='Escape'&&peekCardId&&!selected/);
  assert.match(battle.slice(start,close),/e\.target\.closest\('\.battle-hand'\)/);
});
test('clicking off the hand closes only the preview without blocking the game action',()=>{
  assert.match(battle,/if\(peekCardId&&!e\.target\.closest\('\.own-hand \.hand-card-slot'\)\)setPeekCardId\(null\)/);
  assert.match(battle,/e\.preventDefault\(\);e\.stopPropagation\(\);return;\}\s*if\(!\(e\.target instanceof Element\)\)return;\s*if\(peekCardId/);
});
test('the currently enlarged selected card is announced as expanded to assistive technology',()=>{
  assert.match(pieces,/aria-expanded=\{previewOpen\|\|Boolean\(sourceId\?\.startsWith\('card:'\)&&selected\)\|\|undefined\}/);
  assert.match(pieces,/aria-disabled=\{!enabled\}/);
});
