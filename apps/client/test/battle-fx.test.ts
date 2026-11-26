import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck} from '../../../packages/engine/src/index.ts';
import type {Action,BattleVisualEvent,GameState,PlayerId,Target} from '../../../packages/engine/src/index.ts';
import {battleAnimationTiming,scaledBattleTiming} from '../../../packages/protocol.ts';
import type {BattleAnimation,RoomView} from '../../../packages/protocol.ts';
import {describeAcceptedAction} from '../../server/battle-animation.ts';
import {animationTheme,impactChanges,impactFeedback,defenseImpactLabel,fxRenderBudget,fxFramePressure,fxAutoAdaptation,FX_AUTO_RECOVERY_MS,fxCanvasGeometryChanged,layoutImpactLabels,departureVisual,departureSoundKind,summonVisuals,projectedSummonX,clipBoardFxAnchor,offscreenFxMarkers,createImpactLabelCache,createParticleCache,fxRandom} from '../src/battle-fx-model.ts';
import {battleFxQuality,normalizeFxQuality,setBattleFxQuality} from '../src/battle-fx-quality.ts';
import type {FxImpact} from '../src/battle-fx-model.ts';
import {nextPlayback,PlaybackTimeline,freshAcceptedAnimation} from '../src/battle-playback.ts';
import {battleSoundEnabled,battleSoundVolume,normalSoundVolume,setBattleSound,setBattleSoundVolume,unlockBattleSound,resultSoundTransition,playBattleSound,playBattleResultSound,stopBattleSound,summonSoundLayers,departureSoundLayers} from '../src/battle-sound.ts';
import type {ResultSoundState} from '../src/battle-sound.ts';
import {fixture,kinds,scenarioAction} from './animation-preview-model.ts';
import {resolveDrop,selectHandCard,targetAction,targetsFor} from '../src/battle-actions.ts';
import {cardDialogue,dialoguePlan,heroEmote,EMOTE_LABELS,HERO_DIALOGUE} from '../src/battle-dialogue.ts';
import {localKoreanVoice,dialogueVoiceEnabled,setDialogueVoiceEnabled,speakDialogue,stopDialogueVoice,dialogueVoiceVolume,setDialogueVoiceVolume,installedKoreanVoiceCount,previewDialogue} from '../src/dialogue-voice.ts';
import {battleHapticsEnabled,hapticPattern,hapticSupported,playBattleHaptic,previewBattleHaptics,setBattleHaptics,stopBattleHaptics} from '../src/battle-haptics.ts';
import {advanceImpactHistory} from '../src/battle-impact-history-model.ts';
const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
const catalog=createCatalog(JSON.parse(readFileSync('data/cards/'+active.file,'utf8')));
test('board effect anchors are clipped to visible minions or explicitly marked at hidden edges',()=>{
  const row={left:100,right:300,top:40,bottom:120},unit=(left:number,right:number)=>({left,right,top:50,bottom:110});
  assert.deepEqual(clipBoardFxAnchor(unit(130,180),row),{x:155,y:80,fullyVisible:true});
  assert.deepEqual(clipBoardFxAnchor(unit(80,130),row),{x:115,y:80,fullyVisible:false});
  assert.deepEqual(clipBoardFxAnchor(unit(280,330),row),{x:290,y:80,fullyVisible:false});
  assert.deepEqual(clipBoardFxAnchor(unit(40,95),row),{x:108,y:80,fullyVisible:false,edge:'left'});
  assert.deepEqual(clipBoardFxAnchor(unit(301,351),row),{x:292,y:80,fullyVisible:false,edge:'right'});
  assert.equal(clipBoardFxAnchor(unit(10,10),row),undefined);assert.equal(clipBoardFxAnchor(unit(10,20),{...row,top:NaN}),undefined);assert.equal(clipBoardFxAnchor({...unit(10,20),top:130,bottom:155},row),undefined);
});
test('geometry invalidation ignores subpixel rounding but stops stale-canvas effects on rotation or invalid sizes',()=>{
  assert.equal(fxCanvasGeometryChanged(393,720,393,720),false);assert.equal(fxCanvasGeometryChanged(393,720,392.4,720.8),false);
  assert.equal(fxCanvasGeometryChanged(393,720,720,393),true);assert.equal(fxCanvasGeometryChanged(393,720,393,722),true);
  assert.equal(fxCanvasGeometryChanged(393,720,0,720),true);assert.equal(fxCanvasGeometryChanged(NaN,720,393,720),true);assert.equal(fxCanvasGeometryChanged(393,720,393,Infinity),true);
});
test('panning a target out of view invalidates its numeric label and exposes the edge marker, then restores its label',()=>{
  const target:Target={kind:'minion',instanceId:'m'},impacts:FxImpact[]=[{target,kind:'damage',side:1,amount:3}],row={left:0,right:300,top:0,bottom:100},bounds={left:100,right:150,top:10,bottom:90};
  const cache=createImpactLabelCache(impacts,300,160),visible=clipBoardFxAnchor(bounds,row),hidden=clipBoardFxAnchor({...bounds,left:-60,right:-10},row),back=clipBoardFxAnchor({...bounds,left:200,right:250},row);
  const first=cache(()=>visible);assert.equal(first[0].text,'−3');assert.deepEqual(offscreenFxMarkers(impacts,()=>visible),[]);
  assert.deepEqual(cache(()=>hidden?.edge?undefined:hidden),[]);assert.equal(offscreenFxMarkers(impacts,()=>hidden)[0].edge,'left');
  const last=cache(()=>back);assert.equal(last[0].text,'−3');assert.ok(last[0].x>first[0].x);assert.deepEqual(offscreenFxMarkers(impacts,()=>back),[]);
});
test('offscreen impact markers group unique accepted targets by side and edge without duplicating multi-hit effects',()=>{
  const targets=Array.from({length:5},(_,i)=>({kind:'minion' as const,instanceId:String(i)}));const impacts:FxImpact[]=[{kind:'damage',target:targets[0],side:0,amount:2},{kind:'leave',target:targets[0],side:0},{kind:'damage',target:targets[1],side:0,amount:1},{kind:'heal',target:targets[2],side:0,amount:3},{kind:'freeze',target:targets[3],side:1},{kind:'buff',target:targets[4],side:1}];
  const anchors=[{x:8,y:80,fullyVisible:false,edge:'left' as const},{x:8,y:80,fullyVisible:false,edge:'left' as const},{x:292,y:80,fullyVisible:false,edge:'right' as const},{x:8,y:40,fullyVisible:false,edge:'left' as const},{x:170,y:40,fullyVisible:true}];
  assert.deepEqual(offscreenFxMarkers(impacts,target=>target.kind==='minion'?anchors[Number(target.instanceId)]:undefined),[{edge:'left',side:0,count:2,x:8,y:80},{edge:'right',side:0,count:1,x:292,y:80},{edge:'left',side:1,count:1,x:8,y:40}]);
});
test('result sound plays only once for a live same-match outcome, not saved result reopens',()=>{
  const before:ResultSoundState={code:'match',seat:0,phase:'playing',winner:null},finished:ResultSoundState={...before,phase:'finished',winner:0};
  assert.equal(resultSoundTransition(before,finished),'win');assert.equal(resultSoundTransition(before,{...finished,winner:1}),'loss');assert.equal(resultSoundTransition(before,{...finished,winner:null}),'draw');assert.equal(resultSoundTransition(null,finished),null);assert.equal(resultSoundTransition(finished,finished),null);assert.equal(resultSoundTransition(before,{...finished,code:'new'}),null);assert.equal(resultSoundTransition(before,{...finished,seat:1}),null);assert.equal(resultSoundTransition(before,before),null);
});
test('effect rendering budgets cap backing pixels and preserve high-end desktop quality',()=>{
  const desktop=fxRenderBudget(1200,600,2,8,false),phone=fxRenderBudget(393,720,3,8,false),slow=fxRenderBudget(1024,768,2,4,false),reduced=fxRenderBudget(393,720,3,8,true);
  assert.deepEqual(desktop,{dpr:2,particleDensity:1,frameInterval:0});assert.equal(phone.dpr,1.5);assert.equal(phone.particleDensity,.65);
  assert.ok(slow.dpr**2*1024*768<=1_200_001);assert.equal(slow.frameInterval,1000/30);assert.equal(reduced.particleDensity,0);assert.equal(reduced.frameInterval,1000/30);
  assert.ok(Number.isFinite(fxRenderBudget(NaN,Infinity,NaN,undefined,false).dpr));assert.ok(fxRenderBudget(4000,3000,4,16,false).dpr**2*4000*3000<=3_200_001);
});
test('user quality profiles preserve strict pixel limits, accessibility, and stable automatic adaptation',()=>{
  const args=[393,720,3,8,false] as const,auto=fxRenderBudget(...args),economy=fxRenderBudget(...args,'economy'),rich=fxRenderBudget(...args,'rich');assert.ok(economy.dpr<auto.dpr&&auto.dpr<rich.dpr);assert.ok(economy.particleDensity<auto.particleDensity&&auto.particleDensity<rich.particleDensity);assert.equal(economy.frameInterval,1000/30);assert.ok(economy.dpr**2*393*720<=800_001);
  const desktop=fxRenderBudget(2500,1500,4,12,false,'rich');assert.ok(desktop.dpr**2*2500*1500<=3_200_001);assert.equal(desktop.particleDensity,1.25);
  assert.deepEqual(fxRenderBudget(393,720,3,4,false,'rich'),fxRenderBudget(393,720,3,4,false));assert.equal(fxRenderBudget(...[393,720,3,8,true] as const,'rich').particleDensity,0);
  let pressure=0;for(const delta of [60,16,60,60,60])pressure=fxFramePressure(pressure,delta);assert.equal(pressure,3);assert.equal(fxFramePressure(3,16),0);assert.equal(fxFramePressure(2,Infinity),0);
  const property=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
  try{assert.equal(normalizeFxQuality('invalid'),'auto');setBattleFxQuality('economy');assert.equal(battleFxQuality(),'economy');assert.equal(values.get('card-duel-fx-quality'),'economy');setBattleFxQuality('rich');assert.equal(battleFxQuality(),'rich');}finally{setBattleFxQuality('auto');if(property)Object.defineProperty(globalThis,'localStorage',property);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('automatic quality retains bounded pressure across consecutive cues and recovers without changing user settings',()=>{
  const initial=fxAutoAdaptation(0,100,2,'auto',false);assert.deepEqual(initial,{active:false,until:0});
  const overloaded=fxAutoAdaptation(initial.until,150,3,'auto',false);assert.equal(overloaded.until,150+FX_AUTO_RECOVERY_MS);assert.equal(overloaded.active,true);
  assert.deepEqual(fxAutoAdaptation(overloaded.until,2000,0,'auto',false),overloaded);
  const sustained=fxAutoAdaptation(overloaded.until,5000,3,'auto',false);assert.equal(sustained.until,5000+FX_AUTO_RECOVERY_MS);
  assert.deepEqual(fxAutoAdaptation(sustained.until,sustained.until,0,'auto',false),{active:false,until:0});
  for(const quality of ['economy','rich'] as const)assert.deepEqual(fxAutoAdaptation(sustained.until,6000,3,quality,false),{active:false,until:0});
  assert.deepEqual(fxAutoAdaptation(sustained.until,6000,3,'auto',true),{active:false,until:0});
  const held=fxRenderBudget(393,720,3,8,false,overloaded.active?'economy':'auto'),normal=fxRenderBudget(393,720,3,8,false,'auto');
  assert.ok(held.dpr<normal.dpr&&held.particleDensity<normal.particleDensity);assert.equal(held.frameInterval,1000/30);
  assert.equal(battleFxQuality(),'auto');
});
test('dense board impact labels fit horizontal lanes and stack mixed results inside the arena',()=>{
  const groups=Array.from({length:7},(_,i)=>({key:`m${i}`,position:{x:20+i*46,y:120},impacts:[{side:1 as const,target:{kind:'minion' as const,instanceId:`m${i}`},kind:'damage' as const,amount:15}]}));
  const mobile=layoutImpactLabels(groups,320,280);assert.equal(mobile.length,7);assert.ok(mobile.every(l=>l.text==='−15'&&l.x-l.maxWidth/2>=0&&l.x+l.maxWidth/2<=320));
  for(let i=1;i<mobile.length;i++)assert.ok(mobile[i-1].x+mobile[i-1].maxWidth/2+4<=mobile[i].x-mobile[i].maxWidth/2);
  const desktop=layoutImpactLabels([{...groups[0],position:{x:300,y:240}}],1000,600);assert.ok(desktop[0].fontSize>mobile[0].fontSize);
  const target:Target={kind:'hero',player:0},impacts:FxImpact[]=[{kind:'damage',amount:4,hitCount:3,side:0,target},{kind:'heal',amount:2,side:0,target},{kind:'armorHit',amount:3,side:0,target},{kind:'shieldGain',side:0,target}];
  for(const y of [0,85]){const stack=layoutImpactLabels([{key:'hero',position:{x:0,y},impacts}],320,90);assert.deepEqual(stack.map(l=>l.text),['3연타','−4','+2','방어도 −3','보호막 획득']);assert.ok(stack.every(l=>l.y-l.fontSize/2-l.floatUp>=0&&l.y+l.fontSize/2<=90));for(let i=1;i<stack.length;i++)assert.ok(stack[i-1].y+stack[i-1].fontSize/2<=stack[i].y-stack[i].fontSize/2);}
  assert.deepEqual(layoutImpactLabels(groups,NaN,100),[]);assert.deepEqual(layoutImpactLabels(groups,5,100),[]);
});
test('hit feedback tracks actual accepted damage, shield, healing and canceled attacks',()=>{
  const animation:BattleAnimation={kind:'attack',actor:0,revision:1,heavy:true},target:Target={kind:'hero',player:1};
  const event=(kind:FxImpact['kind'],amount?:number):FxImpact=>({side:1,target,kind,amount});
  assert.equal(impactFeedback(animation,[]).shake,0);assert.equal(impactFeedback({...animation,blocked:true},[]).kind,'blocked');
  assert.equal(impactFeedback(animation,[event('shield')]).kind,'shield');assert.equal(impactFeedback(animation,[event('heal',5)]).shake,0);
  assert.deepEqual(impactFeedback(animation,[event('armorGain',2)]),{kind:'protect',strength:.75,shake:0});
  assert.equal(impactFeedback(animation,[event('shieldGain')]).kind,'protect');assert.equal(defenseImpactLabel(event('armorGain',2)),'방어도 +2');assert.equal(defenseImpactLabel(event('shieldGain')),'보호막 획득');assert.equal(defenseImpactLabel(event('shield')),'보호막 소모');assert.equal(defenseImpactLabel(event('damage',2)),null);
  const small=impactFeedback(animation,[event('damage',1)]),big=impactFeedback(animation,[event('damage',12)]),huge=impactFeedback(animation,[event('damage',1000),event('damage',1000)]);
  assert.equal(small.kind,'damage');assert.ok(small.strength<big.strength&&small.shake<big.shake);assert.equal(huge.shake,10);assert.ok(huge.strength<=1.45);assert.equal(impactFeedback({...animation,blocked:true},[event('damage',2)]).kind,'damage');
});
test('opt-in touch haptics distinguish accepted outcomes and safely bound repeated pulses',()=>{
  const a:BattleAnimation={kind:'attack',actor:0,revision:3},damage={kind:'damage' as const,strength:1.4,shake:8},armor={kind:'armor' as const,strength:.8,shake:2};
  assert.deepEqual(hapticPattern(a,damage,0),[55]);assert.deepEqual(hapticPattern(a,armor,0),[16,20,16]);assert.deepEqual(hapticPattern(a,{...damage,armor:true},0),[18,25,55]);assert.deepEqual(hapticPattern(a,{...damage,extraHits:99},0),[55,24,20,24,16]);
  assert.deepEqual(hapticPattern({...a,kind:'turn'},{kind:'neutral',strength:1,shake:0},0),[]);assert.deepEqual(hapticPattern({...a,kind:'summon'},{kind:'neutral',strength:1,shake:0},1),[]);assert.deepEqual(hapticPattern({...a,kind:'summon'},{kind:'neutral',strength:1,shake:0},0),[18]);
  const calls:(number|number[])[]=[],device={maxTouchPoints:1,vibrate:(p:number|number[])=>{calls.push(p);return true;}};const property=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
  try{setBattleHaptics(false);assert.equal(battleHapticsEnabled(),false);assert.equal(playBattleHaptic(a,damage,0,device,0),false);assert.equal(calls.length,0);assert.equal(hapticSupported({maxTouchPoints:0,vibrate:device.vibrate}),false);setBattleHaptics(true);assert.equal(values.get('card-duel-battle-haptics'),'on');assert.equal(playBattleHaptic(a,damage,0,device,0),true);assert.equal(playBattleHaptic(a,damage,0,device,200),false);assert.equal(playBattleHaptic(a,armor,0,device,250),true);assert.equal(previewBattleHaptics(device),true);assert.equal(previewBattleHaptics({maxTouchPoints:1,vibrate:()=>{throw Error('unsupported');}}),false);stopBattleHaptics(device);assert.deepEqual(calls,[[55],[16,20,16],[24,25,14],0]);}
  finally{setBattleHaptics(false);if(property)Object.defineProperty(globalThis,'localStorage',property);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('battle sound volume preserves mute preference, clamps input and recreates closed audio contexts',async()=>{
  assert.deepEqual([undefined,null,'',NaN,Infinity,-4,48.6,'75',101].map(normalSoundVolume),[100,100,100,100,100,0,49,75,100]);
  const storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),audio=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),doc=Object.getOwnPropertyDescriptor(globalThis,'document');
  const values=new Map<string,string>(),contexts:FakeContext[]=[],gains:number[]=[],oscillators:FakeOscillator[]=[],gainNodes:{disconnects:number}[]=[];const page={hidden:false};
  class FakeOscillator{type='';frequency={setValueAtTime(){},exponentialRampToValueAtTime(){}};stops:number[]=[];disconnects=0;onended:(()=>void)|null=null;connect(){}start(){}stop(at=0){this.stops.push(at);}disconnect(){this.disconnects++;}constructor(){oscillators.push(this);}}
  class FakeContext{state='running';currentTime=0;destination={};resumeCalls=0;pending=false;gain={value:0,setTargetAtTime(value:number){gains.push(value);},setValueAtTime(){},exponentialRampToValueAtTime(){}};constructor(){contexts.push(this);}created=0;createGain(){const node={gain:this.created++===0?this.gain:{...this.gain,setTargetAtTime(){}},connect(){},disconnects:0,disconnect(){this.disconnects++;}};gainNodes.push(node);return node;}createOscillator(){return new FakeOscillator();}createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},connect(){}};}resume(){this.resumeCalls++;if(this.pending)return new Promise<void>(()=>{});this.state='running';return Promise.resolve();}}
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:FakeContext});
  Object.defineProperty(globalThis,'document',{configurable:true,value:page});
  try{setBattleSound(false);setBattleSoundVolume(50);assert.equal(battleSoundEnabled(),false);assert.equal(battleSoundVolume(),50);assert.equal(values.get('card-duel-sound-volume'),'50');unlockBattleSound();assert.equal(contexts.length,0);
    setBattleSound(true);assert.equal(contexts.length,1);assert.equal(contexts[0].gain.value,.16);setBattleSoundVolume(25);assert.equal(gains.at(-1),.08);setBattleSound(false);assert.equal(gains.at(-1),0);assert.equal(battleSoundVolume(),25);setBattleSound(true);assert.equal(gains.at(-1),.08);
    contexts[0].state='closed';unlockBattleSound();assert.equal(contexts.length,2);assert.equal(contexts[1].gain.value,.08);setBattleSoundVolume(0);assert.equal(gains.at(-1),0);
    contexts[1].state='suspended';contexts[1].pending=true;unlockBattleSound(new Event('pointerdown'));assert.equal(contexts[1].resumeCalls,1);setBattleSoundVolume(25);unlockBattleSound(new Event('pointerdown'));assert.equal(contexts[1].resumeCalls,1);unlockBattleSound(new Event('click'));assert.equal(contexts[1].resumeCalls,2);contexts[1].state='closed';unlockBattleSound();assert.equal(contexts.length,3);
    setBattleSoundVolume(100);const turn:BattleAnimation={kind:'turn',actor:0,revision:1};playBattleSound(turn,'gold','impact');assert.equal(oscillators.length,1);assert.equal(oscillators[0].stops.length,1);
    page.hidden=true;stopBattleSound();assert.equal(oscillators[0].stops.length,2);assert.equal(oscillators[0].disconnects,1);assert.equal(gainNodes.at(-1)?.disconnects,1);assert.equal(oscillators[0].onended,null);stopBattleSound();assert.equal(oscillators[0].stops.length,2);
    playBattleSound(turn,'gold','impact');playBattleResultSound('win');assert.equal(oscillators.length,1);assert.equal(battleSoundEnabled(),true);page.hidden=false;playBattleSound(turn,'gold','impact');assert.equal(oscillators.length,2);
    const ended=oscillators[1];ended.onended?.();assert.equal(ended.disconnects,1);assert.equal(ended.stops.length,1);
    for(let i=0;i<40;i++)playBattleSound(turn,'gold','impact');
    assert.equal(oscillators.filter(o=>o.disconnects===0).length,32);
    setBattleSound(false);assert.equal(oscillators.filter(o=>o.disconnects===0).length,0);assert.equal(ended.stops.length,1);
    setBattleSound(true);playBattleSound(turn,'gold','impact');const latest=oscillators.at(-1)!;setBattleSoundVolume(0);assert.equal(latest.disconnects,1);assert.equal(gainNodes.at(-1)?.disconnects,1);
  }finally{page.hidden=false;stopBattleSound();setBattleSoundVolume(100);setBattleSound(true);if(storage)Object.defineProperty(globalThis,'localStorage',storage);else Reflect.deleteProperty(globalThis,'localStorage');if(audio)Object.defineProperty(globalThis,'AudioContext',audio);else Reflect.deleteProperty(globalThis,'AudioContext');if(doc)Object.defineProperty(globalThis,'document',doc);else Reflect.deleteProperty(globalThis,'document');}
});
test('background visibility skips queued accepted cues, preserves newest revision, and resumes only fresh cues',()=>{
 const s=ready(),first=action(s,{type:'endTurn'}),second=action(first.after,{type:'endTurn'},1),third=action(second.after,{type:'endTurn'}),fourth=action(third.after,{type:'endTurn'},1);
 const base=room(s,0),one=room(first.after,0,first.animation),two=room(second.after,0,second.animation),three=room(third.after,0,third.animation),four=room(fourth.after,0,fourth.animation);
 let id=0,visible=s.revision,currentCue:number|null=null;const timers=new Map<ReturnType<typeof setTimeout>,()=>void>(),cues:number[]=[];
 const timeline=new PlaybackTimeline(base,v=>{visible=v.state!.revision;},cue=>{currentCue=cue?.animation.revision??null;if(cue)cues.push(cue.animation.revision);},{schedule:fn=>{const handle=++id as unknown as ReturnType<typeof setTimeout>;timers.set(handle,fn);return handle;},cancel:handle=>{timers.delete(handle);}});
 timeline.receive(one,true);timeline.receive(two,true);assert.equal(timers.size,2);assert.equal(visible,s.revision);
 timeline.setVisible(false);assert.equal(timers.size,0);assert.equal(currentCue,null);assert.equal(visible,second.after.revision);
 timeline.receive(three,true);timeline.receive(two,true);assert.equal(visible,third.after.revision);assert.equal(timers.size,0);assert.deepEqual(cues,[first.after.revision]);
 timeline.setVisible(true);assert.equal(currentCue,null);assert.equal(timers.size,0);timeline.receive(four,true);assert.equal(currentCue,fourth.after.revision);assert.deepEqual(cues,[first.after.revision,fourth.after.revision]);assert.equal(timers.size,2);timeline.dispose();
});
function ready(){
  let s=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'warrior')],{seed:19,firstPlayer:0});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});s.players[0].mana=10;s.players[0].maxMana=10;
  return s;
}
test('real armor-only and mixed hits preserve rules, exact public trace and appropriate hurt dialogue',()=>{
  for(const armor of [5,2,0]){const s=ready();s.players[1].armor=armor;s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
    const a:Action={type:'attack',attackerId:'attacker',target:{kind:'hero',player:1}},events:BattleVisualEvent[]=[];
    const next=applyAction(s,0,a,{visualEvent:e=>events.push(e)});assert.deepEqual(next,applyAction(s,0,a));
    const trace=describeAcceptedAction(s,next,0,a,events)!;
    const hit=events.find(e=>e.kind==='damage');assert.ok(hit?.kind==='damage');assert.equal(hit.armorAbsorbed,Math.min(armor,3));assert.equal(hit.amount,3);
    const impacts=impactChanges(getPlayerView(s,0),getPlayerView(next,0),0,events),reverse=impactChanges(getPlayerView(s,1),getPlayerView(next,1),1,events);assert.deepEqual(impacts,reverse);
    assert.equal(impacts.find(i=>i.kind==='armorHit')?.amount??0,Math.min(armor,3));assert.equal(impacts.find(i=>i.kind==='damage')?.amount??0,Math.max(0,3-armor));
    assert.equal(impactFeedback(trace,impacts).kind,armor>=3?'armor':'damage');assert.equal(impactFeedback(trace,impacts).armor,armor===2?true:undefined);
    assert.equal(dialoguePlan(trace,getPlayerView(s,0),getPlayerView(next,0),0,catalog).impact.length,0);
  }
});
test('precise armor trace splits repeated hits despite simultaneous armor gain and bounds feedback',()=>{
  const s=ready();s.players[1].armor=2;const before=getPlayerView(s,0),after=structuredClone(before);after.opponent.armor=3;after.opponent.health=28;
  const target:Target={kind:'hero',player:1},events:BattleVisualEvent[]=[{kind:'damage',side:1,target,amount:2,armorAbsorbed:2},{kind:'damage',side:1,target,amount:2,armorAbsorbed:0},{kind:'damage',side:1,target,amount:1,armorAbsorbed:1}];
  const impacts=impactChanges(before,after,0,events);assert.deepEqual(impacts.filter(i=>i.kind==='armorHit'||i.kind==='damage'),[{kind:'armorHit',side:1,target,amount:3,hitCount:3},{kind:'damage',side:1,target,amount:2,hitCount:3}]);
  const feedback=impactFeedback({kind:'spell',actor:0,revision:4},impacts);assert.equal(feedback.extraHits,2);assert.equal(feedback.armor,true);assert.equal(defenseImpactLabel(impacts[1]),'방어도 −3');
  assert.equal(impactFeedback({kind:'spell',actor:0,revision:4},[{kind:'damage',side:1,target,amount:100,hitCount:50}]).extraHits,3);
});
test('legacy armor fallback respects old traces, transformation and blocked damage',()=>{
  const s=ready();s.players[1].armor=5;const before=getPlayerView(s,0),after=structuredClone(before);after.opponent.armor=2;
  const target:Target={kind:'hero',player:1},damage:BattleVisualEvent={kind:'damage',side:1,target,amount:3};
  assert.deepEqual(impactChanges(before,after,0,[damage]),[{kind:'armorHit',side:1,target,amount:3}]);assert.deepEqual(impactChanges(before,after,0),[{kind:'armorHit',side:1,target,amount:3}]);assert.deepEqual(impactChanges(before,after,0,[]),[]);
  after.opponent.heroForm='jaraxxus';assert.deepEqual(impactChanges(before,after,0,[damage]),[{kind:'damage',side:1,target,amount:3}]);assert.deepEqual(impactChanges(before,after,0),[]);
});
function room(s:GameState,seat:PlayerId,animation?:BattleAnimation):RoomView{
  return {code:'TESTFX',seat,mode:'human',status:s.phase==='finished'?'finished':'playing',opponentConnected:true,state:getPlayerView(s,seat),animation};
}
function action(s:GameState,a:Action,actor:PlayerId=0){const after=applyAction(s,actor,a);const animation=describeAcceptedAction(s,after,actor,a);assert.ok(animation);return{after,animation};}
test('recent impact history records exact public outcomes, retains earlier actions and rejects replay or hidden identities',()=>{
  const s=ready(),target:Target={kind:'hero',player:1};s.players[1].armor=2;s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:3,health:3,maxHealth:3,attacksRemaining:1}];
  const a:Action={type:'attack',attackerId:'attacker',target},events:BattleVisualEvent[]=[];const result=applyAction(s,0,a,{visualEvent:e=>events.push(e)}),anim=describeAcceptedAction(s,result,0,a,events)!;
  const before=room(s,0),after=room(result,0,anim),name=(card:typeof catalog[string])=>card.name;
  const entry=advanceImpactHistory(before,after,[],catalog,name);assert.equal(entry.length,1);assert.equal(entry[0].actor,'나');assert.equal(entry[0].source?.cardId,'wolf');assert.equal(entry[0].target?.armor,0);assert.equal(entry[0].target?.health,29);assert.match(entry[0].lines.join(' '),/상대 영웅.*방어도 −2.*체력 피해 1/);
  assert.equal(advanceImpactHistory(after,after,entry,catalog,name),entry);assert.deepEqual(advanceImpactHistory(null,after,entry,catalog,name),[]);assert.deepEqual(advanceImpactHistory(before,{...after,code:'NEW'},entry,catalog,name),[]);
  assert.deepEqual(advanceImpactHistory(before,{...after,state:{...after.state!,revision:after.state!.revision+3}},entry,catalog,name),entry);
  const secret={...after,animation:{kind:'secret' as const,actor:1 as const,revision:after.state!.revision,cardId:'hidden-card',events:[]},state:{...before.state!,revision:after.state!.revision}};
  assert.equal(advanceImpactHistory(before,secret,entry,catalog,name)[0].lines[0],'비밀 설치');
  assert.doesNotMatch(JSON.stringify(advanceImpactHistory(before,secret,entry,catalog,name)[0]),/hidden-card/);
  const blocked={...secret,animation:{...secret.animation,kind:'attack' as const,blocked:true}};assert.deepEqual(advanceImpactHistory(before,blocked,[],catalog,name)[0].lines,['공격 차단']);
  const capped=advanceImpactHistory(before,after,Array.from({length:6},(_,i)=>({...entry[0],revision:i})),catalog,name);assert.equal(capped.length,7);
});
test('impact history disambiguates duplicate units by pre/post-action slots and reports actual buff and transform changes',()=>{
  for(const seat of [0,1] as const){const enemy=seat===0?1:0,s=ready(),unit=(instanceId:string)=>({cardId:'wolf',instanceId,attack:3,health:3,maxHealth:3,attacksRemaining:1});s.players[enemy].board=[unit('first'),unit('second'),unit('third')];
    const before=room(s,seat),after=structuredClone(before),v=after.state!;v.revision++;v.opponent.board=[{...unit('second'),attack:5,maxHealth:4,health:4},{...unit('third'),cardId:'recruit',attack:1,health:1,maxHealth:1},unit('new')];
    after.animation={kind:'spell',actor:seat,revision:v.revision,events:[{kind:'damage',target:{kind:'minion',instanceId:'first'},side:enemy,amount:3},{kind:'death',target:{kind:'minion',instanceId:'first'},side:enemy}]};
    const lines=advanceImpactHistory(before,after,[],catalog,card=>card.id)[0].lines;
    assert.ok(lines.some(l=>l.includes('wolf (행동 전 1번)')&&l.includes('사망')&&l.includes('체력 피해 3')));
    assert.ok(lines.some(l=>l.includes('wolf (행동 전 2번)')&&l.includes('공격 3→5')&&l.includes('최대 체력 3→4')));
    assert.ok(lines.some(l=>l.includes('wolf (행동 전 3번)')&&l.includes('변신 → recruit')));
    assert.ok(lines.some(l=>l.includes('wolf (행동 후 3번)')&&l.includes('소환')));
    assert.ok(lines.every(l=>!l.includes('instanceId')));
  }
});
const enemyHero:Target={kind:'hero',player:1};
test('nine heroes have six distinct original emotes and every collectible can speak all four battle stages',()=>{
  const emotes=new Set<string>();
  for(const hero of Object.keys(HERO_DIALOGUE) as (keyof typeof HERO_DIALOGUE)[])for(const key of Object.keys(EMOTE_LABELS) as (keyof typeof EMOTE_LABELS)[]){
    const line=heroEmote(hero,0,key);assert.equal(line.kind,'emote');assert.ok(line.text);emotes.add(line.text);
  }
  assert.equal(emotes.size,54);
  const cards=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);assert.equal(cards.length,382);
  for(const c of cards)for(const kind of ['play','attack','hit','death'] as const){
    const line=cardDialogue(c,'mage',0,kind,11);assert.equal(line.cardId,c.id);assert.equal(line.speaker,c.name);assert.equal(line.kind,kind);assert.ok(line.text);
  }
  assert.notEqual(cardDialogue(catalog.wisp,'mage',0,'play',1).text,cardDialogue(catalog.ogre,'mage',0,'play',1).text);
});
test('legendary voices have card-specific lines, stable voices, and stage-dependent emotional delivery',()=>{
  const ids=['grommash_hellscream','alakir','edwin_vancleef','tirion_fordring','king_krush','cenarius','lord_jaraxxus','archmage_antonidas','prophet_velen','bloodmage_thalnos','lorewalker_cho','millhouse_manastorm','nat_pagle','king_mukla','leeroy_jenkins','cairne_bloodhoof','the_black_knight','sylvanas_windrunner','hogger','illidan_stormrage','baron_geddon','gruul','ragnaros'];
  for(const id of ids){assert.ok(catalog[id],id);for(const kind of ['play','attack','hit','death'] as const){const c=cardDialogue(catalog[id],'mage',0,kind,1);assert.equal(c.text,cardDialogue(catalog[id],'mage',0,kind,2).text);assert.ok(c.rate>=.72&&c.rate<=1.4&&c.pitch>=.45&&c.pitch<=1.75);}const attack=cardDialogue(catalog[id],'mage',0,'attack',1),death=cardDialogue(catalog[id],'mage',0,'death',1);assert.ok(attack.rate>death.rate&&attack.pitch>=death.pitch);}
  const voices=[{name:'A',lang:'ko-KR',localService:true},{name:'B',lang:'ko-KR',localService:true},{name:'C',lang:'ko-KR',localService:false}];
  const chosen=new Set(ids.map(id=>localKoreanVoice(voices,id)?.name));assert.equal(chosen.size,2);for(const id of ids)assert.equal(localKoreanVoice(voices,id)?.name,localKoreanVoice([...voices].reverse(),id)?.name);assert.ok(!chosen.has('C'));
});
test('summon voice remains while minion attack, hit and death stay silent',()=>{
  const s=ready();s.players[0].hand=[{cardId:'wisp',instanceId:'held'}];
  const play=action(s,{type:'playCard',instanceId:'held'});assert.equal(dialoguePlan(play.animation,getPlayerView(s,0),getPlayerView(play.after,0),0,catalog).start[0].cardId,'wisp');
  s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:4,health:5,maxHealth:5,attacksRemaining:1}];
  s.players[1].board=[{cardId:'wisp',instanceId:'victim',attack:1,health:1,maxHealth:1,attacksRemaining:1}];
  const a:Action={type:'attack',attackerId:'attacker',target:{kind:'minion',instanceId:'victim'}};
  const events:BattleVisualEvent[]=[];const after=applyAction(s,0,a,{visualEvent:e=>events.push(e)}),animation=describeAcceptedAction(s,after,0,a,events)!;
  const plan=dialoguePlan(animation,getPlayerView(s,0),getPlayerView(after,0),0,catalog);
  const reversed=dialoguePlan(animation,getPlayerView(s,1),getPlayerView(after,1),1,catalog);
  assert.deepEqual(plan,{start:[],impact:[],death:[]});assert.deepEqual(plan,reversed);
});
test('blocked, shielded and returned units never speak false hit or death lines; secrets stay generic',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:3,health:5,maxHealth:5,attacksRemaining:1}];
  s.players[1].board=[{cardId:'wisp',instanceId:'target',attack:0,health:1,maxHealth:1,attacksRemaining:0,keywords:['divineShield']}];
  const before=getPlayerView(s,0),after=structuredClone(before);
  const base:BattleAnimation={kind:'attack',actor:0,attackerId:'attacker',revision:5,events:[{kind:'shield',side:1,target:{kind:'minion',instanceId:'target'}}]};
  assert.equal(dialoguePlan(base,before,after,0,catalog).impact.length,0);assert.equal(dialoguePlan({...base,blocked:true,events:[]},before,after,0,catalog).death.length,0);
  after.opponent.board=[];assert.equal(dialoguePlan({...base,events:[]},before,after,0,catalog).death.length,0);
  const secret=dialoguePlan({kind:'secret',actor:1,revision:5,cardId:'ice_block'},before,before,0,catalog);
  assert.deepEqual(secret,{start:[],impact:[],death:[]});assert.doesNotMatch(JSON.stringify(secret),/ice_block/);
});
test('only installed Korean voices are accepted and the speech queue respects mute and voice setting',()=>{
  const remote={lang:'ko-KR',localService:false},english={lang:'en-US',localService:true},local={lang:'ko-KR',localService:true};
  assert.equal(localKoreanVoice([remote,english]),undefined);assert.equal(localKoreanVoice([remote,english,local]),local);
  const synthDescriptor=Object.getOwnPropertyDescriptor(globalThis,'speechSynthesis'),utteranceDescriptor=Object.getOwnPropertyDescriptor(globalThis,'SpeechSynthesisUtterance');
  const spoken:FakeUtterance[]=[];let cancelled=0;
  class FakeUtterance{voice:unknown;lang='';pitch=1;rate=1;volume=1;text:string;onend?:()=>void;onerror?:()=>void;constructor(text:string){this.text=text;}}
  Object.defineProperty(globalThis,'speechSynthesis',{configurable:true,value:{getVoices:()=>[remote,local],speak:(v:FakeUtterance)=>spoken.push(v),cancel:()=>{cancelled++;}}});
  Object.defineProperty(globalThis,'SpeechSynthesisUtterance',{configurable:true,value:FakeUtterance});
  try{
    setBattleSound(true);setBattleSoundVolume(50);setDialogueVoiceEnabled(true);
    const line=heroEmote('mage',0,'greet'),hit=heroEmote('warrior',1,'threat');
    speakDialogue([line,hit]);assert.equal(spoken.length,1);assert.equal(spoken[0].voice,local);assert.ok(Math.abs(spoken[0].volume-.72)<1e-10);
    const ended=spoken[0];ended.onend?.();assert.equal(spoken.length,2);assert.equal(ended.onend,null);assert.equal(ended.onerror,null);
    setDialogueVoiceEnabled(false);assert.equal(dialogueVoiceEnabled(),false);assert.equal(cancelled,1);
    speakDialogue([line]);assert.equal(spoken.length,2);
    setDialogueVoiceEnabled(true);setBattleSoundVolume(0);speakDialogue([line]);assert.equal(spoken.length,3);
    setBattleSoundVolume(100);setBattleSound(false);speakDialogue([line]);assert.equal(spoken.length,3);
  }finally{
    stopDialogueVoice();setDialogueVoiceEnabled(true);setBattleSoundVolume(100);setBattleSound(true);
    if(synthDescriptor)Object.defineProperty(globalThis,'speechSynthesis',synthDescriptor);else Reflect.deleteProperty(globalThis,'speechSynthesis');
    if(utteranceDescriptor)Object.defineProperty(globalThis,'SpeechSynthesisUtterance',utteranceDescriptor);else Reflect.deleteProperty(globalThis,'SpeechSynthesisUtterance');
  }
});
test('independent dialogue volume and preview honor mute, offline-only voices and never claim actual playback',()=>{
  const synthDescriptor=Object.getOwnPropertyDescriptor(globalThis,'speechSynthesis'),utteranceDescriptor=Object.getOwnPropertyDescriptor(globalThis,'SpeechSynthesisUtterance'),storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),docDescriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),page={hidden:false};
  const local={lang:'ko-KR',localService:true},remote={lang:'ko-KR',localService:false},spoken:FakeUtterance[]=[],storage=new Map<string,string>();let voices=[local,remote],cancelled=0,fail=false;
  class FakeUtterance{voice:unknown;lang='';pitch=1;rate=1;volume=1;text:string;onend?:()=>void;onerror?:()=>void;constructor(text:string){this.text=text;}}
  Object.defineProperty(globalThis,'speechSynthesis',{configurable:true,value:{getVoices:()=>voices,speak:(v:FakeUtterance)=>{if(fail)throw Error('device');spoken.push(v);},cancel:()=>{cancelled++;}}});
  Object.defineProperty(globalThis,'SpeechSynthesisUtterance',{configurable:true,value:FakeUtterance});Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:page});
  try{const line=heroEmote('mage',0,'greet');setBattleSound(true);setBattleSoundVolume(50);setDialogueVoiceEnabled(true);setDialogueVoiceVolume(25);
    assert.equal(dialogueVoiceVolume(),25);assert.equal(storage.get('card-duel-dialogue-volume'),'25');assert.equal(installedKoreanVoiceCount(),1);assert.equal(previewDialogue(line),'requested');assert.equal(spoken[0].volume,.2);assert.equal(spoken[0].voice,local);
    setDialogueVoiceVolume(0);assert.equal(cancelled,1);assert.equal(previewDialogue(line),'muted');assert.equal(battleSoundVolume(),50);
    setDialogueVoiceVolume(100);voices=[remote];assert.equal(installedKoreanVoiceCount(),0);assert.equal(previewDialogue(line),'unavailable');assert.equal(spoken.length,1);
    voices=[local];fail=true;assert.equal(previewDialogue(line),'failed');assert.equal(spoken.length,1);
    fail=false;page.hidden=true;speakDialogue([line]);assert.equal(previewDialogue(line),'failed');assert.equal(spoken.length,1);page.hidden=false;assert.equal(previewDialogue(line),'requested');assert.equal(spoken.length,2);
  }finally{page.hidden=false;stopDialogueVoice();setDialogueVoiceVolume(100);setDialogueVoiceEnabled(true);setBattleSoundVolume(100);setBattleSound(true);for(const [key,descriptor] of [['speechSynthesis',synthDescriptor],['SpeechSynthesisUtterance',utteranceDescriptor],['localStorage',storageDescriptor],['document',docDescriptor]] as const){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
test('a card click only selects or deselects, even for free minions and targeted spells; only a drop plays',()=>{
  const s=ready();s.players[0].hand=[{instanceId:'cheap',cardId:'wisp'},{instanceId:'spell',cardId:'flame_sphere'}];
  const v=getPlayerView(s,0),held=selectHandCard(v,0,catalog,'cheap',null);assert.deepEqual(held,{kind:'held',id:'cheap'});
  assert.equal(selectHandCard(v,0,catalog,'cheap',held),null);assert.deepEqual(targetsFor(v,0,catalog,held),[]);
  const spell=selectHandCard(v,0,catalog,'spell',held);assert.deepEqual(spell,{kind:'held',id:'spell'});
  assert.equal(targetAction(v,0,catalog,spell,enemyHero),null);assert.equal(s.players[0].hand.length,2);
  const drag=resolveDrop(v,0,catalog,{revision:s.revision,intent:{kind:'card',id:'cheap'}},{kind:'board',position:0});
  assert.ok(drag?.action);assert.equal(drag.action.type,'playCard');assert.equal(applyAction(s,0,drag.action).players[0].board.length,1);
  assert.equal(selectHandCard(v,1,catalog,'cheap',null),null);
});
test('accepted attack metadata is public, mirrored on both seats, and uses exact normalized target',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'public-wolf',attack:5,health:2,maxHealth:2,attacksRemaining:1}];
  const {after,animation}=action(s,{type:'attack',attackerId:'public-wolf',target:{kind:'hero'}});
  assert.deepEqual(animation,{revision:after.revision,actor:0,kind:'attack',attackerId:'public-wolf',target:enemyHero,heavy:true});
  const own=nextPlayback(room(s,0),room(after,0,animation))!,opponent=nextPlayback(room(s,1),room(after,1,animation))!;
  assert.equal(own.duration,1300);assert.equal(own.impact,820);assert.equal(opponent.impact,own.impact);
  assert.deepEqual(impactChanges(own.before.state!,own.after.state!,0),[{side:1,target:enemyHero,kind:'damage',amount:5}]);
  assert.deepEqual(impactChanges(opponent.before.state!,opponent.after.state!,1),[{side:1,target:enemyHero,kind:'damage',amount:5}]);
});
test('optional solo animation speed changes the playback timing, not the authoritative revision',()=>{
  const s=ready(),{after,animation}=action(s,{type:'endTurn'}),before=room(s,0),next=room(after,0,animation);
  const normal=nextPlayback(before,next)!,fast=nextPlayback(before,{...next,animationSpeed:'fast'})!;
  assert.equal(fast.duration,Math.round(normal.duration*.55));assert.equal(fast.impact,Math.round(normal.impact*.55));assert.deepEqual(fast.after.state,normal.after.state);
  assert.equal(nextPlayback(before,{...next,animationSpeed:'instant'}),null);assert.deepEqual(scaledBattleTiming(animation,'instant'),{duration:0,impact:0});
  const instant={...next,animationSpeed:'instant' as const};assert.deepEqual(freshAcceptedAnimation(before,instant),animation);assert.equal(freshAcceptedAnimation(instant,instant),null);assert.equal(freshAcceptedAnimation(before,{...instant,code:'other'}),null);assert.equal(freshAcceptedAnimation(before,{...instant,seat:1}),null);assert.equal(freshAcceptedAnimation(before,{...instant,state:{...instant.state!,revision:instant.state!.revision+2}}),null);
});
test('hidden secret and hand identifiers never appear in accepted action animation',()=>{
  const s=ready();s.players[0].hand=[{instanceId:'private-secret-123',cardId:'ice_block'}];
  const {animation}=action(s,{type:'playCard',instanceId:'private-secret-123'});
  assert.deepEqual(Object.keys(animation).sort(),['actor','kind','revision']);assert.equal(animation.kind,'secret');
  assert.doesNotMatch(JSON.stringify(animation),/ice_block|private-secret/);
  s.players[0].hand=[{instanceId:'private-spell-456',cardId:'flame_sphere'}];
  const spell=action(s,{type:'playCard',instanceId:'private-spell-456',target:enemyHero}).animation;
  assert.equal(spell.cardId,'flame_sphere');assert.doesNotMatch(JSON.stringify(spell),/private-spell/);
});
test('snapshot comparison identifies armor, simultaneous damage, removal, heal, summon, freeze and shield changes',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'alpha',attack:3,health:2,maxHealth:2,attacksRemaining:1,keywords:['divineShield']}];
  s.players[1].board=[{cardId:'wisp',instanceId:'beta',attack:1,health:1,maxHealth:1,attacksRemaining:1}];
  const before=getPlayerView(s,0),after=structuredClone(before);after.opponent.armor=2;after.opponent.board=[];after.self.health--;
  after.self.board[0].keywords=[];after.self.board[0].attack=4;after.self.board[0].frozenThroughTurn=2;
  after.self.board.push({cardId:'wisp',instanceId:'summoned',attack:1,health:1,maxHealth:1,attacksRemaining:0});
  const result=impactChanges(before,after,0);
  assert.deepEqual(result.map(e=>e.kind).sort(),['armorGain','buff','damage','freeze','leave','shield','summon'].sort());
  const heal=structuredClone(after);heal.self.health++;assert.deepEqual(impactChanges(after,heal,0).map(e=>e.kind),['heal']);
});
test('accepted armor, shield gain, absorption and silence show separate defense feedback on both seats',()=>{
  const s=ready();s.players[0].heroClass='warrior';s.players[0].heroPowerUsed=false;
  s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
  s.players[1].board=[{cardId:'wolf',instanceId:'target',attack:0,health:2,maxHealth:2,attacksRemaining:1}];
  const target:Target={kind:'minion',instanceId:'target'};
  const trace=(state:GameState,act:Action)=>{const events:BattleVisualEvent[]=[];const after=applyAction(state,0,act,{visualEvent:e=>events.push(e)});assert.deepEqual(after,applyAction(state,0,act));return [0,1].map(seat=>impactChanges(getPlayerView(state,seat as PlayerId),getPlayerView(after,seat as PlayerId),seat as PlayerId,events));};
  const armor=trace(s,{type:'heroPower'});assert.deepEqual(armor[0],armor[1]);assert.deepEqual(armor[0],[{side:0,target:{kind:'hero',player:0},kind:'armorGain',amount:2}]);
  s.players[0].hand=[{instanceId:'grant',cardId:'light_guard'}];const grant=trace(s,{type:'playCard',instanceId:'grant',target});assert.deepEqual(grant[0],grant[1]);assert.ok(grant[0].some(i=>i.kind==='shieldGain'));
  s.players[1].board[0].keywords=['divineShield'];const hit=trace(s,{type:'attack',attackerId:'attacker',target});assert.deepEqual(hit[0],hit[1]);assert.equal(hit[0].filter(i=>i.kind==='shield').length,1);assert.ok(!hit[0].some(i=>i.kind==='damage'&&i.side===1));
  s.players[0].hand=[{instanceId:'silence',cardId:'silencing_rune'}];const silence=trace(s,{type:'playCard',instanceId:'silence',target});assert.deepEqual(silence[0],silence[1]);assert.ok(!silence[0].some(i=>i.kind==='shield'));
  const silenced=applyAction(s,0,{type:'playCard',instanceId:'silence',target});assert.ok(!impactChanges(getPlayerView(s,0),getPlayerView(silenced,0),0).some(i=>i.kind==='shield'));
});
test('duplication, skipped revisions, initial connection and mismatched events cannot replay stale actions',()=>{
  const s=ready(),{after,animation}=action(s,{type:'endTurn'});
  const before=room(s,0),next=room(after,0,animation);
  assert.ok(nextPlayback(before,next));assert.equal(nextPlayback(next,next),null);assert.equal(nextPlayback(before,{...next,animation:undefined}),null);
  assert.equal(nextPlayback(before,{...next,animation:{...animation,revision:animation.revision-1}}),null);
  assert.equal(nextPlayback({...before,state:null},next),null);
  assert.equal(nextPlayback(before,{...next,state:{...next.state!,revision:next.state!.revision+2}}),null);
  assert.equal(nextPlayback(before,{...next,code:'OTHER1'}),null);
});
test('ordinary summons have time to transform and land and retain fast and instant modes',()=>{
  const summon={kind:'summon',actor:0,revision:1} as const;
  assert.deepEqual(battleAnimationTiming(summon),{duration:2800,impact:2100});
  const before=room(ready(),0);
  const after={...before,state:{...before.state!,revision:before.state!.revision+1},animation:{...summon,revision:before.state!.revision+1}};
  assert.equal(nextPlayback(before,after)?.duration,2800);
  assert.equal(nextPlayback(before,{...after,animationSpeed:'fast'})?.duration,1540);
  assert.equal(nextPlayback(before,{...after,animationSpeed:'instant'}),null);
});
test('direct strikes use the new cadence while other cues retain doubled timing',()=>{
  const previous={
    attack:[1000,430],heroAttack:[1250,520],spell:[1250,550],summon:[1400,1050],
    weapon:[1050,530],secret:[1050,540],coin:[900,420],power:[1100,500],turn:[800,180],choice:[650,240],
  } as const;
  for(const kind of Object.keys(previous) as (keyof typeof previous)[]){
    const cue:BattleAnimation={kind,actor:0,revision:5};
    const [duration,impact]=previous[kind];
    if(kind==='attack'||kind==='heroAttack'){
      assert.deepEqual(battleAnimationTiming(cue),{duration:1300,impact:820});
      assert.equal(battleAnimationTiming({...cue,events:[{kind:'death',side:1,target:{kind:'minion',instanceId:'victim'}}]}).duration,2520);
      continue;
    }
    assert.deepEqual(battleAnimationTiming(cue),{duration:duration*2,impact:impact*2});
    assert.ok(battleAnimationTiming({...cue,heavy:true}).duration>=duration*2);
  }
  assert.deepEqual(battleAnimationTiming({kind:'spell',actor:0,revision:9,heavy:true}),{duration:3800,impact:1700});
});
test('all spells have a sound and particle theme, including fire, frost and healing',()=>{
  const all=Object.values(catalog).filter(c=>c.kind==='spell');
  const theme=(id:string)=>animationTheme({kind:'spell',actor:0,revision:1,cardId:id},catalog[id]);
  assert.equal(theme('flame_sphere'),'fire');assert.equal(theme('ice_shard'),'ice');
  assert.equal(theme('pyroblast'),'fire');
  const themes=new Set(all.map(c=>theme(c.id)));assert.ok(themes.size>=6,JSON.stringify([...themes]));
  const healing=all.find(c=>c.effects?.some(e=>e.kind==='heal')&&c.class==='priest');assert.ok(healing);assert.equal(theme(healing.id),'holy');
  assert.equal(animationTheme({kind:'secret',actor:1,revision:1},undefined),'shadow');
});
test('hero attack produces a distinct cue and the correct damage on the public snapshot',()=>{
  const s=ready();s.players[0].weapon={attack:3,durability:2};s.players[0].heroAttacksRemaining=1;
  const {after,animation}=action(s,{type:'heroAttack',target:enemyHero});
  assert.equal(animation.kind,'heroAttack');assert.equal(battleAnimationTiming(animation).duration,1300);
  assert.equal(after.players[1].health,27);
});
test('actual engine trace preserves overkill and retaliation, including dead characters, without changing rules',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:5,health:2,maxHealth:2,attacksRemaining:1}];
  s.players[1].board=[{cardId:'wolf',instanceId:'defender',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
  const a:Action={type:'attack',attackerId:'attacker',target:{kind:'minion',instanceId:'defender'}},events:BattleVisualEvent[]=[];
  const after=applyAction(s,0,a,{visualEvent:e=>events.push(e)});
  assert.deepEqual(after,applyAction(s,0,a));
  const trace=describeAcceptedAction(s,after,0,a,events)!;
  assert.equal(trace.blocked,undefined);assert.equal(trace.events?.filter(e=>e.kind==='death').length,2);
  const impacts=impactChanges(getPlayerView(s,0),getPlayerView(after,0),0,trace.events);
  assert.deepEqual(impacts.filter(e=>e.kind==='damage').map(e=>e.amount).sort(),[3,5]);
  assert.equal(impacts.filter(e=>e.kind==='leave'&&e.death).length,2);
});
test('a triggered secret is disclosed only at trigger time; attempted attack uses actual combat target or blocked indication',()=>{
  const s=ready();s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
  const secret=Object.values(catalog).find(c=>c.kind==='secret'&&c.trigger==='enemyMinionAttack'&&c.effects.some(e=>e.kind==='cancelEvent'));
  // The classic freezing trap bounces the attacker. Test any applicable
  // canceling minion attack secret without relying on a display name.
  assert.ok(secret);
  s.players[1].secrets=[{cardId:secret.id,instanceId:'hidden-secret-id'}];
  const a:Action={type:'attack',attackerId:'attacker',target:enemyHero},events:BattleVisualEvent[]=[];
  const after=applyAction(s,0,a,{visualEvent:e=>events.push(e)});
  const trace=describeAcceptedAction(s,after,0,a,events)!;
  assert.ok(trace.events?.some(e=>e.kind==='secretTriggered'&&e.cardId===secret.id));assert.equal(trace.blocked,true);
  assert.doesNotMatch(JSON.stringify(trace),/hidden-secret-id/);
});
test('playback waits until impact, serializes rapid opponent updates, and ignores duplicate acknowledgements',()=>{
  const s=ready(),first=action(s,{type:'endTurn'}),second=action(first.after,{type:'endTurn'},1);
  const before=room(s,0),one=room(first.after,0,first.animation),two=room(second.after,0,second.animation);
  let time=0,id=0,visible=s.revision;
  const timers=new Map<ReturnType<typeof setTimeout>,{at:number;fn:()=>void}>(),cues:number[]=[];
  const clock={
    schedule:(fn:()=>void,ms:number)=>{const handle=++id as unknown as ReturnType<typeof setTimeout>;timers.set(handle,{at:time+ms,fn});return handle;},
    cancel:(handle:ReturnType<typeof setTimeout>)=>{timers.delete(handle);}
  };
  const advance=(ms:number)=>{const end=time+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;};
  const timeline=new PlaybackTimeline(before,v=>{visible=v.state!.revision;},cue=>{if(cue)cues.push(cue.animation.revision);},clock);
  timeline.receive(one,true);timeline.receive(one,true);timeline.receive(two,true);
  assert.deepEqual(cues,[first.after.revision]);assert.equal(visible,s.revision);
  advance(359);assert.equal(visible,s.revision);advance(1);assert.equal(visible,first.after.revision);
  advance(1240);assert.deepEqual(cues,[first.after.revision,second.after.revision]);assert.equal(visible,first.after.revision);
  advance(360);assert.equal(visible,second.after.revision);
  timeline.receive(two,false);assert.equal(timers.size,0);timeline.dispose();
});
test('all 22 offline animation demonstrations use legal actions and produce matching accepted cues',()=>{
  for(const actor of [0,1] as const)for(const kind of kinds){
    const before=fixture(catalog,actor),a=scenarioAction(before,actor,kind),trace:BattleVisualEvent[]=[];
    const after=applyAction(before,actor,a,{visualEvent:e=>trace.push(e)}),animation=describeAcceptedAction(before,after,actor,a,trace);
    assert.ok(animation,`${actor} ${kind}`);assert.equal(animation.actor,actor);
    assert.ok(nextPlayback(room(before,0),room(after,0,animation)),kind);
  }
});

test('departure visual never mistakes missing death evidence for death',()=>{
 const target={kind:'minion' as const,instanceId:'removed'},base={kind:'leave' as const,side:0 as const,target};
 assert.equal(departureVisual(base),'exit');assert.equal(departureVisual({...base,death:false}),'exit');assert.equal(departureVisual({...base,death:true}),'death');
});
test('actual bounce versus lethal uses distinct departure audio, even for the opposite seat',()=>{
 const s=ready();s.players[0].heroClass='rogue';s.players[0].hand=[{instanceId:'retreat',cardId:'storm_retreat'}];
 s.players[0].board=[{cardId:'wolf',instanceId:'attacker',attack:5,health:2,maxHealth:2,attacksRemaining:1}];s.players[1].board=[{cardId:'wolf',instanceId:'target',attack:3,health:2,maxHealth:2,attacksRemaining:1}];
 const target:Target={kind:'minion',instanceId:'target'};
 const trace=(action:Action)=>{const events:BattleVisualEvent[]=[];const after=applyAction(s,0,action,{visualEvent:e=>events.push(e)});return ([0,1] as const).map(seat=>impactChanges(getPlayerView(s,seat),getPlayerView(after,seat),seat,events));};
 const bounce=trace({type:'playCard',instanceId:'retreat',target}),kill=trace({type:'attack',attackerId:'attacker',target});
 assert.deepEqual(bounce.map(departureSoundKind),['exit','exit']);assert.deepEqual(kill.map(departureSoundKind),['death','death']);
 assert.equal(departureSoundKind([...bounce[0],...kill[0]]),'death');assert.equal(departureSoundKind([{kind:'leave',side:1,target}]),null);assert.equal(departureSoundKind([]),null);
 const death=departureSoundLayers('death'),exit=departureSoundLayers('exit');assert.ok(death.every(l=>l.from>l.to));assert.ok(exit.every(l=>l.from<l.to));
 for(const recipe of [death,exit]){assert.ok(recipe.length<=3);assert.ok(recipe.every(l=>l.duration+l.delay+.12<=.55));assert.ok(recipe.reduce((n,l)=>n+l.volume,0)<.5);}
});
test('summon uses card art theme rather than generic dust when card is known',()=>{
 const a:BattleAnimation={kind:'summon',actor:0,revision:1};
 assert.equal(animationTheme(a,catalog['forest_wolf']),'nature');assert.equal(animationTheme(a,catalog['frost_elemental']),'ice');assert.equal(animationTheme(a),'dust');
});
test('each visual summon family has a distinct bounded offline sound recipe',()=>{
 const themes=['dust','steel','fire','ice','lightning','arcane','shadow','holy','nature','gold'] as const,recipes=themes.map(summonSoundLayers);
 assert.equal(new Set(recipes.map(r=>JSON.stringify(r))).size,themes.length);
 for(const recipe of recipes){assert.ok(recipe.length>=3&&recipe.length<=5);assert.ok(recipe.every(l=>l.duration+l.delay<=.5&&l.duration>.015&&l.delay>=0&&l.from>0&&l.to>0&&l.volume>0));assert.ok(recipe.reduce((sum,l)=>sum+l.volume,0)<=1);assert.equal(recipe[0].from,130);}
 assert.ok(summonSoundLayers('ice').some(l=>l.kind==='tone'&&l.from>1500));assert.ok(summonSoundLayers('fire').some(l=>l.kind==='noise'&&l.from>=2500));assert.ok(summonSoundLayers('lightning').some(l=>l.kind==='tone'&&l.type==='sawtooth'));
 assert.deepEqual(summonSoundLayers('dust').map(l=>l.volume),[.48,.32,.10]);
});
test('multiple indirect summons use their own public card, seat and final board slot',()=>{
 const s=ready(),unit=(cardId:string,instanceId:string)=>({cardId,instanceId,attack:1,health:1,maxHealth:1,attacksRemaining:0});
 s.players[0].board=[unit('wolf','existing')];const before=getPlayerView(s,0),after=structuredClone(before);
 after.self.board.unshift(unit('forest_wolf','forest'));after.self.board.push(unit('frost_elemental','ice'));after.opponent.board.push(unit('missing','unknown'));
 const result=summonVisuals(before,after,0,catalog);
 assert.equal(result.has('existing'),false);assert.deepEqual([...result],[['forest',{side:0,index:0,count:3,theme:'nature'}],['ice',{side:0,index:2,count:3,theme:'ice'}],['unknown',{side:1,index:0,count:1,theme:'dust'}]]);
 const reversed=summonVisuals(getPlayerView(s,1),{...after,self:{...after.opponent,hand:[],secrets:[]},opponent:after.self},1,catalog);
 assert.deepEqual(reversed.get('ice'),result.get('ice'));assert.deepEqual(reversed.get('unknown'),result.get('unknown'));
 assert.equal(projectedSummonX(150,300,0,3),50);assert.equal(projectedSummonX(150,300,2,3),250);assert.equal(projectedSummonX(150,300,0,1),150);
});
test('impact label cache preserves layout and only recomputes when an anchor changes or appears',()=>{
 const hero:Target={kind:'hero',player:0},minion:Target={kind:'minion',instanceId:'new'};
 const impacts:FxImpact[]=[{kind:'damage',target:hero,amount:7,side:0,hitCount:3},{kind:'shield',target:minion,side:1},{kind:'summon',target:minion,side:1}];
 let visible=false,heroX=50;const position=(target:Target)=>target.kind==='hero'?{x:heroX,y:100}:visible?{x:140,y:100}:undefined;
 const cache=createImpactLabelCache(impacts,320,260),first=cache(position);assert.deepEqual(first.map(l=>l.text),['3연타','−7']);
 for(let i=0;i<120;i++)assert.strictEqual(cache(position),first,'unchanged frames reuse the same array');
 visible=true;const appeared=cache(position);assert.notStrictEqual(appeared,first);assert.deepEqual(appeared,layoutImpactLabels([{key:'h0',position:{x:50,y:100},impacts:[impacts[0]]},{key:'mnew',position:{x:140,y:100},impacts:[impacts[1]]}],320,260));
 heroX=70;const moved=cache(position);assert.notStrictEqual(moved,appeared);assert.strictEqual(cache(position),moved);
 visible=false;assert.deepEqual(cache(position).map(l=>l.text),['3연타','−7']);
});
test('particle geometry cache reuses deterministic samples with unchanged visual math at reduced density',()=>{
 const cache=createParticleCache(),seed=91,scale=1.15,rich=cache(seed,scale,24),first=rich[0];
 assert.equal(first.angle,fxRandom(seed)*Math.PI*2);assert.equal(first.cos,Math.cos(first.angle));assert.equal(first.sin,Math.sin(first.angle));assert.equal(first.velocity,(.45+fxRandom(seed+1))*scale);assert.equal(first.size,(2+5*fxRandom(seed+2))*scale);
 for(let frame=0;frame<120;frame++)assert.strictEqual(cache(seed,scale,10),rich);
 const expanded=cache(seed,scale,35);assert.strictEqual(expanded,rich);assert.strictEqual(expanded[0],first);assert.equal(expanded.length,35);
 assert.notStrictEqual(cache(seed+1,scale,24),rich);assert.notStrictEqual(cache(seed,1.65,24),rich);
 assert.deepEqual(createParticleCache()(seed,scale,35),expanded);
});

test('ordered public combat beats preserve shield, damage and death before visible summons',async()=>{
  const {battleSequence}=await import('../src/battle-sequence.ts');
  const base=room(ready(),0);
  const after=structuredClone(base);
  after.state!.revision++;
  after.state!.self.board.push({instanceId:'new',cardId:'recruit',attack:1,health:2,maxHealth:2,attacksRemaining:0});
  const target={kind:'minion' as const,instanceId:'public-guard'};
  after.animation={kind:'attack',actor:0,revision:after.state!.revision,events:[
    {kind:'shield',side:1,target},{kind:'damage',side:1,target,amount:3},{kind:'death',side:1,target}
  ]};
  assert.deepEqual(battleSequence(nextPlayback(base,after)!),['보호막 소모','피해 3','하수인 사망','하수인 1장 등장']);
});

test('embedded voice requires approval and a matching checksum and maps by public subject',async()=>{
  const {approvedVoiceBytes,findVoiceClip,VOICE_CLIPS}=await import('../src/voice-clips.ts');
  const {createHash}=await import('node:crypto');
  const fixture=Buffer.from('hash-check fixture, not an audio asset');
  const clip={key:'hero:mage:emote',source:'test fixture',license:'test fixture',redistributionApproved:true as const,sha256:createHash('sha256').update(fixture).digest('hex'),base64:fixture.toString('base64')};
  const line=heroEmote('mage',0,'greet');
  assert.equal(findVoiceClip(line,VOICE_CLIPS),undefined);
  assert.equal(findVoiceClip(line,[clip]),clip);
  assert.equal(findVoiceClip(heroEmote('warrior',0,'greet'),[clip]),undefined);
  assert.deepEqual(Buffer.from((await approvedVoiceBytes(clip))!),fixture);
  assert.equal(await approvedVoiceBytes({...clip,sha256:'0'.repeat(64)}),undefined);
  assert.equal(await approvedVoiceBytes({...clip,license:''}),undefined);
});

test('reserved windup credit leaves the travel, contact and return intact',()=>{
  const start=room(ready(),0),end=structuredClone(start);
  end.state!.revision++;
  end.animation={kind:'attack',actor:0,revision:end.state!.revision,attackerId:'public-source'};
  const cues:{windup?:number;impact:number;duration:number}[]=[];
  const delays:number[]=[];
  const timeline=new PlaybackTimeline(start,()=>{},cue=>{if(cue)cues.push(cue);},{
    schedule:(_fn,ms)=>{delays.push(ms);return delays.length as unknown as ReturnType<typeof setTimeout>;},cancel:()=>{},
  },()=>900);
  timeline.receive(end,true);
  assert.equal(cues[0].windup,0);
  assert.equal(cues[0].impact,120);
  assert.equal(cues[0].duration,600);
  assert.deepEqual(delays,[120,600]);
});

test('Cruel Taskmaster uses the same valid minion targets on either side',()=>{
  const setup=()=>{
    const state=ready();
    state.players[0].hand=[{cardId:'harsh_overseer',instanceId:'taskmaster-hand'}];
    for(const side of [0,1] as const)state.players[side].board=[{
      cardId:'wolf',instanceId:`taskmaster-victim-${side}`,attack:2,health:4,maxHealth:4,attacksRemaining:0,
    }];
    return state;
  };
  for(const side of [0,1] as const){
    const {after}=action(setup(),{type:'playCard',instanceId:'taskmaster-hand',position:0,target:{kind:'minion',instanceId:`taskmaster-victim-${side}`}});
    assert.equal(after.players[0].board[0].cardId,'harsh_overseer');
    const victim=after.players[side].board.find(minion=>minion.instanceId===`taskmaster-victim-${side}`);
    assert.equal(victim?.health,3);
    assert.equal(victim?.attack,4);
  }
  assert.throws(()=>action(setup(),{type:'playCard',instanceId:'taskmaster-hand',target:enemyHero}));
  assert.throws(()=>action(setup(),{type:'playCard',instanceId:'taskmaster-hand',target:{kind:'minion',instanceId:'taskmaster-hand'}}));
  const empty=setup();
  for(const player of empty.players)player.board=[];
  assert.equal(action(empty,{type:'playCard',instanceId:'taskmaster-hand',position:0}).after.players[0].board[0].cardId,'harsh_overseer');
});


test('single-pass impact feedback matches v0.323 reference for mixed events',()=>{
  function reference(animation:BattleAnimation,impacts:readonly FxImpact[]){
  const hits=impacts.filter(i=>i.kind==='damage'&&(i.amount??0)>0),peak=Math.max(0,...hits.map(i=>i.amount??0));
  const armor=impacts.filter(i=>i.kind==='armorHit'&&(i.amount??0)>0),extraHits=Math.min(3,Math.max(0,...[...hits,...armor].map(i=>(i.hitCount??1)-1)));
  if(peak>0){const strength=Math.min(1.45,.65+peak*.055+Math.min(3,hits.length-1)*.10);return {kind:'damage',strength,shake:Math.min(10,Math.round(2+peak*.65+Math.min(3,hits.length-1))),...(armor.length?{armor:true}:{}),...(extraHits?{extraHits}:{})};}
  if(armor.length){const peakArmor=Math.max(...armor.map(i=>i.amount??0));return {kind:'armor',strength:Math.min(1.1,.55+peakArmor*.045),shake:Math.min(4,1+Math.ceil(peakArmor/5)),...(extraHits?{extraHits}:{})};}
  if(animation.blocked)return {kind:'blocked',strength:.65,shake:2};
  if(impacts.some(i=>i.kind==='shield'))return {kind:'shield',strength:.75,shake:0};
  if(impacts.some(i=>i.kind==='heal'))return {kind:'heal',strength:.8,shake:0};
  if(impacts.some(i=>i.kind==='shieldGain'||i.kind==='armorGain'))return {kind:'protect',strength:.75,shake:0};
  return {kind:'neutral',strength:1,shake:impacts.some(i=>i.kind==='leave'&&i.death)?4:0};
}
  let seed=827311;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const kinds:FxImpact['kind'][]=['damage','armorHit','heal','shield','shieldGain','armorGain','leave','summon','freeze'];
  const amounts=[undefined,NaN,Infinity,-Infinity,-3,0,.5,1,2,5,20,100];
  for(let i=0;i<30000;i++){
    const animation:BattleAnimation={kind:'spell',actor:0,revision:i,blocked:random()<.2};
    const impacts:FxImpact[]=Array.from({length:Math.floor(random()*24)},()=>({
      target:{kind:'hero',player:1},side:1,kind:kinds[Math.floor(random()*kinds.length)],
      amount:amounts[Math.floor(random()*amounts.length)],hitCount:amounts[Math.floor(random()*amounts.length)],death:random()<.4
    }));
    assert.deepEqual(impactFeedback(animation,impacts),reference(animation,impacts),'seeded case '+i);
  }
});
