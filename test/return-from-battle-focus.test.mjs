import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
const source=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
test('leaving a battle restores keyboard focus to current lobby tab, not the removed battle control',()=>{
  assert.match(source,/const previousBattleMounted=useRef\(false\)/);
  assert.match(source,/const wasPlaying=previousBattleMounted\.current/);
  assert.match(source,/previousBattleMounted\.current=!!room/);
  assert.match(source,/if\(!wasPlaying\|\|room\)return/);
  assert.match(source,/querySelector<HTMLButtonElement>\(`\[data-lobby-tab="\$\{lobbyView\}"\]`\)\?\.focus\(\)/);
  assert.match(source,/\},\[room\?\.code,lobbyView\]\)/);
});
test('return focus is deferred until the menu exists and cancels on a rapid rematch',()=>{
  assert.match(source,/const frame=requestAnimationFrame\(\(\)=>screenScrollRef\.current/);
  assert.match(source,/return \(\)=>cancelAnimationFrame\(frame\)/);
  assert.match(source,/if\(!wasPlaying\|\|room\)return/);
});
