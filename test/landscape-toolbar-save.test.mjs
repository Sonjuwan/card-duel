import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
test('retry, save and surrender are grouped in game management',()=>{
  const management=battle.slice(battle.indexOf('className="battle-setting-group battle-settings-management"'));
  assert.match(management,/className="secondary retry-save" disabled=\{busy\} onClick=\{onRetrySave\}/);
  assert.match(management,/className="settings-primary pause-save" disabled=\{busy\} onClick=\{onPause\}/);
  assert.match(management,/saveRetryable\?'저장 재시도 후 나가기':'저장 후 나가기'/);
  assert.match(management,/onClick=\{confirmConcede\}>항복하기/);
});
