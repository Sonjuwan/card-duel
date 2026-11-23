import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const source=readFileSync(new URL('../apps/client/src/LandscapeExperience.tsx',import.meta.url),'utf8');
test('fullscreen button reflects the actual browser state, including Escape or browser exit',()=>{
  assert.match(source,/useState\(false\)/);
  assert.match(source,/document\.addEventListener\('fullscreenchange',sync\)/);
  assert.match(source,/document\.removeEventListener\('fullscreenchange',sync\)/);
  assert.match(source,/const full=Boolean\(document\.fullscreenElement\);setIsFullscreen\(full\)/);
  assert.match(source,/aria-pressed=\{isFullscreen\}/);
  assert.match(source,/isFullscreen\?'전체화면 종료':'전체화면 및 가로 방향 요청'/);
});
test('exit is available on direct click while portrait rotate button still requests fullscreen',()=>{
  assert.match(source,/if\(document\.fullscreenElement\)\{[\s\S]*await document\.exitFullscreen\(\)/);
  assert.match(source,/else\{await requestLandscape\(\);\}/);
  assert.match(source,/onClick=\{\(\)=>void toggleFullscreen\(\)\}/);
  assert.match(source,/onClick=\{\(\)=>void requestLandscape\(\)\}/);
  assert.match(source,/orientation\.lock\('landscape'\)/);
});
test('initial React state does not read document during server side render',()=>{
  assert.match(source,/useState\(false\)/);
  assert.doesNotMatch(source,/useState\(\(\)=>[^\n]*document/);
});
