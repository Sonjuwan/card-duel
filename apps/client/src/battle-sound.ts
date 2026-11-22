import type { BattleAnimation } from '../../../packages/protocol.ts';
import type { FxTheme } from './battle-fx-model.ts';
let context:AudioContext|undefined,master:GainNode|undefined,muted=false,engineNoise:AudioBuffer|undefined;
try{muted=globalThis.localStorage?.getItem('card-duel-sound')==='off';}catch{}
export function battleSoundEnabled(){return !muted;}
export function setBattleSound(enabled:boolean){
  muted=!enabled;try{localStorage.setItem('card-duel-sound',enabled?'on':'off');}catch{}
  if(master&&context)master.gain.setTargetAtTime(enabled ? .32 : 0,context.currentTime,.025);
  if(enabled)unlockBattleSound();
}
/** A browser requires a real user gesture before starting audio. */
export function unlockBattleSound(){
  if(muted||typeof AudioContext==='undefined')return;
  try{
    if(!context){context=new AudioContext();master=context.createGain();const compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=6;master.gain.value=.32;master.connect(compressor);compressor.connect(context.destination);}
    if(context.state==='suspended')void context.resume().catch(()=>{});
  }catch{/* Sound is optional and must never interrupt gameplay. */}
}
function tone(from:number,to:number,time:number,volume:number,type:OscillatorType='sine',delay=0){
  if(!context||!master)return;
  const start=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
  osc.type=type;osc.frequency.setValueAtTime(from,start);osc.frequency.exponentialRampToValueAtTime(Math.max(1,to),start+time);
  gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.002,volume),start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+time);
  osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+time+.02);
}
function noise(time:number,frequency:number,endFrequency:number,volume:number,delay=0,type:BiquadFilterType='lowpass'){
  if(!context||!master)return;
  if(!engineNoise){engineNoise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const samples=engineNoise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
  const start=context.currentTime+delay,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  source.buffer=engineNoise;filter.type=type;filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),start+time);
  gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.016);gain.gain.exponentialRampToValueAtTime(.001,start+time);
  source.connect(filter);filter.connect(gain);gain.connect(master);source.start(start,Math.random()*.5,time+.03);
}
export function playBattleSound(a:BattleAnimation,theme:FxTheme,beat:'start'|'impact'|'leave'){
  if(muted||!context||context.state!=='running')return;
  try{
    if(beat==='leave'){noise(.38,800,120,.22);tone(118,43,.42,.24);return;}
    if(beat==='start'){
      if(a.kind==='attack'||a.kind==='heroAttack'){noise(.34,300,3200,.40,0,'bandpass');tone(160,360,.28,.13,'triangle');}
      else if(a.kind==='turn'){[392,494,659].forEach((f,i)=>tone(f,f,.3,.07,'sine',i*.10));}
      else {noise(.28,500,2400,.20,0,'bandpass');tone(220,480,.32,.12,'triangle');if(theme==='arcane'||theme==='holy'||theme==='ice')tone(620,990,.48,.10,'sine',.07);}
      return;
    }
    if(a.kind==='attack'||a.kind==='heroAttack'||a.kind==='weapon'){
      // Low body + abrasive transient + a short metallic ring.
      tone(a.heavy?138:103,34,.27,.8,'sine');noise(.13,2900,420,.60);tone(1150,520,.23,.12,'triangle');noise(.45,420,110,.22,.04);
    }else if(a.kind==='summon'){tone(130,43,.26,.48);noise(.30,620,130,.32);tone(440,230,.18,.10,'triangle');}
    else if(a.kind==='turn'||a.kind==='choice')tone(540,440,.22,.08,'triangle');
    else if(theme==='fire'){noise(.54,1600,130,.52);tone(100,36,.49,.56);noise(.32,4200,600,.18,.08);}
    else if(theme==='ice'){noise(.32,3700,900,.26,0,'highpass');[1250,1620,2110].forEach((f,i)=>tone(f,f*.75,.40,.10,'triangle',i*.035));}
    else if(theme==='lightning'){noise(.34,6400,500,.5);tone(155,39,.45,.45,'sawtooth');tone(930,180,.13,.14,'triangle');}
    else if(theme==='shadow'){tone(140,38,.62,.35,'triangle');noise(.5,1000,90,.26);tone(230,97,.5,.09,'sawtooth');}
    else if(theme==='holy'||theme==='nature'||theme==='gold'){[523,659,784,1047].forEach((f,i)=>tone(f,f*.98,.46,.12,'sine',i*.045));noise(.28,2200,900,.10,0,'bandpass');}
    else{tone(460,180,.45,.22,'triangle');tone(940,410,.32,.10,'sine');noise(.35,2600,320,.20);}
  }catch{/* A closed audio context should not affect the match. */}
}
