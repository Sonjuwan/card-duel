import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* v0.284:'));
test('save settings show the current slot state and retry warning',()=>{
 assert.match(app,/const battleSaveAvailable=room\?\.developerFree\?freeSave\?\.available:saveAvailable/);
 assert.match(battle,/saveRetryable\?'저장 오류 · 재시도 가능'/);
 assert.match(battle,/savePending\?'저장 확인 중…'/);
});
test('critical phone warnings float without resizing a fixed-height battlefield',()=>{
 assert.match(patch,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:760px\)/);
 assert.match(patch,/\.game-main>\.screen-content>\.error,[\s\S]*?\.account-maintenance\{/);
 assert.match(patch,/position:fixed;z-index:2450/);
 assert.match(patch,/top:max\(7px,env\(safe-area-inset-top,0px\)\)/);
 assert.match(patch,/max-height:min\(45dvh,180px\)/);
 assert.match(patch,/overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain/);
 assert.match(patch,/\.error button,[\s\S]*?\.account-maintenance button\{min-height:44px\}/);
});
