import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/client/src/landscape-shell.css',import.meta.url),'utf8');
const patch=css.slice(css.lastIndexOf('/* v0.280:'));
test('battle history is a separate explicit dialog, not permanent vertical arena space',()=>{
 assert.match(source,/className="secondary battle-tools-toggle" aria-label="전투 기록과 도움말 열기" onClick=\{openBattleTools\}/);
 assert.match(source,/data-tools-open=\{battleToolsOpen\}/);
 assert.match(source,/role=\{battleToolsOpen\?'dialog':undefined\} aria-modal=\{battleToolsOpen\|\|undefined\}/);
 assert.match(patch,/\.battle-utilities:not\(\[data-tools-open="true"\]\)\{display:none\}/);
 assert.match(patch,/position:fixed;inset:0;z-index:2200/);
 assert.match(patch,/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
});
test('dialog has visible 44px close, focus return and Escape and Tab trapping',()=>{
 assert.match(source,/const closeBattleTools=\(\)=>setBattleToolsOpen\(false\)/);
 assert.match(source,/requestAnimationFrame\(\(\)=>\{if\(returnTo\.isConnected\)returnTo\.focus\(\)/);
 assert.match(source,/className="battle-tools-close secondary" ref=\{toolsCloseRef\} onClick=\{closeBattleTools\}/);
 assert.match(source,/if\(e\.key==='Escape'\)\{e\.preventDefault\(\);e\.stopPropagation\(\);closeBattleTools\(\)/);
 assert.match(source,/if\(e\.key!=='Tab'\)return/);
 assert.match(patch,/\.battle-tools-close\{[\s\S]*?min-height:44px/);
 assert.match(source,/className="battle-arena classic-table" inert=\{ownChoiceOpen\|\|battleToolsOpen\|\|!!inspectedOverlay\}/);
});
