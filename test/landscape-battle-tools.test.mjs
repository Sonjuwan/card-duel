import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
test('the battlefield retains the public action rail without a second records dialog',()=>{
  assert.match(source,/<ImpactRail entries=\{impactHistory\} catalog=\{catalog\}\/>/);
  assert.doesNotMatch(source,/battle-tools-toggle|오류 신고용 전투 기록/);
});
test('battle settings use modal focus and offer an explicit return to play',()=>{
  assert.match(source,/settingsRef.current\?\.showModal\(\)/);
  assert.match(source,/<dialog className="battle-settings-dialog"/);
  assert.match(source,/autoFocus onClick=\{closeSettings\}>게임 계속하기/);
});
