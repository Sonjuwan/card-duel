import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const load=(s)=>readFileSync(new URL(`../apps/client/src/${s}`,import.meta.url),'utf8');
const app=load('App.tsx'),shell=load('landscape-shell.css'),component=load('LandscapeExperience.tsx');
test('online and offline both import the complete landscape shell last',()=>{
  for(const entry of ['main.tsx','offline-main.tsx']){
    const source=load(entry);
    assert.match(source,/import '\.\/game-styles\.ts';/);
    const shared=load('game-styles.ts'),combat=shared.indexOf("import './landscape-combat.css'"),shell=shared.indexOf("import './landscape-shell.css'");
    assert.ok(combat>=0&&shell>combat);
  }
});
test('game and deck modes share a clipped viewport and independently scrolling active panel',()=>{
  assert.match(app,/data-game-viewport="landscape"/);
  assert.match(app,/<div className="screen-content" id="card-duel-screen" ref=\{screenScrollRef\}>/);
  assert.match(shell,/\.lobby-main,\.game-main\{[^}]*display:flex;flex-direction:column/);
  assert.match(shell,/height:100vh;height:100dvh/);
  assert.match(shell,/\.game-main>\.screen-content\{overflow:hidden\}/);
  assert.match(shell,/overscroll-behavior:contain/);
});
test('game menu exposes a dedicated slot/progression page outside the play setup',()=>{
  const menu=app.indexOf('aria-label="게임 메뉴"');
  assert.ok(menu>0&&menu<app.indexOf("lobbyView==='play'?<div className=\"play-hub\""));
  assert.match(app,/data-lobby-tab="slots" onClick=\{\(\)=>openLobbyView\('slots',true\)\}/);
  assert.match(app,/lobbyView==='slots'&&lossOnExit\?<section className="preview-slot-only"/);
  assert.match(shell,/\.lobby-tabs\[aria-label="게임 메뉴"\]\{[^}]*position:sticky/);
});
test('short mobile landscape overrides the 540px theme minimum with fluid playable height',()=>{
  assert.match(shell,/\.game-main \.battle\.phase-playing \.battle-arena\.classic-table/);
  assert.match(shell,/flex:1 1 0%;height:auto;min-height:0;max-height:none/);
  assert.match(shell,/grid-template-rows:clamp\(6px,2dvh,12px\) var\(--landscape-hero-h\)/);
  assert.match(shell,/\.arena-right \.turn-control \.end-turn\{min-height:44px\}/);
});
test('portrait guide offers manual rotation and fullscreen only through direct input',()=>{
  assert.match(component,/className="rotate-device-message" role="dialog"/);
  assert.match(shell,/@media \(pointer:coarse\) and \(orientation:portrait\)/);
  assert.match(component,/onClick=\{\(\)=>void requestLandscape\(\)\}/);
  assert.match(component,/requestFullscreen\(\)/);
  assert.match(component,/orientation\.lock\('landscape'\)/);
  assert.match(component,/자동 화면 회전이 제한되어 있어요/);
});
test('battle, deck maker and card catalog are actual switched game screens',()=>{
  assert.match(app,/initialLobbyView='home'/);
  assert.match(app,/data-lobby-tab="slots" onClick=\{\(\)=>openLobbyView\('slots',true\)\}/);
  for(const part of ['등급','퀘스트','경험치 · 카드 획득','개발자 모드'])assert.ok(app.includes(part));
  assert.match(app,/lobbyView==='catalog'\?<CardBrowser\b[^>]*\bfocusCardId=\{catalogFocus\}[^>]*\bunreadIds=/);
  assert.match(app,/data-lobby-tab="play".*setEnterDeckEditor\(false\);openLobbyView\('decks',true\)/);
  assert.match(app,/screenScrollRef\.current\?\.scrollTo\(0,0\)/);
});
test('single-touch inspection displays an unplayable hand card without a manual play button',()=>{
  const battle=load('Battle.tsx'),pieces=load('battle-pieces.tsx');
  assert.doesNotMatch(battle,/setPeekCardId|selected-card-use|selected-card-inspect/);
  assert.match(pieces,/useCardHover\(info,sourceId\?\.startsWith\('card:'\)\?BATTLE_HOLD_DELAY:undefined,Boolean\(sourceId\?\.startsWith\('card:'\)&&!mulligan\)\)/);
});
test('preview uses the unified deck picker and preserves access to legacy save slots',()=>{
  assert.match(app,/lobbyView==='decks'\?<DeckWorkspace/);
  assert.match(app,/if\(lossOnExit&&offlineMode==='player'\)beginLocal\(resolveSolo\(soloSettings,random32\(\)\),current,true\)/);
  assert.match(app,/<LobbyDialog label="슬롯 · 성장 · 저장 경기">/);
  assert.match(shell,/\.lobby-main \.play-hub\{display:flex;flex-direction:column\}/);
  assert.match(shell,/\.lobby-main \.play-hub>\.play-lobby\{display:flex;flex-direction:column;gap:6px;overflow:visible\}/);
});
test('landscape rail wins over the classic desktop absolute layout at wider mobile viewports',()=>{
  assert.match(shell,/\.battle\.phase-playing \.battle-arena\.classic-table>\.arena-field,[\s\S]*position:relative;inset:auto;grid-column:1;grid-row:1/);
  assert.match(shell,/\.battle\.phase-playing \.battle-arena\.classic-table>\.arena-right,[\s\S]*position:relative;inset:auto;grid-column:2;grid-row:1/);
  assert.match(shell,/\.arena-right>\.resource-block\{[^}]*display:flex/);
  assert.match(shell,/\.arena-right \.mana-display,[\s\S]*position:relative;top:auto;bottom:auto/);
  assert.match(shell,/\.arena-right>\.turn-control\{[^}]*position:relative;top:auto;bottom:auto/);
});
