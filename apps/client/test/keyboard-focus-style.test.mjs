import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('keyboard focus remains visible for native and custom controls', () => {
  const focusRule = css.match(/[^{}]*\[role="button"\]\[tabindex\]:focus-visible[^{}]*\{[^{}]+\}/)?.[0];
  assert.ok(focusRule, 'custom role=button focus ring missing');
  assert.match(focusRule, /button:focus-visible/);
  assert.match(focusRule, /\[role="option"\]\[tabindex\]:focus-visible/);
  assert.match(focusRule, /outline:3px solid/);
});

test('hand interactions provide a keyboard path without duplicate manual controls',()=>{
  const source=readFileSync(new URL('../src/Battle.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/selected-card-use|selected-card-inspect|selection-cancel|<PlacementPicker|<TargetPicker/);
  assert.match(source,/onClick=\{keyboard=>\{if\(keyboard\)applyIntent\(planCard/);
});

test('collection cards keep their ratio and allow full descriptions to scroll',()=>{
  const catalogCss=readFileSync(new URL('../src/local-cards.css',import.meta.url),'utf8');
  assert.match(catalogCss,/\.collection\.classic-collection\.collection-book \.battle-card\s*\{[^}]*aspect-ratio:var\(--full-card-ratio\);height:auto/);
  const copy=catalogCss.match(/\.collection-book \.battle-card \.card-copy\s*\{[^}]*\}/)?.[0];
  assert.ok(copy);assert.match(catalogCss,/\.battle-card \.card-copy\{[^}]*overflow:auto/);assert.match(copy,/white-space:pre-wrap/);assert.match(copy,/height:auto/);
});

test('phone deck builder keeps both panes visible with a sticky, scrollable deck and usable remove targets',()=>{
  const catalogCss=readFileSync(new URL('../src/local-cards.css',import.meta.url),'utf8');
  assert.match(catalogCss,/\.deck-builder \.deck-sidebar\{position:sticky;top:8px/);
  assert.match(catalogCss,/@media\(max-width:600px\)\{\s*\.deck-builder \.deck-layout\{grid-template-columns:minmax\(0,1fr\) minmax\(128px,42%\)/);
  assert.match(catalogCss,/\.deck-builder \.deck-list\{[^}]*max-height:calc\(100dvh - 24px\);overscroll-behavior:contain/);
  assert.match(catalogCss,/\.deck-builder \.deck-entry\{grid-template-columns:minmax\(0,1fr\) 44px/);
});

test('drag feedback uses fixed slot widths and noninteractive paint-only halos',()=>{
  const fx=readFileSync(new URL('../src/battle-fx.css',import.meta.url),'utf8');
  assert.match(fx,/\.position-slot\.dropping:not\(:disabled\)\{position:relative;width:var\(--stable-slot\);min-width:var\(--stable-slot\)/);
  assert.match(fx,/\.position-slot\.touch-drop-hover::after[^}]*pointer-events:none/);
  assert.match(fx,/\.friendly-board\.drop-ready\{outline:3px dashed/);
  assert.match(fx,/\.hero-portrait\.is-targeted\{outline:3px dashed/);
  assert.match(fx,/\.touch-drag-ghost\{filter:drop-shadow/);
});


test('effect-choice modal Escape returns focus by using the same explicit cancellation path as its Cancel button',()=>{
  const battle=readFileSync(new URL('../src/Battle.tsx',import.meta.url),'utf8');
  const keys=battle.slice(battle.indexOf('const choiceKeys='),battle.indexOf('// Mark a genuinely scrollable row'));
  assert.match(keys,/if\(e\.key==='Escape'&&selected\?\.kind==='cardChoice'\)\{e\.preventDefault\(\);e\.stopPropagation\(\);cancelCardChoice\(\);return;/);
  assert.match(battle,/const cancelCardChoice=\(\)=>\{if\(selected\?\.kind==='cardChoice'\)choiceReturn\.current=selected\.id;/);
});
