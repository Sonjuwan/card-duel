import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const builder=readFileSync(new URL('../apps/client/test/build-solo-app.mjs',import.meta.url),'utf8');
const register=readFileSync(new URL('../apps/client/solo-app/register.js',import.meta.url),'utf8');
test('pending PWA installation and update messages cannot cover an active battle',()=>{
  assert.match(builder,/body:has\(#root \.game-main \.duel-screen\) #solo-app-banner:not\(\[data-urgent="true"\]\)\{visibility:hidden;pointer-events:none\}/);
  assert.match(builder,/#solo-app-banner\[hidden\]\{display:none!important\}/);
  assert.match(builder,/position:fixed/);
});
test('pending updates use the game menu when present and preserve the legacy fallback',()=>{
  assert.match(register,/const updateMessage = \(\) => \{if\(updateDialog\)return;announce\('새 버전 준비 완료/);
  assert.match(register,/if\(updateDialog\)\{\s+connectGameUpdate\(registration,updateDialog\)/);
  assert.match(register,/applyButton.disabled=!ready\|\|applying/);
  assert.match(register,/if\(banner\)banner.hidden=quietStartup\|\|statusDismissed/);
  assert.doesNotMatch(builder,/body:has\(#root \.game-main \.duel-screen\) #solo-app-banner\{display:none/);
});

test('critical asset and installation failures remain visible during battle',()=>{
  assert.match(builder,/banner\.dataset\.urgent='true'/);
  assert.match(register,/const urgent=assetFailed\|\|/);
  assert.match(register,/banner\.dataset\.urgent=urgent\?'true':'false'/);
});
