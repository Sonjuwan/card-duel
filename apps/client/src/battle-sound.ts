import type { BattleAnimation } from '../../../packages/protocol.ts';
import type {GameState,PlayerId} from '../../../packages/engine/src/index.ts';
import type { FxTheme,ImpactFeedback } from './battle-fx-model.ts';
let context:AudioContext|undefined,master:GainNode|undefined,muted=false,engineNoise:AudioBuffer|undefined,resuming:Promise<void>|undefined,resumeStartedAt=0;
export const MAX_BATTLE_SOUND_SOURCES=32;
const activeSources=new Map<AudioScheduledSourceNode,()=>void>();
function cancelSource(source:AudioScheduledSourceNode){
  const release=activeSources.get(source);if(!release)return;
  try{source.stop();}catch{}release();
}
/** Disconnect the entire per-source graph, even if a suspended context
 * defers the ended event. Bound concurrent voices during burst effects. */
function trackSource(source:AudioScheduledSourceNode,nodes:readonly AudioNode[]){
  while(activeSources.size>=MAX_BATTLE_SOUND_SOURCES){const oldest=activeSources.keys().next().value;if(!oldest)break;cancelSource(oldest);}
  const release=()=>{if(!activeSources.delete(source))return;source.onended=null;for(const node of nodes)try{node.disconnect();}catch{}};
  activeSources.set(source,release);source.onended=release;
}
/** Cut pending and currently playing effects on app/tab switches without
 * modifying the user's sound preference or global browser audio context. */
export function stopBattleSound(){for(const source of activeSources.keys())cancelSource(source);}
export function normalSoundVolume(raw:unknown){
  if(typeof raw!=='number'&&(typeof raw!=='string'||raw.trim()===''))return 100;
  const value=Number(raw);return Number.isFinite(value)?Math.round(Math.max(0,Math.min(100,value))):100;
}
let volume=100;
try{muted=globalThis.localStorage?.getItem('card-duel-sound')==='off';volume=normalSoundVolume(globalThis.localStorage?.getItem('card-duel-sound-volume'));}catch{}
export function battleSoundEnabled(){return !muted;}
export function battleSoundVolume(){return volume;}
export type ResultSoundState={code:string;seat:PlayerId;phase:GameState['phase'];winner:GameState['winner']};
export type ResultSound='win'|'loss'|'draw';
/** Initial load/resume, duplicate result updates, and a new match code must
 * not replay a fanfare. Only a live transition within this match qualifies. */
export function resultSoundTransition(previous:ResultSoundState|null,current:ResultSoundState):ResultSound|null{
  if(!previous||previous.code!==current.code||previous.seat!==current.seat||previous.phase==='finished'||current.phase!=='finished')return null;
  return current.winner===null?'draw':current.winner===current.seat?'win':'loss';
}
const gainForSettings=()=>muted?0:.32*volume/100;
function updateGain(){if(master&&context&&context.state!=='closed')try{master.gain.setTargetAtTime(gainForSettings(),context.currentTime,.025);}catch{}}
export function setBattleSoundVolume(value:number){
  const wasSilent=volume===0;volume=normalSoundVolume(value);try{localStorage.setItem('card-duel-sound-volume',String(volume));}catch{}updateGain();
  if(volume===0)stopBattleSound();else if(wasSilent&&!muted)unlockBattleSound();
}
export function setBattleSound(enabled:boolean){
  muted=!enabled;try{localStorage.setItem('card-duel-sound',enabled?'on':'off');}catch{}
  updateGain();
  if(enabled)unlockBattleSound();else stopBattleSound();
}
/** A browser requires a real user gesture before starting audio. */
export function unlockBattleSound(event?:Event){
  const Constructor=globalThis.AudioContext??(globalThis as typeof globalThis&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(muted||volume===0||!Constructor||globalThis.document?.hidden)return;
  try{
    if(context?.state==='closed'){stopBattleSound();context=undefined;master=undefined;engineNoise=undefined;resuming=undefined;}
    if(!context){context=new Constructor();master=context.createGain();const compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=6;master.gain.value=gainForSettings();master.connect(compressor);compressor.connect(context.destination);}
    // Some mobile browsers defer a pointerdown resume until click/touch release.
    // A promise left pending must not block a later genuine user activation.
    if(context.state!=='running'&&(!resuming||event?.type==='click'||Date.now()-resumeStartedAt>=1000)){const pending=context.resume();resuming=pending;resumeStartedAt=Date.now();void pending.catch(()=>{}).finally(()=>{if(resuming===pending)resuming=undefined;});}
  }catch{/* Sound is optional and must never interrupt gameplay. */}
}
function tone(from:number,to:number,time:number,volume:number,type:OscillatorType='sine',delay=0){
  if(!context||!master)return;
  const start=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
  osc.type=type;osc.frequency.setValueAtTime(from,start);osc.frequency.exponentialRampToValueAtTime(Math.max(1,to),start+time);
  gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.002,volume),start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+time);
  osc.connect(gain);gain.connect(master);trackSource(osc,[osc,gain]);
  try{osc.start(start);osc.stop(start+time+.02);}catch(e){cancelSource(osc);throw e;}
}
function noise(time:number,frequency:number,endFrequency:number,volume:number,delay=0,type:BiquadFilterType='lowpass'){
  if(!context||!master)return;
  if(!engineNoise){engineNoise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const samples=engineNoise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
  const start=context.currentTime+delay,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  source.buffer=engineNoise;filter.type=type;filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),start+time);
  gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.016);gain.gain.exponentialRampToValueAtTime(.001,start+time);
  source.connect(filter);filter.connect(gain);gain.connect(master);trackSource(source,[source,filter,gain]);
  try{source.start(start,Math.random()*.5,time+.03);}catch(e){cancelSource(source);throw e;}
}
type SoundLayer={kind:'tone';from:number;to:number;duration:number;volume:number;type:OscillatorType;delay:number}|{kind:'noise';from:number;to:number;duration:number;volume:number;type:BiquadFilterType;delay:number};
const voiced=(from:number,to:number,duration:number,volume:number,type:OscillatorType='sine',delay=0):SoundLayer=>({kind:'tone',from,to,duration,volume,type,delay});
const textured=(from:number,to:number,duration:number,volume:number,type:BiquadFilterType='lowpass',delay=0):SoundLayer=>({kind:'noise',from,to,duration,volume,type,delay});
/** A common landing pulse with a bounded, audibly distinct theme accent. No
 * extra downloaded audio, no longer cue, and no overlapping speech queue. */
const summonAccents:Record<FxTheme,readonly SoundLayer[]>={
  dust:[voiced(440,230,.18,.10,'triangle')],
  steel:[voiced(1050,430,.24,.15,'triangle',.035),textured(3200,700,.20,.10,'bandpass',.025)],
  fire:[textured(2500,260,.39,.18,'bandpass',.025),voiced(86,49,.31,.13,'sine',.05)],
  ice:[voiced(1260,900,.32,.12,'triangle',.035),voiced(1860,1395,.33,.10,'sine',.09)],
  lightning:[voiced(720,120,.15,.12,'sawtooth',.035),textured(4700,950,.23,.16,'highpass',.055)],
  arcane:[voiced(350,700,.34,.10,'triangle',.05),voiced(620,940,.34,.10,'sine',.09)],
  shadow:[voiced(98,48,.42,.14,'triangle',.035),textured(650,100,.36,.12,'lowpass',.06)],
  holy:[voiced(523,523,.36,.10,'sine',.04),voiced(659,659,.33,.10,'sine',.09),voiced(784,784,.30,.09,'sine',.14)],
  nature:[textured(1500,450,.31,.09,'bandpass',.03),voiced(392,523,.28,.10,'sine',.06)],
  gold:[voiced(880,660,.30,.12,'triangle',.035),voiced(1320,990,.26,.08,'sine',.12)],
};
export function summonSoundLayers(theme:FxTheme):readonly SoundLayer[]{return [voiced(130,43,.26,theme==='dust' ? .48 : .38),textured(620,130,.30,theme==='dust' ? .32 : .24),...summonAccents[theme]];}
function playLayers(layers:readonly SoundLayer[],delay=0){for(const layer of layers){if(layer.kind==='tone')tone(layer.from,layer.to,layer.duration,layer.volume,layer.type,layer.delay+delay);else noise(layer.duration,layer.from,layer.to,layer.volume,layer.delay+delay,layer.type);}}
export function departureSoundLayers(kind:'death'|'exit'):readonly SoundLayer[]{
  return kind==='death'?[textured(800,120,.38,.22),voiced(118,43,.42,.24)]:[voiced(290,740,.24,.13,'triangle'),textured(700,2300,.23,.09,'bandpass',.025),voiced(660,990,.19,.07,'sine',.065)];
}
/** Schedule through the audio graph so visibility cancellation can stop even
 * a not-yet-started departure; no additional UI timer or playback delay. */
export function playBattleDepartureSound(kind:'death'|'exit'|null){
  if(!kind||muted||volume===0||!context||context.state!=='running'||globalThis.document?.hidden)return;
  try{playLayers(departureSoundLayers(kind),.12);}catch{/* Optional audio never interrupts the game. */}
}
export function playBattleResultSound(result:ResultSound){
  if(muted||volume===0||!context||context.state!=='running'||globalThis.document?.hidden)return;
  try{
    if(result==='win'){[392,523,659,784].forEach((f,i)=>tone(f,f,.46,.16,'sine',i*.12));tone(196,196,.58,.18,'triangle',.24);}
    else if(result==='loss'){[392,330,262].forEach((f,i)=>tone(f,f*.97,.42,.11,'triangle',i*.13));tone(131,98,.5,.12,'sine',.1);}
    else{[392,494,392].forEach((f,i)=>tone(f,f,.34,.12,'sine',i*.12));}
  }catch{/* Result sound must not interrupt gameplay or saving. */}
}
export function playBattleSound(a:BattleAnimation,theme:FxTheme,beat:'start'|'impact',feedback?:ImpactFeedback){
  if(muted||volume===0||!context||context.state!=='running'||globalThis.document?.hidden)return;
  try{
    if(beat==='start'){
      if(a.kind==='attack'||a.kind==='heroAttack'){noise(.34,300,3200,.40,0,'bandpass');tone(160,360,.28,.13,'triangle');}
      else if(a.kind==='turn'){[392,494,659].forEach((f,i)=>tone(f,f,.3,.07,'sine',i*.10));}
      else {noise(.28,500,2400,.20,0,'bandpass');tone(220,480,.32,.12,'triangle');if(theme==='arcane'||theme==='holy'||theme==='ice')tone(620,990,.48,.10,'sine',.07);}
      return;
    }
    if(feedback?.kind==='blocked'){noise(.12,1800,420,.28,0,'bandpass');tone(720,310,.24,.17,'triangle');return;}
    // A bounded metallic layer on mixed hits, independent of damage theme.
    if(feedback?.kind==='armor'||feedback?.armor){const strength=feedback.kind==='armor'?feedback.strength:.7;tone(510,220,.22,.23*strength,'triangle');noise(.17,2400,620,.22*strength,0,'bandpass');tone(850,440,.14,.09,'sine',.03);}
    for(let i=0;i<Math.min(3,feedback?.extraHits??0);i++){noise(.07,2700,700,.10,.07*(i+1),'bandpass');tone(380,110,.08,.08,'triangle',.07*(i+1));}
    if(feedback?.kind==='armor')return;
    if(feedback?.kind==='shield'){tone(980,620,.21,.18,'triangle');tone(1600,850,.18,.12,'sine',.025);noise(.16,4700,1300,.16,0,'highpass');return;}
    if(feedback?.kind==='protect'){tone(260,390,.28,.14,'triangle');tone(520,780,.28,.14,'sine',.055);tone(780,1040,.22,.09,'sine',.12);return;}
    if(feedback?.kind==='heal'){[440,554,659,880].forEach((f,i)=>tone(f,f*.99,.40,.12,'sine',i*.038));noise(.26,1600,900,.08,0,'bandpass');return;}
    const impactStrength=feedback?.kind==='damage'?feedback.strength:1;
    if(a.kind==='weapon'&&feedback?.kind!=='damage'){tone(920,450,.22,.19,'triangle');noise(.19,2600,850,.25,0,'bandpass');tone(160,86,.18,.18,'sine',.04);}
    else if(a.kind==='attack'||a.kind==='heroAttack'||a.kind==='weapon'){
      // Low body + abrasive transient + a short metallic ring.
      const intensity=feedback?.kind==='damage'?feedback.strength:a.kind==='weapon'?1:.7;
      tone(intensity>=1?138:103,34,.27,.62*intensity,'sine');noise(.13,2900,420,.46*intensity);tone(1150,520,.23,.12*intensity,'triangle');noise(.45,420,110,.18*intensity,.04);
    }else if(a.kind==='summon'){playLayers(summonSoundLayers(theme));}
    else if(a.kind==='turn'||a.kind==='choice')tone(540,440,.22,.08,'triangle');
    else if(theme==='fire'){noise(.54,1600,130,.42*impactStrength);tone(100,36,.49,.44*impactStrength);noise(.32,4200,600,.18,.08);}
    else if(theme==='ice'){noise(.32,3700,900,.24*impactStrength,0,'highpass');[1250,1620,2110].forEach((f,i)=>tone(f,f*.75,.40,.10,'triangle',i*.035));}
    else if(theme==='lightning'){noise(.34,6400,500,.4*impactStrength);tone(155,39,.45,.36*impactStrength,'sawtooth');tone(930,180,.13,.14,'triangle');}
    else if(theme==='shadow'){tone(140,38,.62,.30*impactStrength,'triangle');noise(.5,1000,90,.22*impactStrength);tone(230,97,.5,.09,'sawtooth');}
    else if(theme==='holy'||theme==='nature'||theme==='gold'){[523,659,784,1047].forEach((f,i)=>tone(f,f*.98,.46,.12,'sine',i*.045));noise(.28,2200,900,.10,0,'bandpass');}
    else{tone(460,180,.45,.22,'triangle');tone(940,410,.32,.10,'sine');noise(.35,2600,320,.20);}
  }catch{/* A closed audio context should not affect the match. */}
}
