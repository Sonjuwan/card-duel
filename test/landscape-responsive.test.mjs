import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';

const load=(s)=>readFileSync(new URL(s,import.meta.url),'utf8');
const layout=load('../apps/client/src/landscape-shell.css');
const combat=load('../apps/client/src/landscape-combat.css');

// Screen geometry adapts to browser UI, display cutouts, and different phone
// aspect ratios.  Breakpoints change *organization*; they do not set a fixed
// canvas size, and no minimum arena height may force document scrolling.
test('every landscape orientation can use the full dynamic visible viewport',()=>{
  assert.match(layout,/@media \(orientation:landscape\)\{/);
  assert.match(layout,/height:100vh;height:100dvh;min-height:0;overflow:hidden/);
  assert.match(layout,/env\(safe-area-inset-top,0px\)/);
  assert.match(layout,/env\(safe-area-inset-right,0px\)/);
  assert.match(layout,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(layout,/env\(safe-area-inset-left,0px\)/);
  assert.doesNotMatch(layout,/(?:^|[;{\s])(?:min-)?height:540px/);
  for(const name of ['index.html','offline.html']) {
    const html=load('../apps/client/'+name);
    assert.match(html,/viewport-fit=cover/);
  }
});
test('short landscape phone gets a proportional board at any CSS width',()=>{
  assert.match(combat,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
  assert.doesNotMatch(combat,/@media[^\n]*min-width:/);
  assert.match(combat,/--landscape-hero-h:clamp\(32px,11dvh,58px\)/);
  assert.match(combat,/--landscape-hand-h:clamp\(34px,11dvh,54px\)/);
  assert.match(combat,/--landscape-card-w:clamp\(18px,calc\(\(100dvw/);
  assert.match(combat,/env\(safe-area-inset-left,0px\) - env\(safe-area-inset-right,0px\)/);
  assert.match(combat,/var\(--landscape-rail-w\) - 52px\) \/ 10\)/);
  assert.match(combat,/min-width:clamp\(44px,6\.9dvw,66px\)/);
  assert.match(combat,/minmax\(0,1fr\)[^;]*minmax\(0,1fr\)/);
  assert.match(combat,/min-height:0;\s*overflow:hidden/);
  assert.doesNotMatch(combat,/min-height:318px|grid-template-rows:16px 54px/);
});
test('card preview scales to the viewport and does not change arena row heights',()=>{
  assert.match(combat,/--landscape-card-open-w:clamp\(102px,17dvw,158px\)/);
  assert.match(combat,/--landscape-card-open-h:clamp\(124px,45dvh,228px\)/);
  assert.match(combat,/calc\(var\(--landscape-card-h\) - var\(--landscape-hand-h\)\)/);
  assert.match(combat,/calc\(-1 \* var\(--landscape-hand-h\)\)/);
  assert.match(layout,/\.hand-card-slot:has\(>\.battle-card\.is-preview-expanded\)/);
});
test('navigation touch areas remain large even on small phones',()=>{
  assert.match(layout,/\.lobby-main>\.screen-content>\.lobby-tabs\[aria-label="게임 메뉴"\] button\{min-height:44px\}/);
  assert.match(layout,/\.play-hub \.slot-tile button\{min-height:44px\}/);
  assert.match(combat,/\.turn-control \.end-turn\{min-height:44px/);
  assert.match(layout,/max-width:650px/);
  assert.match(layout,/grid-template-columns:1fr\}/);
});

test('a ten-card hand budgets for the rail and notch rather than clipping inaccessible cards',()=>{
  assert.match(combat,/--landscape-rail-w:clamp\(72px,12dvw,116px\)/);
  assert.match(combat,/--landscape-card-w:clamp\(18px,calc\(\(100dvw/);
  assert.match(combat,/\.battle \.arena-field \.hand-card-slot\{/);
  assert.match(combat,/min-width:var\(--landscape-card-w\)/);
  assert.match(combat,/width:min\(23px,var\(--landscape-card-w\)\)/);
  // Representative geometries incl. a phone with 44px safe insets on both sides.
  for(const [width,left,right] of [[390,0,0],[480,44,44],[568,0,0],[932,0,0]]){
    const rail=Math.min(116,Math.max(72,width*.12));
    const card=Math.min(60,Math.max(18,(width-left-right-rail-52)/10));
    const available=width-left-right-rail-8;
    assert.ok(card*10+27+6<=available,`ten-card hand clips at width ${width}`);
  }
});
