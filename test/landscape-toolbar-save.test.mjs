import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* v0.283:'));
const actions=battle.slice(battle.indexOf('<div className="duel-actions">'));
test('save retries and save-before-leave precede secondary tools on compact battle toolbar',()=>{
  const retry=actions.indexOf('className="secondary retry-save"');
  const pause=actions.indexOf('className="secondary pause-save"');
  const tools=actions.indexOf('className="secondary battle-tools-toggle"');
  assert.ok(retry>=0&&pause>retry&&tools>pause);
  assert.match(actions,/aria-label="저장 다시 시도" disabled=\{busy\} onClick=\{onRetrySave\}/);
  assert.match(actions,/aria-label=\{saveRetryable\?'저장 재시도 후 나가기':'저장 후 나가기'\} disabled=\{busy\} onClick=\{onPause\}/);
});
test('small landscape hides only visual action labels, never status, action or aria names',()=>{
  assert.match(actions,/<span className="battle-action-full">저장 다시 시도<\/span><span className="battle-action-short" aria-hidden="true">저장 재시도<\/span>/);
  assert.match(actions,/<span className="battle-action-short" aria-hidden="true">저장·나가기<\/span>/);
  assert.match(patch,/\.battle-action-full\{display:none\}/);
  assert.match(patch,/\.battle-action-short\{display:inline;white-space:nowrap\}/);
  assert.match(patch,/\.save-indicator\{[\s\S]*?text-overflow:ellipsis/);
  assert.match(patch,/\.retry-save,[\s\S]*?\.pause-save\{min-height:44px/);
});
