import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* v0.282:'));
test('audio/voice controls share one compact disclosure without changing sound or TTS action',()=>{
  assert.match(battle,/<details className="battle-sound-menu"/);
  assert.match(battle,/<summary>소리·연출<\/summary>[\s\S]*?<div className="sound-settings">/);
  assert.match(battle,/aria-pressed=\{sound\} onClick=\{toggleSound\}/);
  assert.match(battle,/<DialogueSettings hero=\{s\.self\.heroClass\} mode=\{captionMode\}/);
  assert.match(battle,/if\(e\.key==='Escape'\)\{e\.preventDefault\(\);e\.stopPropagation\(\);e\.currentTarget\.open=false/);
  assert.match(battle,/if\(e\.key!=='Tab'\)return/);
});
test('landscape sound disclosure uses a 44px touch opener and a notch-safe, independently scrollable panel',()=>{
  assert.match(patch,/\.battle-sound-menu>summary\{min-height:44px/);
  assert.match(patch,/position:fixed;top:max\(54px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(patch,/max-height:calc\(100dvh - 66px - env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(patch,/z-index:2400;overflow-y:auto;overflow-x:hidden;touch-action:pan-y/);
  assert.match(patch,/\.battle-sound-menu \.sound-toggle\{min-height:44px\}/);
});

test('outside tap closes sound panel without activating underlying card or turn control',()=>{
 const catcher=css.slice(css.lastIndexOf('/* Opening audio options'));
 assert.match(battle,/className="battle-sound-dismiss" tabIndex=\{-1\} aria-hidden="true"/);
 assert.match(battle,/onClick=\{e=>\{const details=e\.currentTarget\.closest/);
 assert.match(catcher,/\.battle-sound-menu\[open\]>.battle-sound-dismiss\{[\s\S]*?position:fixed;inset:0;z-index:2399/);
 assert.match(catcher,/\.battle-sound-menu\[open\]>summary\{position:relative;z-index:2401\}/);
});
