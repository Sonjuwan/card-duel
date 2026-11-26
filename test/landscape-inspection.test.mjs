import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const battle=load('../apps/client/src/Battle.tsx'),pieces=load('../apps/client/src/battle-pieces.tsx'),css=load('../apps/client/src/landscape-shell.css');
test('both boards use pinned inspection without opening a tap modal',()=>{
  assert.match(pieces,/useCardHover\(info,BATTLE_HOLD_DELAY,!targeted\)/);
  assert.equal((battle.match(/<BattleMinion /g)||[]).length,2);
  assert.doesNotMatch(battle,/onInspectTap/);
});
test('mulligan inspection dialog traps Tab, Escape closes, and focus returns',()=>{
  assert.match(battle,/role="dialog" aria-modal="true" aria-label="카드 상세"/);
  assert.match(battle,/onClick=\{e=>\{if\(e.target===e.currentTarget\)closeBoardInspector\(\)/);
  assert.match(battle,/if\(e\.key==='Escape'\)\{e\.preventDefault\(\);e\.stopPropagation\(\);closeBoardInspector\(\)/);
  assert.match(battle,/else if\(e\.key==='Tab'\)\{e\.preventDefault\(\);inspectCloseRef\.current\?\.focus\(\)/);
  assert.match(battle,/requestAnimationFrame\(\(\)=>\{if\(returnTo\?\.isConnected\)returnTo\.focus\(\)/);
  assert.match(battle,/useEffect\(\(\)=>setInspectedOverlay\(null\),\[room\.code,s\?\.revision\]\)/);
});
test('modal has notch-safe padding, 44px close action and independent scroll',()=>{
  assert.match(css,/\.board-inspect-backdrop\{[\s\S]*?env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/\.board-inspect-dialog\{[\s\S]*?overflow-y:auto/);
  assert.match(css,/\.board-inspect-close\{[^}]*min-height:44px/);
});

test('hand inspection uses the same preview without committing cards',()=>{
  assert.doesNotMatch(battle,/selected-card-inspect|peekCardId/);
  assert.match(pieces,/useCardHover\(info,sourceId\?\.startsWith\('card:'\)\?BATTLE_HOLD_DELAY:undefined,Boolean\(sourceId\?\.startsWith\('card:'\)&&!mulligan\)\)/);
});
