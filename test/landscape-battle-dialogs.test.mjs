import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const dialog=css.slice(css.indexOf('/* Match-end and card-choice overlays'));
test('small landscape choice/result overlays are constrained to arena not document',()=>{
  assert.match(dialog,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
  assert.match(dialog,/\.battle-overlay\.result-overlay\{[\s\S]*?overflow:hidden/);
  assert.match(dialog,/\.battle-overlay \.result-window\{[\s\S]*?max-height:100%;min-height:0/);
  assert.match(dialog,/overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain/);
});
test('candidate cards pan horizontally, button actions remain touch-sized',()=>{
  assert.match(dialog,/choice-window>\.choice-cards\{[\s\S]*?overflow-x:auto;overflow-y:hidden/);
  assert.match(dialog,/touch-action:pan-x/);
  assert.match(dialog,/\.choice-window>button,[\s\S]*?\.result-window>button,[\s\S]*?\.effect-choices button\{\s*min-height:44px/);
});
