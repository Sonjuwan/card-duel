import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, Battle, DeckEditor, DeckWorkspace } from '../src/App.tsx';
import { BattleCard, BattleMinion, CardInspector, HiddenHand, ManaDisplay } from '../src/battle-pieces.tsx';
import { catalog, loadPublicCatalog } from '../src/data.ts';
import { applyAction, createGame, getPlayerView, starterDeck } from '../../../packages/engine/src/index.ts';
import type { GameState, PlayerId } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import { REFERENCE_CARDS } from '../src/reference-art-data.ts';
import { ClassicNamesContext, displayCardName } from '../src/card-names.ts';
import { LocalCardArt, LocalHeroArt, LocalPowerArt, LocalVectorCardArt } from '../src/local-art.tsx';
import { CardHoverPanel } from '../src/hover-preview.tsx';
import { cardArtRecipe, heroArtRecipe, powerArtRecipe } from '../src/local-art-model.ts';
import { HERO_CLASSES } from '../../../packages/engine/src/index.ts';

// Browser-independent React rendering checks. This covers runtime JSX and
// the shape of all major views without claiming real browser interaction.
const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
const raw=readFileSync(`data/cards/${active.file}`,'utf8');
loadPublicCatalog(JSON.parse(raw),createHash('sha256').update(raw).digest('hex'));
const noOp=()=>{};
const room=(state:GameState|null,seat:PlayerId=0):RoomView=>({code:'TEST23',seat,mode:'human',status:!state?'waiting':state.phase==='finished'?'finished':'playing',opponentConnected:true,state:state?getPlayerView(state,seat):null});
const render=(s:GameState|null,seat:PlayerId=0,connected=true)=>renderToStaticMarkup(<Battle room={room(s,seat)} send={noOp} leave={noOp} connected={connected} busy={false}/>);
function create(){return createGame(catalog,[starterDeck(catalog,'warrior'),starterDeck(catalog,'mage')],{seed:104,firstPlayer:0});}
function ready(){let s=create();s=applyAction(s,0,{type:'mulligan',replace:[]});return applyAction(s,1,{type:'mulligan',replace:[]});}

test('lobby renders both play modes, nine class portraits, 25 difficulties and separate deck editor navigation',()=>{const html=renderToStaticMarkup(<App/>);assert.match(html,/AI 연습 대전/);assert.match(html,/친구와 1:1 대전/);assert.match(html,/5단계 · 전문가/);assert.match(html,/25단계 · 최강 · 학습형/);assert.match(html,/덱 편집하기/);assert.match(html,/382종/);assert.match(html,/연결 재시도/);assert.equal((html.match(/class="class-choice /g)??[]).length,9);assert.equal((html.match(/class="collection-item"/g)??[]).length,0);});
test('standalone lobby exposes only offline solo controls with all 25 levels',()=>{const html=renderToStaticMarkup(<App standalone/>);assert.match(html,/오프라인 솔로/);assert.match(html,/25단계 · 최강/);assert.match(html,/AI 대전 시작/);assert.match(html,/AI 성능/);assert.doesNotMatch(html,/연결 재시도|AI 실행 위치|친구와 1:1 대전|새 방 만들기/);});
test('solo lobby and deck editor show all strategic options and result history',()=>{const html=renderToStaticMarkup(<App standalone/>);assert.match(html,/AI 덱 전략/);assert.match(html,/무작위 직업/);assert.match(html,/컨트롤/);assert.match(html,/내가 후공/);assert.match(html,/솔로 대전 기록/);const editor=renderToStaticMarkup(<DeckEditor deck={starterDeck(catalog,'mage')} setDeck={noOp}/>);assert.match(editor,/추천 덱 유형/);assert.match(editor,/전설 중심/);});
test('finished local match offers same-opponent rematch and return to lobby',()=>{let s=ready();s=applyAction(s,1,{type:'concede'});const view:RoomView={...room(s),mode:'bot',botEngine:'device',botDifficulty:20,botDeckStyle:'control'};const html=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onRematch={noOp} connected busy={false}/>);assert.match(html,/같은 상대와 재대전/);assert.match(html,/대전 준비로 돌아가기/);});
test('finished ranked result shows only a server-confirmed XP receipt',()=>{const s=applyAction(ready(),1,{type:'concede'});const pending:RoomView={...room(s),mode:'bot',ranked:{rank:1,deckPower:1,intelligence:1,reward:'pending'}};const html=(view:RoomView)=>renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} connected busy={false}/>);assert.match(html(pending),/저장 중/);assert.doesNotMatch(html(pending),/class="ranked-reward"/);const saved=html({...pending,ranked:{...pending.ranked!,reward:'saved',rewardDetails:{xp:140,questAdvanced:true,questCompleted:true,questBonusXp:110,unlockedCards:['wolf'],rankAfter:2}}});assert.match(saved,/\+140 XP/);assert.match(saved,/보너스 \+110 XP/);assert.match(saved,/승급! 브론즈 4/);assert.match(saved,/새 카드 1종 해금/);assert.doesNotMatch(html({...pending,ranked:{...pending.ranked!,reward:'notEligible'}}),/class="ranked-reward"/);});
test('local save controls appear only when available, including the mulligan screen',()=>{for(const state of [create(),ready()]){const view:RoomView={...room(state),mode:'bot',botEngine:'device'};const saved=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onPause={noOp} autoSaved connected busy={false}/>);assert.match(saved,/자동 저장됨/);assert.match(saved,/저장 후 나가기/);const unavailable=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} autoSaved={false} connected busy={false}/>);assert.match(unavailable,/자동 저장 사용 불가/);assert.doesNotMatch(unavailable,/저장 후 나가기/);}assert.doesNotMatch(render(ready()),/자동 저장|저장 후 나가기/);});
test('deck editor renders a partial deck, twelve cards per page, 182 legal cards and mana curve slots',()=>{const html=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/>);assert.match(html,/2\/30장/);assert.match(html,/덱 마나 분포/);assert.match(html,/평균 마나 2.0/);assert.match(html,/빈칸 자동 채우기/);assert.match(html,/필터 초기화/);assert.match(html,/182\/182종/);assert.equal((html.match(/class="collection-item"/g)??[]).length,12);assert.equal((html.match(/class="battle-card /g)??[]).length,12);assert.match(html,/collection-pages/);assert.match(html,/1\/16/);});
test('waiting room and mulligan states render independently',()=>{const waiting=render(null),mulligan=render(create());assert.match(waiting,/친구를 기다리는 중/);assert.match(waiting,/TEST23/);assert.match(mulligan,/시작 카드 선택/);assert.match(mulligan,/선공/);assert.match(mulligan,/확정/);});
test('battle view shows only own cards, both hero resources and visible readiness/blocked reasons',()=>{let s=ready();s.players[0].hand=[{cardId:'wisp',instanceId:'own0'},{cardId:'blade_burst',instanceId:'own1'}];s.players[1].hand=[{cardId:'flame_sphere',instanceId:'hidden-opponent-card'}];s.players[0].mana=10;s.players[0].maxMana=10;s.players[0].board=[{cardId:'wolf',instanceId:'friend',attack:3,health:2,maxHealth:2,attacksRemaining:1}];const html=render(s);assert.match(html,/내 턴/);assert.match(html,/공격 가능 1회/);assert.match(html,/장착한 무기가 없습니다/);assert.match(html,/class="battle-minion faction-neutral is-ready"/);assert.ok(!html.includes('hidden-opponent-card'));assert.ok(!html.includes(catalog.flame_sphere.name));assert.match(html,/마나 10\/10/);assert.match(html,/오류 신고용 전투 기록/);assert.match(html,/전투 기록 복사/);assert.equal((html.match(/class="card-back"/g)??[]).length,1);assert.equal((html.match(/class="battle-card /g)??[]).length,2);});
test('disconnected and finished battle views present distinct state messages',()=>{let s=ready();assert.match(render(s,0,false),/서버 재연결 대기/);s=applyAction(s,1,{type:'concede'});assert.match(render(s),/승리!/);assert.match(render(s,1),/패배/);assert.match(render(s),/덱 편집으로 돌아가기/);});
test('pending private choices render card names only to their owner',()=>{const s=ready();s.pendingChoice={owner:0,cards:[{cardId:'flame_sphere',instanceId:'private-pick'}]};s.players[0].hand=[];s.players[1].hand=[];const owner=render(s,0),enemy=render(s,1);assert.match(owner,/덱 위의 카드 중 한 장을 선택하세요/);assert.ok(owner.includes(catalog.flame_sphere.name));assert.match(enemy,/상대가 카드를 선택하는 중입니다/);assert.ok(!enemy.includes(catalog.flame_sphere.name));});
test('battlefield order and full 7-by-7 board plus 10-by-10 hands at maximum occupancy render safely',()=>{const s=ready();for(const seat of [0,1] as const){s.players[seat].board=Array.from({length:7},(_,i)=>({cardId:'wolf',instanceId:`board-${seat}-${i}`,attack:3,health:2,maxHealth:2,attacksRemaining:1}));s.players[seat].hand=Array.from({length:10},(_,i)=>({cardId:seat===0?'wisp':'flame_sphere',instanceId:`hand-${seat}-${i}`}));}const h=render(s);assert.equal((h.match(/class="battle-minion /g)??[]).length,14);assert.equal((h.match(/class="battle-card /g)??[]).length,10);assert.equal((h.match(/class="card-back"/g)??[]).length,10);assert.equal((h.match(/class="hand-card-slot fan-/g)??[]).length,10);assert.equal((h.match(/class="opponent-card-slot fan-/g)??[]).length,10);assert.match(h,/class="table-decor"/);assert.match(h,/내 전장 7\/7/);assert.match(h,/상대 전장 7\/7/);assert.match(h,/data-count="10"/);assert.ok(h.indexOf('class="hidden-hand"')<h.indexOf('class="hero-zone enemy-hero-zone"'));assert.ok(h.indexOf('class="hero-zone enemy-hero-zone"')<h.indexOf('class="arena-board enemy-board"'));assert.ok(h.indexOf('class="arena-board friendly-board')<h.indexOf('class="own-hand"'));assert.ok(!h.includes('hand-1-'));assert.ok(!h.includes(catalog.flame_sphere.name));assert.equal((h.match(/class="position-slot[^\"]*" disabled=""/g)??[]).length,8);});
test('mana crystals represent full, used, locked and temporary mana separately',()=>{const p=getPlayerView(ready(),0).self;let h=renderToStaticMarkup(<ManaDisplay player={{...p,mana:2,maxMana:6,lockedMana:2,pendingOverload:3}}/>);assert.equal((h.match(/mana-crystal filled/g)??[]).length,2);assert.equal((h.match(/mana-crystal spent/g)??[]).length,2);assert.equal((h.match(/mana-crystal locked/g)??[]).length,2);assert.equal((h.match(/mana-crystal future/g)??[]).length,4);assert.match(h,/다음 과부하 3/);h=renderToStaticMarkup(<ManaDisplay player={{...p,mana:5,maxMana:6,lockedMana:2}}/>);assert.equal((h.match(/mana-crystal filled/g)??[]).length,5);assert.equal((h.match(/mana-crystal locked/g)??[]).length,2);});
test('portraits and resources render armor, weapon durability, private and public secret counts',()=>{const s=ready();s.players[0].health=17;s.players[0].armor=4;s.players[0].weapon={attack:3,durability:2};s.players[0].secrets=[{cardId:'arcane_barrier',instanceId:'owned-secret'}];const enemySecret=Object.values(catalog).find(c=>c.kind==='secret'&&c.id!=='arcane_barrier')!;s.players[1].secrets=[{cardId:enemySecret.id,instanceId:'secret-not-visible'}];const h=render(s);assert.match(h,/생명력 17, 방어도 4, 공격력 3/);assert.match(h,/내구도 2/);assert.match(h,/상대 비밀 1개/);assert.match(h,/내 비밀 1개/);assert.ok(h.includes(catalog.arcane_barrier.name));assert.ok(!h.includes(enemySecret.name));assert.ok(!h.includes('secret-not-visible'));});
test('minion statuses are identifiable by frame, label and inspection text',()=>{const m={cardId:'wolf',instanceId:'m',attack:5,health:1,maxHealth:2,attacksRemaining:1,keywords:['taunt','divineShield','stealth'] as const,frozenThroughTurn:12,silenced:true};const minion={...m,keywords:[...m.keywords]};const h=renderToStaticMarkup(<BattleMinion card={catalog.wolf} minion={minion} catalog={catalog} ownTurn={true}/>);for(const tag of ['has-taunt','has-shield','has-stealth','is-frozen','is-silenced','damaged','도발','천상의 보호막','빙결'])assert.ok(h.includes(tag),tag);const inspect=renderToStaticMarkup(<CardInspector item={{card:catalog.wolf,minion}} catalog={catalog}/>);assert.match(inspect,/침묵/);assert.match(inspect,/체력 <b>1<\/b>/);});
test('selected mulligan card shows a replacement badge and accessible pressed state',()=>{const h=renderToStaticMarkup(<BattleCard card={catalog.wolf} enabled={true} mulligan selected/>);assert.match(h,/aria-pressed="true"/);assert.match(h,/replace-banner/);assert.match(h,/교체/);assert.ok(!h.includes('<img'));});
test('opponent hand component renders only count and generic card-backs',()=>{const h=renderToStaticMarkup(<HiddenHand count={10}/>);assert.equal((h.match(/class="card-back"/g)??[]).length,10);assert.match(h,/상대 손패 10장/);assert.ok(!h.includes('card-name'));});
test('enemy turn and disconnected state disable draggable cards and end-turn button',()=>{let s=ready();s.players[0].hand=[{cardId:'wisp',instanceId:'card'}];const disconnected=render(s,0,false);assert.match(disconnected,/서버 재연결 대기/);assert.match(disconnected,/class="end-turn" disabled=""/);assert.ok(!disconnected.includes('draggable="true"'));s=applyAction(s,0,{type:'endTurn'});const enemy=render(s);assert.match(enemy,/상대 턴/);assert.match(enemy,/class="end-turn" disabled=""/);assert.ok(!enemy.includes('draggable="true"'));});
test('classic names map all 382 historical cards and all tokens without changing rule ids',()=>{
 const deckCards=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);
 assert.equal(deckCards.length,382);assert.equal(new Set(deckCards.map(c=>REFERENCE_CARDS[c.id]?.artId)).size,382);
 for(const c of Object.values(catalog)){assert.ok(REFERENCE_CARDS[c.id],c.id);assert.match(displayCardName(c,true),/\S/);assert.equal(displayCardName(c,false),c.name);}
 assert.equal(displayCardName(catalog.flame_sphere,true),'화염구');
});
test('familiar names are optional and both modes render exactly one self-contained illustration',()=>{
 const base=renderToStaticMarkup(<BattleCard card={catalog.flame_sphere} enabled/>);
 const marked=renderToStaticMarkup(<ClassicNamesContext.Provider value={true}><BattleCard card={catalog.flame_sphere} cost={1} enabled/></ClassicNamesContext.Provider>);
 for(const h of [base,marked]){assert.equal((h.match(/class="original-art"/g)??[]).length,1);assert.ok(!h.includes('<img'));assert.ok(!h.includes('https://'));assert.ok(!h.includes('reference-card-face'));}
 assert.match(marked,/화염구, 마나 1/);assert.ok(!marked.includes('화염 구체'));
 assert.match(base,/화염 구체/);
});
test('local art never renders hidden opponent hand or secret identity',()=>{
 const s=ready();s.players[0].hand=[{cardId:'wolf',instanceId:'own'}];s.players[1].hand=[{cardId:'flame_sphere',instanceId:'FROZEN-HIDDEN-A'}];s.players[1].secrets=[{cardId:'arcane_barrier',instanceId:'FROZEN-HIDDEN-B'}];
 const html=renderToStaticMarkup(<ClassicNamesContext.Provider value={true}><Battle room={{...room(s),mode:'bot'}} send={noOp} leave={noOp} busy={false} connected/></ClassicNamesContext.Provider>);
 assert.ok(html.includes(`data-art-seed="${cardArtRecipe(catalog.wolf).seed}"`));assert.ok(!html.includes(`data-art-seed="${cardArtRecipe(catalog.flame_sphere).seed}"`));assert.ok(!html.includes(`data-art-seed="${cardArtRecipe(catalog.arcane_barrier).seed}"`));assert.ok(!html.includes('FROZEN-HIDDEN'));
 assert.equal((html.match(/class="card-back"/g)??[]).length,1);
});
test('all 443 client card definitions render independently without external assets and retain live stats',()=>{
 const all=Object.values(catalog);assert.equal(all.length,443);
 const ids=new Set<number>();const subjects=new Set<string>();
 for(const card of all){
  const recipe=cardArtRecipe(card);ids.add(recipe.seed);subjects.add(recipe.subject);
  const html=renderToStaticMarkup(<ClassicNamesContext.Provider value={true}><BattleCard card={card} cost={7} enabled/></ClassicNamesContext.Provider>);
  assert.match(html,/class="original-art"/);assert.match(html,/class="painted-art art-/);assert.match(html,/data-art-asset="/);assert.match(html,/마나 7/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('https://'));assert.ok(!html.includes('NaN'));
  if(card.kind==='minion')assert.match(html,new RegExp(`공격력 ${card.attack}, 생명력 ${card.health}`));
  if(card.kind==='weapon')assert.match(html,new RegExp(`공격력 ${card.attack}, 내구도 ${card.durability}`));
 }
 assert.equal(ids.size,443);assert.ok(subjects.size>=36,`subject coverage=${subjects.size}`);
 for(const heroClass of HERO_CLASSES){const hero=renderToStaticMarkup(<LocalHeroArt heroClass={heroClass}/>);const power=renderToStaticMarkup(<LocalPowerArt heroClass={heroClass}/>);assert.ok(hero.includes(`data-art-seed="${heroArtRecipe(heroClass).seed}"`));assert.ok(power.includes(`data-art-seed="${powerArtRecipe(heroClass).seed}"`));assert.ok(!hero.includes('https://'));assert.ok(!power.includes('https://'));}
});
test('deck editor shows twelve illustrated cards and tile art only for the owned cards',()=>{
 const html=renderToStaticMarkup(<ClassicNamesContext.Provider value={true}><DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/></ClassicNamesContext.Provider>);
 assert.equal((html.match(/class="original-art"/g)??[]).length,13);
 assert.match(html,/class="local-deck-tile"/);assert.ok(!html.includes('<img'));
});
test('each art instance owns unique gradient and clipping ids, even for repeated cards',()=>{
 const html=renderToStaticMarkup(<><LocalVectorCardArt card={catalog.wolf}/><LocalVectorCardArt card={catalog.wolf}/><LocalVectorCardArt card={catalog.flame_sphere}/></>);
 const ids=[...html.matchAll(/<(?:(?:linear|radial)Gradient|clipPath) id="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,9);assert.equal(new Set(ids).size,9);
 for(const ref of html.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]));
});
test('hover panel displays a large card with current buffed attack, damaged health, and continuous effect text',()=>{
 const minion={cardId:'wolf',instanceId:'minion',attack:9,health:1,maxHealth:5,attacksRemaining:1,keywords:['taunt' as const],frozenThroughTurn:10};
 const h=renderToStaticMarkup(<CardHoverPanel preview={{item:{card:catalog.wolf,minion},side:'left'}}/>);
 assert.match(h,/role="tooltip"/);assert.match(h,/hover-large-card/);assert.match(h,/stat-attack">9/);assert.match(h,/stat-health">1/);assert.match(h,/생명력 1\/5/);assert.match(h,/도발/);assert.match(h,/빙결/);assert.match(h,/hover-description/);assert.match(h,/data-art-asset="raptor"/);
 const silence=renderToStaticMarkup(<CardHoverPanel preview={{item:{card:catalog.wolf,minion:{...minion,silenced:true}},side:'right'}}/>);assert.match(silence,/침묵 \(원래 카드 효과 제거\)/);
});
test('deck builder has explicit set tabs with counts and each visible card has a set label',()=>{
 const h=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp}/>);
 assert.match(h,/aria-label="카드 세트"/);assert.match(h,/aria-pressed="true">전체<small>182/);assert.match(h,/기본 카드<small>\d+/);assert.match(h,/오리지널 카드<small>\d+/);assert.equal((h.match(/collection-set-label/g)??[]).length,12);
});
test('deck builder basic and original initial views never display cards from the opposite set',()=>{
 const basic=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialSet="basic"/>);
 const original=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialSet="original"/>);
 assert.match(basic,/data-set-filter="basic" aria-pressed="true"/);assert.match(original,/data-set-filter="original" aria-pressed="true"/);
 assert.equal((basic.match(/class="battle-card [^"]*rarity-basic/g)??[]).length,12);assert.equal((original.match(/class="battle-card [^"]*rarity-basic/g)??[]).length,0);
 assert.doesNotMatch(basic,/option value="rare"/);assert.doesNotMatch(basic,/option value="epic"/);assert.match(original,/option value="epic"/);assert.doesNotMatch(original,/option value="basic"/);
});
test('deck builder renders visible cards in ascending mana order in each set',()=>{
 for(const initialSet of ['all','basic','original'] as const){
  const h=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialSet={initialSet}/>);
  const costs=[...h.matchAll(/data-preview-cost="(\d+)"/g)].map(m=>Number(m[1]));
  assert.equal(costs.length,12);assert.deepEqual(costs,[...costs].sort((a,b)=>a-b));
 }
});
test('deck workspace separates class list, saved deck list, read-only catalogue and builder; book has two six-card leaves',()=>{
 const props={deck:{heroClass:'mage' as const,cards:['wolf']},setDeck:noOp};
 for(const screen of ['classes','saved','cards','build'] as const){
  const h=renderToStaticMarkup(<DeckWorkspace {...props} initialScreen={screen}/>);assert.match(h,new RegExp(`data-deck-screen="${screen}"`));
  assert.equal((h.match(/data-deck-screen=/g)??[]).length,1);assert.equal((h.match(/data-deck-nav=/g)??[]).length,4);
  if(screen==='cards'||screen==='build'){assert.equal((h.match(/class="collection-item"/g)??[]).length,12);assert.match(h,/data-book-page="left"/);assert.match(h,/data-book-page="right"/);}
  if(screen==='cards'){assert.match(h,/382\/382종/);assert.doesNotMatch(h,/덱 저장/);}
  if(screen==='saved')assert.match(h,/저장한 덱이 없습니다/);
  if(screen==='classes')assert.equal((h.match(/class="class-choice /g)??[]).length,9);
 }
});
test('epic cards render their rarity and unique art; changed hero power is public',()=>{
 const h=renderToStaticMarkup(<BattleCard card={catalog.pyroblast} enabled/>);
 assert.match(h,/rarity-epic/);assert.match(h,/art-epic-pyroblast/);
 let s=ready();s.players[0].heroClass='priest';s.players[0].shadowformLevel=2;
 assert.match(render(s),/정신 분쇄/);assert.match(render(s,1),/정신 분쇄/);
});
test('opponent hidden cards are never registered as hover sources',()=>{
 const s=ready();s.players[0].hand=[{cardId:'wisp',instanceId:'own'}];s.players[1].hand=[{cardId:'flame_sphere',instanceId:'private'}];
 const html=render(s);assert.match(html,/data-preview-card="wisp"/);assert.ok(!html.includes('data-preview-card="flame_sphere"'));assert.ok(!html.includes('data-hover-preview'));
});
