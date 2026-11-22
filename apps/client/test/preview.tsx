/* Generate a standalone, static presentation of the actual React components.
 * No live game state, credentials, third-party art, or browser APIs are used. */
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Battle } from '../src/Battle.tsx';
import { PlayLobby } from '../src/Lobby.tsx';
import { DeckEditor, DeckWorkspace } from '../src/App.tsx';
import { Sigil, BattleCard } from '../src/battle-pieces.tsx';
import { PAINTED_ASSETS } from '../src/painted-art-model.ts';
import { CardHoverPanel } from '../src/hover-preview.tsx';
import { cardSet, cardSetLabel, sortCardsForDisplay } from '../src/card-sets.ts';
import { cardArtRecipe } from '../src/local-art-model.ts';
import { className } from '../src/data.ts';
import { HERO_CLASSES } from '../../../packages/engine/src/index.ts';
import { catalog, loadPublicCatalog } from '../src/data.ts';
import { applyAction, createGame, getPlayerView, practiceDeck } from '../../../packages/engine/src/index.ts';
import type { GameState, Minion, PlayerId } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import { ClassicNamesContext, displayCardName } from '../src/card-names.ts';
import { renderBattlePoster,renderCardFrameComparison,renderDuplicateArtComparison } from './preview-poster.ts';
import type { ReactNode } from 'react';
let previewSequence=0;
const referencePreview=(node:ReactNode)=>renderToStaticMarkup(<ClassicNamesContext.Provider value={true}>{node}</ClassicNamesContext.Provider>,{identifierPrefix:`preview-${previewSequence++}-`});

const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
const raw=readFileSync(`data/cards/${active.file}`,'utf8');
loadPublicCatalog(JSON.parse(raw),createHash('sha256').update(raw).digest('hex'));
const noOp=()=>{};
const deck=practiceDeck(catalog,'mage');
const mulligan=createGame(catalog,[deck,practiceDeck(catalog,'warrior')],{seed:45,firstPlayer:0});
let example=applyAction(mulligan,0,{type:'mulligan',replace:[]});example=applyAction(example,1,{type:'mulligan',replace:[]});
function minion(id:string,seat:PlayerId,i:number,patch:Partial<Minion>={}):Minion{const c=catalog[id];if(c.kind!=='minion')throw new Error(id);return{cardId:id,instanceId:`example-minion-${seat}-${i}`,attack:c.attack,health:c.health,maxHealth:c.health,attacksRemaining:1,keywords:[...(c.keywords??[])],...patch};}
example.turn=11;example.players[0].health=23;example.players[0].mana=5;example.players[0].maxMana=6;example.players[1].health=18;example.players[1].mana=0;example.players[1].maxMana=5;example.players[1].armor=2;
example.players[0].hand=['wisp','wolf','flame_sphere','ice_block','faceless_manipulator','pyroblast'].map((id,i)=>({cardId:id,instanceId:`sample-hand-${i}`}));
example.players[1].hand=Array.from({length:5},(_,i)=>({cardId:'recruit',instanceId:`sample-opponent-${i}`}));
example.players[0].board=[minion('wolf',0,0),minion('snow_brute',0,1,{health:2}),minion('wisp',0,2,{attacksRemaining:0}),minion('void_sentinel',0,3,{keywords:['divineShield']})];
example.players[1].board=[minion('recruit',1,0),minion('ogre',1,1,{health:3,frozenThroughTurn:12}),minion('night_cat',1,2,{keywords:['stealth']})];
example.players[1].weapon={attack:3,durability:2};example.players[0].secrets=[{cardId:'arcane_barrier',instanceId:'sample-secret'}];
example.players[0].deck=example.players[0].deck.slice(0,17);example.players[1].deck=example.players[1].deck.slice(0,20);
example.history=[{turn:9,player:0,message:'회색 늑대 사용'},{turn:10,player:1,message:'동굴 거인 사용'},{turn:10,player:1,message:'영웅 피해 3'},{turn:10,player:1,message:'턴 종료'},{turn:11,player:0,message:'턴 시작'}];
function room(s:GameState):RoomView{return {code:'DEMO23',seat:0,mode:'bot',botDifficulty:3,status:'playing',opponentConnected:true,state:getPlayerView(s,0)};}
function header(){return <header className="app-header"><div className="brand"><span className="brand-emblem"><Sigil kind="neutral"/></span><div><p className="eyebrow">INDEPENDENT CARD GAME · v0.36.0</p><h1>Card Duel</h1></div></div><div className="connection"><span className="good">● 화면 미리보기</span></div></header>;}
const arena=referencePreview(<main className="game-main">{header()}<Battle room={room(example)} send={noOp} leave={noOp} connected busy={false}/></main>);
// Deliberately crowded sample to check every legal hand/board slot at small sizes.
const full=structuredClone(example);
const extraMinions=['recruit','wolf','ogre','night_cat','snow_brute','wisp','void_sentinel'];
full.players[0].board=extraMinions.map((id,i)=>({...minion(id,0,i,i===4?{keywords:['taunt']}:i===6?{keywords:['divineShield']}:{}),instanceId:`full-minion-0-${i}`}));
full.players[1].board=[...extraMinions].reverse().map((id,i)=>({...minion(id,1,i,i===0?{keywords:['taunt']}:i===3?{frozenThroughTurn:12}:{}),instanceId:`full-minion-1-${i}`}));
full.players[0].hand=['wisp','wolf','flame_sphere','ice_block','faceless_manipulator','pyroblast','night_cat','void_sentinel','flame_sphere','wolf'].map((id,i)=>({cardId:id,instanceId:`full-hand-${i}`}));
full.players[1].hand=Array.from({length:10},(_,i)=>({cardId:'recruit',instanceId:`full-opponent-${i}`}));
full.players[0].maxMana=10;full.players[0].mana=7;full.players[0].lockedMana=2;
const fullArena=referencePreview(<main className="game-main">{header()}<Battle room={room(full)} send={noOp} leave={noOp} connected busy={false}/></main>);
const lobby=referencePreview(<main className="lobby-main">{header()}<PlayLobby deck={deck} onClass={noOp} botClass="warrior" setBotClass={noOp} difficulty={3} setDifficulty={noOp} code="" setCode={noOp} onBegin={noOp} onEdit={noOp} connected busy={false}/></main>);
const mull=referencePreview(<main className="game-main">{header()}<Battle room={room(mulligan)} send={noOp} leave={noOp} connected busy={false}/></main>);
const editor=referencePreview(<>{(['all','basic','original'] as const).map(set=><div data-demo-set={set} hidden={set!=='all'} key={set}><main className="lobby-main">{header()}<DeckEditor deck={{heroClass:'mage',cards:deck.cards.slice(0,22)}} setDeck={noOp} initialSet={set}/></main></div>)}</>);
const workspace=referencePreview(<>{(['classes','saved','cards','build'] as const).map(screen=><div data-demo-workspace={screen} hidden={screen!=='classes'} key={screen}><main className="lobby-main">{header()}<DeckWorkspace deck={{heroClass:'mage',cards:deck.cards.slice(0,22)}} setDeck={noOp} initialScreen={screen}/></main></div>)}</>);
const paintedCss=readFileSync('apps/client/src/painted-art.css','utf8').replace(/url\("\.\/assets\/illustrations\/([a-z-]+\.webp)"\)/g,(_,file:string)=>`url("data:image/webp;base64,${readFileSync('apps/client/src/assets/illustrations/'+file).toString('base64')}")`);
const css=['styles','battle','classic-table','local-cards'].map(name=>readFileSync('apps/client/src/'+name+'.css','utf8')).join('\n')+'\n'+paintedCss+'\n'+readFileSync('apps/client/src/hover-preview.css','utf8')+'\n'+readFileSync('apps/client/src/battle-fx.css','utf8');
const hoverExample=referencePreview(<CardHoverPanel preview={{item:{card:catalog.snow_brute,minion:example.players[0].board[1]},side:'right'}} example/>);
// HTML is only a visual sandbox, but its public cards can demonstrate the same
// dwell and dismiss experience without a running server or external resources.
const hoverTemplates=referencePreview(<>{Object.values(catalog).map(card=><template key={card.id} data-preview-template={card.id}><CardHoverPanel preview={{item:{card},side:'right'}}/></template>)}{[...example.players[0].board,...example.players[1].board,...full.players[0].board,...full.players[1].board].map(minion=><template key={minion.instanceId} data-preview-template={minion.instanceId}><CardHoverPanel preview={{item:{card:catalog[minion.cardId],minion},side:'right'}}/></template>)}</>);
const hoverScript=`<script>(()=>{let timer,active,popup;const templates=new Map([...document.querySelectorAll('template[data-preview-template]')].map(t=>[t.dataset.previewTemplate,t]));function clear(){clearTimeout(timer);active=null;if(popup){popup.remove();popup=null;}}const source=e=>e.target.closest?.('[data-preview-card]');function start(el){if(!el||el===active)return;clear();active=el;timer=setTimeout(()=>{if(active!==el||!el.isConnected)return;const t=templates.get(el.dataset.previewMinion||el.dataset.previewCard);if(!t)return;popup=t.content.firstElementChild.cloneNode(true);const b=el.getBoundingClientRect();popup.classList.toggle('hover-left',b.left+b.width/2>=innerWidth/2);popup.classList.toggle('hover-right',b.left+b.width/2<innerWidth/2);if(el.dataset.previewCost!==undefined)popup.querySelector('.card-mana').textContent=el.dataset.previewCost;document.body.append(popup);},1000);}document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')start(source(e));});document.addEventListener('pointerout',e=>{const el=source(e);if(el&&el===active&&!(e.relatedTarget instanceof Node&&el.contains(e.relatedTarget)))clear();});document.addEventListener('focusin',e=>{if(e.target.matches(':focus-visible'))start(source(e));});document.addEventListener('focusout',e=>{if(source(e)===active)clear();});document.addEventListener('click',e=>{clear();const nav=e.target.closest?.('[data-deck-nav]');if(nav?.closest('[data-demo-workspace]')){for(const view of document.querySelectorAll('[data-demo-workspace]'))view.hidden=view.dataset.demoWorkspace!==nav.dataset.deckNav;}const button=e.target.closest?.('[data-set-filter]');if(button?.closest('[data-demo-set]')){for(const view of document.querySelectorAll('[data-demo-set]'))view.hidden=view.dataset.demoSet!==button.dataset.setFilter;}});document.addEventListener('dragstart',clear);document.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});window.addEventListener('resize',clear);window.addEventListener('blur',clear);})();</script>`;
const representative=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false).reduce((map,c)=>{const subject=cardArtRecipe(c).subject;if(!map.has(subject))map.set(subject,c);return map;},new Map<string, typeof catalog[string]>());
const sampleCards=referencePreview(<div className="gallery-grid">{[...representative.values()].map(c=><div className="gallery-card" key={c.id}><BattleCard card={c} enabled/><small>{c.kind==='coin'?'동전':c.class==='neutral'?'중립':className[c.class]} · {c.id}</small></div>)}</div>);
const galleryCss=`.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:20px 14px;max-width:1450px;margin:auto;padding:18px 12px}.gallery-card{min-width:0;display:flex;flex-direction:column;align-items:center;gap:7px;color:#e6c99c;text-align:center}.gallery-card .battle-card{width:100%;max-width:172px;height:auto;aspect-ratio:5/8;flex:none;min-height:0}.gallery-card small{font-size:10px;overflow-wrap:anywhere}.gallery-section{max-width:1500px;margin:15px auto;border-bottom:1px solid #8f7555;padding:10px}.gallery-section>summary{font-weight:900;font-size:22px;cursor:pointer;color:#f2d8b2}.gallery-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:10px}.gallery-nav a{color:#f0d5a6;padding:6px 12px;background:#44301e;border:1px solid #ae8750;border-radius:5px;text-decoration:none}`;
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card Duel v0.36.0 — 인터페이스 미리보기</title><style>${css}\n${galleryCss}\n.preview-nav{position:sticky;top:0;z-index:30;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px;background:#1c1a20eb;border-bottom:1px solid #8f774e;color:#edd4a6;font-size:12px}.preview-nav a{color:#d8e9fa;border:1px solid #756552;padding:5px 9px;border-radius:6px;text-decoration:none}.preview-nav a:hover{background:#3a332c}.preview-scene{scroll-margin-top:50px;border-bottom:2px solid #75604b;padding:4px 0 20px}.preview-label{display:block;max-width:1650px;margin:auto;color:#f6d49a;text-align:center;padding:8px 3px 0;font-size:13px}</style></head><body><nav class="preview-nav" aria-label="미리보기 장면"><strong>자체 디자인 미리보기 (오프라인 가능 · 실제 게임 아님 · 확대 체험 가능)</strong><a href="#battle">전투</a><a href="#full-board">최대 전장</a><a href="#mulligan">멀리건</a><a href="#lobby">대전 메뉴</a><a href="#deck-workspace">덱 관리</a><a href="#deck">덱 편집</a><a href="#hover-card">확대 예시</a><a href="#art-gallery">카드 디자인</a></nav><p class="preview-label">자체 제작 일러스트 · 외부 이미지 요청 없음 · 모든 카드의 마나, 효과 및 능력치는 현재 Card Duel 데이터입니다.</p><section id="battle" class="preview-scene"><span class="preview-label">01 · 전투 화면</span>${arena}</section><section id="full-board" class="preview-scene"><span class="preview-label">02 · 최대 전장 (하수인 7개씩 · 손패 10장씩)</span>${fullArena}</section><section id="mulligan" class="preview-scene"><span class="preview-label">03 · 시작 카드 교체</span>${mull}</section><section id="lobby" class="preview-scene"><span class="preview-label">04 · 대전 준비</span>${lobby}</section><section id="deck-workspace" class="preview-scene"><span class="preview-label">05 · 덱 관리 메뉴 (4개 화면 전환 가능)</span>${workspace}</section><section id="deck" class="preview-scene"><span class="preview-label">05 · 덱 편집기 (기본/오리지널 탭 체험 가능)</span>${editor}</section><section id="hover-card" class="preview-scene"><span class="preview-label">06 · 1초 확대 카드 예시 (전장 능력치 포함)</span>${hoverExample}</section><section id="art-gallery" class="preview-scene"><span class="preview-label">07 · 자체 제작 일러스트 종류별 미리보기</span>${sampleCards}</section>${hoverTemplates}${hoverScript}</body></html>`;
writeFileSync('interface-preview.html',html,'utf8');console.log('Created interface-preview.html from current UI components.');
// Keep the battle-only preview small enough to download and open directly.
// Include only art and hover templates used in this specific public scene.
const quickCardIds=new Set([...arena.matchAll(/data-preview-card="([^"]+)"/g)].map(m=>m[1]));
const quickTemplates=referencePreview(<>{[...quickCardIds].map(id=><template key={id} data-preview-template={id}><CardHoverPanel preview={{item:{card:catalog[id]},side:'right'}}/></template>)}{[...example.players[0].board,...example.players[1].board].map(minion=><template key={minion.instanceId} data-preview-template={minion.instanceId}><CardHoverPanel preview={{item:{card:catalog[minion.cardId],minion},side:'right'}}/></template>)}</>);
const quickAssets=new Set([...(arena+quickTemplates).matchAll(/data-art-asset="([^"]+)"/g)].map(m=>m[1]));
const quickCss=css.replace(/\.painted-art\.art-([a-z-]+)\{background-image:url\("data:image\/webp;base64,[^"]+"\)\}/g,(rule,name:string)=>quickAssets.has(name)?rule:'');
const quickHtml=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card Duel v0.36.0 · 전투 미리보기</title><style>${quickCss}</style></head><body><p style="text-align:center;color:#eed2a2;margin:8px">전투 화면 미리보기 · 카드에 1초 올려 확대 · 실제 대전은 아닙니다</p>${arena}${quickTemplates}${hoverScript}</body></html>`;
writeFileSync('interface-quick.html',quickHtml,'utf8');
writeFileSync('dist/interface-layout.svg',renderBattlePoster(example,catalog),'utf8');
writeFileSync('dist/interface-hover.svg',renderBattlePoster(example,catalog,true),'utf8');
writeFileSync('dist/card-frame-comparison.svg',renderCardFrameComparison(catalog),'utf8');
writeFileSync('dist/duplicate-art-comparison.svg',renderDuplicateArtComparison(catalog),'utf8');
console.log(`Created interface-quick.html (${Math.round(Buffer.byteLength(quickHtml)/1024)} KB, ${quickAssets.size} paintings) and layout poster.`);
const allCards=sortCardsForDisplay(Object.values(catalog));
const groups=[...new Set(allCards.map(c=>c.cost))].map(cost=>({cost,key:'cost-'+cost,label:cost+'마나',groupCards:allCards.filter(c=>c.cost===cost)}));
const galleryMarkup=referencePreview(<main className="lobby-main"><h1>Card Duel 전체 카드 도감 · {allCards.length}종</h1><p>마나 비용 낮은 순 · 같은 비용은 이름순 · 전체 카드 또는 원하는 세트만 검색하세요.</p>
<div className="gallery-filter">
<label>카드 검색 <input id="gallery-search" type="search" placeholder="이름, 효과, 카드 ID"/></label>
<label>카드 세트 <select id="gallery-set" defaultValue="all"><option value="all">전체 카드 ({allCards.length}종)</option><option value="basic">기본 카드 ({allCards.filter(c=>cardSet(c)==='basic').length}종)</option><option value="original">오리지널 카드 ({allCards.filter(c=>cardSet(c)==='original').length}종)</option><option value="token">생성 카드 · 동전 ({allCards.filter(c=>cardSet(c)==='token').length}종)</option></select></label>
<label>직업 <select id="gallery-class" defaultValue="all"><option value="all">전체 직업</option><option value="neutral">공용 카드</option>{HERO_CLASSES.map(c=><option key={c} value={c}>{className[c]}</option>)}<option value="coin">동전</option></select></label>
<label>등급 <select id="gallery-rarity" defaultValue="all"><option value="all">전체 등급</option><option value="basic">기본</option><option value="common">일반</option><option value="rare">희귀</option><option value="epic">영웅</option><option value="legendary">전설</option><option value="token">생성 카드 · 동전</option></select></label>
<button type="button" id="gallery-reset" className="secondary">필터 초기화</button><output id="gallery-count" aria-live="polite">{allCards.length}종 표시</output></div>
<nav className="gallery-nav" aria-label="마나 비용 바로가기">{groups.map(g=><a href={'#'+g.key} key={g.key}>{g.label}</a>)}</nav>
{groups.map(g=><section key={g.key} id={g.key} className="gallery-section" data-cost-group={g.cost}><h2>{g.label} · <span data-gallery-group-count>{g.groupCards.length}</span>종</h2><div className="gallery-grid">{g.groupCards.map(c=><div className="gallery-card" key={c.id} data-gallery-cost={c.cost} data-gallery-set={cardSet(c)} data-gallery-class={c.kind==='coin'?'coin':c.class} data-gallery-rarity={cardSet(c)==='token'?'token':c.kind==='coin'?'token':c.rarity} data-gallery-search={`${c.id} ${c.name} ${displayCardName(c,true)} ${c.kind==='coin'?'':c.description??''}`.toLowerCase()}><BattleCard card={c} enabled/><small>{cardSetLabel(c)} · {c.kind==='coin'?'동전':c.class==='neutral'?'공용':className[c.class]} · {c.id}</small></div>)}</div></section>)}
</main>);
const galleryFilterCss=`.gallery-filter{position:sticky;top:0;z-index:20;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:16px;padding:14px;background:#28211e;border-bottom:1px solid #ae8750;color:#f6e1ba}.gallery-filter label{display:flex;align-items:center;gap:8px}.gallery-filter input,.gallery-filter select{min-width:150px;padding:7px;color:#f6e1ba;background:#382b22;border:1px solid #ae8750;border-radius:5px}.gallery-filter output{font-weight:700}.gallery-section[hidden],.gallery-card[hidden]{display:none!important}.gallery-section{scroll-margin-top:160px}`;
const galleryFilterScript=`<script>(()=>{const search=document.getElementById('gallery-search'),set=document.getElementById('gallery-set'),scope=document.getElementById('gallery-class'),rarity=document.getElementById('gallery-rarity'),reset=document.getElementById('gallery-reset'),count=document.getElementById('gallery-count'),groups=[...document.querySelectorAll('.gallery-section')];function update(){const q=search.value.trim().toLowerCase(),s=set.value,k=scope.value,r=rarity.value;let total=0;for(const group of groups){let visible=0;for(const card of group.querySelectorAll('.gallery-card')){const match=(s==='all'||card.dataset.gallerySet===s)&&(k==='all'||card.dataset.galleryClass===k)&&(r==='all'||card.dataset.galleryRarity===r)&&(!q||card.dataset.gallerySearch.includes(q));card.hidden=!match;if(match)visible++;}group.hidden=!visible;group.querySelector('[data-gallery-group-count]').textContent=String(visible);total+=visible;}count.textContent=total+'종 표시';}search.addEventListener('input',update);set.addEventListener('change',()=>{rarity.value='all';update();});scope.addEventListener('change',update);rarity.addEventListener('change',update);reset.addEventListener('click',()=>{search.value='';set.value=scope.value=rarity.value='all';update();});update();})();</script>`;
function checkOfflineMarkup(markup:string){
  assert.ok(!/<img\b|https?:\/\/art\.hearthstonejson/.test(markup),'no remote images in generated preview');
  const ids=[...markup.matchAll(/<(?:linearGradient|radialGradient|clipPath)[^>]* id="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,'SVG definitions are unique across static sections');
}
checkOfflineMarkup(html);checkOfflineMarkup(galleryMarkup);checkOfflineMarkup(quickHtml);
assert.equal((galleryMarkup.match(/class="battle-card /g)??[]).length,allCards.length,'every card occurs once in gallery');
assert.equal((galleryMarkup.match(/class="original-art"/g)??[]).length,allCards.length);
writeFileSync('card-gallery.html',`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Card Duel v0.36.0 카드 도감</title><style>${css}\n${galleryCss}\n${galleryFilterCss}</style></head><body>${galleryMarkup}${hoverTemplates}${hoverScript}${galleryFilterScript}</body></html>`,'utf8');
// All unique paintings are represented once in a compact offline contact sheet.
const cols=8,cellWidth=160,cellHeight=170;
const cells=PAINTED_ASSETS.map((name,i)=>{
 const x=(i%cols)*cellWidth+8,y=Math.floor(i/cols)*cellHeight+6;
 const data=readFileSync('apps/client/src/assets/illustrations/'+name+'.webp').toString('base64');
 return `<image width="144" height="144" x="${x}" y="${y}" href="data:image/webp;base64,${data}"/><text x="${x+72}" y="${y+158}" text-anchor="middle" fill="#ead9b8" font-family="sans-serif" font-size="11">${name}</text>`;
}).join('');
writeFileSync('dist/local-art-sheet.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${cols*cellWidth}" height="${Math.ceil(PAINTED_ASSETS.length/cols)*cellHeight}"><rect width="100%" height="100%" fill="#251f1b"/>${cells}</svg>`,'utf8');
console.log('Created card-gallery.html and the local art contact sheet.');
