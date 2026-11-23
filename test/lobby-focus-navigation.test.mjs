import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const app=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
test('persistent menu tabs identify each screen and announce its current pressed state',()=>{
  for(const tab of ['play','decks','catalog']){
    assert.match(app,new RegExp(`data-lobby-tab="${tab}" onClick=\\{\\(\\)=>openLobbyView\\('${tab}'\\)\\}`));
    assert.match(app,new RegExp(`aria-pressed=\\{lobbyView==='${tab}'\\}`));
  }
});
test('navigation from unmounted panels returns focus to the matching persistent tab',()=>{
  assert.match(app,/const openLobbyView=\(next:'play'\|'decks'\|'catalog',restoreFocus=false\)=>\{/);
  assert.match(app,/if\(restoreFocus\)requestAnimationFrame\(\(\)=>screenScrollRef\.current\?\.querySelector<HTMLButtonElement>/);
  assert.match(app,/onEdit=\{\(\)=>openLobbyView\('decks',true\)\}/);
  assert.match(app,/onPlay=\{\(\)=>openLobbyView\('play',true\)\}/);
  assert.match(app,/onClick=\{\(\)=>openLobbyView\('play',true\)\}/);
});
