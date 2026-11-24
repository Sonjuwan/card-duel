import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const app=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
test('the home menu opens each independent screen with focus restoration',()=>{
  assert.match(app,/lobbyView==='home'/);
  for(const tab of ['play','decks','catalog']){
    assert.ok(app.includes(`data-lobby-tab="${tab}" onClick={()=>openLobbyView('${tab}',true)}`));
  }
  assert.match(app,/data-lobby-tab=\{lobbyView\}/);
});
test('navigation from unmounted panels returns focus to the matching persistent tab',()=>{
  assert.match(app,/const openLobbyView=\(next:Exclude<LobbyView,'home'>,restoreFocus=false\)=>\{/);
  assert.match(app,/if\(restoreFocus\)requestAnimationFrame\(\(\)=>screenScrollRef\.current\?\.querySelector<HTMLButtonElement>/);
  assert.match(app,/onEdit=\{\(\)=>openLobbyView\('decks',true\)\}/);
  assert.match(app,/onPlay=\{\(\)=>openLobbyView\('play',true\)\}/);
  assert.match(app,/onClick=\{\(\)=>openLobbyView\('play',true\)\}/);
});

test('slot and growth are a separate preview home destination, not a play support button',()=>{
  assert.match(app,/data-lobby-tab="slots" onClick=\{\(\)=>openLobbyView\('slots',true\)\}/);
  assert.match(app,/lobbyView==='slots'&&lossOnExit\?<section className="preview-slot-only"/);
  assert.match(app,/!lossOnExit&&<LobbyDialog label="슬롯 · 성장 · 저장 경기">/);
  assert.match(app,/previewGate\?'home':props\.initialLobbyView/);
});
