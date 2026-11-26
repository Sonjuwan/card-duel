import {approvedVoiceBytes,findVoiceClip} from './voice-clips.ts';
import {playEmbeddedVoice} from './battle-sound.ts';
import type {DialogueLine} from './battle-dialogue.ts';
import {battleSoundEnabled,normalSoundVolume,dialogueOutput,setDialogueOutput} from './battle-sound.ts';

let enabled=true,voiceVolume=90;
try{enabled=globalThis.localStorage?.getItem('card-duel-dialogue-voice')!=='off';voiceVolume=normalSoundVolume(globalThis.localStorage?.getItem('card-duel-dialogue-volume')??90);}catch{}
export const dialogueVoiceEnabled=()=>enabled;
export const dialogueVoiceVolume=()=>voiceVolume;
export function setDialogueVoiceVolume(value:number){voiceVolume=normalSoundVolume(value);setDialogueOutput(voiceVolume);try{localStorage.setItem('card-duel-dialogue-volume',String(voiceVolume));}catch{}if(voiceVolume===0)stopDialogueVoice();}
export function setDialogueVoiceEnabled(value:boolean){
  enabled=value;try{localStorage.setItem('card-duel-dialogue-voice',value?'on':'off');}catch{}
  if(!value)stopDialogueVoice();
}
/** Only installed Korean voices: never select a cloud voice in offline play. */
export function localKoreanVoice<T extends {lang:string;localService:boolean;name?:string;voiceURI?:string}>(voices:readonly T[],identity?:string):T|undefined{
  const local=voices.filter(v=>v.localService&&/^ko(?:[-_]|$)/i.test(v.lang));
  if(!identity||local.length<2)return local[0];
  // Installed voices stay assigned to the same speaker across actions, even
  // if the system changes the enumeration order. Never choose a remote voice.
  local.sort((a,b)=>(a.voiceURI??a.name??a.lang).localeCompare(b.voiceURI??b.name??b.lang));
  let hash=0;for(const c of identity)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  return local[hash%local.length];
}
export function installedKoreanVoiceCount():number{
  try{return typeof SpeechSynthesisUtterance==='undefined'?0:(globalThis.speechSynthesis?.getVoices()??[]).filter(v=>v.localService&&/^ko(?:[-_]|$)/i.test(v.lang)).length;}catch{return 0;}
}
type Item={line:DialogueLine;expires:number};
let clipToken:object|null=null, stopClip:(()=>void)|undefined;
let waiting:Item[]=[],current:SpeechSynthesisUtterance|null=null,watchdog:ReturnType<typeof setTimeout>|undefined;
// Release browser-held callbacks as well as the module reference. A late
// native speech event must not retain a completed battle's dialogue closure.
function releaseUtterance(utterance:SpeechSynthesisUtterance){
  utterance.onend=null;utterance.onerror=null;
  if(current===utterance)current=null;
  if(watchdog)clearTimeout(watchdog);watchdog=undefined;
}
export function stopDialogueVoice(){

  clipToken=null;stopClip?.();stopClip=undefined;
  waiting=[];if(watchdog)clearTimeout(watchdog);watchdog=undefined;
  if(current){releaseUtterance(current);try{globalThis.speechSynthesis?.cancel();}catch{}}
}
function drain():boolean{
  if(globalThis.document?.hidden){stopDialogueVoice();return false;}
  if(current||clipToken||!enabled||!battleSoundEnabled()||voiceVolume===0)return false;
  const item=waiting.shift();if(!item)return false;
  if(item.expires<Date.now())return drain();
  const clip=findVoiceClip(item.line);
  if(!clip)return speakItem(item);
  const token={};
  clipToken=token;
  const active=()=>clipToken===token&&Date.now()<item.expires&&!globalThis.document?.hidden;
  const finish=(fallback:boolean)=>{
    if(clipToken!==token)return;

  clipToken=null;stopClip=undefined;
    if(fallback&&item.expires>Date.now()&&speakItem(item))return;
    drain();
  };
  void approvedVoiceBytes(clip).then(async bytes=>{
    if(!active()){finish(false);return;}
    const stop=bytes?await playEmbeddedVoice(bytes,active,()=>finish(false)):undefined;
    if(clipToken!==token){stop?.();return;}
    if(!stop){finish(true);return;}
    stopClip=stop;
  }).catch(()=>finish(true));
  return true;
}
function speakItem(item:Item):boolean{
  try{
    const synth=globalThis.speechSynthesis,voice=synth&&localKoreanVoice(synth.getVoices(),item.line.cardId??item.line.speaker);
    if(!voice||typeof SpeechSynthesisUtterance==='undefined'){waiting=[];return false;}
    const utterance=new SpeechSynthesisUtterance(item.line.text);
    utterance.voice=voice;utterance.lang=voice.lang;utterance.pitch=item.line.pitch;utterance.rate=item.line.rate;
    utterance.volume=dialogueOutput();
    current=utterance;
    const done=()=>{if(current!==utterance)return;releaseUtterance(utterance);drain();};
    utterance.onend=done;utterance.onerror=done;
    watchdog=setTimeout(()=>{if(current===utterance){releaseUtterance(utterance);try{synth.cancel();}catch{}drain();}},4500);
    synth.speak(utterance);return true;
  }catch{stopDialogueVoice();return false;}
}
/** Short, bounded queue. Area attacks show all captions but never queue a
 * whole board of speech or delay the actual game action. */
export function speakDialogue(lines:readonly DialogueLine[]){
  if(globalThis.document?.hidden||!enabled||!battleSoundEnabled()||voiceVolume===0)return;
  const now=Date.now();waiting=waiting.filter(item=>item.expires>=now);
  for(const line of lines.slice(0,2))waiting.push({line,expires:now+30000});
  // Preserve chronological summon and greeting order; never interrupt the current line.
  drain();
}
/** A preview explicitly replaces only the dialogue queue, never game audio or
 * action playback. Distinguish requesting speech from successful playback. */
export function previewDialogue(line:DialogueLine):'requested'|'muted'|'unavailable'|'failed'{
  if(globalThis.document?.hidden)return 'failed';
  if(!enabled||!battleSoundEnabled()||voiceVolume===0)return 'muted';
  if(!findVoiceClip(line)&&!installedKoreanVoiceCount())return 'unavailable';
  stopDialogueVoice();waiting=[{line,expires:Date.now()+3500}];return drain()?'requested':'failed';
}
