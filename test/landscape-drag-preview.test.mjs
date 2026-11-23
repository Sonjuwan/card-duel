import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const dragRuleStart=css.lastIndexOf('/* Active drags use the dedicated translucent pointer ghost');
const dragRuleEnd=css.indexOf('/* Ultra-short landscape windows',dragRuleStart);
const rule=css.slice(dragRuleStart,dragRuleEnd);
test('active touch drags collapse only their visual preview, keeping the real input source',()=>{
  assert.match(battle,/currentDrag\?' is-dragging'/);
  assert.match(rule,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
  assert.match(rule,/\.battle\.is-dragging \.arena-field \.hand-card-slot:has\(>\.battle-card\.is-selected\)>\.battle-card/);
  assert.match(rule,/width:var\(--landscape-card-w\);height:var\(--landscape-card-h\)/);
  assert.match(rule,/transform:translateY\(calc\(var\(--landscape-card-h\) - var\(--landscape-hand-h\)\)\)/);
  assert.doesNotMatch(rule,/pointer-events:none/);
});
test('active drag card copy is hidden so text never floats over an actionable board target',()=>{
  assert.match(rule,/\.card-copy,\s*\.game-main \.battle\.is-dragging/);
  assert.match(rule,/\.card-type\{visibility:hidden\}/);
  assert.match(rule,/z-index:1/);
});
