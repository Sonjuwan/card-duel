import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const home=readFileSync(new URL('../apps/client/src/RunehallHome.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
test('the home menu opens each independent screen with focus restoration',()=>{
  assert.match(app,/lobbyView==='home'/);
  assert.match(app,/data-lobby-tab="play" onClick=\{\(\)=>\{setEnterDeckEditor\(false\);openLobbyView\('decks',true\);\}\}/);
  assert.match(app,/data-lobby-tab="catalog" onClick=\{\(\)=>openLobbyView\('catalog',true\)\}/);
  assert.doesNotMatch(app,/data-lobby-tab="decks"/);
  assert.match(app,/data-lobby-tab=\{lobbyView\}/);
});
test('navigation from unmounted panels returns focus to the matching persistent tab',()=>{
  assert.match(app,/const openLobbyView=\(next:Exclude<LobbyView,'home'>,restoreFocus=false,cardId\?:string\)=>\{/);
  assert.match(app,/if\(restoreFocus\)requestAnimationFrame\(\(\)=>screenScrollRef\.current\?\.querySelector<HTMLButtonElement>/);
  assert.match(app,/onEdit=\{\(\)=>\{setEnterDeckEditor\(false\);openLobbyView\('decks',true\);\}\}/);
  assert.match(app,/onPlay=\{current=>\{\s*editDeck\(current\);setEnterDeckEditor\(false\);/);
  assert.match(app,/lobbyView==='decks'\?'play':lobbyView/);
});

test('slot and growth are a separate preview home destination, not a play support button',()=>{
  assert.match(home,/data-lobby-tab="slots" onClick=\{\(\)=>onOpen\('slots'\)\}/);
  assert.match(app,/lobbyView==='growth'&&lossOnExit\?<PlayerGrowth/);
  assert.match(app,/lobbyView==='slots'&&lossOnExit\?<section className="preview-slot-only"/);
  assert.match(app,/!lossOnExit&&<LobbyDialog label="슬롯 · 성장 · 저장 경기">/);
  assert.match(app,/readSelectedSlot\(\)/);
  assert.match(app,/return <AppSession key=\{slot\}/);
});
