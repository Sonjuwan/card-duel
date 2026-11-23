import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const controls=css.slice(css.indexOf('/* Mobile tap targets must not shrink'));
test('mobile game/lobby header and saved slots retain 44px touch area in landscape',()=>{
  assert.match(controls,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
  for(const selector of ['.lobby-main .app-header button','.game-main .app-header button','.landscape-fullscreen-control','.lobby-main .play-hub .slot-tile button','.lobby-main .play-hub .mode-primary','.lobby-main .saved-duel-panel button']){
    assert.ok(controls.includes(selector),`${selector} missing from touch target scope`);
  }
  assert.match(controls,/\.lobby-main \.saved-duel-panel button\{\s*min-height:44px;/);
});
test('portrait rotation prompt keeps game document fixed while scrolling guide itself',()=>{
  assert.match(controls,/@media \(pointer:coarse\) and \(orientation:portrait\)\{\s*html,body,#root\{height:100dvh;max-height:100dvh;overflow:hidden\}/);
  assert.match(controls,/\.rotate-device-message\{overscroll-behavior:contain;touch-action:pan-y\}/);
  const experience=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
  assert.match(experience,/element\.inert=media\.matches/);
});
