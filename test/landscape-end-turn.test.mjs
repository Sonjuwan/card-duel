import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* v0.281:'));
test('mobile turn-end stays at least 44px while surrender moves into deliberate tools drawer',()=>{
 assert.match(patch,/\.arena-right>\.concede-button\{display:none\}/);
 assert.match(patch,/\.arena-right>\.turn-control\{[\s\S]*?flex:0 0 auto;min-height:44px/);
 assert.match(patch,/\.turn-control>\.end-turn\{[\s\S]*?min-height:44px/);
 assert.match(patch,/\.battle-utilities\[data-tools-open="true"\]>.compact-concede\{[\s\S]*?min-height:44px/);
});
test('the surrendered game command and confirmation are identical in both layouts',()=>{
 assert.match(battle,/const confirmConcede=\(\)=>\{if\(window\.confirm\('항복하시겠습니까\?'\)\)perform\(\{type:'concede'\}\)/);
 assert.doesNotMatch(battle,/className="secondary danger concede-button"/);
 assert.match(battle,/className="secondary danger" type="button" disabled=\{busy\} onClick=\{confirmConcede\}>항복하기/);
 assert.match(battle,/className="secondary danger compact-concede" disabled=\{!connected\|\|busy\} onClick=\{confirmConcede\}/);
 assert.match(battle,/onClick=\{e=>perform\(\{type:'endTurn'\}/);
});
