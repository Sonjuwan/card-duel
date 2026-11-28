import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const ui=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
test('browser fullscreen denial announces PWA alternative even when already in landscape',()=>{
  assert.match(ui,/const isLandscape=window\.matchMedia\('\(orientation: landscape\)'\)\.matches/);
  assert.match(ui,/if\(!outcome\.fullscreen&&isLandscape\)setNotice\('이 브라우저에서는 전체화면이 제한되어 있어요\./);
  assert.match(ui,/notice&&!battleMenu&&<div className="landscape-fullscreen-feedback" role="status"/);
  assert.match(ui,/aria-label="전체화면 안내 닫기" onClick=\{\(\)=>setNotice\(''\)\}/);
});
test('fullscreen denial feedback is landscape-only, notch-safe, bounded and dismissible',()=>{
  assert.match(css,/\.landscape-fullscreen-feedback\{display:none\}/);
  assert.match(css,/@media \(orientation:landscape\)\{\s*\.landscape-fullscreen-feedback\{/);
  assert.match(css,/env\(safe-area-inset-top,0px\)/);
  assert.match(css,/width:min\(380px,calc\(100dvw - 20px\)\)/);
  assert.match(css,/\.landscape-fullscreen-feedback button\{flex:none;min-width:44px;min-height:44px\}/);
});

test('fullscreen advice is deferred during an active battle without clearing its message',()=>{
  assert.match(css,/body:has\(\.game-main \.duel-screen\) \.landscape-fullscreen-feedback\{visibility:hidden;pointer-events:none\}/);
  assert.doesNotMatch(css,/body:has\(\.game-main \.duel-screen\) \.landscape-fullscreen-feedback\{display:none/);
});
