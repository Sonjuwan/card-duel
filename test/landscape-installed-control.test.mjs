import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');

test('installed PWA keeps the same menu action and can request orientation independently',()=>{
  assert.match(ui,/document.fullscreenElement.*display-mode: fullscreen/);
  assert.match(ui,/document.documentElement.requestFullscreen\(\)/);
  assert.match(ui,/className="landscape-menu-button"/);
  assert.match(ui,/className="rotate-device-message" role="dialog"/);
  assert.match(ui,/orientation\.lock\('landscape'\)/);
});
