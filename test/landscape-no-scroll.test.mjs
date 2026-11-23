import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* v0.279:'));
test('landscape gameplay screen does not vertically scroll even with expanded target controls',()=>{
  assert.match(patch,/@media \(orientation:landscape\)/);
  assert.match(patch,/\.duel-screen\.phase-playing,[\s\S]*?\.duel-screen\.phase-finished\{[\s\S]*?overflow-y:hidden;overflow-x:hidden/);
  assert.match(patch,/overscroll-behavior:none/);
});
test('short landscapes retain readable independent logs without growing battlefield',()=>{
  assert.match(patch,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
  assert.match(patch,/\.phase-finished>\.battle-utilities\{[\s\S]*?flex:0 0 44px;min-height:0;max-height:44px;overflow-y:auto/);
  assert.match(patch,/\.phase-finished>\.battle-arena\.classic-table\{[\s\S]*?flex:1 1 0%;min-height:0;max-height:100%/);
});
