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
test('deck edit and card collection keep a live side panel rather than disappearing below the cards',()=>{
  assert.match(app,/className="deck-editor-controls"/);
  assert.match(app,/className="card-browser-controls"/);
  assert.match(patch,/\.deck-panel \.deck-layout\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) clamp\(156px,29dvw,310px\)/);
  assert.match(patch,/\.deck-panel \.deck-sidebar\{[\s\S]*?overflow-y:auto/);
  assert.match(patch,/\.deck-panel \.deck-layout>div\{[\s\S]*?overflow-y:auto/);
});
test('landscape editor controls have bounded scrolling, responsive rails and minimum touch sizes',()=>{
  assert.match(patch,/\.deck-editor-controls,\.lobby-main \.card-browser-controls\{[\s\S]*?max-height:clamp\(67px,26dvh,155px\)/);
  assert.match(patch,/\.deck-panel \.deck-layout\{grid-template-columns:minmax\(0,1fr\) clamp\(144px,30dvw,240px\)/);
  assert.match(patch,/\.deck-workspace-nav button\{min-height:44px\}/);
  assert.match(patch,/\.card-browser-controls button\{min-height:44px\}/);
});
