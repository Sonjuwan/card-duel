import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
const patch=css.slice(css.indexOf('/* Card collection and deck-making'));
test('all deck pages are full-height game screens, not a scrolling browser document',()=>{
  assert.match(patch,/html,body\{overscroll-behavior:none\}/);
  assert.match(patch,/#root\{height:100dvh;min-height:0;overflow:hidden\}/);
  assert.match(patch,/screen-content:has\(>\.deck-workspace\),[\s\S]*?screen-content:has\(>\.card-browser\)\{overflow:hidden\}/);
  assert.match(patch,/\.deck-workspace\{[\s\S]*?flex:1 1 0%;min-height:0;min-width:0;overflow:hidden/);
});
test('the editor keeps paginated cards and a live deck rail without independent scrollers',()=>{
  assert.match(app,/deckRows\.items\.map/);
  assert.match(app,/savedRows\.items\.map/);
  assert.match(patch,/\.deck-panel \.deck-sidebar\{[^}]*overflow:visible/);
  assert.match(patch,/\.deck-panel \.deck-layout>div\{[^}]*overflow:visible/);
  assert.match(patch,/\.book-edge\{min-width:44px;min-height:44px/);
});
