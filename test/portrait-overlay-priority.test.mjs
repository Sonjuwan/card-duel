import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const shell=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const builder=readFileSync(new URL('../apps/client/test/build-solo-app.mjs',import.meta.url),'utf8');
test('mandatory portrait rotate guide stays above PWA update/installation banner',()=>{
  const guide=shell.match(/\.rotate-device-message\{\s*position:fixed;z-index:(\d+);inset:0;display:grid/);
  const banner=builder.match(/#solo-app-banner\{[^}]*z-index:(\d+);/);
  assert.ok(guide,'portrait blocking dialog z-index missing');
  assert.ok(banner,'PWA status banner z-index missing');
  assert.ok(Number(guide[1])>Number(banner[1]),'installed PWA toast must not intercept rotation control');
  assert.match(shell,/@media \(pointer:coarse\) and \(orientation:portrait\)/);
  assert.match(shell,/\.rotate-device-panel button\{min-height:48px/);
});
