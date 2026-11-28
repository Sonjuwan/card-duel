import {lethalPortraits,mulliganSlots} from '../src/battle-cinematics.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, Battle, DeckEditor, DeckWorkspace } from '../src/App.tsx';
import { BattleCard, BattleMinion, HeroPortrait, HeroPower, TargetPicker, PlacementPicker, targetRowText, CardInspector, HiddenHand, ManaDisplay, DeckPile } from '../src/battle-pieces.tsx';
import { catalog, loadPublicCatalog } from '../src/data.ts';
import { applyAction, createGame, getPlayerView, starterDeck } from '../../../packages/engine/src/index.ts';
import type { GameState, PlayerId } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import { REFERENCE_CARDS } from '../src/reference-art-data.ts';
import { ClassicNamesContext, displayCardName } from '../src/card-names.ts';
import { LocalCardArt, LocalHeroArt, LocalPowerArt, LocalVectorCardArt } from '../src/local-art.tsx';
import { TableDecor } from '../src/table-decor.tsx';
import { CardHoverPanel } from '../src/hover-preview.tsx';
import { cardArtRecipe, heroArtRecipe, powerArtRecipe } from '../src/local-art-model.ts';
import { HERO_CLASSES } from '../../../packages/engine/src/index.ts';
import {OfflineGrowthPanel} from '../src/OfflineGrowthPanel.tsx';
import {offlineGrowth,readOfflineGrowth} from '../src/offline-growth.ts';
import {SoloHistory} from '../src/Lobby.tsx';
import {DialogueCaptions,captionMode,filterCaptions,readCaptionMode,writeCaptionMode,unexpiredCaptions,nextCaptionDelay} from '../src/battle-dialogue-ui.tsx';
import {cardDialogue,heroEmote} from '../src/battle-dialogue.ts';
import {ImpactHistory} from '../src/battle-impact-history.tsx';
import type {SoloResult} from '../src/solo-settings.ts';

// Browser-independent React rendering checks. This covers runtime JSX and
// the shape of all major views without claiming real browser interaction.
const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
const raw=readFileSync(`data/cards/${active.file}`,'utf8');
loadPublicCatalog(JSON.parse(raw),createHash('sha256').update(raw).digest('hex'));
const noOp=()=>{};
const legalMageCount=Math.min(8,Object.values(catalog).filter(c=>c.kind!=='coin'&&c.class==='mage'&&c.collectible!==false).length);

test('deck builder renders the live deck count next to unabridged collection descriptions',()=>{
  const html=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/>);
  assert.match(html,/class="panel deck-panel deck-builder collection-workspace"/);
  assert.match(html,/내 덱 <span class="deck-live-count">2\/30<\/span>/);
  assert.equal((html.match(/class="card-copy"/g)??[]).length,legalMageCount);
});
test('deck editor labels add operations and starts with no transient message',()=>{const html=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/>);assert.doesNotMatch(html,/class="game-toast"/);assert.match(html,/aria-label="[^"]+덱에 추가"/);});
test('deck editor exposes card location and explicit removal without a detail dialog',()=>{const html=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/>);assert.equal((html.match(/class="deck-inspect-row"/g)??[]).length,1);assert.match(html,/카드 위치 보기/);assert.match(html,/aria-label="[^"]+ 한 장 제거"/);assert.doesNotMatch(html,/<dialog class="collection-detail-dialog"/);});
test('offline promotion panel exposes separate wins and XP progress and handles the maximum rank',()=>{const growth=offlineGrowth(catalog),profile=readOfflineGrowth(undefined,growth).profile;const panel=(p:typeof profile)=>renderToStaticMarkup(<OfflineGrowthPanel profile={p} growth={growth} deck={starterDeck(catalog,'warrior')} busy={false} ready onStart={noOp} onDeck={noOp}/>);const initial=panel(profile);assert.match(initial,/aria-label="승급 승리 진행률"/);assert.match(initial,/aria-label="승급 XP 진행률"/);assert.match(initial,/3승 남음/);const threshold=growth.ranks[1].minimumXp??0;assert.match(panel({...profile,xp:threshold,rankWins:growth.winsPerRank}),/다음 유효한 현재 랭크 승리에서 승급합니다/);const max=panel({...profile,rank:25});assert.match(max,/최고 랭크 달성/);assert.doesNotMatch(max,/aria-label="승급 승리 진행률"/);});
test('solo practice history shows filter controls, total matching records and ten rows per page',()=>{const history:SoloResult[]=Array.from({length:26},(_,i)=>({code:`LOCAL-${i}`,date:'2026-11-22T00:00:00Z',heroClass:'mage',opponent:'warrior',difficulty:3,result:'win',turns:7,generation:0,catalogHash:'previous'}));const html=renderToStaticMarkup(<SoloHistory history={history}/>);assert.match(html,/최근 26\/100경기/);assert.match(html,/전체 버전/);assert.match(html,/전체 결과/);assert.match(html,/페이지 1\/3/);assert.equal((html.match(/class="solo-history-entry"/g)??[]).length,10);assert.match(html,/disabled=""[^>]*>이전 기록/);assert.match(html,/>다음 기록/);});
test('offline save slot controls expose their current status, rank, and match summary to assistive technology',()=>{
  const html=renderToStaticMarkup(<App initialLobbyView="play" standalone/>);
  for(const slot of [1,2,3]){
    assert.match(html,new RegExp(`aria-describedby="slot-${slot}-state slot-${slot}-progress slot-${slot}-match"`));
    for(const suffix of ['state','progress','match'])assert.match(html,new RegExp(`id="slot-${slot}-${suffix}"`));
  }
  assert.match(html,/aria-pressed="true"[^>]*aria-describedby="slot-1-state/);
  assert.match(html,/id="slot-1-state">현재 선택<\/small>/);
});
const room=(state:GameState|null,seat:PlayerId=0):RoomView=>({code:'TEST23',seat,mode:'human',status:!state?'waiting':state.phase==='finished'?'finished':'playing',opponentConnected:true,state:state?getPlayerView(state,seat):null});
const render=(s:GameState|null,seat:PlayerId=0,connected=true)=>renderToStaticMarkup(<Battle room={room(s,seat)} send={noOp} leave={noOp} connected={connected} busy={false}/>);
test('combat outcome details display accessible names, portraits and exact public effects',()=>{
  assert.match(render(ready()),/class="impact-history"/);
  const markup=renderToStaticMarkup(<ImpactHistory catalog={catalog} entries={[{
    revision:4,turn:2,actor:'나',kind:'attack',
    source:{label:'붉은늪지랩터',cardId:'wolf'},
    target:{label:'상대 영웅',hero:'mage'},
    effects:[{label:'상대 영웅 · 방어도 −2',hero:'mage',armor:0}],
    lines:['상대 영웅 · 방어도 −2']
  }]}/>);
  assert.match(markup,/최근 전투 결과/);
  assert.match(markup,/class="impact-matchup"/);
  assert.equal((markup.match(/class="impact-portrait"/g)??[]).length,3);
  assert.match(markup,/방어도 −2/);
});
test('turn ownership stays correct while handling an action, choosing a card, or disconnected',()=>{const state=ready();const view={...room(state),mode:'bot' as const};const show=(v:RoomView,busy=false,connected=true)=>renderToStaticMarkup(<Battle room={v} send={noOp} leave={noOp} connected={connected} busy={busy}/>);const waiting=show(view,true);assert.match(waiting,/<span class="turn-owner">내 턴<\/span>/);assert.match(waiting,/행동 처리 중<\/span>/);assert.match(waiting,/class="end-turn" disabled=""/);assert.match(show(view,false,false),/<span class="turn-owner">내 턴<\/span>/);assert.match(show(view,false,false),/연결 대기<\/span>/);const choice={...state,pendingChoice:{owner:0 as const,cards:[{cardId:'wolf',instanceId:'choose1'}]}};const choosing=show({...view,state:getPlayerView(choice,0)});assert.match(choosing,/<span class="turn-owner">내 턴<\/span>/);assert.match(choosing,/카드 선택 중<\/span>/);const enemy=show({...room(state,1),mode:'bot'});assert.match(enemy,/<span class="turn-owner">AI 턴<\/span>/);assert.match(enemy,/AI 턴<\/span>/);const done=show({...view,state:getPlayerView(applyAction(state,1,{type:'concede'}),0)});assert.match(done,/<span class="turn-owner">대전 종료<\/span>/);});
test('battle exposes a labelled keyboard-accessible effects volume control',()=>{const html=render(ready());assert.match(html,/aria-label="효과음 볼륨"/);assert.match(html,/type="range"/);assert.match(html,/aria-valuetext="100%"/);assert.match(html,/효과음 켜짐/);});
test('active hand exposes keyboard navigation hint without claiming controls on the enemy turn',()=>{
  const s=ready();assert.match(render(s),/방향키 이동/);assert.doesNotMatch(render(s,1),/방향키 이동/);
});
test('battle keeps quick mute accessible while compacting all detailed audio controls into settings',()=>{
  const html=render(ready()),start=html.indexOf('<details class="dialogue-settings">'),end=html.indexOf('</details>',start);assert.ok(start>=0&&end>start);const settings=html.slice(start,end),outside=html.slice(0,start)+html.slice(end);
  assert.match(settings,/aria-label="효과음 볼륨"/);assert.match(settings,/대사 음성 켜짐/);assert.match(settings,/aria-label="대사 볼륨"/);assert.match(settings,/aria-label="전투 연출 품질"/);
  assert.match(outside,/class="secondary sound-toggle"/);assert.doesNotMatch(outside,/aria-label="효과음 볼륨"|대사 음성 켜짐/);
});
test('static card details expose printed ability chips but live silenced cards show only current statuses',()=>{const card=Object.values(catalog).find(c=>c.kind==='minion'&&c.keywords?.includes('taunt'))!;if(card.kind!=='minion')throw Error('Missing taunt');const printed=renderToStaticMarkup(<CardInspector item={{card}} catalog={catalog}/>);assert.match(printed,/aria-label="기본 능력"/);assert.match(printed,/<li>도발<\/li>/);assert.match(printed,/하수인 · (기본|일반|희귀|영웅|전설)/);const live=renderToStaticMarkup(<CardInspector item={{card,minion:{cardId:card.id,instanceId:'instance',attack:card.attack+1,health:card.health,maxHealth:card.health+2,attacksRemaining:0,silenced:true}}} catalog={catalog}/>);assert.match(live,/침묵 \(효과 제거\)/);assert.match(live,new RegExp(`기본 공격/체력 ${card.attack}/${card.health}`));assert.doesNotMatch(live,/aria-label="기본 능력"/);});
test('battle toolbar groups information, controls and live save status without hiding retry',()=>{const view:RoomView={...room(ready()),mode:'bot',botEngine:'device'};const html=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onPause={noOp} autoSaved={false} saveRetryable connected busy={false}/>);assert.match(html,/class="duel-toolbar" role="group" aria-label="대전 설정 및 저장"/);assert.match(html,/class="duel-indicators"/);assert.match(html,/role="status" aria-atomic="true" class="save-indicator warn"/);assert.match(html,/class="duel-actions"/);assert.match(html,/저장 재시도 후 나가기/);});
test('card details distinguish equipped weapon stats from their printed values without rendering a redundant landscape details drawer',()=>{const weapon=Object.values(catalog).find(c=>c.kind==='weapon')!;if(weapon.kind!=='weapon')throw Error('Missing weapon');const html=renderToStaticMarkup(<CardInspector item={{card:weapon,weapon:{attack:weapon.attack+2,durability:1}}} catalog={catalog}/>);assert.match(html,new RegExp(`공격 <b>${weapon.attack+2}</b>`));assert.match(html,/내구 <b>1<\/b>/);assert.match(html,/현재 장착 중/);assert.doesNotMatch(render(ready()),/landscape-card-detail|selected-card-use/);});
function create(){return createGame(catalog,[starterDeck(catalog,'warrior'),starterDeck(catalog,'mage')],{seed:104,firstPlayer:0});}
function ready(){let s=create();s=applyAction(s,0,{type:'mulligan',replace:[]});return applyAction(s,1,{type:'mulligan',replace:[]});}
test('placement picker renders a labelled native select with exact ordered gaps and selected position',()=>{
  const s=ready();s.players[0].mana=10;s.players[0].hand=[{cardId:'wisp',instanceId:'held'}];s.players[0].board=[{cardId:'wolf',instanceId:'a',attack:3,health:2,maxHealth:2,attacksRemaining:1,keywords:[]},{cardId:'wolf',instanceId:'b',attack:3,health:1,maxHealth:2,attacksRemaining:1,keywords:[]}];
  const view=getPlayerView(s,0),html=renderToStaticMarkup(<PlacementPicker view={view} seat={0} catalog={catalog} selection={{kind:'held',id:'held'}} position={1} onChoose={noOp}/>);
  assert.match(html,/배치 2\/3/);assert.match(html,/aria-label="하수인 배치 위치 선택"/);assert.match(html,/<option value="0">1번 · 왼쪽 끝/);assert.match(html,/<option value="1" selected="">2번 · .+ 사이/);assert.match(html,/<option value="2">3번 · 오른쪽 끝/);
  assert.equal(renderToStaticMarkup(<PlacementPicker view={view} seat={0} catalog={catalog} selection={null} position={1} onChoose={noOp}/>),'');
});
test('optional target picker distinguishes public duplicate minions and omits other board units',()=>{
  const s=ready();s.players[1].board=[{cardId:'wolf',instanceId:'a',attack:3,health:2,maxHealth:2,attacksRemaining:1,keywords:[]},{cardId:'wolf',instanceId:'b',attack:3,health:1,maxHealth:2,attacksRemaining:1,keywords:[]},{cardId:'night_cat',instanceId:'hidden-pick',attack:1,health:1,maxHealth:1,attacksRemaining:1,keywords:['stealth']}];
  const view=getPlayerView(s,0),html=renderToStaticMarkup(<TargetPicker view={view} seat={0} targets={[{kind:'hero',player:0},{kind:'minion',instanceId:'a'},{kind:'minion',instanceId:'b'}]} catalog={catalog} onChoose={noOp}/>);
  assert.match(html,/대상 목록 3/);assert.match(html,/전장 1번/);assert.match(html,/전장 2번/);assert.doesNotMatch(html,/hidden-pick|전장 3번/);assert.equal((html.match(/class="target-picker-row/g)??[]).length,3);
  assert.equal(renderToStaticMarkup(<TargetPicker view={view} seat={0} targets={[]} catalog={catalog} onChoose={noOp}/>),'');
  const target={target:{kind:'minion' as const,instanceId:'b'},kind:'minion' as const,side:'enemy' as const,cardId:'wolf',attack:3,health:1,position:1};
  assert.match(targetRowText(target,catalog,false).compact,/상대 .+ \(2번\)/);assert.equal(targetRowText(target,catalog,false).detail,'전장 2번 · 3/1');
});
test('selected attack and targeted power expose a cancelable pressed state; actual targets are described as targets',()=>{
  const minion={cardId:'wolf',instanceId:'toggle-m',attack:3,health:2,maxHealth:2,attacksRemaining:1,keywords:[]};
  const props={card:catalog.wolf,minion,catalog,ownTurn:true,enabled:true};
  const selected=renderToStaticMarkup(<BattleMinion {...props} selected sourceId="minion:toggle-m"/>);assert.match(selected,/aria-pressed="true"/);assert.match(selected,/다시 누르면 취소/);
  const target=renderToStaticMarkup(<BattleMinion {...props} targeted dropTarget sourceId="minion:toggle-m"/>);assert.doesNotMatch(target,/aria-pressed/);assert.match(target,/선택 가능한 대상/);assert.match(target,/is-drop-target/);
  const player={...getPlayerView(ready(),0).self,heroClass:'mage' as const};
  const hero=renderToStaticMarkup(<HeroPortrait player={player} label="나" sourceId="hero" enabled selected/>);assert.match(hero,/aria-pressed="true"/);
  const power=renderToStaticMarkup(<HeroPower player={player} sourceId="power" enabled selected/>);assert.match(power,/aria-pressed="true"/);assert.match(power,/다시 누르면 취소/);
  const immediate=renderToStaticMarkup(<HeroPower player={{...player,heroClass:'warrior'}} sourceId="power" enabled/>);assert.doesNotMatch(immediate,/aria-pressed/);
});
test('solo battle hides emote menu but preserves voice and independent caption slots',()=>{
  const view:RoomView={...room(ready()),mode:'bot',botEngine:'device'};
  const html=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} connected busy={false}/>);
  assert.match(html,/대사 음성 켜짐/);assert.doesNotMatch(html,/aria-label="직업 고유 감정표현"/);
  for(const label of ['인사','감사','칭찬','사과','놀람','도발'])assert.doesNotMatch(html,new RegExp('<b>'+label+'</b>'));
  assert.equal((html.match(/class="battle-dialogue-captions"/g)??[]).length,2);
  assert.match(html,/전투 진동 꺼짐/);assert.match(html,/이 기기는 진동 API 미지원/);assert.match(html,/진동 미리 체험/);
  assert.match(html,/aria-label="전투 연출 품질"/);assert.match(html,/절전 · 가벼운 효과/);assert.match(html,/풍부 · 화려한 효과/);
  assert.doesNotMatch(render(ready()),/aria-label="직업 고유 감정표현"/);
});
test('dialogue captions render real public card and hero art, but secret identity remains concealed',()=>{
  const card=cardDialogue(catalog.wisp,'mage',0,'play',1),hero=heroEmote('mage',0,'greet'),secret={...hero,kind:'play' as const,speaker:'비밀',text:'쉿...'};
  const captions=[card,hero,secret].map((l,key)=>({...l,key,expires:9999}));const html=renderToStaticMarkup(<DialogueCaptions captions={captions} side={0} hero="mage" catalog={catalog}/>);
  assert.equal((html.match(/class="dialogue-portrait"/g)??[]).length,3);assert.equal((html.match(/data-art-asset=/g)??[]).length,2);assert.match(html,/dialogue-portrait-placeholder">\?/);assert.doesNotMatch(html,/ice_block/);
});
test('dialogue settings preserve saved caption mode and independently filter visual captions',()=>{
  const hero=heroEmote('mage',0,'greet'),card=cardDialogue(catalog.wisp,'mage',0,'play',1),enemy=heroEmote('warrior',1,'greet');const captions=[hero,card,enemy].map((l,key)=>({...l,key,expires:9999}));
  assert.deepEqual(filterCaptions(captions,0,'all'),captions.slice(0,2));assert.deepEqual(filterCaptions(captions,0,'emotes'),[captions[0]]);assert.deepEqual(filterCaptions(captions,0,'off'),[]);assert.equal(captionMode('bad'),'all');
  const property=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
  try{assert.equal(readCaptionMode(),'all');writeCaptionMode('emotes');assert.equal(readCaptionMode(),'emotes');writeCaptionMode('off');assert.equal(readCaptionMode(),'off');const h=render(ready());assert.match(h,/대사 설정/);assert.match(h,/aria-label="대사 자막 표시"/);assert.match(h,/aria-label="대사 볼륨"/);assert.match(h,/내 영웅 음성 미리듣기/);assert.match(h,/value="off" selected=""/);}finally{if(property)Object.defineProperty(globalThis,'localStorage',property);else Reflect.deleteProperty(globalThis,'localStorage');}
  const html=renderToStaticMarkup(<DialogueCaptions captions={captions} side={0} hero="mage" catalog={catalog} mode="emotes"/>);assert.match(html,/line-emote/);assert.doesNotMatch(html,/line-play/);
  assert.doesNotMatch(renderToStaticMarkup(<DialogueCaptions captions={captions} side={0} hero="mage" catalog={catalog} mode="off"/>),/dialogue-portrait/);
});
test('caption expiry consolidates into the earliest timer and never drops newer lines',()=>{
  const now=1000,lines=[{key:1,expires:1100},{key:2,expires:1200},{key:3,expires:1100},{key:4,expires:1700}];
  assert.equal(nextCaptionDelay(lines,now),100);assert.deepEqual(unexpiredCaptions(lines,1100).map(c=>c.key),[2,4]);
  assert.equal(nextCaptionDelay(unexpiredCaptions(lines,1100),1100),100);
  assert.deepEqual(unexpiredCaptions(lines,1200).map(c=>c.key),[4]);
  assert.equal(nextCaptionDelay([],now),null);assert.equal(nextCaptionDelay([{expires:Infinity}],now),null);
  assert.equal(nextCaptionDelay([{expires:900}],now),1);
  const captions=[heroEmote('mage',0,'greet')].map((l,key)=>({...l,key,expires:1100}));
  assert.match(renderToStaticMarkup(<DialogueCaptions captions={captions} side={0} hero="mage" catalog={catalog}/>),/aria-relevant="additions"/);
});

test('lobby renders both play modes, nine class portraits, 25 difficulties and separate deck editor navigation',()=>{const html=renderToStaticMarkup(<App initialLobbyView="play"/>);assert.match(html,/AI 연습 대전/);assert.match(html,/친구와 1:1 대전/);assert.match(html,/5단계 · 전문가/);assert.match(html,/25단계 · 최강 · 학습형/);assert.match(html,/덱 편집하기/);assert.match(html,/382종/);assert.match(html,/연결 재시도/);assert.equal((html.match(/class="class-choice /g)??[]).length,9);assert.equal((html.match(/class="collection-item"/g)??[]).length,0);});
test('standalone starts in user mode and keeps unrestricted practice in developer mode',()=>{const player=renderToStaticMarkup(<App initialLobbyView="play" standalone/>),dev=renderToStaticMarkup(<App initialLobbyView="play" standalone initialOfflineMode="developer"/>);assert.match(player,/오프라인 솔로/);assert.match(player,/로컬 저장 슬롯/);assert.match(player,/슬롯 3/);assert.match(player,/솔로 랭크 · 유저 모드/);assert.doesNotMatch(player,/AI 대전 시작|개발자 랭크 시험 시작|실험 AI 시험 시작/);assert.match(dev,/25단계 · 최강/);assert.match(dev,/AI 대전 시작/);assert.match(dev,/개발자 랭크 시험 시작/);assert.match(dev,/실험 AI 시험 시작/);assert.match(dev,/AI 성능/);for(const html of [player,dev])assert.doesNotMatch(html,/연결 재시도|AI 실행 위치|친구와 1:1 대전|새 방 만들기/);});
test('offline ranked player panel displays starter ownership, XP, quest, ladder, unlock tracker and bounded collection',()=>{const growth=offlineGrowth(catalog),profile=readOfflineGrowth(undefined,growth).profile;const html=renderToStaticMarkup(<OfflineGrowthPanel profile={profile} growth={growth} deck={starterDeck(catalog,'warrior')} busy={false} ready onStart={noOp} onDeck={noOp} onBackup={noOp} onCombinedBackup={noOp} onRestore={noOp}/>);assert.match(html,/브론즈 5/);assert.match(html,/XP 0/);assert.match(html,/성장\+덱 통합 백업 다운로드/);assert.match(html,/미진행 슬롯에 성장 백업 복원/);assert.match(html,/직업 퀘스트: 전사 0\/10판/);assert.match(html,/솔로 랭크 대전 시작/);assert.match(html,/XP를 지급하지 않습니다/);assert.match(html,/퀘스트 직업 기본 덱/);assert.match(html,/25개 랭크 · 승급 조건/);assert.match(html,/다이아몬드 1/);assert.match(html,/25개 카드 전력 단계별 해금 현황/);assert.match(html,/다음 카드 XP 진행률/);assert.match(html,/솔로 카드 검색/);assert.match(html,/382종 · 페이지 1\/20/);assert.equal((html.match(/<tr[^>]*>/g)??[]).length,52);assert.match(html,/랭크 대전 기록 · 최근 30경기/);});
test('solo lobby and deck editor show all strategic options and result history',()=>{const html=renderToStaticMarkup(<App initialLobbyView="play" standalone initialOfflineMode="developer"/>);assert.match(html,/AI 덱 전략/);assert.match(html,/무작위 직업/);assert.match(html,/컨트롤/);assert.match(html,/내가 후공/);assert.match(html,/솔로 대전 기록/);const editor=renderToStaticMarkup(<DeckEditor deck={starterDeck(catalog,'mage')} setDeck={noOp} strategicPresets/>);assert.match(editor,/추천 덱 유형/);assert.match(editor,/전설 중심/);});
test('finished local match offers same-opponent rematch and return to lobby',()=>{let s=ready();s=applyAction(s,1,{type:'concede'});const view:RoomView={...room(s),mode:'bot',botEngine:'device',botDifficulty:20,botDeckStyle:'control'};const html=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onRematch={noOp} connected busy={false}/>);assert.match(html,/같은 상대와 재대전/);assert.match(html,/대전 준비로 돌아가기/);});
test('finished ranked result shows only a server-confirmed XP receipt',()=>{const s=applyAction(ready(),1,{type:'concede'});const pending:RoomView={...room(s),mode:'bot',ranked:{rank:1,deckPower:1,intelligence:1,reward:'pending'}};const html=(view:RoomView)=>renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} connected busy={false}/>);assert.match(html(pending),/저장 중/);assert.doesNotMatch(html(pending),/class="ranked-reward"/);const saved=html({...pending,ranked:{...pending.ranked!,reward:'saved',rewardDetails:{xp:140,questAdvanced:true,questCompleted:true,questBonusXp:110,unlockedCards:['wolf'],rankAfter:2}}});assert.match(saved,/\+140 XP/);assert.match(saved,/보너스 \+110 XP/);assert.match(saved,/승급! 브론즈 4/);assert.match(saved,/새 카드 1종 해금/);assert.doesNotMatch(html({...pending,ranked:{...pending.ranked!,reward:'notEligible'}}),/class="ranked-reward"/);});
test('local save controls appear only when available, including the mulligan screen',()=>{for(const state of [create(),ready()]){const view:RoomView={...room(state),mode:'bot',botEngine:'device'};const saved=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onPause={noOp} autoSaved connected busy={false}/>);assert.match(saved,/자동 저장됨/);assert.match(saved,/저장 후 나가기/);const unavailable=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} autoSaved={false} connected busy={false}/>);assert.match(unavailable,/자동 저장 사용 불가/);assert.doesNotMatch(unavailable,/저장 후 나가기/);}assert.doesNotMatch(render(ready()),/자동 저장|저장 후 나가기/);});
test('retryable save failures expose a non-destructive retry in play and after results',()=>{for(const state of [create(),ready(),applyAction(ready(),1,{type:'concede'})]){const view:RoomView={...room(state),mode:'bot',botEngine:'device'};const html=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onPause={noOp} autoSaved={false} saveRetryable connected busy={false}/>);assert.match(html,/저장 오류 · 재시도 가능/);assert.match(html,/저장 재시도 후 나가기/);}});
test('retry in place is visible only for a retryable save and disabled while busy',()=>{
  const view:RoomView={...room(ready()),mode:'bot',botEngine:'device'};const markup=(busy:boolean,saveRetryable:boolean)=>renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} onRetrySave={noOp} autoSaved={!saveRetryable} saveRetryable={saveRetryable} connected busy={busy}/>);
  const retryButton=/<button[^>]*class="secondary retry-save"[^>]*aria-label="저장 다시 시도"[^>]*>/;
  const available=markup(false,true).match(retryButton);
  const busy=markup(true,true).match(retryButton);
  assert.ok(available);
  assert.ok(busy);
  assert.doesNotMatch(available[0],/ disabled=""/);
  assert.match(busy[0],/ disabled=""/);
  assert.doesNotMatch(markup(false,false),retryButton);
});
test('save banner distinguishes pending work from last durable timestamp and confirmed save',()=>{
  const view:RoomView={...room(ready()),mode:'bot',botEngine:'device'},timestamp='2026-11-23T02:11:00.000Z';
  const markup=(pending:boolean,lastSavedAt:string)=>renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} autoSaved savePending={pending} lastSavedAt={lastSavedAt} connected busy={pending}/>);
  assert.match(markup(true,timestamp),/save-indicator warn">저장 확인 중…/);assert.match(markup(false,timestamp),/save-indicator good">자동 저장됨/);assert.match(markup(true,timestamp),/최근 저장 <time dateTime="2026-11-23T02:11:00.000Z">/);
  assert.doesNotMatch(markup(false,'invalid'),/class="last-saved-at"/);
});
test('deck editor renders a partial deck, eight-card spread, 182 legal cards and mana curve slots',()=>{const html=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/>);assert.match(html,/내 덱 <span class="deck-live-count">2\/30<\/span>/);assert.doesNotMatch(html,/2\/30장/);assert.match(html,/덱 마나 분포/);assert.match(html,/평균 마나 2.0/);assert.match(html,/빈칸 자동 채우기/);assert.match(html,/필터 초기화/);assert.match(html,/type="search" aria-label="카드 이름 또는 효과 검색"/);assert.match(html,/182\/182종/);assert.equal((html.match(/class="collection-item"/g)??[]).length,legalMageCount);assert.equal((html.match(/class="battle-card /g)??[]).length,legalMageCount);assert.equal((html.match(/class="book-edge secondary"/g)??[]).length,2);});
test('card book advertises keyboard geometry navigation and announces updated pages without activating cards',()=>{
  const html=renderToStaticMarkup(<DeckWorkspace deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialScreen="cards"/>);
  assert.match(html,/role="group" aria-label="카드책 펼침" aria-description="방향키로 카드 이동/);
  assert.match(html,/role="status" aria-live="polite" aria-atomic="true">전사/);
});
test('waiting room and mulligan states render independently',()=>{const waiting=render(null),mulligan=render(create());assert.match(waiting,/친구를 기다리는 중/);assert.match(waiting,/TEST23/);assert.match(mulligan,/시작 카드 선택/);assert.match(mulligan,/선공/);assert.match(mulligan,/확정/);});
test('battle view shows only own cards, both hero resources and visible readiness/blocked reasons',()=>{let s=ready();s.players[0].hand=[{cardId:'wisp',instanceId:'own0'},{cardId:'blade_burst',instanceId:'own1'}];s.players[1].hand=[{cardId:'flame_sphere',instanceId:'hidden-opponent-card'}];s.players[0].mana=10;s.players[0].maxMana=10;s.players[0].board=[{cardId:'wolf',instanceId:'friend',attack:3,health:2,maxHealth:2,attacksRemaining:1}];const html=render(s);assert.match(html,/내 턴/);assert.match(html,/공격 가능 1회/);assert.match(html,/장착한 무기가 없습니다/);assert.match(html,/class="battle-minion faction-neutral is-ready"/);assert.ok(!html.includes('hidden-opponent-card'));assert.ok(!html.includes(catalog.flame_sphere.name));assert.match(html,/마나 10\/10/);assert.match(html,/오류 신고용 전투 기록/);assert.match(html,/전투 기록 복사/);assert.equal((html.match(/class="card-back"/g)??[]).length,1);assert.equal((html.match(/class="battle-card /g)??[]).length,2);});
test('disconnected and finished battle views present distinct state messages',()=>{let s=ready();assert.match(render(s,0,false),/서버 재연결 대기/);s=applyAction(s,1,{type:'concede'});assert.match(render(s),/승리!/);assert.match(render(s,1),/패배/);assert.match(render(s),/덱 편집으로 돌아가기/);});
test('pending private choices render card names only to their owner',()=>{const s=ready();s.pendingChoice={owner:0,cards:[{cardId:'flame_sphere',instanceId:'private-pick'}]};s.players[0].hand=[];s.players[1].hand=[];const owner=render(s,0),enemy=render(s,1);assert.match(owner,/덱 위의 카드 중 한 장을 선택하세요/);assert.ok(owner.includes(displayCardName(catalog.flame_sphere,true)));assert.match(enemy,/상대가 카드를 선택하는 중입니다/);assert.ok(!enemy.includes(displayCardName(catalog.flame_sphere,true)));});
test('only the connected chooser sees modal semantics, inert background and a recovery exit',()=>{
  const s=ready();s.pendingChoice={owner:0,cards:[{cardId:'wolf',instanceId:'choice'}]};
  const markup=renderToStaticMarkup(<Battle room={room(s)} send={noOp} leave={noOp} onPause={noOp} connected busy={false}/>);
  assert.match(markup,/class="choice-window" role="dialog" aria-modal="true" tabindex="-1"/);
  assert.match(markup,/class="arena-field" inert=""/);assert.match(markup,/class="duel-title"[^>]* inert=""/);
  assert.match(markup,/class="battle-utilities"[^>]* inert=""/);
  assert.match(markup,/class="choice-window".*저장 후 나가기.*나가기/);
  for(const waiting of [render(s,1),render(s,0,false)]){assert.match(waiting,/class="choice-window" role="status"/);assert.doesNotMatch(waiting,/ inert=""/);}
});
test('battlefield order and full 7-by-7 board plus 10-by-10 hands at maximum occupancy render safely',()=>{const s=ready();for(const seat of [0,1] as const){s.players[seat].board=Array.from({length:7},(_,i)=>({cardId:'wolf',instanceId:`board-${seat}-${i}`,attack:3,health:2,maxHealth:2,attacksRemaining:1}));s.players[seat].hand=Array.from({length:10},(_,i)=>({cardId:seat===0?'wisp':'flame_sphere',instanceId:`hand-${seat}-${i}`}));}const h=render(s);assert.equal((h.match(/class="battle-minion /g)??[]).length,14);assert.equal((h.match(/class="battle-card /g)??[]).length,10);assert.equal((h.match(/class="card-back"/g)??[]).length,10);assert.equal((h.match(/class="hand-card-slot fan-/g)??[]).length,10);assert.equal((h.match(/class="opponent-card-slot fan-/g)??[]).length,10);assert.match(h,/class="table-decor"/);assert.match(h,/내 전장 7\/7/);assert.match(h,/상대 전장 7\/7/);assert.match(h,/data-count="10"/);assert.ok(h.indexOf('class="hidden-hand"')<h.indexOf('class="hero-zone enemy-hero-zone"'));assert.ok(h.indexOf('class="hero-zone enemy-hero-zone"')<h.indexOf('class="arena-board enemy-board"'));assert.ok(h.indexOf('class="arena-board friendly-board')<h.indexOf('class="own-hand"'));assert.ok(!h.includes('hand-1-'));assert.ok(!h.includes(catalog.flame_sphere.name));assert.equal((h.match(/class="position-slot[^\"]*" data-drop-position="\d+" disabled=""/g)??[]).length,8);});
test('board insertion DOM identifiers cover every exact gap without exposing enemy slots',()=>{const s=ready();s.players[0].board=Array.from({length:2},(_,i)=>({cardId:'wolf',instanceId:`gap-${i}`,attack:3,health:2,maxHealth:2,attacksRemaining:1}));const h=render(s);assert.deepEqual([...h.matchAll(/data-drop-position="(\d+)"/g)].map(m=>Number(m[1])),[0,1,2]);});
test('mana crystals represent full, used, locked and temporary mana separately',()=>{const p=getPlayerView(ready(),0).self;let h=renderToStaticMarkup(<ManaDisplay player={{...p,mana:2,maxMana:6,lockedMana:2,pendingOverload:3}}/>);assert.equal((h.match(/mana-crystal filled/g)??[]).length,2);assert.equal((h.match(/mana-crystal spent/g)??[]).length,2);assert.equal((h.match(/mana-crystal locked/g)??[]).length,2);assert.equal((h.match(/mana-crystal future/g)??[]).length,4);assert.match(h,/사용한 마나 2, 잠긴 마나 2, 다음 턴 과부하 3/);assert.match(h,/role="group"/);assert.match(h,/다음 과부하 3/);h=renderToStaticMarkup(<ManaDisplay player={{...p,mana:5,maxMana:6,lockedMana:2}}/>);assert.equal((h.match(/mana-crystal filled/g)??[]).length,5);assert.equal((h.match(/mana-crystal locked/g)??[]).length,2);});
test('portraits and resources render armor, weapon durability, private and public secret counts',()=>{const s=ready();s.players[0].health=17;s.players[0].armor=4;s.players[0].weapon={attack:3,durability:2};s.players[0].secrets=[{cardId:'arcane_barrier',instanceId:'owned-secret'}];const enemySecret=Object.values(catalog).find(c=>c.kind==='secret'&&c.id!=='arcane_barrier')!;s.players[1].secrets=[{cardId:enemySecret.id,instanceId:'secret-not-visible'}];const h=render(s);assert.match(h,/생명력 17, 방어도 4, 공격력 3/);assert.match(h,/내구도 2/);assert.match(h,/상대 비밀 1개/);assert.match(h,/내 비밀 1개/);assert.ok(h.includes(displayCardName(catalog.arcane_barrier,true)));assert.ok(!h.includes(displayCardName(enemySecret,true)));assert.ok(!h.includes('secret-not-visible'));});
test('minion statuses are identifiable by frame, label and inspection text',()=>{const m={cardId:'wolf',instanceId:'m',attack:5,health:1,maxHealth:2,attacksRemaining:1,keywords:['taunt','divineShield','stealth'] as const,frozenThroughTurn:12,silenced:true};const minion={...m,keywords:[...m.keywords]};const h=renderToStaticMarkup(<BattleMinion card={catalog.wolf} minion={minion} catalog={catalog} ownTurn={true}/>);for(const tag of ['has-taunt','has-shield','has-stealth','is-frozen','is-silenced','damaged','도발','천상의 보호막','빙결'])assert.ok(h.includes(tag),tag);const inspect=renderToStaticMarkup(<CardInspector item={{card:catalog.wolf,minion}} catalog={catalog}/>);assert.match(inspect,/침묵/);assert.match(inspect,/체력 <b>1<\/b>/);});
test('selected mulligan card shows a replacement badge and accessible pressed state',()=>{const h=renderToStaticMarkup(<BattleCard card={catalog.wolf} enabled={true} mulligan selected/>);assert.match(h,/aria-pressed="true"/);assert.match(h,/replace-banner/);assert.match(h,/교체/);assert.ok(!h.includes('<img'));});
test('opponent hand component renders only count and generic card-backs',()=>{const h=renderToStaticMarkup(<HiddenHand count={10}/>);assert.equal((h.match(/class="card-back"/g)??[]).length,10);assert.match(h,/상대 손패 10장/);assert.ok(!h.includes('card-name'));});
test('enemy turn and disconnected state disable draggable cards and end-turn button',()=>{let s=ready();s.players[0].hand=[{cardId:'wisp',instanceId:'card'}];const disconnected=render(s,0,false);assert.match(disconnected,/서버 재연결 대기/);assert.match(disconnected,/class="end-turn" disabled=""/);assert.ok(!disconnected.includes('draggable="true"'));s=applyAction(s,0,{type:'endTurn'});const enemy=render(s);assert.match(enemy,/상대 턴/);assert.match(enemy,/class="end-turn" disabled=""/);assert.ok(!enemy.includes('draggable="true"'));});
test('reconnect countdown stays readable but does not announce every second as live status',()=>{
  const view:RoomView={...room(ready()),opponentConnected:false,opponentReconnectDeadlineMs:Date.now()+90_000};
  const html=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} connected busy={false}/>);
  assert.match(html,/<span role="status" aria-live="polite">상대 재접속 대기 중<\/span>/);
  assert.match(html,/<small class="reconnect-countdown" aria-live="off"> · 남은 재접속 시간 1분 \d+초<\/small>/);
  assert.doesNotMatch(html,/<span role="status" aria-live="polite">[^<]*\d+초<\/span>/);
  const noCountdown=renderToStaticMarkup(<Battle room={view} send={noOp} leave={noOp} connected={false} busy={false}/>);
  assert.match(noCountdown,/<span role="status" aria-live="polite">서버 재연결 대기<\/span>/);
  assert.doesNotMatch(noCountdown,/class="reconnect-countdown"/);
});
test('classic names map all 382 historical cards and all tokens without changing rule ids',()=>{
 const deckCards=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);
 assert.equal(deckCards.length,382);assert.equal(new Set(deckCards.map(c=>REFERENCE_CARDS[c.id]?.artId)).size,382);
 for(const c of Object.values(catalog)){assert.ok(REFERENCE_CARDS[c.id],c.id);assert.match(displayCardName(c,true),/\S/);assert.equal(displayCardName(c,false),c.name);}
 assert.equal(displayCardName(catalog.flame_sphere,true),'화염구');
});
test('classic names are the default and retain the same self-contained illustration',()=>{
 const base=renderToStaticMarkup(<BattleCard card={catalog.flame_sphere} enabled/>);
 const marked=renderToStaticMarkup(<ClassicNamesContext.Provider value={true}><BattleCard card={catalog.flame_sphere} cost={1} enabled/></ClassicNamesContext.Provider>);
 for(const h of [base,marked]){assert.equal((h.match(/class="original-art"/g)??[]).length,1);assert.ok(!h.includes('<img'));assert.ok(!h.includes('https://'));assert.ok(!h.includes('reference-card-face'));}
 assert.match(marked,/화염구, 마나 1/);assert.ok(!marked.includes('화염 구체'));
 assert.match(base,/화염구/);
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
test('deck editor shows illustrated catalog cards and tile art only for the owned cards',()=>{
 const html=renderToStaticMarkup(<ClassicNamesContext.Provider value={true}><DeckEditor deck={{heroClass:'mage',cards:['wolf','wolf']}} setDeck={noOp}/></ClassicNamesContext.Provider>);
 assert.equal((html.match(/class="original-art"/g)??[]).length,legalMageCount+1);
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
test('deck builder has explicit set tabs with counts and each visible card has its copy-limit badge',()=>{
 const h=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp}/>);
 assert.match(h,/aria-label="카드 세트"/);assert.match(h,/aria-pressed="true">전체<small>182/);assert.match(h,/기본 카드<small>\d+/);assert.match(h,/클래식 카드<small>\d+/);assert.equal((h.match(/collection-copy-badge/g)??[]).length,legalMageCount);
});
test('deck builder basic and original initial views never display cards from the opposite set',()=>{
 const basic=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialSet="basic"/>);
 const original=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialSet="original"/>);
 assert.match(basic,/data-set-filter="basic" aria-pressed="true"/);assert.match(original,/data-set-filter="original" aria-pressed="true"/);
 const classBasic=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.class==='mage'&&c.collectible!==false&&c.rarity==='basic').length;
 assert.equal((basic.match(/class="battle-card [^"]*rarity-basic/g)??[]).length,Math.min(8,classBasic));assert.equal((original.match(/class="battle-card [^"]*rarity-basic/g)??[]).length,0);
 assert.doesNotMatch(basic,/option value="rare"/);assert.doesNotMatch(basic,/option value="epic"/);assert.match(original,/option value="epic"/);assert.doesNotMatch(original,/option value="basic"/);
});
test('deck builder renders visible cards in ascending mana order in each set',()=>{
 for(const initialSet of ['all','basic','original'] as const){
  const h=renderToStaticMarkup(<DeckEditor deck={{heroClass:'mage',cards:[]}} setDeck={noOp} initialSet={initialSet}/>);
  const costs=[...h.matchAll(/data-preview-cost="(\d+)"/g)].map(m=>Number(m[1]));
  assert.ok(costs.length>0&&costs.length<=legalMageCount);assert.deepEqual(costs,[...costs].sort((a,b)=>a-b));
 }
});
test('deck workspace separates class list, saved deck list, read-only catalogue and builder; book has two four-card leaves',()=>{
 const props={deck:{heroClass:'mage' as const,cards:['wolf']},setDeck:noOp};
 for(const screen of ['classes','saved','cards','build'] as const){
  const h=renderToStaticMarkup(<DeckWorkspace {...props} initialScreen={screen}/>);assert.match(h,new RegExp(`data-deck-screen="${screen}"`));
  assert.equal((h.match(/data-deck-screen=/g)??[]).length,1);assert.equal((h.match(/data-deck-nav=/g)??[]).length,4);
  if(screen==='cards'){assert.equal((h.match(/class="collection-item"/g)??[]).length,8);assert.match(h,/data-book-page="left"/);assert.match(h,/data-book-page="right"/);}
  if(screen==='cards'){assert.match(h,/전체<small>382<\/small>/);assert.doesNotMatch(h,/덱 저장/);assert.match(h,/<dialog class="collection-detail-dialog" aria-label="카드 확대 상세"/);}
  if(screen==='build'){assert.equal((h.match(/class="collection-item"/g)??[]).length,8);assert.match(h,/book-edge/);assert.doesNotMatch(h,/collection-continuous/);}
  if(screen==='saved'){assert.match(h,/저장한 덱이 없습니다/);assert.match(h,/저장 덱 백업 다운로드/);assert.match(h,/덱 백업 추가/);}
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
test('an old-card-version ranked save blocks a new ranked match but keeps backup available',()=>{const growth=offlineGrowth(catalog),profile=readOfflineGrowth(undefined,growth).profile;const html=renderToStaticMarkup(<OfflineGrowthPanel profile={profile} growth={growth} deck={starterDeck(catalog,'warrior')} busy={false} ready rankBlocked onStart={noOp} onDeck={noOp} onBackup={noOp}/>);assert.match(html,/이전 카드 버전의 진행 중인 랭크 경기가 있습니다/);assert.match(html,/<button[^>]*disabled[^>]*>솔로 랭크 대전 시작<\/button>/);assert.match(html,/<button[^>]*>성장 백업 다운로드<\/button>/);});


test('lethal portrait staging excludes surrender and restored results',()=>{
  const s=ready();
  const before=getPlayerView(s,0);
  const finished=applyAction(s,1,{type:'concede'});
  const conceded=getPlayerView(finished,0);
  assert.deepEqual(lethalPortraits(before,conceded),{own:false,enemy:false});
  const fatal={...conceded,opponent:{...conceded.opponent,health:0}};
  assert.deepEqual(lethalPortraits(before,fatal),{own:false,enemy:true});
  assert.deepEqual(lethalPortraits(undefined,fatal),{own:false,enemy:false});
  const fragments=renderToStaticMarkup(<HeroPortrait player={fatal.opponent} label="상대" shatter/>);
  assert.equal((fragments.match(/class="hero-shard"/g)??[]).length,6);
});
test('mulligan staging maps authoritative replacement cards back to the original selected slots',()=>{
  const a={instanceId:'a',cardId:'wolf'}, b={instanceId:'b',cardId:'wisp'}, c={instanceId:'c',cardId:'wolf'};
  const incoming={instanceId:'d',cardId:'wisp'};
  assert.deepEqual(mulliganSlots([a,b,c],[a,c,incoming,{instanceId:'coin',cardId:'__coin'}],['b']),[
    {key:'a',card:a,swapping:false},{key:'b',card:incoming,swapping:true},{key:'c',card:c,swapping:false},
  ]);
});


test('static battle subtrees preserve card identity, hand count and independent SVG ids',()=>{
  const cards=renderToStaticMarkup(<><LocalCardArt card={catalog.wolf}/><LocalCardArt card={catalog.wisp}/></>);
  for(const card of [catalog.wolf,catalog.wisp])assert.ok(cards.includes(`data-art-seed="${cardArtRecipe(card).seed}"`));
  for(const count of [0,1,7,10]){
    const html=renderToStaticMarkup(<HiddenHand count={count}/>);
    assert.equal((html.match(/class="card-back"/g)??[]).length,count);
    assert.ok(html.includes(`상대 손패 ${count}장`));
  }
  const tables=renderToStaticMarkup(<><TableDecor/><TableDecor/></>);
  const ids=Array.from(tables.matchAll(/\sid="([^"]+)"/g),m=>m[1]);
  assert.equal(ids.length,10);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ids)assert.ok(tables.includes(`url(#${id})`));
});


test('scalar resource readouts preserve deck fatigue, mana flags and labels',()=>{
  const p=getPlayerView(ready(),0).self;
  const full=renderToStaticMarkup(<DeckPile player={{...p,deckCount:30,fatigue:0}} label="내"/>);
  const empty=renderToStaticMarkup(<DeckPile player={{...p,deckCount:0,fatigue:2}} label="내"/>);
  assert.match(full,/내 덱 30장/);assert.match(full,/local-card-back-art/);
  assert.match(empty,/내 덱 0장, 탈진 2/);assert.match(empty,/deck-pile empty/);assert.doesNotMatch(empty,/local-card-back-art/);
  const mana=renderToStaticMarkup(<ManaDisplay player={{...p,mana:2,maxMana:6,lockedMana:2,pendingOverload:3}} charging compact/>);
  assert.match(mana,/mana-display compact/);assert.match(mana,/data-charging="true"/);assert.match(mana,/마나 2\/6/);
  assert.match(mana,/다음 과부하 3/);
});
