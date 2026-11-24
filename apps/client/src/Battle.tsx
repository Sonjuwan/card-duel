import {heroShatterMs,lethalPortraits,mulliganSlots} from './battle-cinematics.ts';
import {chooseMusic} from './music.ts';
import {playCardPickup} from './battle-sound.ts';
import {battleSequence} from './battle-sequence.ts';
import type {BattleIntent} from './battle-intents.ts';
import {BattleIntentQueue,isBattleIntent,validateBattleIntent} from './battle-intents.ts';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent,PointerEvent,MouseEvent,KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BOT_DIFFICULTY_NAMES, cardChoiceReason, heroPowerReason, publicCardCost, publicCardReason, sameTarget } from '../../../packages/engine/src/index.ts';
import type { Action, PlayerId, Target } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import { catalog, catalogHash, className } from './data.ts';
import { formatBattleReport } from './battle-report.ts';
import { planAttack, planCard, planDrag, planPower, selectHandCard, selectionCard, repositionSelection, toggleActionSelection, keyboardTargetIndex, keyboardActionSource,keyboardReturnIndex,modalTabIndex,targetPickerRows, targetAction, targetsFor } from './battle-actions.ts';
import type { DragIntent, DragState, Intent, Selection } from './battle-actions.ts';
import { BattleCard, BattleMinion, CardInspector, DeckPile, HeroPortrait, HeroPower, HiddenHand, ManaDisplay, Secrets, Sigil, TargetPicker, PlacementPicker, targetRowText, WeaponSlot } from './battle-pieces.tsx';
import type { Inspectable } from './battle-pieces.tsx';
import { ClassicNamesContext, displayCardName, classicHistoryText } from './card-names.ts';
import { fanSlot, deriveTableMotion } from './table-visuals.ts';
import type { TableMotion } from './table-visuals.ts';
import { TableDecor } from './table-decor.tsx';
import type { PlayerView } from '../../../packages/engine/src/index.ts';
import { HoverPreviewProvider } from './hover-preview.tsx';
import { useBattlePlayback,freshAcceptedAnimation } from './battle-playback.ts';
import type { PlaybackCue } from './battle-playback.ts';
import { BattleEffects } from './battle-fx.tsx';
import { battleSoundEnabled, subscribeBattleSound, setBattleSound, resultSoundTransition,playBattleResultSound,playBattleSound,playBattleDepartureSound,stopBattleSound,playCinematicSound } from './battle-sound.ts';
import type {ResultSoundState} from './battle-sound.ts';
import {animationTheme,impactChanges,impactFeedback,departureSoundKind} from './battle-fx-model.ts';
import {DECK_STYLE_LABELS} from './solo-settings.ts';
import {rankInfo} from '../../../packages/progression.ts';
import {intentFromSource,advanceGesture,finishGesture,interruptTouch,isCaptureHandoff,canPanBoard,boardEdgePanDelta,nearestVisibleBoardSlot,nearestTouchTarget,pointerDrop,dropFeedbackText} from './touch-gesture.ts';
import type {TouchGesture,TouchHit,DropFeedback} from './touch-gesture.ts';
import {useBattleDialogue,DialogueCaptions,DialogueSettings,readCaptionMode,writeCaptionMode} from './battle-dialogue-ui.tsx';
import type {CaptionMode} from './battle-dialogue-ui.tsx';
import {stopDialogueVoice} from './dialogue-voice.ts';
import {playBattleHaptic,stopBattleHaptics} from './battle-haptics.ts';
import {ImpactHistory,ImpactRail,useImpactHistory} from './battle-impact-history.tsx';
import {independentActivation} from './hover-timing.ts';
import {secondsUntilDeadline,watchDeadlineSeconds} from './battle-clock.ts';
import {landscapeHandPreviewShift,dismissPeekOnHandFocus} from './landscape-hand-preview.ts';

type BattleProps={room:RoomView;send:(action:Action)=>void;leave:()=>void;connected:boolean;busy:boolean;intentEpoch?:number;onRematch?:()=>void;onPause?:()=>void;onRetrySave?:()=>void;autoSaved?:boolean;saveRetryable?:boolean;savePending?:boolean;lastSavedAt?:string;compactUi?:boolean};
export function Battle(props:BattleProps){
  const playback=useBattlePlayback(props.room,props.connected);
  const queue=useRef(new BattleIntentQueue()).current;
  const [pending,setPending]=useState(0),[intentNotice,setIntentNotice]=useState('');
  const current=props.room.state;
  const context=`${props.room.code}:${props.room.seat}:${current?.turn}:${props.intentEpoch??0}:${Boolean(props.saveRetryable)}`;
  const queueContext=useRef(context);
  const eligible=props.connected&&props.room.opponentConnected&&current?.phase==='playing'&&current.activePlayer===props.room.seat&&!current.choicePending;
  const visible=playback.room.state;
  const inputBlocked=!eligible||queue.full||queue.ending||props.busy&&!queue.inFlight;
  const cancelPending=()=>{
    queue.cancelPending();
    setPending(0);
    setIntentNotice('예약을 취소했습니다.');
  };
  useEffect(()=>{
    if(!eligible||queueContext.current!==context){
      queueContext.current=context;
      if(queue.pending.length)setIntentNotice('경기 상태가 바뀌어 남은 예약을 취소했습니다.');
      queue.clear();
      setPending(0);
      return;
    }
    if(props.busy)return;
    queue.acknowledge();
    if(playback.playing&&props.room.turnDeadlineMs===undefined)return;
    for(let action=queue.take();action;action=queue.take()){
      setPending(queue.pending.length);
      const reason=validateBattleIntent(current,props.room.seat,catalog,action);
      if(!reason){props.send(action);return;}
      queue.acknowledge();
      setIntentNotice(`예약 취소 · ${reason}`);
    }
  },[context,current,eligible,pending,props.room.turnDeadlineMs,playback.playing,props.busy,props.send,props.room.seat,queue]);
  const submit=(action:Action)=>{
    if(!isBattleIntent(action)){
      if(props.busy||playback.playing)return;
      if(queue.pending.length)cancelPending();
      props.send(action);
      return;
    }
    // Only offer actions the player could select from the current visual frame.
    if(inputBlocked||!visible||validateBattleIntent(visible,props.room.seat,catalog,action))return;
    if(!queue.offer(action)){setIntentNotice('이미 예약했거나 예약 한도에 도달했습니다.');return;}
    setPending(queue.pending.length);
    setIntentNotice('');
  };
  return <HoverPreviewProvider resetKey={`${props.room.code}:${props.room.state?.phase}:${props.connected}`} refreshKey={visible?.revision}>
    <BattleView {...props} send={submit} room={playback.room} busy={props.busy||playback.playing||pending>0} inputBlocked={inputBlocked} pending={pending} reservations={queue.pending.slice()} deadline={props.room.turnDeadlineMs} intentNotice={intentNotice} cancelPending={cancelPending} cue={playback.cue} playing={playback.playing}/>
  </HoverPreviewProvider>;
}
function BattleView({room,send,leave,onRematch,onPause,onRetrySave,autoSaved,saveRetryable,savePending,lastSavedAt,compactUi=false,connected,busy,inputBlocked,pending,reservations,deadline,intentNotice,cancelPending,cue,playing}:BattleProps&{cue:PlaybackCue|null;playing:boolean;inputBlocked:boolean;pending:number;reservations:BattleIntent[];deadline?:number;intentNotice:string;cancelPending:()=>void}){
  const classicNames=useContext(ClassicNamesContext);
  const [selected,setSelected]=useState<Selection|null>(null);
  const [sound,setSound]=useState(battleSoundEnabled);
  useEffect(()=>subscribeBattleSound(()=>setSound(battleSoundEnabled())),[]);
  const [captionMode,setCaptionMode]=useState(readCaptionMode);
  const changeCaptionMode=(mode:CaptionMode)=>{writeCaptionMode(mode);setCaptionMode(mode);};
  const toggleSound=()=>{setBattleSound(!sound);setSound(!sound);if(sound)stopDialogueVoice();};
  const [replace,setReplace]=useState<string[]>([]);
  const [mulliganInspectId,setMulliganInspectId]=useState<string|null>(null);
  const [compactSettingsOpen,setCompactSettingsOpen]=useState(false);
  const [battleToolsOpen,setBattleToolsOpen]=useState(false);
  const toolsCloseRef=useRef<HTMLButtonElement>(null),toolsReturnRef=useRef<HTMLElement|null>(null);
  const openBattleTools=()=>{toolsReturnRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setBattleToolsOpen(true);};
  const closeBattleTools=()=>setBattleToolsOpen(false);
  const [position,setPosition]=useState<number|null>(null);
  const [inspected,setInspected]=useState<Inspectable|null>(null);
  // A non-actionable board minion still needs a tap-to-read path on a tiny
  // landscape field. Never convert an available attack/target tap to inspect.
  const [inspectedOverlay,setInspectedOverlay]=useState<Inspectable|null>(null);
  const inspectCloseRef=useRef<HTMLButtonElement>(null),inspectReturn=useRef<HTMLElement|null>(null);
  const inspectBoardMinion=(item:Inspectable)=>{
    // Inspection is read-only on any layout. Valid attack and target actions always take priority.
    inspectReturn.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setInspectedOverlay(item);
  };
  const closeBoardInspector=()=>{
    const returnTo=inspectReturn.current;
    inspectReturn.current=null;
    setInspectedOverlay(null);
    // React clears inert on the underlying field after the overlay unmounts.
    // Returning focus synchronously would target an inert card on mobile.
    requestAnimationFrame(()=>{if(returnTo?.isConnected)returnTo.focus();});
  };

  const [peekCardId,setPeekCardId]=useState<string|null>(null);
  const [drag,setDrag]=useState<DragState|null>(null),dragRef=useRef<DragState|null>(null);
  const touchRef=useRef<TouchGesture|null>(null),cancelledPointer=useRef<number|null>(null),suppressClick=useRef(0);
  const [touchGhost,setTouchGhost]=useState<string|null>(null);
  const [touchSlot,setTouchSlot]=useState<number|undefined>(undefined);
  const [dropTarget,setDropTarget]=useState<Target|undefined>(undefined);
  const edgePanRef=useRef<{frame:number;row:HTMLElement;drag:DragState;x:number;y:number;direction:number;started:number;last:number;refresh:()=>void}|null>(null);
  const [dropFeedback,setDropFeedback]=useState<DropFeedback|null>(null),[dropNotice,setDropNotice]=useState('');
  useEffect(()=>{if(!dropNotice)return;const timer=setTimeout(()=>setDropNotice(''),2200);return()=>clearTimeout(timer);},[dropNotice]);
  const [reportMessage,setReportMessage]=useState(''),[roomCopied,setRoomCopied]=useState(false);
  const reportRef=useRef<HTMLTextAreaElement>(null);
  const arenaRef=useRef<HTMLDivElement>(null),messageRef=useRef<HTMLDivElement>(null),aimRef=useRef<SVGLineElement>(null);
  const focusRequest=useRef<'held'|'card'|'cardChoice'|null>(null);
  const choiceRef=useRef<HTMLDivElement>(null),choiceReturn=useRef<string|null>(null);
  const resultRef=useRef<HTMLDivElement>(null);
  const actionFocus=useRef<{source:string|undefined;trigger:Element|null;code:string;revision:number}|null>(null);
  const s=room.state,seat=room.seat,enemy:PlayerId=seat===0?1:0;
  const [exchange,setExchange]=useState<{before:PlayerView;marked:string[]}|null>(null);
  const exchangeAccepted=!!exchange&&!!s?.self.mulliganDone;
  const [exchangeRevealed,setExchangeRevealed]=useState(false);
  useEffect(()=>{if(!exchange)return;const t=setTimeout(()=>setExchangeRevealed(true),430);return()=>{clearTimeout(t);setExchangeRevealed(false);};},[exchange]);
  const showExchangeFaces=exchangeAccepted&&exchangeRevealed;
  useEffect(()=>{
    if(!exchange)return;
    if(!exchangeAccepted){
      if((!busy&&exchangeRevealed)||!connected)setExchange(null);
      return;
    }
    if(!exchangeRevealed)return;
    const delay=850+exchange.marked.length*65;
    const timer=setTimeout(()=>setExchange(null),delay);
    return()=>clearTimeout(timer);
  },[exchange,exchangeAccepted,exchangeRevealed,busy,connected]);
  const previousCinematic=useRef<PlayerView|undefined>(undefined);
  const [shattered,setShattered]=useState({own:false,enemy:false});
  const [shattering,setShattering]=useState(false);
  useLayoutEffect(()=>{
    if(playing)return;
    const old=previousCinematic.current;
    previousCinematic.current=s??undefined;
    const defeated=lethalPortraits(old,s??undefined);
    if(!defeated.own&&!defeated.enemy)return;
    setShattered(defeated);
    if(room.animationSpeed==='instant'||window.matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden)return;
    setShattering(true);
    playCinematicSound('shatter');
    const timer=setTimeout(()=>setShattering(false),heroShatterMs);
    return()=>clearTimeout(timer);
  },[s?.phase,playing,room.animationSpeed]);
  const presentingResult=s?.phase==='finished'&&!playing&&!shattering;
  useEffect(()=>{
    if(presentingResult&&s)chooseMusic(s.winner===seat?'win':'loss',room.code);
  },[presentingResult,room.code,seat,s?.winner]);

  // Recompute only when the selected/inspected card or the viewport changes.
  // This fixes first/last-card previews under short and notch-cut landscapes
  // without moving the real click/drag target or changing the board layout.
  useLayoutEffect(()=>{
    const arena=arenaRef.current;if(!arena)return;
    let frame=0;
    const slots=()=>arena.querySelectorAll<HTMLElement>('.own-hand .hand-card-slot');
    const align=()=>{
      const board=arena.querySelector<HTMLElement>('.friendly-minions');
      const field=arena.querySelector<HTMLElement>('.arena-field');
      if(!board||!field)return;
      const ownBoard=board.closest('.friendly-board');
      const line=Math.max(board.getBoundingClientRect().bottom,ownBoard?.getBoundingClientRect().bottom??0)+4;
      const viewport=field.getBoundingClientRect();
      for(const slot of slots()){
        const originalTransform=slot.style.transform;
        slot.style.setProperty('transform','none','important');
        const box=slot.getBoundingClientRect();
        slot.style.transform=originalTransform;
        const card=slot.querySelector<HTMLElement>(':scope > .battle-card');
        if(!card||box.width<=0)continue;
        const height=Math.min(Math.max(105,box.height*1.7),Math.max(72,window.innerHeight-line-3),290);
        const width=height/1.55;
        const delta=landscapeHandPreviewShift(box.left,box.width,width,Math.max(0,viewport.left),Math.min(window.innerWidth,viewport.right),3);
        slot.style.setProperty('--hand-preview-width',`${width}px`);
        slot.style.setProperty('--hand-preview-x',`${(box.width-width)/2+delta}px`);
        slot.style.setProperty('--hand-preview-y',`${Math.max(line,box.top+box.height-height)-box.top}px`);
      }
    };
    const queue=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(align);};
    align();
    window.addEventListener('resize',queue);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(queue):null;
    if(observer)observer.observe(arena);
    return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',queue);
      for(const slot of slots())for(const prop of ['width','x','y'])slot.style.removeProperty(`--hand-preview-${prop}`);};
  },[exchange,selected,peekCardId,s?.revision,s?.self.hand.length]);
  useEffect(()=>setPeekCardId(null),[room.code,s?.revision]);
  useEffect(()=>setInspectedOverlay(null),[room.code,s?.revision]);
  useEffect(()=>{if(inspectedOverlay)inspectCloseRef.current?.focus();},[inspectedOverlay]);
  useEffect(()=>{
    if(battleToolsOpen){toolsCloseRef.current?.focus();return;}
    // React must first clear `inert` on the opening toolbar before it can
    // receive focus again, including iOS standalone PWA activation.
    const returnTo=toolsReturnRef.current;toolsReturnRef.current=null;
    if(returnTo?.isConnected){const frame=requestAnimationFrame(()=>{if(returnTo.isConnected)returnTo.focus();});return()=>cancelAnimationFrame(frame);}
  },[battleToolsOpen]);
  useEffect(()=>setBattleToolsOpen(false),[room.code,s?.phase]);
  const dialogue=useBattleDialogue(room,cue,connected,catalog,card=>displayCardName(card,classicNames));
  const impactHistory=useImpactHistory(room,connected,catalog,card=>displayCardName(card,classicNames));
  const previousResult=useRef<ResultSoundState|null>(null);
  useEffect(()=>{if(!connected||!s){previousResult.current=null;return;}if(!presentingResult&&s.phase==='finished')return;const current={code:room.code,seat,phase:s.phase,winner:s.winner},result=resultSoundTransition(previousResult.current,current);previousResult.current=current;if(result)playBattleResultSound(result);},[room.code,seat,s?.phase,s?.winner,presentingResult,connected]);
  const previousSoundRoom=useRef<RoomView|null>(null),lastInstantSound=useRef(-Infinity);
  useEffect(()=>{if(!connected||!s){previousSoundRoom.current=null;lastInstantSound.current=-Infinity;return;}const before=previousSoundRoom.current;previousSoundRoom.current=room;if(!before||before.code!==room.code){lastInstantSound.current=-Infinity;return;}if(room.animationSpeed!=='instant'||!before.state)return;const a=freshAcceptedAnimation(before,room),now=performance.now();if(!a)return;const impacts=impactChanges(before.state,s,seat,a.events),feedback=impactFeedback(a,impacts);playBattleHaptic(a,feedback,seat);if(s.phase==='finished'||now-lastInstantSound.current<300)return;lastInstantSound.current=now;const theme=animationTheme(a,a.cardId?catalog[a.cardId]:undefined,a.actor===seat?before.state.self.heroClass:before.state.opponent.heroClass);playBattleSound(a,theme,'impact',feedback);playBattleDepartureSound(departureSoundKind(impacts));},[room.code,seat,s?.revision,room.animationSpeed,connected]);
  useEffect(()=>()=>{stopBattleHaptics();stopBattleSound();stopDialogueVoice();},[room.code]);
  const [secondsLeft,setSecondsLeft]=useState<number|null>(()=>deadline===undefined?null:secondsUntilDeadline(deadline,Date.now()));
  useEffect(()=>watchDeadlineSeconds(deadline,setSecondsLeft,250),[deadline]);
  const [reconnectLeft,setReconnectLeft]=useState<number|null>(()=>room.opponentReconnectDeadlineMs===undefined?null:secondsUntilDeadline(room.opponentReconnectDeadlineMs,Date.now()));
  useEffect(()=>watchDeadlineSeconds(room.opponentReconnectDeadlineMs,setReconnectLeft,1000),[room.opponentReconnectDeadlineMs]);
  const opponentReady=room.mode==='bot'||room.opponentConnected;
  const previousView=useRef<PlayerView|undefined>(undefined);
  const [motion,setMotion]=useState<TableMotion|null>(null);
  useEffect(()=>{if(!connected||!s){previousView.current=undefined;setMotion(null);return;}const next=deriveTableMotion(previousView.current,s,seat);previousView.current=s;if(document.hidden){setMotion(null);return;}setMotion(next);const timer=setTimeout(()=>setMotion(null),1000);return()=>clearTimeout(timer);},[s?.revision,connected,seat]);
  const visual=room.animationSpeed!=='instant'&&motion?.revision===s?.revision&&(!room.animation||cue?.animation.revision===motion?.revision)?motion:null;
  const active=!!s&&s.phase==='playing'&&!s.choicePending&&s.activePlayer===seat&&connected&&opponentReady&&!inputBlocked;
  const ownChoiceOpen=!!s&&s.phase==='playing'&&!playing&&((!!s.choicePending&&!!s.self.pendingChoice?.length&&connected&&opponentReady)||(active&&selected?.kind==='cardChoice'));
  // End-of-match results are a genuine modal. The next/new game controls
  // receive focus when playback ends; Tab must not navigate the hidden arena.
  useEffect(()=>{
    if(!presentingResult)return;
    const dialog=resultRef.current;
    if(!dialog)return;
    (dialog.querySelector<HTMLElement>('button:not(:disabled)')??dialog).focus();
  },[presentingResult]);
  const resultKeys=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
    if(e.key!=='Tab'||e.altKey||e.ctrlKey||e.metaKey)return;
    const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([aria-disabled="true"])')];
    const next=modalTabIndex(buttons.indexOf(document.activeElement as HTMLButtonElement),buttons.length,e.shiftKey);
    e.preventDefault();e.stopPropagation();(buttons[next]??e.currentTarget).focus();
  };
  const choiceControls=()=>[...choiceRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([aria-disabled="true"])')??[]];
  useEffect(()=>{
    if(ownChoiceOpen){const dialog=choiceRef.current;if(!dialog)return;const controls=choiceControls();if(!controls.includes(document.activeElement as HTMLElement))(controls[0]??dialog).focus();return;}
    const returnId=choiceReturn.current;choiceReturn.current=null;if(returnId)[...arenaRef.current?.querySelectorAll<HTMLElement>('[data-action-source]')??[]].find(el=>el.dataset.actionSource===`card:${returnId}`)?.focus();
  },[ownChoiceOpen,busy]);
  const choiceKeys=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
    // The effect-choice dialog is outside the arena's keyboard capture zone.
    // Escape must use the normal cancellation path so its original hand card
    // regains focus; the window-level emergency reset cannot do that.
    if(e.key==='Escape'&&selected?.kind==='cardChoice'){e.preventDefault();e.stopPropagation();cancelCardChoice();return;}
    if(e.key!=='Tab'||e.altKey||e.ctrlKey||e.metaKey)return;
    const controls=choiceControls(),next=modalTabIndex(controls.indexOf(document.activeElement as HTMLElement),controls.length,e.shiftKey);
    e.preventDefault();e.stopPropagation();(controls[next]??choiceRef.current)?.focus();
  };
  // Mark a genuinely scrollable row before pointerdown. The browser can
  // then perform native horizontal panning while vertical attack drags work.
  useEffect(()=>{
    const rows=[...arenaRef.current?.querySelectorAll<HTMLElement>('.minion-row')??[]];if(!rows.length)return;
    const measure=()=>{for(const row of rows)row.dataset.scrollable=String(canPanBoard(getComputedStyle(row).overflowX,row.clientWidth,row.scrollWidth));};measure();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;for(const row of rows){observer?.observe(row);for(const segment of row.children)observer?.observe(segment);}
    window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
  },[room.code,s?.revision,s?.phase]);
  useEffect(()=>{
    const request=focusRequest.current;if(!request)return;focusRequest.current=null;
    if(!active||selected?.kind!==request)return;
    if(request==='held'){messageRef.current?.querySelector<HTMLElement>('.selected-card-use')?.focus();return;}
    const selector=request==='card'?'.is-targeted[aria-disabled="false"]':'.effect-choices button:not(:disabled)';
    arenaRef.current?.querySelector<HTMLElement>(selector)?.focus();
  },[active,selected]);
  useEffect(()=>{
    const pending=actionFocus.current;if(!pending)return;
    if(!s||s.phase==='finished'||pending.code!==room.code){actionFocus.current=null;return;}
    if(!active||s.revision<pending.revision)return;
    actionFocus.current=null;const focused=document.activeElement;
    // Do not steal focus from a user who navigated elsewhere during playback.
    if(focused&&focused!==document.body&&focused!==pending.trigger&&focused.isConnected)return;
    const available=[...arenaRef.current?.querySelectorAll<HTMLElement>('[data-action-source][aria-disabled="false"]')??[]],index=keyboardReturnIndex(pending.source,available.map(el=>el.dataset.actionSource??''));
    (available[index]??arenaRef.current?.querySelector<HTMLElement>('.end-turn:not(:disabled)'))?.focus();
  },[active,s?.revision,s?.phase,room.code]);
  useEffect(()=>{const cancel=()=>{actionFocus.current=null;};const tab=(e:KeyboardEvent)=>{if(e.key==='Tab')cancel();};window.addEventListener('pointerdown',cancel,true);window.addEventListener('keydown',tab,true);return()=>{window.removeEventListener('pointerdown',cancel,true);window.removeEventListener('keydown',tab,true);};},[]);
  const stopEdgePan=()=>{if(edgePanRef.current)cancelAnimationFrame(edgePanRef.current.frame);edgePanRef.current=null;};
  useEffect(()=>()=>stopEdgePan(),[]);
  const clearDrag=()=>{stopEdgePan();dragRef.current=null;touchRef.current=null;setDrag(null);setTouchGhost(null);setTouchSlot(undefined);setDropTarget(undefined);setDropFeedback(null);aimRef.current?.setAttribute('visibility','hidden');};
  const cancelActiveTouch=()=>{const interrupted=touchRef.current,guard=interruptTouch(interrupted,cancelledPointer.current,suppressClick.current,Date.now());cancelledPointer.current=guard.cancelledPointer;suppressClick.current=guard.suppressUntil;clearDrag();if(interrupted&&arenaRef.current?.hasPointerCapture(interrupted.pointerId)){try{arenaRef.current.releasePointerCapture(interrupted.pointerId);}catch{}}};
  const cancelCardChoice=()=>{if(selected?.kind==='cardChoice')choiceReturn.current=selected.id;setSelected(null);cancelActiveTouch();};
  useEffect(()=>{
    const interrupt=()=>{actionFocus.current=null;cancelActiveTouch();setSelected(null);setInspected(null);setDropNotice('');};
    const hide=()=>{interrupt();stopBattleSound();stopDialogueVoice();stopBattleHaptics();setMotion(null);};
    const changed=()=>{if(document.hidden)hide();};
    document.addEventListener('visibilitychange',changed);window.addEventListener('blur',interrupt);window.addEventListener('pagehide',hide);
    return()=>{document.removeEventListener('visibilitychange',changed);window.removeEventListener('blur',interrupt);window.removeEventListener('pagehide',hide);};
  },[]);
  useEffect(()=>{setSelected(null);setInspected(null);setPosition(null);cancelActiveTouch();setDropNotice('');},[s?.revision,connected,opponentReady]);
  // Busy/playback may change without a new revision. Do not leave a ghost,
  // pointer capture or queued board edge-pan alive across input locking.
  useEffect(()=>{if(!active){setSelected(null);cancelActiveTouch();}},[active]);
  useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);cancelActiveTouch();}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  const perform=(action:Action,keyboard=false)=>{actionFocus.current=keyboard&&s?{source:keyboardActionSource(action),trigger:document.activeElement,code:room.code,revision:s.revision}:null;setSelected(null);clearDrag();send(action);};
  const copyRoom=async()=>{try{await navigator.clipboard.writeText(room.code);setRoomCopied(true);}catch{window.prompt('방 코드 복사',room.code);}};
  if(!s)return <section className="panel waiting waiting-arena"><span className="waiting-sigil"><Sigil kind="deck"/></span><p className="eyebrow">{room.ownedPvp?'ACCOUNT PVP':'PRIVATE MATCH'}</p><h2>{room.ownedPvp?'다른 유저를 기다리는 중':'친구를 기다리는 중'}</h2><strong className="room-code">{room.code}</strong><p>{room.ownedPvp?'상대가 참가하면 보유 카드 대전이 시작됩니다. 친구에게 계정 대전 코드를 공유할 수도 있습니다.':'친구에게 방 코드를 알려주세요. 참가하면 자동으로 대전이 시작됩니다.'}</p><div className="waiting-actions"><button onClick={copyRoom}>{roomCopied?'코드 복사됨':'방 코드 복사'}</button><button className="secondary" onClick={leave}>방 나가기</button></div></section>;
  const report=formatBattleReport(room,catalog,catalogHash);
  const copyReport=async()=>{try{await navigator.clipboard.writeText(report);setReportMessage('기록 복사 완료');}catch{reportRef.current?.focus();reportRef.current?.select();setReportMessage('기록을 선택했습니다. Ctrl+C를 누르세요.');}};
  const applyIntent=(intent:Intent|null,keyboard=false)=>{if(!active||!intent)return;if(intent.action)perform(intent.action,keyboard);else{if(keyboard&&(intent.selection.kind==='card'||intent.selection.kind==='cardChoice'))focusRequest.current=intent.selection.kind;setSelected(old=>toggleActionSelection(old,intent.selection));}};
  const pendingPosition=selected?.kind==='card'||selected?.kind==='cardChoice'?selected.position:undefined;
  const boardPosition=Math.min(pendingPosition??position??s.self.board.length,s.self.board.length);
  const choosePosition=(i:number)=>{
    if(!active||!Number.isInteger(i)||i<0||i>s.self.board.length||s.self.board.length>=7)return;
    setPosition(i);setSelected(old=>repositionSelection(s,catalog,old,i));
    const row=arenaRef.current?.querySelector<HTMLElement>('.friendly-minions'),slot=row?.querySelector<HTMLElement>(`[data-drop-position="${i}"]`);
    if(row&&slot&&row.dataset.scrollable==='true'){
      const visible=row.getBoundingClientRect(),gap=slot.getBoundingClientRect();
      if(gap.left<visible.left+6)row.scrollLeft-=visible.left+6-gap.left;
      else if(gap.right>visible.right-6)row.scrollLeft+=gap.right-visible.right+6;
    }
  };
  const currentDrag=active&&drag?.revision===s.revision?drag.intent:null;
  const draggedMinion=currentDrag?.kind==='card'&&catalog[s.self.hand.find(c=>c.instanceId===currentDrag.id)?.cardId??'']?.kind==='minion';
  const dragPlan=currentDrag?planDrag(s,seat,catalog,currentDrag,boardPosition):null;
  const highlight=currentDrag?dragPlan?.selection??null:selected;
  const legalTargets=active?targetsFor(s,seat,catalog,highlight):[];
  const targetKeys=(e:ReactKeyboardEvent<HTMLElement>)=>{
    // Inspection must remain dismissible even on the opponent's turn when
    // actions are disabled. Preserve nested menu Escape behavior.
    if(e.key==='Escape'&&peekCardId&&!selected&&!currentDrag&&e.target instanceof HTMLElement&&
      !e.target.closest('.battle-emote-menu[open],.dialogue-settings[open]')&&
      e.target.closest('.battle-hand')){
      e.preventDefault();e.stopPropagation();setPeekCardId(null);return;
    }
    if(!active||currentDrag||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!(e.target instanceof HTMLElement)||e.target.matches('input,select,textarea,[contenteditable="true"]'))return;
    // Nested emote/settings disclosures handle their own Escape. The arena's
    // capture handler runs before their bubble handlers: do not silently
    // cancel an unrelated selected card underneath an open settings panel.
    if(e.key==='Escape'&&e.target.closest('.battle-emote-menu[open],.dialogue-settings[open]'))return;
    if(selected&&e.key==='Escape'){
      // First Escape closes an expanded target list while keeping the source
      // selected; a second Escape cancels the actual action as usual.
      const openPicker=e.target.closest<HTMLDetailsElement>('.target-picker[open]');
      if(openPicker){e.preventDefault();e.stopPropagation();openPicker.open=false;openPicker.querySelector<HTMLElement>('summary')?.focus();return;}
      if(selected.kind==='cardChoice'){e.preventDefault();e.stopPropagation();cancelCardChoice();return;}
      const key=selected.kind==='attack'?`minion:${selected.id}`:selected.kind==='heroAttack'?'hero':selected.kind==='power'?'power':`card:${selected.id}`;
      const source=[...arenaRef.current?.querySelectorAll<HTMLElement>('[data-action-source]')??[]].find(el=>el.dataset.actionSource===key);
      e.preventDefault();e.stopPropagation();setSelected(null);cancelActiveTouch();source?.focus();return;
    }
    let controls:HTMLElement[]=[];
    if(selected&&legalTargets.length&&e.target.closest('.battle-card,.battle-minion,.hero-portrait,.hero-power,.selected-card-use,.selection-cancel'))controls=[...arenaRef.current?.querySelectorAll<HTMLElement>('.is-targeted[aria-disabled="false"]')??[]];
    else if((!selected||selected.kind==='held')&&e.target.matches('.battle-card,.battle-minion')){
      const row=e.target.closest('.battle-hand,.minion-row');if(!row)return;
      // Include disabled cards for inspection; navigation never activates them.
      controls=[...row.querySelectorAll<HTMLElement>('.battle-card,.battle-minion')];
    }
    const next=keyboardTargetIndex(e.key,controls.indexOf(e.target),controls.length);if(next===null)return;
    e.preventDefault();e.stopPropagation();controls[next].focus();
  };
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
  const reservationBadge=(type:'playCard'|'attack',id:string)=>{
    const index=reservations.findIndex(action=>type==='playCard'?action.type==='playCard'&&action.instanceId===id:action.type==='attack'&&action.attackerId===id);
    return index<0?null:<span className="intent-badge" aria-label={`예약 ${index+1}번`}>{index+1}</span>;
  };
  const canTarget=(target:Target)=>legalTargets.some(t=>sameTarget(t,target));
  const canAttack=(id?:string)=>active&&!!planAttack(s,seat,catalog,id);
  const power=active?planPower(s,seat,catalog):null;
  const powerReason=heroPowerReason(s.self)??(active&&!power?'선택할 수 있는 대상이 없습니다.':undefined);
  const choiceCard=selected?.kind==='cardChoice'?selectionCard(s,catalog,selected):undefined;
  const selectedCard=selectionCard(s,catalog,highlight);
  const selectedAttacker=selected?.kind==='attack'?s.self.board.find(m=>m.instanceId===selected.id):undefined;
  const targetSourceCard=selectedAttacker?catalog[selectedAttacker.cardId]:selectedCard;
  const targetSourceLabel=selected?.kind==='heroAttack'?'내 영웅 공격':selected?.kind==='power'?'내 영웅 능력':targetSourceCard?displayCardName(targetSourceCard,classicNames):'선택한 행동';
  const enemyLabel=room.mode==='bot'?'AI':'상대';
  const handReady=(id:string)=>active&&!!planCard(s,seat,catalog,id,boardPosition);
  const choose=(target:Target,keyboard=false)=>{if(!active)return;const action=targetAction(s,seat,catalog,selected,target);if(action)perform(action,keyboard);};
  const beginDrag=(event:DragEvent<HTMLButtonElement>,intent:DragIntent)=>{
    if(!active||!planDrag(s,seat,catalog,intent,boardPosition)){event.preventDefault();return;}
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','card-duel-action');
    const next={intent,revision:s.revision};dragRef.current=next;setDrag(next);setSelected(null);setDropNotice('');
  };
  const touchDown=(e:PointerEvent<HTMLDivElement>)=>{
    // A physical new press is independent from the previous drag/scroll's
    // synthetic click. Do not make the user wait 250 ms to tap again.
    if(e.isPrimary){suppressClick.current=0;cancelledPointer.current=null;setDropNotice('');}
    if(!active||e.pointerType==='mouse'||!e.isPrimary||!(e.target instanceof Element))return;
    const source=e.target.closest<HTMLElement>('[data-action-source]'),intent=intentFromSource(source?.dataset.actionSource);
    if(!intent||!planDrag(s,seat,catalog,intent,boardPosition))return;
    touchRef.current={pointerId:e.pointerId,originX:e.clientX,originY:e.clientY,drag:{intent,revision:s.revision},phase:'pending',canPanBoard:intent.kind==='attack'&&source?.closest<HTMLElement>('.friendly-minions')?.dataset.scrollable==='true'};
  };
  const pointerSlotAt=(hit:Element|null,x:number,intent:DragIntent):number|undefined=>{
    if(intent.kind!=='card'||catalog[s.self.hand.find(c=>c.instanceId===intent.id)?.cardId??'']?.kind!=='minion')return undefined;
    const board=hit?.closest('.friendly-board');if(!board)return undefined;
    const row=board.querySelector('.friendly-minions');if(!row)return undefined;
    const bounds=row.getBoundingClientRect(),outer=board.getBoundingClientRect();
    const visible={left:Math.max(0,bounds.left,outer.left),right:Math.min(document.documentElement.clientWidth,bounds.right,outer.right)};
    return nearestVisibleBoardSlot(x,visible,[...row.querySelectorAll<HTMLElement>('[data-drop-position]:not(:disabled)')].map(el=>{
      const rect=el.getBoundingClientRect();return {position:Number(el.dataset.dropPosition),left:rect.left,right:rect.right};
    }));
  };
  const pointerDescription=(hit:Element|null,x:number,intent:DragIntent,touchY?:number):TouchHit=>{
    const minionId=hit?.closest<HTMLElement>('[data-preview-minion]')?.dataset.previewMinion,hero=hit?.closest('.hero-portrait')?(hit.closest('.enemy-hero-zone')?'enemy':'self'):undefined,slot=pointerSlotAt(hit,x,intent);
    const description:TouchHit={minionId,hero,slot,ownBoard:!!hit?.closest('.friendly-board'),field:!!hit?.closest('.arena-field'),hand:!!hit?.closest('.own-hand,.hidden-hand'),control:!!hit?.closest('button,input,select,textarea,summary,[role="button"]')&&!minionId&&!hero&&slot===undefined};
    // Only physical touch drags of attacks/targeted spells get a small
    // tolerance. Native mouse drops, exact targets, controls and minion
    // insertion retain their original semantics.
    const card=intent.kind==='card'?catalog[s.self.hand.find(c=>c.instanceId===intent.id)?.cardId??'']:undefined;
    if(touchY===undefined||!description.field||description.hand||description.control||minionId||hero||slot!==undefined||intent.kind==='card'&&card?.kind!=='spell')return description;
    const plan=planDrag(s,seat,catalog,intent,boardPosition),legal=targetsFor(s,seat,catalog,plan?.selection??null),field=hit?.closest('.arena-field');
    if(!legal.length||!field)return description;
    const fieldRect=field.getBoundingClientRect(),target=nearestTouchTarget(x,touchY,[...field.querySelectorAll<HTMLElement>('.battle-minion,.hero-portrait')].flatMap(el=>{
      const id=el.dataset.previewMinion,zone=el.closest('.minion-row,.hero-zone');if(!zone)return [];
      const target:Target=id?{kind:'minion',instanceId:id}:{kind:'hero',player:el.closest('.enemy-hero-zone')?enemy:seat};
      const rect=el.getBoundingClientRect(),clip=zone.getBoundingClientRect();
      return [{target,legal:legal.some(t=>sameTarget(t,target)),left:Math.max(0,rect.left,clip.left,fieldRect.left),right:Math.min(document.documentElement.clientWidth,rect.right,clip.right,fieldRect.right),top:Math.max(0,rect.top,clip.top,fieldRect.top),bottom:Math.min(document.documentElement.clientHeight,rect.bottom,clip.bottom,fieldRect.bottom)}];
    }));
    return target?.kind==='minion'?{...description,minionId:target.instanceId}:target?.kind==='hero'?{...description,hero:target.player===seat?'self':'enemy'}:description;
  };
  const pointerPlan=(hit:Element|null,x:number,d:DragState,touchY?:number)=>{const description=pointerDescription(hit,x,d.intent,touchY),result=pointerDrop(s,seat,catalog,d,description,boardPosition),action=result.intent?.action,target=action&&'target' in action?action.target:undefined;return {...result,target,slot:result.intent?description.slot:undefined};};
  const updatePointerFeedback=(hit:Element|null,x:number,d:DragState,touchY?:number)=>{const plan=pointerPlan(hit,x,d,touchY);setTouchSlot(plan.slot);setDropTarget(old=>old&&plan.target&&sameTarget(old,plan.target)?old:plan.target);setDropFeedback(plan.feedback);return plan;};
  const edgeDelta=(row:HTMLElement,x:number,y:number,elapsed=16)=>{
    const rect=row.getBoundingClientRect();if(row.dataset.scrollable!=='true'||y<Math.max(0,rect.top)||y>Math.min(document.documentElement.clientHeight,rect.bottom))return 0;
    return boardEdgePanDelta(x,Math.max(0,rect.left),Math.min(document.documentElement.clientWidth,rect.right),row.scrollLeft,row.scrollWidth-row.clientWidth,elapsed);
  };
  const queueEdgePan=(x:number,y:number,d:DragState)=>{
    const intent=d.intent,card=intent.kind==='card'?catalog[s.self.hand.find(c=>c.instanceId===intent.id)?.cardId??'']:undefined;
    const row=card?.kind==='minion'?document.elementFromPoint(x,y)?.closest<HTMLElement>('.friendly-minions'):undefined;
    const direction=row?Math.sign(edgeDelta(row,x,y)):0;if(!row||!direction){stopEdgePan();return;}
    const live=edgePanRef.current;
    if(live&&live.row===row&&live.drag===d&&live.direction===direction){live.x=x;live.y=y;live.refresh=()=>updatePointerFeedback(document.elementFromPoint(live.x,live.y),live.x,d,live.y);return;}
    stopEdgePan();const now=performance.now(),session={frame:0,row,drag:d,x,y,direction,started:now,last:now,refresh:()=>{}};
    session.refresh=()=>updatePointerFeedback(document.elementFromPoint(session.x,session.y),session.x,d,session.y);
    const tick=(time:number)=>{
      if(edgePanRef.current!==session)return;
      if(dragRef.current!==d||document.hidden||!row.isConnected){stopEdgePan();return;}
      const step=edgeDelta(row,session.x,session.y,Math.max(1,time-session.last));session.last=time;
      if(!step||Math.sign(step)!==session.direction){stopEdgePan();return;}
      if(time-session.started>=140){const before=row.scrollLeft;row.scrollLeft+=step;if(row.scrollLeft===before){stopEdgePan();return;}session.refresh();}
      session.frame=requestAnimationFrame(tick);
    };
    edgePanRef.current=session;session.frame=requestAnimationFrame(tick);
  };
  const nativeDragOver=(e:DragEvent<HTMLDivElement>)=>{pointAim(e.clientX,e.clientY);const d=dragRef.current;if(!d||!active)return;const plan=updatePointerFeedback(document.elementFromPoint(e.clientX,e.clientY),e.clientX,d);if(plan.intent){e.preventDefault();e.dataTransfer.dropEffect='move';}else e.dataTransfer.dropEffect='none';};
  const nativeDrop=(e:DragEvent<HTMLDivElement>)=>{const d=dragRef.current;if(!d||!active)return;e.preventDefault();e.stopPropagation();const plan=pointerPlan(document.elementFromPoint(e.clientX,e.clientY),e.clientX,d);clearDrag();if(plan.intent)applyIntent(plan.intent);else setDropNotice(dropFeedbackText(plan.feedback));};
  const nativeDragEnd=()=>{const unfinished=!!dragRef.current;clearDrag();if(unfinished&&active)setDropNotice('드래그 취소 · 카드와 마나는 그대로 유지됩니다.');};
  const touchMove=(e:PointerEvent<HTMLDivElement>)=>{
    pointAim(e.clientX,e.clientY);
    const g=touchRef.current;if(!g||g.pointerId!==e.pointerId)return;
    const next=advanceGesture(g,e.clientX,e.clientY,s.revision);if(!next||!active){cancelActiveTouch();return;}touchRef.current=next;
    if(next.phase!=='dragging')return;
    if(g.phase!=='dragging'){
      try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
      setSelected(null);setDrag(next.drag);dragRef.current=next.drag;
      if(next.drag.intent.kind==='card')setTouchGhost(next.drag.intent.id);
    }
    e.currentTarget.style.setProperty('--touch-x',`${e.clientX}px`);e.currentTarget.style.setProperty('--touch-y',`${e.clientY}px`);
    updatePointerFeedback(document.elementFromPoint(e.clientX,e.clientY),e.clientX,next.drag,e.clientY);
    queueEdgePan(e.clientX,e.clientY,next.drag);
    e.preventDefault();
  };
  const touchUp=(e:PointerEvent<HTMLDivElement>)=>{
    if(cancelledPointer.current===e.pointerId){cancelledPointer.current=null;suppressClick.current=Date.now()+250;return;}
    const g=touchRef.current;if(!g||g.pointerId!==e.pointerId)return;
    const outcome=finishGesture(g,s.revision,active);touchRef.current=null;
    if(outcome==='tap')return;
    suppressClick.current=Date.now()+250;
    if(outcome==='cancel'){clearDrag();return;}
    try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
    const plan=pointerPlan(document.elementFromPoint(e.clientX,e.clientY),e.clientX,g.drag,e.clientY);
    clearDrag();if(plan.intent)applyIntent(plan.intent);else setDropNotice(dropFeedbackText(plan.feedback));e.preventDefault();
  };
  const stopTouch=(e:PointerEvent<HTMLDivElement>)=>{if(isCaptureHandoff(e.type,e.target!==e.currentTarget,e.currentTarget.hasPointerCapture(e.pointerId)))return;if(cancelledPointer.current===e.pointerId||touchRef.current?.pointerId===e.pointerId){cancelledPointer.current=e.type==='lostpointercapture'?e.pointerId:null;suppressClick.current=Date.now()+250;clearDrag();}};
  const guardClick=(e:MouseEvent<HTMLDivElement>)=>{if(Date.now()<suppressClick.current&&!independentActivation(e.nativeEvent)){e.preventDefault();e.stopPropagation();return;}if(peekCardId&&e.target instanceof Element&&!e.target.closest('.own-hand .hand-card-slot'))setPeekCardId(null);};
  const label=s.phase==='finished'?(s.winner===null?'무승부':s.winner===seat?'승리!':'패배'):s.phase==='mulligan'?'시작 카드 선택':s.activePlayer===seat?'내 턴':room.mode==='bot'?'AI 턴':'상대 턴';
  const dropRow=currentDrag&&dropTarget?targetPickerRows(s,seat,[dropTarget])[0]:undefined;
  const dropLabel=dropRow?targetRowText(dropRow,catalog,classicNames).compact:undefined;
  const turnLabel=s.phase==='finished'?'대전 종료':label;
  const handHint=active?'선택 후 내기 또는 드래그':s.phase==='finished'?'대전 종료':!connected||!opponentReady?'연결 대기':playing?'연출 재생 중':busy?'행동 처리 중':s.choicePending?(s.self.pendingChoice?'카드 선택 중':`${turnLabel} · 카드 선택 중`):turnLabel;
  const result=s.winner===null?'무승부':s.winner===seat?'대전 승리':'대전 패배';
  const resultReason=s.reason==='fatigue'?'탈진':s.reason==='turnLimit'?'최대 턴 도달':s.reason==='concede'?'항복':'영웅 체력 소진';
  const pauseMessage=`상대 재접속 대기${reconnectLeft===null?'':` · ${Math.floor(reconnectLeft/60)}분 ${reconnectLeft%60}초`}`;
  const status=s.phase==='finished'?'대전 종료':!connected?'서버 재연결 대기':!opponentReady?'상대 재접속 대기 중':playing?'전투 연출 재생 중':busy?'행동 처리 중':s.choicePending?(s.self.pendingChoice?'덱 카드 선택 중':`${turnLabel} · 덱 카드 선택 중`):currentDrag&&dropFeedback?dropFeedbackText(dropFeedback,touchSlot,dropLabel):dropNotice?dropNotice:choiceCard?'카드 효과를 선택하세요.'+(pendingPosition===undefined?'':` · 배치 ${boardPosition+1}번`):currentDrag?.kind==='card'&&highlight?.kind==='cardChoice'?'전장에 놓은 뒤 카드 효과를 선택하세요.':highlight?.kind==='held'?`${selectedCard?displayCardName(selectedCard,classicNames):'카드'} 선택${selectedCard?.kind==='minion'?` · 배치 ${boardPosition+1}번`:''} · 내기 또는 드래그`:highlight?.kind==='attack'||highlight?.kind==='heroAttack'?`공격 대상 ${legalTargets.length}개 · 강조된 대상 선택`:highlight?`선택할 대상 ${legalTargets.length}개${pendingPosition===undefined?'':` · 배치 ${boardPosition+1}번`} · 강조된 대상 선택`:currentDrag?.kind==='card'?'내 전장 또는 유효한 대상에 카드를 놓으세요.':active?'초록색으로 빛나는 카드와 하수인을 사용할 수 있습니다.':'상대방의 행동을 기다리는 중';
  const confirmConcede=()=>{
    if(!window.confirm('항복하시겠습니까?'))return;
    setCompactSettingsOpen(false);
    setBattleToolsOpen(false);
    perform({type:'concede'});
  };
  const cardInspect=(item:Inspectable)=>setInspected(item);
  const ownHeroTarget:Target={kind:'hero',player:seat},enemyHeroTarget:Target={kind:'hero',player:enemy};
  // In an immersive landscape arena the side inspector is hidden. A hand
  // card that cannot currently be played must still be fully readable after
  // the first tap, without changing mana, attack, target or drag selection.
  const peekedHand=s.self.hand.find(c=>c.instanceId===peekCardId);
  const peekedCard=peekedHand?catalog[peekedHand.cardId]:undefined;
  const currentInspector=selectedCard?{card:selectedCard,cost:publicCardCost(s,seat,selectedCard,catalog,s.self.hand.find(c=>c.instanceId===(highlight?.kind==='held'||highlight?.kind==='card'||highlight?.kind==='cardChoice'?highlight.id:''))?.costDiscount)}:peekedCard?{card:peekedCard,cost:publicCardCost(s,seat,peekedCard,catalog,peekedHand?.costDiscount)}:inspected;
  const selectedHandInspectable=!!selectedCard||!!peekedCard;
  const mulliganInspectable=s.self.hand.find(c=>c.instanceId===mulliganInspectId)??s.self.hand[0];
  const tier=room.ranked??room.developerTest;
  const title=<div className={`duel-title${compactUi?' compact-title':''}`} data-settings-open={compactSettingsOpen} inert={ownChoiceOpen||battleToolsOpen||!!inspectedOverlay}>
    {compactUi&&<button className="compact-settings-trigger secondary" type="button" aria-label="전투 설정" aria-expanded={compactSettingsOpen} onClick={()=>setCompactSettingsOpen(old=>!old)}>⚙</button>}
    {compactUi&&(onPause||presentingResult)&&<button className="compact-home-trigger secondary" type="button" aria-label="저장하고 대전 준비로" disabled={busy||shattering} onClick={presentingResult?leave:onPause}>⌂</button>}
    <div className="duel-summary"><p className="eyebrow">{tier?`${room.developerTest?.experiment?'실험 AI · ':room.developerTest?'개발자 시험 · ':''}${rankInfo(tier.rank).name} · 랭크 AI ${tier.intelligence}단계`:room.mode==='bot'?`AI 대전 · ${room.botDifficulty??3}단계 ${BOT_DIFFICULTY_NAMES[room.botDifficulty??3]}`:room.ownedPvp?'계정 PvP':`ROOM ${room.code}`} · TURN {s.turn}</p><h2>{label}</h2></div>
    <div className="duel-toolbar" role="group" aria-label="대전 설정 및 저장">
      <div className="duel-indicators"><span className={room.opponentConnected?'good':'warn'}>{room.mode==='bot'?(room.botEngine==='device'?'기기 AI':'서버 AI')+(tier?` · 덱 전력 ${tier.deckPower}`:room.botDeckStyle?' · '+DECK_STYLE_LABELS[room.botDeckStyle]:'')+(room.botTrainingGeneration?' · 학습 '+room.botTrainingGeneration+'세대':''):room.opponentConnected?'상대 연결됨':'상대 연결 끊김'}</span>
        {autoSaved!==undefined&&<small role="status" aria-atomic="true" className={`save-indicator ${savePending?'warn':autoSaved?'good':'warn'}`}>{savePending?'저장 확인 중…':autoSaved?'자동 저장됨':saveRetryable?'저장 오류 · 재시도 가능':'자동 저장 사용 불가'}</small>}{lastSavedAt&&Number.isFinite(Date.parse(lastSavedAt))&&<small className="last-saved-at">최근 저장 <time dateTime={lastSavedAt}>{new Date(lastSavedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}</time></small>}</div>
      <div className="duel-actions">{onRetrySave&&saveRetryable&&<button type="button" className="secondary retry-save" aria-label="저장 다시 시도" disabled={busy} onClick={onRetrySave}><span className="battle-action-full">저장 다시 시도</span><span className="battle-action-short" aria-hidden="true">저장 재시도</span></button>}{onPause&&(s.phase!=='finished'||saveRetryable)&&<button type="button" className="secondary pause-save" aria-label={saveRetryable?'저장 재시도 후 나가기':'저장 후 나가기'} disabled={busy} onClick={onPause}><span className="battle-action-full">{saveRetryable?'저장 재시도 후 나가기':'저장 후 나가기'}</span><span className="battle-action-short" aria-hidden="true">저장·나가기</span></button>}{s.phase!=='mulligan'&&<button type="button" className="secondary battle-tools-toggle" aria-label="전투 기록과 도움말 열기" onClick={openBattleTools}>기록</button>}
        {compactUi?<div className="battle-sound-menu battle-sound-flat"><div className="sound-settings"><button type="button" className="secondary sound-toggle" aria-pressed={sound} onClick={toggleSound}>효과음 {sound?'켜짐':'꺼짐'}</button><DialogueSettings hero={s.self.heroClass} mode={captionMode} onMode={changeCaptionMode} disabled={playing} flat/></div></div>:<details className="battle-sound-menu" onKeyDown={e=>{
          if(!e.currentTarget.open)return;
          if(e.key==='Escape'){e.preventDefault();e.stopPropagation();e.currentTarget.open=false;e.currentTarget.querySelector<HTMLElement>('summary')?.focus();return;}
          if(e.key!=='Tab')return;
          const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('summary,button:not([disabled]):not([tabindex="-1"]),input:not([disabled]),select:not([disabled])')).filter(el=>el.getClientRects().length>0);
          const first=controls[0],last=controls[controls.length-1];
          if(first&&last&&e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
          else if(first&&last&&!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }}><summary>소리·연출</summary><button type="button" className="battle-sound-dismiss" tabIndex={-1} aria-hidden="true" onClick={e=>{const details=e.currentTarget.closest<HTMLDetailsElement>('.battle-sound-menu');if(details){details.open=false;details.querySelector<HTMLElement>('summary')?.focus();}}}/><div className="sound-settings"><button type="button" className="secondary sound-toggle" aria-pressed={sound} onClick={toggleSound}>효과음 {sound?'켜짐':'꺼짐'}</button><DialogueSettings hero={s.self.heroClass} mode={captionMode} onMode={changeCaptionMode} disabled={playing}/></div></details>}{compactUi&&s.phase!=='finished'&&<button className="secondary danger" type="button" disabled={busy} onClick={confirmConcede}>항복하기</button>}{!compactUi&&!battleToolsOpen&&s.phase==='playing'&&<button className="secondary danger desktop-concede" type="button" disabled={!connected||busy} onClick={confirmConcede}>항복</button>}{!compactUi&&<button className="secondary" disabled={busy} onClick={leave}>나가기</button>}</div>{compactUi&&<button type="button" className="secondary compact-settings-close" onClick={()=>setCompactSettingsOpen(false)}>설정 닫기 ✕</button>}
    </div></div>;
  const inspectDialog=inspectedOverlay&&!ownChoiceOpen&&<div className="board-inspect-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)closeBoardInspector();}}>
      <section className="board-inspect-dialog" role="dialog" aria-modal="true" aria-label="카드 상세" onKeyDownCapture={e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeBoardInspector();}
        else if(e.key==='Tab'){e.preventDefault();inspectCloseRef.current?.focus();}
      }}>
        <button type="button" className="board-inspect-close secondary" ref={inspectCloseRef} onClick={closeBoardInspector}>카드 설명 닫기 <kbd>Esc</kbd></button>
        <CardInspector item={inspectedOverlay} catalog={catalog}/>
      </section>
    </div>;
  if(s.phase==='mulligan'||exchange)return <section className={`battle duel-screen phase-mulligan${compactUi?' preview-compact':''}`}>{title}<div className="mulligan-arena classic-mulligan" inert={!!inspectedOverlay}><TableDecor/><div className="mulligan-opponent"><HiddenHand count={s.opponent.handCount}/><HeroPortrait player={s.opponent} label={enemyLabel}/></div><div className="mulligan-heading"><span className="mulligan-order">{s.firstPlayer===seat?'선공':'후공'}</span><h3>첫 손패를 선택하세요</h3><p>{!opponentReady?pauseMessage:s.self.mulliganDone?'상대의 선택을 기다리는 중입니다.':'바꾸고 싶은 카드를 클릭한 후 확정하세요.'}</p>{!compactUi&&mulliganInspectable&&<div className="mulligan-inspection-controls"><label>설명할 카드<select aria-label="설명을 확인할 첫 손패 카드" value={mulliganInspectable.instanceId} onChange={e=>setMulliganInspectId(e.target.value)}>{s.self.hand.map(c=><option key={c.instanceId} value={c.instanceId}>{displayCardName(catalog[c.cardId],classicNames)}</option>)}</select></label><button type="button" className="secondary mulligan-inspection-open" onClick={()=>inspectBoardMinion({card:catalog[mulliganInspectable.cardId],cost:publicCardCost(s,seat,catalog[mulliganInspectable.cardId],catalog,mulliganInspectable.costDiscount)})}>카드 설명 확대</button></div>}</div><div className="mulligan-cards" data-exchange={exchange?(showExchangeFaces?'reveal':'return'):undefined}>
    {(exchange?mulliganSlots(exchange.before.self.hand,showExchangeFaces?s.self.hand:exchange.before.self.hand,exchange.marked):s.self.hand.map(card=>({key:card.instanceId,card,swapping:false}))).map(({key,card:c,swapping},index)=><div key={key} className="mulligan-card-frame" data-replaced={swapping||undefined} style={{'--exchange-delay':`${index*65}ms`} as React.CSSProperties}>
      <BattleCard card={catalog[c.cardId]} mulligan selected={!exchange&&replace.includes(c.instanceId)} enabled={!exchange&&!s.self.mulliganDone&&connected&&opponentReady&&!busy} onClick={()=>{setMulliganInspectId(c.instanceId);setReplace(old=>old.includes(c.instanceId)?old.filter(x=>x!==c.instanceId):[...old,c.instanceId]);}}/>
      {swapping&&showExchangeFaces&&<span className="mulligan-card-back" aria-hidden="true"><Sigil kind="deck"/></span>}
    </div>)}
    </div><button className="mulligan-confirm" disabled={!!exchange||s.self.mulliganDone||busy||!connected||!opponentReady} onClick={e=>{
      if(exchange||busy||s.self.mulliganDone)return;
      if(replace.length&&room.animationSpeed!=='instant'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)setExchange({before:s,marked:replace});
      perform({type:'mulligan',replace},e.detail===0);
    }}>확정 ({replace.length}장 교체)</button><div className="mulligan-self"><HeroPortrait player={s.self} label="나"/></div></div>{inspectDialog}</section>;
  return <section data-animation-speed={room.animationSpeed??"normal"} className={`battle duel-screen phase-${s.phase}${compactUi?' preview-compact':''}${active?' my-turn':''}${currentDrag?' is-dragging':''}${highlight?' has-selection':''}${playing?' is-playing-fx':''}${room.animation?.revision===s.revision?' has-fx-revision':''}`}>
    {title}
    <div className="arena-message" inert={ownChoiceOpen||battleToolsOpen||!!inspectedOverlay} ref={messageRef} onKeyDownCapture={targetKeys} data-drop-feedback={currentDrag?dropFeedback??undefined:dropNotice?'notice':undefined}><span className={`turn-lamp${active?' live':''}`}/><span role="status" aria-live={currentDrag?"off":"polite"}>{status}{intentNotice&&<small> · {intentNotice}</small>}{selected&&!currentDrag&&legalTargets.length>0&&<small className="target-key-hint"> · 방향키/Enter</small>}</span>{pending>0&&<button className="secondary" type="button" onClick={cancelPending} aria-label={`예약 ${pending}개 취소`}>예약 {pending} · 취소</button>}{connected&&!opponentReady&&reconnectLeft!==null&&<small className="reconnect-countdown" aria-live="off"> · 남은 재접속 시간 {Math.floor(reconnectLeft/60)}분 {reconnectLeft%60}초</small>}{selectedHandInspectable&&!currentDrag&&currentInspector&&<button type="button" className="secondary selected-card-inspect" aria-label={`${displayCardName(currentInspector.card,classicNames)} 카드 설명 전체 보기`} onClick={()=>inspectBoardMinion(currentInspector)}>카드 설명 확대</button>}{active&&!currentDrag&&<PlacementPicker view={s} seat={seat} catalog={catalog} selection={selected} position={boardPosition} onChoose={choosePosition}/>}{selected?.kind==='held'&&active&&<button type="button" className="selected-card-use" onClick={e=>applyIntent(planCard(s,seat,catalog,selected.id,boardPosition),e.detail===0)}>선택 카드 내기</button>}{selected&&!currentDrag&&legalTargets.length>0&&<TargetPicker key={`${s.revision}:${aimSource}:${selected.kind==='card'?selected.choice??'':''}`} view={s} seat={seat} targets={legalTargets} catalog={catalog} sourceLabel={targetSourceLabel} onChoose={choose}/>}{selected&&<button className="secondary selection-cancel" onClick={()=>setSelected(null)}>선택 취소 <kbd>Esc</kbd></button>}</div>
    <div className="battle-arena classic-table" inert={ownChoiceOpen||battleToolsOpen||!!inspectedOverlay} ref={arenaRef} onKeyDownCapture={targetKeys} onPointerDown={touchDown} onPointerMove={touchMove} onPointerUp={touchUp} onPointerCancel={stopTouch} onLostPointerCapture={stopTouch} onClickCapture={guardClick} onPointerLeave={hideAim} onDragOverCapture={nativeDragOver} onDropCapture={nativeDrop} onDragLeave={e=>{if(!e.relatedTarget||!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget)){setDropFeedback(null);setTouchSlot(undefined);setDropTarget(undefined);hideAim();}}} onContextMenu={e=>{if(selected||currentDrag){e.preventDefault();if(selected?.kind==='cardChoice')cancelCardChoice();else{setSelected(null);clearDrag();}}}}>
      {touchGhost&&<div className="touch-drag-ghost" aria-hidden="true"><BattleCard card={catalog[s.self.hand.find(h=>h.instanceId===touchGhost)?.cardId??'']??catalog.__coin}/></div>}
      <TableDecor/><BattleEffects cue={cue} arenaRef={arenaRef} catalog={catalog}/>{cue&&<ActionSequence key={cue.animation.revision} cue={cue}/>}{visual?.turn&&<div className={`turn-flash ${visual.turn}`} role="status">{visual.turn==='own'?'내 턴':'상대 턴'}</div>}
      {aimVisible&&<svg className={`aim-overlay${highlight?.kind==='attack'||highlight?.kind==='heroAttack'?' attack-aim':''}`} key={aimSource} aria-hidden="true"><defs><marker id="duel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="currentColor"/></marker></defs><line ref={aimRef} visibility="hidden" markerEnd="url(#duel-arrow)" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></svg>}
      <aside className="arena-left" inert={ownChoiceOpen} aria-label="전투 기록">
        <ImpactRail entries={impactHistory} catalog={catalog}/>
      </aside>
      <div className="arena-field" inert={ownChoiceOpen}>
        <HiddenHand count={s.opponent.handCount}/>
        <div className="hero-zone enemy-hero-zone"><DialogueCaptions captions={dialogue.captions} side={enemy} mode={captionMode} catalog={catalog} hero={s.opponent.heroClass} heroForm={s.opponent.heroForm}/>
          <WeaponSlot player={s.opponent} catalog={catalog} onInspect={cardInspect}/><div className="hero-center"><Secrets count={s.opponent.secretCount}/><HeroPortrait shatter={shattered.enemy} delta={visual?.enemyHeroDelta} player={s.opponent} label={enemyLabel} targeted={canTarget(enemyHeroTarget)} dropTarget={!!currentDrag&&!!dropTarget&&sameTarget(dropTarget,enemyHeroTarget)} enabled={canTarget(enemyHeroTarget)} onClick={keyboard=>choose(enemyHeroTarget,keyboard)}/></div><HeroPower player={s.opponent}/>
        </div>
        <div className="arena-board enemy-board" aria-label={`상대 전장 ${s.opponent.board.length}/7`}><span className="zone-caption">상대 전장 <b>{s.opponent.board.length}/7</b></span><div className="minion-row" data-board-count={s.opponent.board.length}>{s.opponent.board.map(m=>{const target:Target={kind:'minion',instanceId:m.instanceId};return <BattleMinion entering={visual?.summoned.has(m.instanceId)} delta={visual?.minionDelta.get(m.instanceId)} key={m.instanceId} card={catalog[m.cardId]} minion={m} catalog={catalog} ownTurn={s.activePlayer===enemy} enabled={canTarget(target)} targeted={canTarget(target)} dropTarget={!!currentDrag&&!!dropTarget&&sameTarget(dropTarget,target)} onInspect={cardInspect} onInspectTap={()=>inspectBoardMinion({card:catalog[m.cardId],minion:m})} onClick={keyboard=>choose(target,keyboard)}/>;})}{!s.opponent.board.length&&<div className="empty-board">상대 하수인 없음</div>}</div></div>
        <div className="battle-divider"><span/><span className="divider-emblem"><Sigil kind="neutral"/></span><span/></div>
        <div className={`arena-board friendly-board${currentDrag?.kind==='card'?' drop-ready':''}`} aria-label={`내 전장 ${s.self.board.length}/7`}><span className="zone-caption">내 전장 <b>{s.self.board.length}/7</b></span><div className="minion-row friendly-minions" data-board-count={s.self.board.length}>
          {Array.from({length:s.self.board.length+1},(_,i)=>{const m=s.self.board[i];const target:Target|undefined=m?{kind:'minion',instanceId:m.instanceId}:undefined;const attackReady=!!m&&canAttack(m.instanceId);const targetReady=!!target&&canTarget(target);const isSource=!!m&&highlight?.kind==='attack'&&highlight.id===m.instanceId;return <div className="board-segment" key={m?.instanceId??'last-gap'}><button type="button" className={`position-slot${boardPosition===i?' chosen':''}${draggedMinion?' dropping':''}${draggedMinion&&touchSlot===i?' touch-drop-hover':''}`} data-drop-position={i} disabled={!active||s.self.board.length>=7} aria-label={`하수인 배치 위치 ${i+1}`} aria-pressed={boardPosition===i} title={`하수인을 ${i+1}번 위치에 배치`} onClick={()=>choosePosition(i)}><span>+</span></button>{m&&target&&<BattleMinion entering={visual?.summoned.has(m.instanceId)} delta={visual?.minionDelta.get(m.instanceId)} sourceId={`minion:${m.instanceId}`} card={catalog[m.cardId]} minion={m} catalog={catalog} ownTurn={s.activePlayer===seat} enabled={targetReady||attackReady&&(!highlight||highlight.kind==='attack'||highlight.kind==='heroAttack')} ready={attackReady&&!highlight&&!currentDrag} selected={isSource} targeted={targetReady} dropTarget={!!currentDrag&&!!dropTarget&&sameTarget(dropTarget,target)} onInspect={cardInspect} onInspectTap={()=>inspectBoardMinion({card:catalog[m.cardId],minion:m})} onClick={keyboard=>{if(targetReady)choose(target,keyboard);else if(attackReady)setSelected(old=>toggleActionSelection(old,planAttack(s,seat,catalog,m.instanceId)));}} onDragStart={attackReady?e=>beginDrag(e,{kind:'attack',id:m.instanceId}):undefined} onDragEnd={nativeDragEnd}/>} {m&&reservationBadge('attack',m.instanceId)}</div>;})}{!s.self.board.length&&<div className="empty-board own-empty">{currentDrag?.kind==='card'?'여기에 카드를 놓으세요':'손패에서 하수인을 내보세요'}</div>}</div>
        </div>
        <div className="hero-zone self-hero-zone"><DialogueCaptions captions={dialogue.captions} side={seat} mode={captionMode} catalog={catalog} hero={s.self.heroClass} heroForm={s.self.heroForm}/><WeaponSlot player={s.self} catalog={catalog} onInspect={cardInspect}/><div className="hero-center"><Secrets count={s.self.secretCount} names={s.self.secrets.map(c=>displayCardName(catalog[c.cardId],classicNames))} cards={s.self.secrets.map(c=>catalog[c.cardId])}/><HeroPortrait shatter={shattered.own} delta={visual?.ownHeroDelta} sourceId="hero" player={s.self} label="나" enabled={canTarget(ownHeroTarget)||canAttack()&&(!highlight||highlight.kind==='heroAttack')} ready={canAttack()&&!highlight&&!currentDrag} selected={highlight?.kind==='heroAttack'} targeted={canTarget(ownHeroTarget)} dropTarget={!!currentDrag&&!!dropTarget&&sameTarget(dropTarget,ownHeroTarget)} onClick={keyboard=>{if(canTarget(ownHeroTarget))choose(ownHeroTarget,keyboard);else if(canAttack())setSelected(old=>toggleActionSelection(old,planAttack(s,seat,catalog)));}} onDragStart={canAttack()?e=>beginDrag(e,{kind:'heroAttack'}):undefined} onDragEnd={nativeDragEnd}/></div><HeroPower sourceId="power" player={s.self} enabled={!!power} ready={!!power&&!highlight&&!currentDrag} selected={highlight?.kind==='power'} reason={powerReason} onClick={keyboard=>applyIntent(power,keyboard)}/></div>
        <div className="own-hand"><div className="hand-heading"><span>내 손패 <b>{s.self.handCount}/10</b></span><span>{handHint}{active&&<small className="target-key-hint"> · 방향키 이동</small>}</span></div><div className="battle-hand" data-count={s.self.hand.length}
          onFocusCapture={e=>{if(dismissPeekOnHandFocus(peekCardId,(e.target as HTMLElement).dataset.actionSource))setPeekCardId(null);}}
          onBlurCapture={e=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))setPeekCardId(null);}}>{s.self.hand.map((c,i)=>{const reason=active?publicCardReason(s,seat,c,catalog):undefined;const ready=handReady(c.instanceId);return <div className={`hand-card-slot ${fanSlot(i,s.self.hand.length)}${visual?.drawn.has(c.instanceId)?' card-drawn':''}`} key={c.instanceId}><BattleCard sourceId={`card:${c.instanceId}`} card={catalog[c.cardId]} cost={publicCardCost(s,seat,catalog[c.cardId],catalog,c.costDiscount)} reason={reason} enabled={ready} ready={ready&&!highlight&&!currentDrag} previewOpen={peekCardId===c.instanceId} onBlocked={()=>setPeekCardId(previous=>previous===c.instanceId?null:c.instanceId)} selected={(highlight?.kind==='held'||highlight?.kind==='card'||highlight?.kind==='cardChoice')&&highlight.id===c.instanceId||currentDrag?.kind==='card'&&currentDrag.id===c.instanceId} onClick={keyboard=>{setPeekCardId(null);const next=selectHandCard(s,seat,catalog,c.instanceId,selected);if(next&&!playing)playCardPickup();if(keyboard&&next?.kind==='held')focusRequest.current='held';setSelected(next);}} onInspect={cardInspect} onDragStart={e=>beginDrag(e,{kind:'card',id:c.instanceId})} onDragEnd={nativeDragEnd}/>{reservationBadge('playCard',c.instanceId)}</div>;})}{!s.self.hand.length&&<div className="empty-hand">손패가 비어 있습니다.</div>}</div></div>
      </div>
      <aside className="arena-right" inert={ownChoiceOpen||!!inspectedOverlay} aria-label="마나, 덱, 턴 종료">
        <div className="resource-block opponent-resources"><span className="rail-heading">상대 자원</span><ManaDisplay player={s.opponent} compact/><DeckPile player={s.opponent} label="상대"/></div>
        <div className="turn-control"><small>TURN {s.turn}</small>{deadline!==undefined&&<b className="turn-countdown" data-urgent={secondsLeft!==null&&secondsLeft<=5}>판정 시간 {secondsLeft??0}초</b>}<button type="button" className={`end-turn${active?' your-turn':''}`} disabled={!active} onClick={e=>perform({type:'endTurn'},e.detail===0)}>턴 종료</button><span className="turn-owner">{turnLabel}</span></div>
        <div className="resource-block own-resources"><DeckPile player={s.self} label="내"/><span className="rail-heading">내 자원</span><ManaDisplay player={s.self}/>{s.self.nextSecretFree&&<small className="resource-buff">다음 비밀 무료</small>}{s.self.protectMinionsThisTurn&&<small className="resource-buff">하수인 피해 보호</small>}</div>
        
      </aside>
      {s.choicePending&&!playing&&<div className="battle-overlay choice-overlay"><div className="choice-window" role={ownChoiceOpen?'dialog':'status'} aria-modal={ownChoiceOpen||undefined} tabIndex={ownChoiceOpen?-1:undefined} ref={ownChoiceOpen?choiceRef:undefined} onKeyDownCapture={ownChoiceOpen?choiceKeys:undefined} aria-label="덱 카드 선택"><h3>{!opponentReady?pauseMessage:s.self.pendingChoice?'덱 위의 카드 중 한 장을 선택하세요':'상대가 카드를 선택하는 중입니다'}</h3>{s.self.pendingChoice&&<><p>한 장을 손패에 넣고 나머지는 버립니다.</p><div className="choice-cards">{s.self.pendingChoice.map(c=><BattleCard key={c.instanceId} card={catalog[c.cardId]} enabled={connected&&opponentReady&&!busy} onClick={keyboard=>perform({type:'chooseDeckCard',instanceId:c.instanceId},keyboard)}/>)}</div>{ownChoiceOpen&&onPause&&<button type="button" className="secondary" disabled={busy} onClick={onPause}>{saveRetryable?'저장 재시도 후 나가기':'저장 후 나가기'}</button>}{ownChoiceOpen&&<button type="button" className="secondary" disabled={busy} onClick={leave}>나가기</button>}</>}</div></div>}
      {active&&choiceCard&&(choiceCard.kind==='spell'||choiceCard.kind==='minion')&&selected?.kind==='cardChoice'&&<div className="battle-overlay choice-overlay"><div className="choice-window" role="dialog" aria-modal="true" tabIndex={-1} ref={choiceRef} onKeyDownCapture={choiceKeys} aria-label="카드 효과 선택"><h3>{displayCardName(choiceCard,classicNames)} · 효과 선택</h3><div className="effect-choices">{choiceCard.choices?.map((option,i)=>{const reason=cardChoiceReason(s,seat,choiceCard,catalog,i);return <button type="button" key={i} disabled={!active||!!reason} title={reason} onClick={e=>applyIntent(planCard(s,seat,catalog,selected.id,selected.position,i),e.detail===0)}>{option.label}{reason&&<small>{reason}</small>}</button>;})}</div><button className="secondary" onClick={cancelCardChoice}>취소</button></div></div>}
      {presentingResult&&<div className="battle-overlay result-overlay"><div className={`result-window ${s.winner===seat?'victory':s.winner===null?'draw':'defeat'}`} role="dialog" aria-modal="true" aria-label="대전 결과" tabIndex={-1} ref={resultRef} onKeyDownCapture={resultKeys}><Sigil kind={s.winner===seat?'paladin':s.winner===null?'neutral':'shield'}/><h3>{result}</h3><p>{resultReason} · {s.turn}턴</p>{room.developerTest&&<p>개발자 시험 완료 · {room.botEngine==='device'?'로컬':'계정'} 성장 및 전적 변경 없음</p>}{room.ranked&&<p>{room.ranked.reward==='saved'?room.botEngine==='device'?'기기 XP·퀘스트 기록 저장 완료':'계정 XP·퀘스트 기록 저장 완료':room.ranked.reward==='notEligible'?'조기 항복은 XP 보상에 포함되지 않습니다.':room.botEngine==='device'?(autoSaved?'기기에서 랭크 대전 결과 저장 중…':'성장 기록 저장에 실패했습니다. 저장 경기를 다시 열어 확인하세요.'):'서버에서 랭크 대전 결과 저장 중…'}</p>}{room.ranked?.reward==='saved'&&room.ranked.rewardDetails&&<section className="ranked-reward" aria-label="대전 보상"><strong>+{room.ranked.rewardDetails.xp.toLocaleString('ko-KR')} XP</strong>{room.ranked.rewardDetails.questAdvanced&&<p>{room.ranked.rewardDetails.questCompleted?`직업 퀘스트 완료 · 보너스 +${room.ranked.rewardDetails.questBonusXp??0} XP 포함`:'직업 퀘스트 +1판'}</p>}{(room.ranked.rewardDetails.rankAfter??0)>room.ranked.rank&&<p>승급! {rankInfo(room.ranked.rewardDetails.rankAfter!).name}</p>}{!!room.ranked.rewardDetails.unlockedCards?.length&&<p>새 카드 {room.ranked.rewardDetails.unlockedCards.length}종 해금: {room.ranked.rewardDetails.unlockedCards.slice(0,4).map(id=>catalog[id]?.name??id).join(', ')}{room.ranked.rewardDetails.unlockedCards.length>4&&' 외'}</p>}</section>}{room.pvpReward&&<p>{room.pvpReward==='saved'?'계정 PvP 전적 저장 완료':'서버에서 유저 대전 결과 저장 중…'}</p>}{onRematch&&<button onClick={onRematch}>같은 상대와 재대전</button>}<button className="secondary" onClick={leave}>{room.mode==='bot'?'대전 준비로 돌아가기':'덱 편집으로 돌아가기'}</button></div></div>}
    </div>
    {inspectDialog}
    <div className="battle-utilities" data-tools-open={battleToolsOpen} inert={ownChoiceOpen||!!inspectedOverlay} role={battleToolsOpen?'dialog':undefined} aria-modal={battleToolsOpen||undefined} aria-label={battleToolsOpen?'전투 기록과 도움말':undefined} onKeyDownCapture={e=>{if(!battleToolsOpen)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeBattleTools();return;}if(e.key!=='Tab')return;const focusable=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),summary,select,textarea,input,[tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);if(!focusable.length){e.preventDefault();return;}const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}><button type="button" className="battle-tools-close secondary" ref={toolsCloseRef} onClick={closeBattleTools}>전투 기록 닫기 <kbd>Esc</kbd></button><ImpactHistory entries={impactHistory} catalog={catalog}/><details className="landscape-card-detail"><summary title="선택된 카드의 설명과 효과 확인">카드 상세 보기{selectedCard?` · ${displayCardName(selectedCard,classicNames)}`:''}</summary><CardInspector item={currentInspector} catalog={catalog}/></details><details className="battle-log"><summary>최근 전투 기록 ({s.history.length}/60)</summary>{s.history.slice().reverse().map((entry,i)=><div className="log-entry" key={`${entry.turn}-${i}`}><small>턴 {entry.turn} · {entry.player===seat?'나':'상대'}</small>　{classicHistoryText(entry.message,catalog)}</div>)}</details><details className="battle-report"><summary>오류 신고용 전투 기록</summary><p>공개 정보만 기록합니다. 방 코드, 양쪽 손패의 카드 이름 및 미발동 비밀은 포함하지 않습니다.</p><textarea readOnly aria-label="오류 신고용 전투 기록" ref={reportRef} value={report}/><div className="controls"><button className="secondary" onClick={copyReport}>전투 기록 복사</button>{reportMessage&&<small role="status">{reportMessage}</small>}</div></details>{s.phase==='playing'&&<button type="button" className="secondary danger compact-concede" disabled={!connected||busy} onClick={confirmConcede}>항복</button>}</div>
  </section>;
}

function ActionSequence({cue}:{cue:PlaybackCue}){
  const beats=battleSequence(cue);
  const [step,setStep]=useState(-1);
  useEffect(()=>{
    if(beats.length<2)return;
    const timers=beats.map((_,index)=>setTimeout(()=>setStep(index),cue.impact+index*(cue.duration-cue.impact)/beats.length));
    return ()=>timers.forEach(clearTimeout);
  },[cue]);
  if(beats.length<2||step<0)return null;
  return <div className="battle-sequence" role="status" data-sequence-step={step+1}>{beats[step]} <small>{step+1}/{beats.length}</small></div>;
}
