import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
test('public card inspection disables background actions without disabling its own modal',()=>{
 assert.match(source,/className=\{`duel-title/);
 assert.match(source,/data-settings-open=\{compactSettingsOpen\} inert=\{ownChoiceOpen\|\|battleToolsOpen\|\|!!inspectedOverlay\}/);
 assert.match(source,/className="arena-message" inert=\{ownChoiceOpen\|\|battleToolsOpen\|\|!!inspectedOverlay\}/);
 assert.match(source,/className="battle-arena classic-table" inert=\{battleToolsOpen\|\|!!inspectedOverlay\}/);
 assert.match(source,/className="mulligan-arena classic-mulligan" ref=\{exchangeArena\} inert=\{!!inspectedOverlay\}/);
 assert.match(source,/className="battle-utilities" data-tools-open=\{battleToolsOpen\} inert=\{ownChoiceOpen\|\|!!inspectedOverlay\}/);
 assert.match(source,/const inspectDialog=inspectedOverlay&&!ownChoiceOpen&&<div className="board-inspect-backdrop"/);
});
test('inspector restores focus only after React clears inert on the previously focused action',()=>{
 assert.match(source,/const returnTo=inspectReturn.current;[\s\S]*?setInspectedOverlay\(null\);[\s\S]*?requestAnimationFrame\(\(\)=>\{if\(returnTo\?\.isConnected\)returnTo.focus\(\)/);
});
