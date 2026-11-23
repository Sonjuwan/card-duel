import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const battle=load('../apps/client/src/Battle.tsx'),pieces=load('../apps/client/src/battle-pieces.tsx'),css=load('../apps/client/src/landscape-shell.css');
test('inactive minion tap opens a readable public-detail view without activating an attack',()=>{
  assert.match(pieces,/if\(hover\.consumeTouchClick\(e\.nativeEvent\)\)return;if\(enabled\)onClick\?\.\(e\.detail===0\);else onInspectTap\?\.\(\)/);
  assert.equal((battle.match(/onInspectTap=\{\(\)=>inspectBoardMinion\(\{card:catalog\[m.cardId\],minion:m\}\)\}/g)||[]).length,2,'both enemy and friendly public minions');
  assert.match(battle,/const inspectBoardMinion=/);
});
test('inspection dialog traps Tab, Escape closes, returning focus to prior minion',()=>{
  assert.match(battle,/role="dialog" aria-modal="true" aria-label="카드 상세"/);
  assert.match(battle,/onClick=\{e=>\{if\(e.target===e.currentTarget\)closeBoardInspector\(\)/);
  assert.match(pieces,/aria-disabled=\{!enabled&&!onInspectTap\}/);
  assert.match(pieces,/!enabled&&onInspectTap\?'누르면 카드 상세 보기'/);
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

test('chosen or unplayable hand cards can open the full-text inspector without an action',()=>{
  assert.match(battle,/const peekedHand=s\.self\.hand\.find\(c=>c\.instanceId===peekCardId\)/);
  assert.match(battle,/const peekedCard=peekedHand\?catalog\[peekedHand\.cardId\]:undefined/);
  assert.match(battle,/const selectedHandInspectable=!!selectedCard\|\|!!peekedCard/);
  assert.match(battle,/selectedHandInspectable&&!currentDrag&&currentInspector&&<button[^>]*className="secondary selected-card-inspect"/);
  assert.match(battle,/onClick=\{\(\)=>inspectBoardMinion\(currentInspector\)\}>카드 설명 확대/);
  assert.match(css,/\.arena-message \.selected-card-inspect\{[^}]*min-height:44px/);
});
