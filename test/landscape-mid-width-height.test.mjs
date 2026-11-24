import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const marker='/* The 661–940px wide, 541–760px high landscape viewport';
const mid=css.slice(css.indexOf(marker));
test('landscape 661–940px gap uses a true non-scrolling phase arena',()=>{
  assert.ok(css.includes(marker));
  assert.match(mid,/@media \(orientation:landscape\) and \(min-width:661px\) and \(max-width:940px\) and \(min-height:541px\) and \(max-height:760px\)/);
  assert.match(mid,/duel-screen\.phase-playing,[\s\S]+?overflow:hidden/);
  assert.match(mid,/battle-arena\.classic-table\{[\s\S]+?flex:1 1 0%;height:auto;min-height:0;max-height:100%;overflow:hidden/);
  assert.match(mid,/arena-field\{[\s\S]+?grid-template-rows:[^;]+;[\s\S]+?overflow:hidden/);
});
test('medium landscape keeps turn button accessible and only internal secondary content scrollable',()=>{
  assert.match(mid,/arena-right\{[\s\S]+?overflow-y:auto;overflow-x:hidden/);
  assert.match(mid,/\.turn-control\{[\s\S]+?position:sticky;top:0/);
  assert.match(mid,/\.end-turn\{min-height:44px\}/);
  assert.match(mid,/battle-utilities\{[\s\S]+?max-height:min\(13dvh,80px\);overflow-y:auto/);
  assert.doesNotMatch(mid,/min-height:540px/);
});

test('middle-width landscape cards are compact until tap/focus, with field-bound preview',()=>{
  const preview=css.slice(css.indexOf('/* Mid-size landscape screens'));
  assert.match(preview,/\.hand-card-slot\{[\s\S]+?--landscape-card-open-w:clamp/);
  assert.match(preview,/\.battle-card\.is-selected/);
  assert.match(preview,/\.battle-card\.is-preview-expanded/);
  assert.match(preview,/var\(--landscape-preview-shift, 0px\)/);
  assert.match(preview,/\.battle\.is-dragging[\s\S]+?transform:translateY/);
  const code=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
  assert.match(code,/\.friendly-minions/);
  assert.match(code,/y=line-box.top/);
});
