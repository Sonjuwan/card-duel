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
test('deck browsing and live deck rows use separate contained scrolling regions',()=>{
  const integrated=readFileSync(new URL('../apps/client/src/integrated-ui.css',import.meta.url),'utf8');
  const editor=app.slice(app.indexOf('function DeckEditorView'),app.indexOf('export type DeckScreen'));
  assert.match(editor,/deckRows\.map/);
  assert.match(editor,/<CollectionBook cards=\{browseCards\} continuous/);
  assert.doesNotMatch(editor,/deckPage|paging=|PageControls/);
  assert.match(integrated,/\.deck-list-scroll\{overflow:auto;overscroll-behavior:contain/);
  assert.match(integrated,/collection-continuous\{[^}]*overflow:auto/);
  assert.match(app,/savedRows\.items\.map/);
});
