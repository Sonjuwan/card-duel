import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const source=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const rule=source.slice(source.lastIndexOf('/* Very narrow landscape windows'));
test('short landscape phones below 661px retain finger-height actions',()=>{
  assert.match(rule,/@media \(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\) and \(max-width:660px\)/);
  for(const selector of ['.duel-toolbar button','.arena-message button','.turn-control .end-turn','.arena-right .concede-button','.landscape-card-detail summary'])assert.ok(rule.includes(selector),selector);
  assert.match(rule,/min-height:44px/);
});
test('actions scroll inside their own bounded areas rather than making the game page long',()=>{
  assert.match(rule,/max-height:min\(22dvh,84px\);flex-wrap:wrap/);
  assert.match(rule,/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
  assert.match(rule,/\.duel-toolbar\{max-height:min\(18dvh,68px\);overflow-y:auto/);
  assert.doesNotMatch(rule,/min-height:(318|540)px/);
});
