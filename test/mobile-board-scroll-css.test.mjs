import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../apps/client/src/battle-fx.css',import.meta.url),'utf8');
const pieces=readFileSync(new URL('../apps/client/src/battle-pieces.tsx',import.meta.url),'utf8');
const battle=readFileSync(new URL('../apps/client/src/Battle.tsx',import.meta.url),'utf8');
const stylesCss=readFileSync(new URL('../apps/client/src/styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../apps/client/src/App.tsx',import.meta.url),'utf8');
const tableCss=readFileSync(new URL('../apps/client/src/classic-table.css',import.meta.url),'utf8');
const battleCss=readFileSync(new URL('../apps/client/src/battle.css',import.meta.url),'utf8');
test('portrait board overflow is scrollable for gesture measurement',()=>{
  const rule=css.slice(css.lastIndexOf('/* Keep the overflow contract'));
  assert.match(rule,/@media\(max-width:660px\)/);
  assert.match(rule,/\.classic-table \.arena-board>\.minion-row\s*\{[^}]*overflow-x:auto/s);
  assert.match(rule,/justify-content:safe center/);
  assert.match(rule,/overscroll-behavior-x:contain/);
});
test('scrolling row permits native horizontal panning',()=>{
  const rule=css.slice(css.lastIndexOf('/* Keep the overflow contract'));
  assert.match(rule,/\[data-scrollable="true"\]\s*\{\s*touch-action:pan-x/s);
});
test('save slot buttons have touch-size minimum even in narrow portrait view',()=>{
  assert.match(stylesCss,/\.slot-tile button\s*\{[^}]*min-height:44px/s);
  assert.match(stylesCss,/@media\(max-width:420px\)[^\n]*\.slot-tile small\s*\{font-size:12px\}/s);
});
test('card collection page navigation has touch-size buttons',()=>{
  assert.match(tableCss,/\.collection-pages button\s*\{[^}]*min-height:44px/s);
});
test('deck editor controls retain touch-size targets at mobile width',()=>{
  assert.match(battleCss,/@media\(max-width:660px\)\{\.deck-panel \.controls button,\.deck-panel \.controls select\{min-height:44px\}\}/);
});
test('narrowest screens use two save columns and leave error actions unsqueezed',()=>{
  assert.match(stylesCss,/\.error\{flex-wrap:wrap;overflow-wrap:anywhere\}\.error button\{flex-shrink:0\}/);
  assert.match(stylesCss,/@media\(max-width:360px\)\{\.slot-panel>\.slot-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
});
test('mobile primary and offline installation actions have minimum finger target height',()=>{
  assert.match(stylesCss,/@media\(max-width:660px\)\{\.saved-duel-panel>button,\.error button,\.selected-deck-banner button,\.lobby-tabs button,#solo-app-banner button\{min-height:44px\}\}/);
});

test('mobile target picker keeps scrollable legal targets inside the safe viewport',()=>{
  assert.match(css, /\.target-picker\[open\] \.target-picker-panel\{position:fixed;top:auto;bottom:calc\(8px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css, /max-height:min\(62dvh,420px\);overflow-y:auto;overflow-x:hidden/);
  assert.match(css, /@media\(max-height:430px\) and \(orientation:landscape\)/);
});
test('target picker has a reachable close action without cancelling the selected card',()=>{
  assert.match(pieces, /className="target-picker-close" onClick=\{closeList\}/);
  assert.match(pieces, /details\.open=false;details\.querySelector<HTMLElement>\('summary'\)\?\.focus\(\)/);
  assert.match(css, /\.target-picker-close\{grid-column:1\/-1;min-height:44px/);
});

test('Escape cancels the current target selection and restores focus',()=>{
  assert.match(battle,/if\(selected&&e.key==='Escape'\)\{/);
  assert.match(battle,/setSelected\(null\);cancelActiveTouch\(\);source\?\.focus\(\)/);
});
test('expanded target picker supports bounded arrow/Home/End keyboard focus without selecting a target',()=>{
  assert.match(pieces,/const navigateTargets=\(event:KeyboardEvent<HTMLDetailsElement>\)=>/);
  assert.match(pieces,/if\(!details\?\.open\|\|event\.altKey\|\|event\.ctrlKey\|\|event\.metaKey\|\|event\.shiftKey\)return/);
  assert.match(pieces,/keyboardTargetIndex\(event\.key,buttons\.indexOf\(event\.target as HTMLButtonElement\),buttons\.length\)/);
  assert.match(pieces,/event\.preventDefault\(\);event\.stopPropagation\(\);buttons\[next\]\.focus\(\)/);
  assert.match(pieces,/<details ref=\{detailsRef\} className="target-picker" onKeyDown=\{navigateTargets\}>/);
});

test('a scrolled long target list keeps Close visible and arrow-key focus unobscured',()=>{
  assert.match(css,/\.arena-message \.target-picker-close\{[^}]*position:sticky;top:0;z-index:2/);
  assert.match(css,/\.target-picker-row\{scroll-margin-block-start:54px;scroll-margin-block-end:8px\}/);
  assert.match(css,/\.target-picker-panel\{[^}]*overflow:auto/);
});

test('saved-deck screen navigation and failed deletes preserve last verified rows',()=>{
  assert.match(app,/if\(next==='saved'\)\{const checked=checkedDeckLibrary\(saved,storage\);setSaved\(checked.decks\);if\(checked.warning\)setMessage\(checked.warning\);else setMessage/);
  assert.match(app,/deleteSaved=async\(entry:NamedDeck\)=>[\s\S]*?catch\(e\)\{setSaved\(current=>deckLibraryAfterWriteFailure\(current,storage\)\)/);
  assert.doesNotMatch(app,/setSaved\(readDecks\(storage\)\)/);
});


test('target list text includes public shield and immune statuses without exposing hidden cards',()=>{
  const actions=readFileSync(new URL('../apps/client/src/battle-actions.ts',import.meta.url),'utf8');
  assert.match(actions,/minion\.keywords\?\.includes\('divineShield'\)\?\['천상의 보호막'\]/);
  assert.match(actions,/minion\.immuneThisTurn\?\['면역'\]/);
  assert.match(pieces,/row\.publicStatuses\?\.length/);
});


test('battlecry targeting starts at a focusable projected minion',()=>{
  assert.match(battle,/className="battlecry-anchor" data-action-source="battlecry"/);
  assert.match(battle,/aimPress.current=e.pointerId/);
  assert.match(battle,/setPointerCapture\(e.pointerId\)/);
});

test('rapid pointer drag statuses do not repeatedly queue screen reader announcements',()=>{
  assert.match(battle,/role="status" aria-live=\{currentDrag\?"off":"polite"\}/);
  assert.match(battle,/currentDrag&&dropFeedback\?dropFeedbackText/);
});


test('public target combat tags are separate high-contrast chips and screen reader description stays complete',()=>{
  assert.match(pieces,/const \{name,detail,baseDetail\}=targetRowText\(row,catalog,classic\)/);
  assert.match(pieces,/aria-label=\{`\$\{name\}, \$\{detail\}`\}/);
  assert.match(pieces,/className="target-picker-flags" aria-hidden="true"/);
  assert.match(css,/\.target-picker-flags\{[^}]*flex-wrap:wrap/);
  for(const name of ['shield','freeze','immune'])assert.match(css,new RegExp('target-flag-'+name+'\\{'));
});


test('mobile target picker text grows instead of shrinking to fit crowded lists',()=>{
  assert.match(css,/@media\(pointer:coarse\),\(max-width:660px\)\{\s*\.target-picker summary\{font-size:13px\}/);
  assert.match(css,/\.arena-message \.target-picker-row strong\{font-size:14px\}/);
  assert.match(css,/\.arena-message \.target-picker-row small\{font-size:12px\}/);
  assert.match(css,/\.target-picker-flags>span\{font-size:11px\}/);
});


test('direct saved-deck navigation warns on corrupt storage and clears stale warning after successful retry',()=>{
  assert.match(app,/initialScreen==='saved'\?checkedDeckLibrary\(\[\],storage\)\.warning/);
  assert.match(app,/current\.startsWith\('저장 덱을 확인할 수 없습니다\.'\)\?'저장 덱 확인 완료':current/);
});


test('deck editor startup warns when an inaccessible store makes its saved deck list appear empty',()=>{
  assert.match(app,/\[storageMessage,setStorageMessage\]=useState\(\(\)=>checkedDeckLibrary\(\[\],storage\)\.warning\?\?''\)/);
  assert.match(app,/\[message,setMessage\]=useState\(\(\)=>initialScreen==='saved'\?checkedDeckLibrary/);
  assert.match(app, /\{storageMessage&&<small role="status">\{storageMessage\}<\/small>\}/);
});

test('landscape touch combat buttons do not collapse to 23-36px hit targets',()=>{
  const rule=css.slice(css.lastIndexOf('/* v0.214: landscape touch controls'));
  assert.match(rule,/@media\(pointer:coarse\) and \(orientation:landscape\) and \(max-height:540px\) and \(min-width:661px\)/);
  for(const selector of ['.duel-toolbar button','.arena-message button','.arena-right .turn-control .end-turn','.arena-right .concede-button','.landscape-card-detail summary'])assert.ok(rule.includes(selector),`${selector} keeps a minimum size`);
  assert.match(rule,/\.landscape-card-detail summary\{min-height:44px\}/);
  assert.match(rule,/\.arena-message\{flex-wrap:wrap;min-height:44px\}/);
});


test('landscape card text is confined to the dedicated card preview',()=>{
  assert.doesNotMatch(battle,/landscape-card-detail|onInspectTap|ActionSequence/);
  const preview=readFileSync(new URL('../apps/client/src/hover-preview.tsx',import.meta.url),'utf8');
  assert.match(preview,/className="hover-description"/);
  assert.match(preview,/createPortal\(<CardHoverPanel/);
});

test('mobile emote menu is viewport anchored, has a sticky close action, and consumes Escape without cancelling cards',()=>{
  const dialogue=readFileSync(new URL('../apps/client/src/battle-dialogue-ui.tsx',import.meta.url),'utf8');
  assert.match(dialogue,/className="battle-emote-menu" ref=\{details\} onKeyDown=\{e=>\{if\(e\.key==='Escape'/);
  assert.match(dialogue,/e\.preventDefault\(\);e\.stopPropagation\(\);close\(\)/);
  assert.match(dialogue,/className="battle-emote-close" onClick=\{close\}/);
  assert.match(dialogue,/menu\.querySelector<HTMLElement>\('summary'\)\?\.focus\(\)/);
  assert.match(battle,/if\(e\.key==='Escape'&&e\.target\.closest\('\.battle-emote-menu\[open\],\.dialogue-settings\[open\]'\)\)return/);
  assert.match(css,/\.battle-emote-menu\[open\] \.battle-emote-options\{position:fixed;top:auto;bottom:calc\(8px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css,/\.battle-emote-options \.battle-emote-close\{position:sticky;top:0;z-index:2;min-height:44px/);
});
