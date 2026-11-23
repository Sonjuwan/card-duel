import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const source=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
test('portrait dialog keeps keyboard focus on its only actionable control',()=>{
  assert.match(source,/onKeyDownCapture=\{event=>\{[\s\S]*?event\.key==='Tab'[\s\S]*?event\.preventDefault\(\);rotateButton\.current\?\.focus\(\)/);
  assert.match(source,/role="dialog" aria-modal="true"/);
  assert.match(source,/if\(media\.matches\)rotateButton\.current\?\.focus\(\)/);
});
test('portrait overlay makes all external navigation regions inert, not just the card body',()=>{
  for(const selector of ['.screen-content','.app-header .connection','.app-header .brand','.app-header .landscape-fullscreen-control','main > footer']){
    assert.ok(source.includes(`'${selector}'`),`missing inert target ${selector}`);
  }
  assert.match(source,/element\.inert=media\.matches/);
  assert.match(source,/element\.inert=false/);
});
