import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const source=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
test('desktop fullscreen toggles while touch keeps the landscape entry action',()=>{
  assert.match(source,/createPortal\(<button type="button" className="landscape-menu-button"/);
  assert.equal(source.match(/가로 전체화면/g)?.length,2);
  assert.match(source,/if\(desktop\)\{[\s\S]*await document\.exitFullscreen\(\)/);
  assert.match(source,/orientation\.lock\('landscape'\)/);
  assert.match(source,/document\.addEventListener\('fullscreenchange',sync\)/);
});
