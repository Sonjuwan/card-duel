import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {modalTabIndex} from '../apps/client/src/battle-actions.ts';
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
test('completed battle results are a keyboard-modal and not merely a visual overlay',()=>{
  assert.match(battle,/result-window[^\n]+role="dialog" aria-modal="true" aria-label="대전 결과" tabIndex=\{-1\} ref=\{resultRef\}/);
  assert.match(battle,/const presentingResult=s\?\.phase==='finished'&&!playing&&!shattering/);
  assert.match(battle,/querySelector<HTMLElement>\('button:not\(:disabled\)'\)/);
  assert.match(battle,/onKeyDownCapture=\{resultKeys\}/);
});
test('results do not let Tab or Shift+Tab escape to obscured game controls',()=>{
  for(let current=0;current<3;current++){
    assert.equal(modalTabIndex(current,3,false),(current+1)%3);
    assert.equal(modalTabIndex(current,3,true),(current+2)%3);
  }
  assert.equal(modalTabIndex(-1,0,false),-1);
  assert.match(battle,/if\(e\.key!=='Tab'\|\|e\.altKey\|\|e\.ctrlKey\|\|e\.metaKey\)return;/);
  assert.match(battle,/e\.preventDefault\(\);e\.stopPropagation\(\);\(buttons\[next\]\?\?e\.currentTarget\)\.focus\(\)/);
});
