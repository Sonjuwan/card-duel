import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* Opening-hand selection'));
test('short landscape initial-hand layout ignores old 460px minimum and centers both heroes',()=>{
  assert.match(patch,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
  assert.match(patch,/\.mulligan-arena\.classic-mulligan\{[\s\S]*?min-height:0;max-height:none;height:auto/);
  assert.match(patch,/grid-template-rows:clamp\(34px,15dvh,60px\) minmax\(0,1fr\) clamp\(44px,15dvh,60px\)/);
  assert.match(patch,/\.mulligan-opponent\{grid-column:1;grid-row:1/);
  assert.match(patch,/\.mulligan-self\{grid-column:1;grid-row:3/);
  assert.match(battle,/className="mulligan-arena classic-mulligan"/);
});
test('hand cards scroll within their own row; confirm remains a 44px right-hand target',()=>{
  assert.match(patch,/\.mulligan-cards\{[\s\S]*?overflow-x:auto;overflow-y:hidden/);
  assert.match(patch,/overscroll-behavior-x:contain;touch-action:pan-x/);
  assert.match(patch,/\.mulligan-cards \.battle-card\{[\s\S]*?flex:0 0 clamp\(64px,13dvw,112px\)/);
  assert.match(patch,/\.mulligan-heading\{[\s\S]*?overflow-y:auto/);
  assert.match(patch,/\.mulligan-confirm\{[\s\S]*?grid-column:2;grid-row:3;[\s\S]*?min-height:44px/);
});

test('first-hand cards can be read full size without inadvertently replacing them',()=>{
  assert.match(battle,/const \[mulliganInspectId,setMulliganInspectId\]=useState<string\|null>\(null\)/);
  assert.match(battle,/const mulliganInspectable=s\.self\.hand\.find/);
  assert.match(battle,/aria-label="설명을 확인할 첫 손패 카드"/);
  assert.match(battle,/className="secondary mulligan-inspection-open" onClick=\{\(\)=>inspectBoardMinion/);
  assert.match(battle,/onClick=\{\(\)=>\{setMulliganInspectId\(c\.instanceId\);setReplace/);
  assert.match(battle,/<\/div>\{inspectDialog\}<\/section>;/);
  assert.match(css,/\.mulligan-inspection-controls select,\.mulligan-inspection-open\{[^}]*min-height:44px/);
});
