import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const last=css.slice(css.lastIndexOf('/* Do not crop a 44px target/confirm button'));
test('landscape action messages fit multiple 44px controls without cropping',()=>{
  assert.match(last,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
  assert.match(last,/\.game-main \.duel-screen \.arena-message\{[^}]*min-height:44px;max-height:min\(22dvh,88px\)/);
  assert.match(last,/flex-wrap:wrap;align-content:flex-start;overflow-y:auto;overflow-x:hidden/);
  assert.match(last,/\.game-main \.duel-screen \.arena-message button,[\s\S]*summary\{min-height:44px\}/);
});
test('scroll is confined to action strip; battlefield still owns remaining canvas height',()=>{
  assert.match(css,/\.game-main>\.screen-content\{overflow:hidden\}/);
  assert.match(css,/\.game-main \.battle\.phase-playing \.battle-arena\.classic-table,[\s\S]*flex:1 1 0%;height:auto;min-height:0/);
  assert.match(last,/overscroll-behavior:contain/);
});
