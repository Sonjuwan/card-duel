import type {PlayerId} from '../../../packages/engine/src/index.ts';
import type {BattleAnimation} from '../../../packages/protocol.ts';
import type {ImpactFeedback} from './battle-fx-model.ts';

type HapticDevice={maxTouchPoints?:number;vibrate?:(pattern:number|number[])=>boolean};
let enabled=false,lastAt=-Infinity;
try{enabled=globalThis.localStorage?.getItem('card-duel-battle-haptics')==='on';}catch{}
export const battleHapticsEnabled=()=>enabled;
export function hapticSupported(device:HapticDevice|undefined=globalThis.navigator){return !!device&&typeof device.vibrate==='function'&&(device.maxTouchPoints??0)>0;}
export function stopBattleHaptics(device:HapticDevice|undefined=globalThis.navigator){try{if(hapticSupported(device))device!.vibrate!(0);}catch{}}
export function setBattleHaptics(value:boolean){enabled=value;lastAt=-Infinity;try{localStorage.setItem('card-duel-battle-haptics',value?'on':'off');}catch{}if(!value)stopBattleHaptics();}

/** Short tactile cues encode real accepted outcomes rather than card stats or
 * a tentative target. Never vibrate through a whole turn or long combo. */
export function hapticPattern(a:BattleAnimation,feedback:ImpactFeedback,seat:PlayerId):number[]{
  if(feedback.kind==='damage'){
    const primary=feedback.strength>=1.1?55:feedback.strength>=.9?38:24;
    if(feedback.armor)return [18,25,primary];
    if((feedback.extraHits??0)>0)return [primary,24,20,...(feedback.extraHits!>=2?[24,16]:[])];
    return [primary];
  }
  if(feedback.kind==='armor')return [16,20,16];
  if(feedback.kind==='shield'||feedback.kind==='blocked')return [12,20,12];
  if(feedback.kind==='heal'||feedback.kind==='protect')return [12];
  return a.kind==='summon'&&a.actor===seat?[18]:[];
}
function vibrate(pattern:number[],device:HapticDevice|undefined){
  if(!enabled||!hapticSupported(device)||!pattern.length||globalThis.document?.hidden)return false;
  try{return device!.vibrate!(pattern);}catch{return false;}
}
export function playBattleHaptic(a:BattleAnimation,feedback:ImpactFeedback,seat:PlayerId,device:HapticDevice|undefined=globalThis.navigator,now=performance.now()){
  if(now-lastAt<240)return false;const pattern=hapticPattern(a,feedback,seat),started=vibrate(pattern,device);if(started)lastAt=now;return started;
}
export function previewBattleHaptics(device:HapticDevice|undefined=globalThis.navigator){return vibrate([24,25,14],device);}
