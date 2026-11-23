import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/styles.css',import.meta.url),'utf8');
test('high contrast preserves visible keyboard focus',()=>{
  const block=css.split('@media (forced-colors: active)').at(-1);
  assert.match(block,/focus-visible\s*\{[^}]*outline:3px solid Highlight/);
  assert.match(block,/\[role="button"\]\[tabindex\]:focus-visible/);
  assert.match(block,/\[role="option"\]\[tabindex\]:focus-visible/);
});
test('high contrast retains target and selection distinction',()=>{
  const block=css.split('@media (forced-colors: active)').at(-1);
  assert.match(block,/\.hero\.targetable/);
  assert.match(block,/\.card\.active/);
  assert.match(block,/\.card\.ready/);
});
