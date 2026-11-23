import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const segment=css.slice(css.lastIndexOf('/* Ultra-short landscape windows'));
test('ultra-short landscape rail scrolls locally, preserving the non-scrolling game canvas',()=>{
  assert.match(segment,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:360px\)/);
  assert.match(segment,/\.arena-right\{[^}]*overflow-y:auto;overflow-x:hidden/);
  assert.match(segment,/overscroll-behavior:contain/);
  assert.match(css,/\.game-main>\.screen-content\{overflow:hidden\}/);
});
test('end turn is first and sticky; own mana and opponent resources remain reachable',()=>{
  assert.match(segment,/\.arena-right>\.turn-control\{[^}]*order:-4;position:sticky;top:0;z-index:7/);
  assert.match(segment,/\.arena-right>\.own-resources\{order:-3;flex:0 0 auto/);
  assert.match(segment,/\.arena-right>\.opponent-resources\{order:-2;flex:0 0 auto/);
  assert.match(segment,/\.arena-right>\.concede-button\{order:-1;flex-shrink:0/);
  assert.match(segment,/\.arena-right>\.turn-control \.end-turn\{min-height:44px\}/);
});
