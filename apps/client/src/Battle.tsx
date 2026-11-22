import { useContext, useEffect, useRef, useState } from 'react';
import type { DragEvent,PointerEvent,MouseEvent } from 'react';
import { BOT_DIFFICULTY_NAMES, cardChoiceReason, heroPowerReason, publicCardCost, publicCardReason, sameTarget } from '../../../packages/engine/src/index.ts';
import type { Action, PlayerId, Target } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import { catalog, catalogHash, className } from './data.ts';
import { formatBattleReport } from './battle-report.ts';
import { planAttack, planCard, planDrag, planPower, resolveDrop, selectHandCard, selectionCard, targetAction, targetsFor } from './battle-actions.ts';
import type { DragIntent, DragState, Intent, Selection } from './battle-actions.ts';
import { BattleCard, BattleMinion, CardInspector, DeckPile, HeroPortrait, HeroPower, HiddenHand, ManaDisplay, Secrets, Sigil, WeaponSlot } from './battle-pieces.tsx';
import type { Inspectable } from './battle-pieces.tsx';
import { ClassicNamesContext, displayCardName } from './card-names.ts';
import { fanSlot, deriveTableMotion } from './table-visuals.ts';
import type { TableMotion } from './table-visuals.ts';
import { TableDecor } from './table-decor.tsx';
import type { PlayerView } from '../../../packages/engine/src/index.ts';
import { HoverPreviewProvider } from './hover-preview.tsx';
import { useBattlePlayback } from './battle-playback.ts';
import type { PlaybackCue } from './battle-playback.ts';
import { BattleEffects } from './battle-fx.tsx';
import { battleSoundEnabled, setBattleSound } from './battle-sound.ts';
import {DECK_STYLE_LABELS} from './solo-settings.ts';
import {rankInfo} from '../../../packages/progression.ts';
import {intentFromSource,advanceGesture,touchDropLocations} from './touch-gesture.ts';
import type {TouchGesture,TouchHit} from './touch-gesture.ts';

type BattleProps={room:RoomView;send:(action:Action)=>void;leave:()=>void;connected:boolean;busy:boolean;onRematch?:()=>void;onPause?:()=>void;autoSaved?:boolean};
export function Battle(props:BattleProps){
  const playback=useBattlePlayback(props.room,props.connected);
  return <HoverPreviewProvider resetKey={`${props.room.code}:${props.room.state?.phase}:${props.connected}:${playback.playing}`} refreshKey={playback.room.state?.revision}><BattleView {...props} room={playback.room} busy={props.busy||playback.playing} cue={playback.cue} playing={playback.playing}/></HoverPreviewProvider>;
}
function BattleView({room,send,leave,onRematch,onPause,autoSaved,connected,busy,cue,playing}:BattleProps&{cue:PlaybackCue|null;playing:boolean}){
  const classicNames=useContext(ClassicNamesContext);
  const [selected,setSelected]=useState<Selection|null>(null);
  const [sound,setSound]=useState(battleSoundEnabled);
  const toggleSound=()=>{setBattleSound(!sound);setSound(!sound);};
  const [replace,setReplace]=useState<string[]>([]);
  const [position,setPosition]=useState<number|null>(null);
  const [inspected,setInspected]=useState<Inspectable|null>(null);
  const [drag,setDrag]=useState<DragState|null>(null),dragRef=useRef<DragState|null>(null);
  const touchRef=useRef<TouchGesture|null>(null),suppressClick=useRef(0);
  const [touchGhost,setTouchGhost]=useState<string|null>(null);
  const [reportMessage,setReportMessage]=useState(''),[roomCopied,setRoomCopied]=useState(false);
  const reportRef=useRef<HTMLTextAreaElement>(null);
  const arenaRef=useRef<HTMLDivElement>(null),aimRef=useRef<SVGLineElement>(null);
  const s=room.state,seat=room.seat,enemy:PlayerId=seat===0?1:0;
  const [secondsLeft,setSecondsLeft]=useState<number|null>(()=>room.turnDeadlineMs===undefined?null:Math.max(0,Math.ceil((room.turnDeadlineMs-Date.now())/1000)));
  useEffect(()=>{const deadline=room.turnDeadlineMs;if(deadline===undefined){setSecondsLeft(null);return;}const update=()=>setSecondsLeft(Math.max(0,Math.ceil((deadline-Date.now())/1000)));update();const tick=setInterval(update,250);return()=>clearInterval(tick);},[room.turnDeadlineMs]);
  const [reconnectLeft,setReconnectLeft]=useState<number|null>(null);
  useEffect(()=>{const deadline=room.opponentReconnectDeadlineMs;if(deadline===undefined){setReconnectLeft(null);return;}const update=()=>setReconnectLeft(Math.max(0,Math.ceil((deadline-Date.now())/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[room.opponentReconnectDeadlineMs]);
  const opponentReady=room.mode==='bot'||room.opponentConnected;
  const previousView=useRef<PlayerView|undefined>(undefined);
  const [motion,setMotion]=useState<TableMotion|null>(null);
  useEffect(()=>{if(!connected||!s){previousView.current=undefined;setMotion(null);return;}const next=deriveTableMotion(previousView.current,s,seat);previousView.current=s;setMotion(next);const timer=setTimeout(()=>setMotion(null),1000);return()=>clearTimeout(timer);},[s?.revision,connected,seat]);
  const visual=room.animationSpeed!=='instant'&&motion?.revision===s?.revision?motion:null;
  const active=!!s&&s.phase==='playing'&&!s.choicePending&&s.activePlayer===seat&&connected&&opponentReady&&!busy;
  const clearDrag=()=>{dragRef.current=null;touchRef.current=null;setDrag(null);setTouchGhost(null);};
  useEffect(()=>{setSelected(null);setInspected(null);clearDrag();},[s?.revision,connected,opponentReady]);
  useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);clearDrag();}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  const perform=(action:Action)=>{setSelected(null);clearDrag();send(action);};
  const copyRoom=async()=>{try{await navigator.clipboard.writeText(room.code);setRoomCopied(true);}catch{window.prompt('방 코드 복사',room.code);}};
  if(!s)return <section className="panel waiting waiting-arena"><span className="waiting-sigil"><Sigil kind="deck"/></span><p className="eyebrow">{room.ownedPvp?'ACCOUNT PVP':'PRIVATE MATCH'}</p><h2>{room.ownedPvp?'다른 유저를 기다리는 중':'친구를 기다리는 중'}</h2><strong className="room-code">{room.code}</strong><p>{room.ownedPvp?'상대가 참가하면 보유 카드 대전이 시작됩니다. 친구에게 계정 대전 코드를 공유할 수도 있습니다.':'친구에게 방 코드를 알려주세요. 참가하면 자동으로 대전이 시작됩니다.'}</p><div className="waiting-actions"><button onClick={copyRoom}>{roomCopied?'코드 복사됨':'방 코드 복사'}</button><button className="secondary" onClick={leave}>방 나가기</button></div></section>;
  const report=formatBattleReport(room,catalog,catalogHash);
  const copyReport=async()=>{try{await navigator.clipboard.writeText(report);setReportMessage('기록 복사 완료');}catch{reportRef.current?.focus();reportRef.current?.select();setReportMessage('기록을 선택했습니다. Ctrl+C를 누르세요.');}};
  const applyIntent=(intent:Intent|null)=>{if(!active||!intent)return;if(intent.action)perform(intent.action);else setSelected(intent.selection);};
  const boardPosition=Math.min(position??s.self.board.length,s.self.board.length);
  const currentDrag=active&&drag?.revision===s.revision?drag.intent:null;
  const dragPlan=currentDrag?planDrag(s,seat,catalog,currentDrag,boardPosition):null;
  const highlight=currentDrag?dragPlan?.selection??null:selected;
  const legalTargets=active?targetsFor(s,seat,catalog,highlight):[];
  const aimSource=highlight?.kind==='attack'?`minion:${highlight.id}`:highlight?.kind==='card'?`card:${highlight.id}`:highlight?.kind==='heroAttack'?'hero':highlight?.kind==='power'?'power':null;
  const aimVisible=!!aimSource&&legalTargets.length>0;
  const hideAim=()=>aimRef.current?.setAttribute('visibility','hidden');
  const pointAim=(x:number,y:number)=>{
    const arena=arenaRef.current,line=aimRef.current;if(!arena||!line||!aimVisible)return;
    const source=[...arena.querySelectorAll<HTMLElement>('[data-action-source]')].find(el=>el.dataset.actionSource===aimSource);if(!source){hideAim();return;}
    const bounds=arena.getBoundingClientRect(),from=source.getBoundingClientRect();
    if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom){hideAim();return;}
    line.setAttribute('x1',String(from.left+from.width/2-bounds.left));line.setAttribute('y1',String(from.top+from.height/2-bounds.top));line.setAttribute('x2',String(x-bounds.left));line.setAttribute('y2',String(y-bounds.top));line.setAttribute('visibility','visible');
  };
  const canTarget=(target:Target)=>legalTargets.some(t=>sameTarget(t,target));
  const canAttack=(id?:string)=>active&&!!planAttack(s,seat,catalog,id);
  const power=active?planPower(s,seat,catalog):null;
  const powerReason=heroPowerReason(s.self)??(active&&!power?'선택할 수 있는 대상이 없습니다.':undefined);
  const choiceCard=selected?.kind==='cardChoice'?selectionCard(s,catalog,selected):undefined;
  const selectedCard=selectionCard(s,catalog,highlight);
  const enemyLabel=room.mode==='bot'?'AI':'상대';
  const handReady=(id:string)=>active&&!!planCard(s,seat,catalog,id,boardPosition);
  const choose=(target:Target)=>{if(!active)return;const action=targetAction(s,seat,catalog,selected,target);if(action)perform(action);};
  const beginDrag=(event:DragEvent<HTMLButtonElement>,intent:DragIntent)=>{
    if(!active||!planDrag(s,seat,catalog,intent,boardPosition)){event.preventDefault();return;}
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','card-duel-action');
    const next={intent,revision:s.revision};dragRef.current=next;setDrag(next);setSelected(null);
  };
  const liveDrag=()=>active&&dragRef.current?.revision===s.revision?dragRef.current.intent:null;
  const dragTargetAction=(target:Target)=>active?resolveDrop(s,seat,catalog,dragRef.current,{kind:'target',target,position:boardPosition})?.action??null:null;
  const targetDropProps=(target:Target)=>({
    onDragOver:(e:DragEvent<HTMLButtonElement>)=>{if(dragTargetAction(target)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';}},
    onDrop:(e:DragEvent<HTMLButtonElement>)=>{const action=dragTargetAction(target);if(action){e.preventDefault();e.stopPropagation();perform(action);}},
  });
  const dropIntoBoard=(e:DragEvent<HTMLElement>,pos:number)=>{if(!active)return;const planned=resolveDrop(s,seat,catalog,dragRef.current,{kind:'board',position:pos});if(!planned)return;e.preventDefault();e.stopPropagation();clearDrag();applyIntent(planned);};
  const allowBoardDrop=(e:DragEvent<HTMLElement>)=>{const d=liveDrag();if(d?.kind==='card'&&planCard(s,seat,catalog,d.id,boardPosition)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';}};
  const spellFieldDrop=(e:DragEvent<HTMLElement>)=>{const d=liveDrag();if(d?.kind!=='card'||!(e.target instanceof Element)||e.target.closest('.own-hand,.hidden-hand'))return false;return catalog[s.self.hand.find(c=>c.instanceId===d.id)?.cardId??'']?.kind!=='minion';};
  const touchDown=(e:PointerEvent<HTMLDivElement>)=>{
    if(!active||e.pointerType==='mouse'||!e.isPrimary||!(e.target instanceof Element))return;
    const source=e.target.closest<HTMLElement>('[data-action-source]'),intent=intentFromSource(source?.dataset.actionSource);
    if(!intent||!planDrag(s,seat,catalog,intent,boardPosition))return;
    touchRef.current={pointerId:e.pointerId,originX:e.clientX,originY:e.clientY,drag:{intent,revision:s.revision},phase:'pending'};
  };
  const touchMove=(e:PointerEvent<HTMLDivElement>)=>{
    pointAim(e.clientX,e.clientY);
    const g=touchRef.current;if(!g||g.pointerId!==e.pointerId)return;
    const next=advanceGesture(g,e.clientX,e.clientY,s.revision);if(!next||!active){clearDrag();return;}touchRef.current=next;
    if(next.phase!=='dragging')return;
    if(g.phase!=='dragging'){
      try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
      setSelected(null);setDrag(next.drag);dragRef.current=next.drag;
      if(next.drag.intent.kind==='card')setTouchGhost(next.drag.intent.id);
    }
    e.currentTarget.style.setProperty('--touch-x',`${e.clientX}px`);e.currentTarget.style.setProperty('--touch-y',`${e.clientY}px`);
    e.preventDefault();
  };
  const touchUp=(e:PointerEvent<HTMLDivElement>)=>{
    const g=touchRef.current;if(!g||g.pointerId!==e.pointerId)return;
    touchRef.current=null;
    if(g.phase!=='dragging')return;
    suppressClick.current=Date.now()+250;
    try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
    const hit=document.elementFromPoint(e.clientX,e.clientY),slot=hit?.closest<HTMLElement>('[data-drop-position]');
    const description:TouchHit={minionId:hit?.closest<HTMLElement>('[data-preview-minion]')?.dataset.previewMinion,hero:hit?.closest('.hero-portrait')?(hit.closest('.enemy-hero-zone')?'enemy':'self'):undefined,slot:slot?Number(slot.dataset.dropPosition):undefined,ownBoard:!!hit?.closest('.friendly-board'),field:!!hit?.closest('.arena-field'),hand:!!hit?.closest('.own-hand,.hidden-hand')};
    const d=g.drag.intent,cardId=d.kind==='card'?s.self.hand.find(h=>h.instanceId===d.id)?.cardId:undefined;
    const fieldDrop=!!cardId&&catalog[cardId]?.kind!=='minion';
    let intent:Intent|null=null;
    if(active)for(const location of touchDropLocations(description,seat,boardPosition,fieldDrop)){intent=resolveDrop(s,seat,catalog,g.drag,location);if(intent)break;}
    clearDrag();if(intent)applyIntent(intent);e.preventDefault();
  };
  const stopTouch=(e:PointerEvent<HTMLDivElement>)=>{if(touchRef.current?.pointerId===e.pointerId){if(touchRef.current.phase==='dragging')suppressClick.current=Date.now()+250;clearDrag();}};
  const guardClick=(e:MouseEvent<HTMLDivElement>)=>{if(Date.now()<suppressClick.current){e.preventDefault();e.stopPropagation();}};
  const label=s.phase==='finished'?(s.winner===null?'무승부':s.winner===seat?'승리!':'패배'):s.phase==='mulligan'?'시작 카드 선택':s.activePlayer===seat?'내 턴':room.mode==='bot'?'AI 턴':'상대 턴';
  const result=s.winner===null?'무승부':s.winner===seat?'대전 승리':'대전 패배';
  const resultReason=s.reason==='fatigue'?'탈진':s.reason==='turnLimit'?'최대 턴 도달':s.reason==='concede'?'항복':'영웅 체력 소진';
  const pauseMessage=`상대 재접속 대기${reconnectLeft===null?'':` · ${Math.floor(reconnectLeft/60)}분 ${reconnectLeft%60}초`}`;
  const status=s.phase==='finished'?'대전 종료':!connected?'서버 재연결 대기':!opponentReady?pauseMessage:playing?'전투 연출 재생 중':busy?'행동 처리 중':s.choicePending?'덱 카드 선택 중':choiceCard?'카드 효과를 선택하세요.':highlight?.kind==='held'?'선택한 카드를 전장으로 끌어 놓으세요.':highlight?.kind==='attack'||highlight?.kind==='heroAttack'?'공격할 대상을 선택하세요.':highlight?'강조된 대상을 선택하세요.':currentDrag?.kind==='card'?'내 전장 또는 유효한 대상에 카드를 놓으세요.':active?'초록색으로 빛나는 카드와 하수인을 사용할 수 있습니다.':'상대방의 행동을 기다리는 중';
  const cardInspect=(item:Inspectable)=>setInspected(item);
  const ownHeroTarget:Target={kind:'hero',player:seat},enemyHeroTarget:Target={kind:'hero',player:enemy};
  const currentInspector=selectedCard?{card:selectedCard,cost:publicCardCost(s,seat,selectedCard,catalog,s.self.hand.find(c=>c.instanceId===(highlight?.kind==='held'||highlight?.kind==='card'||highlight?.kind==='cardChoice'?highlight.id:''))?.costDiscount)}:inspected;
  const tier=room.ranked??room.developerTest;
  const title=<div className="duel-title"><div><p className="eyebrow">{tier?`${room.developerTest?'개발자 시험 · ':''}${rankInfo(tier.rank).name} · 랭크 AI ${tier.intelligence}단계`:room.mode==='bot'?`AI 대전 · ${room.botDifficulty??3}단계 ${BOT_DIFFICULTY_NAMES[room.botDifficulty??3]}`:room.ownedPvp?'계정 PvP':`ROOM ${room.code}`} · TURN {s.turn}</p><h2>{label}</h2></div><div className="duel-toolbar"><span className={room.opponentConnected?'good':'warn'}>{room.mode==='bot'?(room.botEngine==='device'?'기기 AI':'서버 AI')+(tier?` · 덱 전력 ${tier.deckPower}`:room.botDeckStyle?' · '+DECK_STYLE_LABELS[room.botDeckStyle]:'')+(room.botTrainingGeneration?' · 학습 '+room.botTrainingGeneration+'세대':''):room.opponentConnected?'상대 연결됨':'상대 연결 끊김'}</span>{autoSaved!==undefined&&<small className={autoSaved?'good':'warn'}>{autoSaved?'자동 저장됨':'자동 저장 사용 불가'}</small>}{onPause&&s.phase!=='finished'&&<button className="secondary" disabled={busy} onClick={onPause}>저장 후 나가기</button>}<button className="secondary sound-toggle" aria-pressed={sound} onClick={toggleSound}>효과음 {sound?'켜짐':'꺼짐'}</button><button className="secondary" onClick={leave}>나가기</button></div></div>;
  if(s.phase==='mulligan')return <section className="battle duel-screen phase-mulligan">{title}<div className="mulligan-arena classic-mulligan"><TableDecor/><div className="mulligan-opponent"><HiddenHand count={s.opponent.handCount}/><HeroPortrait player={s.opponent} label={enemyLabel}/></div><div className="mulligan-heading"><span className="mulligan-order">{s.firstPlayer===seat?'선공':'후공'}</span><h3>첫 손패를 선택하세요</h3><p>{!opponentReady?pauseMessage:s.self.mulliganDone?'상대의 선택을 기다리는 중입니다.':'바꾸고 싶은 카드를 클릭한 후 확정하세요.'}</p></div><div className="mulligan-cards">{s.self.hand.map(c=><BattleCard key={c.instanceId} card={catalog[c.cardId]} mulligan selected={replace.includes(c.instanceId)} enabled={!s.self.mulliganDone&&connected&&opponentReady&&!busy} onClick={()=>setReplace(old=>old.includes(c.instanceId)?old.filter(x=>x!==c.instanceId):[...old,c.instanceId])}/>)}</div><button className="mulligan-confirm" disabled={s.self.mulliganDone||busy||!connected||!opponentReady} onClick={()=>perform({type:'mulligan',replace})}>확정 ({replace.length}장 교체)</button><div className="mulligan-self"><HeroPortrait player={s.self} label="나"/></div></div></section>;
  return <section data-animation-speed={room.animationSpeed??"normal"} className={`battle duel-screen phase-${s.phase}${active?' my-turn':''}${currentDrag?' is-dragging':''}${highlight?' has-selection':''}${playing?' is-playing-fx':''}${room.animation?.revision===s.revision?' has-fx-revision':''}`}>
    {title}
    <div className="arena-message" role="status"><span className={`turn-lamp${active?' live':''}`}/><span>{status}</span>{selected?.kind==='held'&&active&&<button type="button" className="mobile-card-use" onClick={()=>applyIntent(planCard(s,seat,catalog,selected.id,boardPosition))}>선택 카드 내기</button>}{selected&&<button className="secondary" onClick={()=>setSelected(null)}>선택 취소 <kbd>Esc</kbd></button>}</div>
    <div className="battle-arena classic-table" ref={arenaRef} onPointerDown={touchDown} onPointerMove={touchMove} onPointerUp={touchUp} onPointerCancel={stopTouch} onLostPointerCapture={stopTouch} onClickCapture={guardClick} onPointerLeave={hideAim} onDragOverCapture={e=>pointAim(e.clientX,e.clientY)} onContextMenu={e=>{if(selected||currentDrag){e.preventDefault();setSelected(null);clearDrag();}}}>
      {touchGhost&&<div className="touch-drag-ghost" aria-hidden="true"><BattleCard card={catalog[s.self.hand.find(h=>h.instanceId===touchGhost)?.cardId??'']??catalog.__coin}/></div>}
      <TableDecor/><BattleEffects cue={cue} arenaRef={arenaRef} catalog={catalog}/>{visual?.turn&&<div className={`turn-flash ${visual.turn}`} role="status">{visual.turn==='own'?'내 턴':'상대 턴'}</div>}
      {aimVisible&&<svg className={`aim-overlay${highlight?.kind==='attack'||highlight?.kind==='heroAttack'?' attack-aim':''}`} key={aimSource} aria-hidden="true"><defs><marker id="duel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="currentColor"/></marker></defs><line ref={aimRef} visibility="hidden" markerEnd="url(#duel-arrow)" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></svg>}
      <aside className="arena-left" aria-label="카드 상세와 전투 기록">
        <div className="rail-heading"><span>카드 상세</span><small>마우스 올리기</small></div><CardInspector item={currentInspector} catalog={catalog}/>
        <div className="rail-heading"><span>최근 행동</span><small>{s.history.length}/60</small></div>
        <div className="event-timeline">{s.history.slice(-7).reverse().map((entry,i)=><div className={`timeline-entry${entry.player===seat?' own':''}`} key={`${entry.turn}-${i}`}><span className="event-dot"/><div><small>{entry.player===seat?'나':enemyLabel} · 턴 {entry.turn}</small><p>{entry.message}</p></div></div>)}{!s.history.length&&<p>아직 행동이 없습니다.</p>}</div>
        <details className="arena-help"><summary>조작 방법</summary><p>카드는 클릭하면 선택되고 전장이나 유효한 대상에 끌어 놓으면 사용됩니다. 준비된 하수인과 영웅을 클릭하거나 적에게 끌어 공격합니다. 금색 슬롯은 하수인 배치 위치입니다.</p></details>
      </aside>
      <div className="arena-field" onDragOver={e=>{if(spellFieldDrop(e))allowBoardDrop(e);}} onDrop={e=>{if(spellFieldDrop(e))dropIntoBoard(e,boardPosition);}}>
        <HiddenHand count={s.opponent.handCount}/>
        <div className="hero-zone enemy-hero-zone">
          <WeaponSlot player={s.opponent} catalog={catalog}/><div className="hero-center"><Secrets count={s.opponent.secretCount}/><HeroPortrait delta={visual?.enemyHeroDelta} player={s.opponent} label={enemyLabel} targeted={canTarget(enemyHeroTarget)} enabled={canTarget(enemyHeroTarget)} onClick={()=>choose(enemyHeroTarget)} {...targetDropProps(enemyHeroTarget)}/></div><HeroPower player={s.opponent}/>
        </div>
        <div className="arena-board enemy-board" aria-label={`상대 전장 ${s.opponent.board.length}/7`}><span className="zone-caption">상대 전장 <b>{s.opponent.board.length}/7</b></span><div className="minion-row" data-board-count={s.opponent.board.length}>{s.opponent.board.map(m=>{const target:Target={kind:'minion',instanceId:m.instanceId};return <BattleMinion entering={visual?.summoned.has(m.instanceId)} delta={visual?.minionDelta.get(m.instanceId)} key={m.instanceId} card={catalog[m.cardId]} minion={m} catalog={catalog} ownTurn={s.activePlayer===enemy} enabled={canTarget(target)} targeted={canTarget(target)} onInspect={cardInspect} onClick={()=>choose(target)} {...targetDropProps(target)}/>;})}{!s.opponent.board.length&&<div className="empty-board">상대 하수인 없음</div>}</div></div>
        <div className="battle-divider"><span/><span className="divider-emblem"><Sigil kind="neutral"/></span><span/></div>
        <div className={`arena-board friendly-board${currentDrag?.kind==='card'?' drop-ready':''}`} aria-label={`내 전장 ${s.self.board.length}/7`} onDragOver={allowBoardDrop} onDrop={e=>dropIntoBoard(e,boardPosition)}><span className="zone-caption">내 전장 <b>{s.self.board.length}/7</b></span><div className="minion-row friendly-minions" data-board-count={s.self.board.length}>
          {Array.from({length:s.self.board.length+1},(_,i)=>{const m=s.self.board[i];const target:Target|undefined=m?{kind:'minion',instanceId:m.instanceId}:undefined;const attackReady=!!m&&canAttack(m.instanceId);const targetReady=!!target&&canTarget(target);const isSource=!!m&&highlight?.kind==='attack'&&highlight.id===m.instanceId;return <div className="board-segment" key={m?.instanceId??'last-gap'}><button type="button" className={`position-slot${boardPosition===i?' chosen':''}${currentDrag?.kind==='card'?' dropping':''}`} disabled={!active||s.self.board.length>=7} aria-label={`하수인 배치 위치 ${i+1}`} aria-pressed={boardPosition===i} title={`하수인을 ${i+1}번 위치에 배치`} onClick={()=>setPosition(i)} onDragOver={allowBoardDrop} onDrop={e=>dropIntoBoard(e,i)}><span>+</span></button>{m&&target&&<BattleMinion entering={visual?.summoned.has(m.instanceId)} delta={visual?.minionDelta.get(m.instanceId)} sourceId={`minion:${m.instanceId}`} card={catalog[m.cardId]} minion={m} catalog={catalog} ownTurn={s.activePlayer===seat} enabled={targetReady||attackReady&&(!highlight||highlight.kind==='attack'||highlight.kind==='heroAttack')} ready={attackReady&&!highlight&&!currentDrag} selected={isSource} targeted={targetReady} onInspect={cardInspect} onClick={()=>{if(targetReady)choose(target);else if(attackReady)setSelected(planAttack(s,seat,catalog,m.instanceId));}} onDragStart={attackReady?e=>beginDrag(e,{kind:'attack',id:m.instanceId}):undefined} onDragEnd={clearDrag} {...targetDropProps(target)}/>}</div>;})}{!s.self.board.length&&<div className="empty-board own-empty">{currentDrag?.kind==='card'?'여기에 카드를 놓으세요':'손패에서 하수인을 내보세요'}</div>}</div>
        </div>
        <div className="hero-zone self-hero-zone"><WeaponSlot player={s.self} catalog={catalog}/><div className="hero-center"><Secrets count={s.self.secretCount} names={s.self.secrets.map(c=>displayCardName(catalog[c.cardId],classicNames))} cards={s.self.secrets.map(c=>catalog[c.cardId])}/><HeroPortrait delta={visual?.ownHeroDelta} sourceId="hero" player={s.self} label="나" enabled={canTarget(ownHeroTarget)||canAttack()&&(!highlight||highlight.kind==='heroAttack')} ready={canAttack()&&!highlight&&!currentDrag} selected={highlight?.kind==='heroAttack'} targeted={canTarget(ownHeroTarget)} onClick={()=>{if(canTarget(ownHeroTarget))choose(ownHeroTarget);else if(canAttack())setSelected(planAttack(s,seat,catalog));}} onDragStart={canAttack()?e=>beginDrag(e,{kind:'heroAttack'}):undefined} onDragEnd={clearDrag} {...targetDropProps(ownHeroTarget)}/></div><HeroPower sourceId="power" player={s.self} enabled={!!power} ready={!!power&&!highlight&&!currentDrag} selected={highlight?.kind==='power'} reason={powerReason} onClick={()=>applyIntent(power)}/></div>
        <div className="own-hand"><div className="hand-heading"><span>내 손패 <b>{s.self.handCount}/10</b></span><span>{active?'선택 후 드래그':'상대 턴'}</span></div><div className="battle-hand" data-count={s.self.hand.length}>{s.self.hand.map((c,i)=>{const reason=active?publicCardReason(s,seat,c,catalog):undefined;const ready=handReady(c.instanceId);return <div className={`hand-card-slot ${fanSlot(i,s.self.hand.length)}${visual?.drawn.has(c.instanceId)?' card-drawn':''}`} key={c.instanceId}><BattleCard sourceId={`card:${c.instanceId}`} card={catalog[c.cardId]} cost={publicCardCost(s,seat,catalog[c.cardId],catalog,c.costDiscount)} reason={reason} enabled={ready} ready={ready&&!highlight&&!currentDrag} selected={(highlight?.kind==='held'||highlight?.kind==='card'||highlight?.kind==='cardChoice')&&highlight.id===c.instanceId||currentDrag?.kind==='card'&&currentDrag.id===c.instanceId} onClick={()=>setSelected(selectHandCard(s,seat,catalog,c.instanceId,selected))} onInspect={cardInspect} onDragStart={e=>beginDrag(e,{kind:'card',id:c.instanceId})} onDragEnd={clearDrag}/></div>;})}{!s.self.hand.length&&<div className="empty-hand">손패가 비어 있습니다.</div>}</div></div>
      </div>
      <aside className="arena-right" aria-label="마나, 덱, 턴 종료">
        <div className="resource-block opponent-resources"><span className="rail-heading">상대 자원</span><ManaDisplay player={s.opponent} compact/><DeckPile player={s.opponent} label="상대"/></div>
        <div className="turn-control"><small>TURN {s.turn}</small>{room.turnDeadlineMs!==undefined&&<b className="turn-countdown" data-urgent={secondsLeft!==null&&secondsLeft<=5}>남은 시간 {secondsLeft??0}초</b>}<button type="button" className={`end-turn${active?' your-turn':''}`} disabled={!active} onClick={()=>perform({type:'endTurn'})}>턴 종료</button><span>{active?'내 턴':s.phase==='finished'?'대전 종료':room.mode==='bot'?'AI 턴':'상대 턴'}</span></div>
        <div className="resource-block own-resources"><DeckPile player={s.self} label="내"/><span className="rail-heading">내 자원</span><ManaDisplay player={s.self}/>{s.self.nextSecretFree&&<small className="resource-buff">다음 비밀 무료</small>}{s.self.protectMinionsThisTurn&&<small className="resource-buff">하수인 피해 보호</small>}</div>
        {s.phase==='playing'&&<button type="button" className="secondary danger concede-button" disabled={!connected||busy} onClick={()=>{if(window.confirm('항복하시겠습니까?'))perform({type:'concede'});}}>항복</button>}
      </aside>
      {s.choicePending&&!playing&&<div className="battle-overlay choice-overlay"><div className="choice-window" role="group" aria-label="덱 카드 선택"><h3>{!opponentReady?pauseMessage:s.self.pendingChoice?'덱 위의 카드 중 한 장을 선택하세요':'상대가 카드를 선택하는 중입니다'}</h3>{s.self.pendingChoice&&<><p>한 장을 손패에 넣고 나머지는 버립니다.</p><div className="choice-cards">{s.self.pendingChoice.map(c=><BattleCard key={c.instanceId} card={catalog[c.cardId]} enabled={connected&&opponentReady&&!busy} onClick={()=>perform({type:'chooseDeckCard',instanceId:c.instanceId})}/>)}</div></>}</div></div>}
      {choiceCard&&(choiceCard.kind==='spell'||choiceCard.kind==='minion')&&selected?.kind==='cardChoice'&&<div className="battle-overlay choice-overlay"><div className="choice-window" role="group" aria-label="카드 효과 선택"><h3>{displayCardName(choiceCard,classicNames)} · 효과 선택</h3><div className="effect-choices">{choiceCard.choices?.map((option,i)=>{const reason=cardChoiceReason(s,seat,choiceCard,catalog,i);return <button type="button" key={i} disabled={!active||!!reason} title={reason} onClick={()=>applyIntent(planCard(s,seat,catalog,selected.id,selected.position,i))}>{option.label}{reason&&<small>{reason}</small>}</button>;})}</div><button className="secondary" onClick={()=>setSelected(null)}>취소</button></div></div>}
      {s.phase==='finished'&&!playing&&<div className="battle-overlay result-overlay"><div className={`result-window ${s.winner===seat?'victory':s.winner===null?'draw':'defeat'}`}><Sigil kind={s.winner===seat?'paladin':s.winner===null?'neutral':'shield'}/><h3>{result}</h3><p>{resultReason} · {s.turn}턴</p>{room.developerTest&&<p>개발자 시험 완료 · 계정 성장 및 전적 변경 없음</p>}{room.ranked&&<p>{room.ranked.reward==='saved'?'계정 XP·퀘스트 기록 저장 완료':room.ranked.reward==='notEligible'?'조기 항복은 XP 보상에 포함되지 않습니다.':'서버에서 랭크 대전 결과 저장 중…'}</p>}{room.ranked?.reward==='saved'&&room.ranked.rewardDetails&&<section className="ranked-reward" aria-label="대전 보상"><strong>+{room.ranked.rewardDetails.xp.toLocaleString('ko-KR')} XP</strong>{room.ranked.rewardDetails.questAdvanced&&<p>{room.ranked.rewardDetails.questCompleted?`직업 퀘스트 완료 · 보너스 +${room.ranked.rewardDetails.questBonusXp??0} XP 포함`:'직업 퀘스트 +1판'}</p>}{(room.ranked.rewardDetails.rankAfter??0)>room.ranked.rank&&<p>승급! {rankInfo(room.ranked.rewardDetails.rankAfter!).name}</p>}{!!room.ranked.rewardDetails.unlockedCards?.length&&<p>새 카드 {room.ranked.rewardDetails.unlockedCards.length}종 해금: {room.ranked.rewardDetails.unlockedCards.slice(0,4).map(id=>catalog[id]?.name??id).join(', ')}{room.ranked.rewardDetails.unlockedCards.length>4&&' 외'}</p>}</section>}{room.pvpReward&&<p>{room.pvpReward==='saved'?'계정 PvP 전적 저장 완료':'서버에서 유저 대전 결과 저장 중…'}</p>}{onRematch&&<button onClick={onRematch}>같은 상대와 재대전</button>}<button className="secondary" onClick={leave}>{room.mode==='bot'?'대전 준비로 돌아가기':'덱 편집으로 돌아가기'}</button></div></div>}
    </div>
    <div className="battle-utilities"><details className="battle-log"><summary>최근 전투 기록 ({s.history.length}/60)</summary>{s.history.slice().reverse().map((entry,i)=><div className="log-entry" key={`${entry.turn}-${i}`}><small>턴 {entry.turn} · {entry.player===seat?'나':'상대'}</small>　{entry.message}</div>)}</details><details className="battle-report"><summary>오류 신고용 전투 기록</summary><p>공개 정보만 기록합니다. 방 코드, 양쪽 손패의 카드 이름 및 미발동 비밀은 포함하지 않습니다.</p><textarea readOnly aria-label="오류 신고용 전투 기록" ref={reportRef} value={report}/><div className="controls"><button className="secondary" onClick={copyReport}>전투 기록 복사</button>{reportMessage&&<small role="status">{reportMessage}</small>}</div></details></div>
  </section>;
}
