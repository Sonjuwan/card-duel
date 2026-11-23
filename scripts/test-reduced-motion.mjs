import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const css=readFileSync(new URL('../apps/client/src/classic-table.css',import.meta.url),'utf8');
const block=css.match(/@media\s*\(prefers-reduced-motion:reduce\)\s*\{([\s\S]*?)\n\}/)?.[1];
test('reduced-motion disables card and damage animations',()=>{
  assert.ok(block);
  assert.match(block,/\.motion-delta/);
  assert.match(block,/animation:none!important/);
  assert.match(block,/transition:none!important/);
});
test('reduced-motion hover and focus do not translate the hand slot',()=>{
  assert.ok(block);
  assert.match(block,/\.hand-card-slot:hover,\.classic-table \.hand-card-slot:focus-within\s*\{transform:none\}/);
  assert.doesNotMatch(block,/translateY\(/);
});
test('keyboard focus remains visibly outlined',()=>{
  assert.match(block,/\.hand-card-slot:focus-within\s*\{outline:3px solid/);
});
