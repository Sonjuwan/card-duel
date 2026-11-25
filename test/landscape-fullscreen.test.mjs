import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const source=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
test('fullscreen remains an enter-only menu action with a stable label',()=>{
  assert.match(source,/createPortal\(<button type="button" className="landscape-menu-button"/);
  assert.equal(source.match(/가로 전체화면/g)?.length,2);
  assert.doesNotMatch(source,/exitFullscreen|toggleFullscreen/);
  assert.match(source,/orientation\.lock\('landscape'\)/);
  assert.match(source,/document\.addEventListener\('fullscreenchange',sync\)/);
});
