import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const media=css.slice(css.indexOf('/* Mid-height tablets'));
test('mid-height landscape tablet stays in the 100dvh game canvas without old 540px arena minimum',()=>{
  assert.match(media,/@media \(orientation:landscape\) and \(min-width:941px\) and \(max-height:760px\)/);
  assert.match(media,/duel-screen\.phase-playing,[\s\S]*?duel-screen\.phase-finished\{\s*display:flex;flex-direction:column;flex:1 1 0%;min-height:0;overflow:hidden/);
  assert.match(media,/battle-arena\.classic-table\{[\s\S]*?flex:1 1 0%;height:auto;min-height:0;max-height:100%;overflow:hidden/);
  assert.doesNotMatch(media,/min-height:540px/);
});
test('battlefield resources and heroes scale to visible tablet height without changing touch or card rules',()=>{
  for(const [name,budget] of [['hero',12],['board',16],['hand',17]]){
    assert.match(media,new RegExp(`--${name}-h:clamp\\([^;]+,${budget}dvh,`));
  }
  // Existing short phone layout stays separate; desktop height >760 keeps classic full art.
  assert.match(css,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\)/);
});
