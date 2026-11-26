import {memo,useEffect,useRef,useState} from 'react';
import type {Card,Catalog,HeroClass,PlayerId} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import type {PlaybackCue} from './battle-playback.ts';
import {freshAcceptedAnimation} from './battle-playback.ts';
import {dialoguePlan,heroEmote,HERO_DIALOGUE,EMOTE_LABELS} from './battle-dialogue.ts';
import type {DialogueLine,Emote} from './battle-dialogue.ts';
import {speakDialogue,stopDialogueVoice,dialogueVoiceEnabled,setDialogueVoiceEnabled,installedKoreanVoiceCount,previewDialogue} from './dialogue-voice.ts';
import {AudioMixer} from './AudioMixer.tsx';
import {LocalCardArt,LocalHeroArt} from './local-art.tsx';
import {className} from './data.ts';
import {battleHapticsEnabled,setBattleHaptics,hapticSupported,previewBattleHaptics} from './battle-haptics.ts';
import {battleFxQuality,normalizeFxQuality,setBattleFxQuality} from './battle-fx-quality.ts';

const kindLabel={play:'등장',attack:'공격',hit:'피격',death:'사망',emote:'감정표현'} as const;
type Caption=DialogueLine&{key:number;expires:number};
export type CaptionMode='all'|'emotes'|'off';
export function captionMode(raw:unknown):CaptionMode{return raw==='off'||raw==='emotes'?raw:'all';}
export function readCaptionMode():CaptionMode{try{return captionMode(globalThis.localStorage?.getItem('card-duel-dialogue-captions'));}catch{return 'all';}}
export function writeCaptionMode(value:CaptionMode){try{localStorage.setItem('card-duel-dialogue-captions',value);}catch{}}
export function filterCaptions<T extends Pick<DialogueLine,'kind'|'side'>>(captions:readonly T[],side:PlayerId,mode:CaptionMode){return mode==='off'?[]:captions.filter(c=>c.side===side&&(mode==='all'||c.kind==='emote'));}
export function unexpiredCaptions<T extends {expires:number}>(captions:readonly T[],now:number):T[]{return captions.filter(c=>c.expires>now);}
/** A single timer tracks the earliest caption expiry, independent of hit count. */
export function nextCaptionDelay(captions:readonly {expires:number}[],now:number):number|null{
  if(!Number.isFinite(now)||!captions.length)return null;
  const earliest=Math.min(...captions.map(c=>c.expires));return Number.isFinite(earliest)?Math.max(1,earliest-now):null;
}
export function useBattleDialogue(room:RoomView,cue:PlaybackCue|null,connected:boolean,catalog:Catalog,name:(card:Card)=>string){
  const [captions,setCaptions]=useState<Caption[]>([]),[emoteCooldown,setEmoteCooldown]=useState(false);
  const greeted=useRef('');
  const serial=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]),before=useRef<RoomView|null>(null),lastCue=useRef('');
  const reset=()=>{for(const timer of timers.current)clearTimeout(timer);timers.current=[];setCaptions([]);setEmoteCooldown(false);lastCue.current='';before.current=null;stopDialogueVoice();};
  useEffect(()=>{reset();return()=>{for(const timer of timers.current)clearTimeout(timer);timers.current=[];stopDialogueVoice();};},[room.code,connected]);
  useEffect(()=>{const changed=()=>{if(document.hidden)reset();};document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
  useEffect(()=>{const delay=nextCaptionDelay(captions,Date.now());if(delay===null)return;const timer=setTimeout(()=>setCaptions(old=>unexpiredCaptions(old,Date.now())),delay);return()=>clearTimeout(timer);},[captions]);
  const show=(lines:readonly DialogueLine[])=>{
    if(document.hidden||!lines.length)return;
    const now=Date.now(),newLines=lines.map(line=>({...line,key:++serial.current,expires:now+2300}));
    setCaptions(old=>[...unexpiredCaptions(old,now),...newLines].slice(-16));
    speakDialogue(lines);
  };
  useEffect(()=>{
    if(!connected||!room.state||room.state.phase!=='playing'||room.state.turn>1||greeted.current===room.code||document.hidden)return;
    greeted.current=room.code;
    const {self,opponent}=room.state;
    show([heroEmote(self.heroClass,room.seat,'greet'),heroEmote(opponent.heroClass,room.seat===0?1:0,'greet')]);
  },[room.code,room.state?.phase,connected]);
  const showPlan=(plan:ReturnType<typeof dialoguePlan>,impact:number)=>{
    show(plan.start);if(plan.impact.length)later(()=>show(plan.impact),impact);
    if(plan.death.length)later(()=>show(plan.death),impact+180);
  };
  useEffect(()=>{
    if(!connected||!room.state)return;
    if(document.hidden)return;
    // Non-instant playback announces at the cue's own start and impact.
    if(cue&&cue.before.state&&cue.after.state){
      const key=cue.before.code+':'+cue.animation.revision;
      if(lastCue.current!==key){
        lastCue.current=key;
        for(const timer of timers.current)clearTimeout(timer);
        timers.current=[];
        setEmoteCooldown(false);

        const plan=dialoguePlan(cue.animation,cue.before.state,cue.after.state,room.seat,catalog,name);
        show(plan.start);
        const impact=setTimeout(()=>show(plan.impact),cue.impact);
        const death=setTimeout(()=>show(plan.death),Math.min(cue.duration-1,cue.impact+180));
        return ()=>{clearTimeout(impact);clearTimeout(death);};
      }
    }
  },[room.code,cue,connected]);
  useEffect(()=>{
    if(!connected||!room.state)return;
    const prev=before.current;
    before.current=room;
    if(document.hidden||room.animationSpeed!=='instant'||!prev?.state)return;
    const a=freshAcceptedAnimation(prev,room);
    if(a){
      showPlan(dialoguePlan(a,prev.state,room.state,room.seat,catalog,name),80);
      return ()=>{for(const timer of timers.current)clearTimeout(timer);timers.current=[];setEmoteCooldown(false);};
    }
  },[room.code,room.state?.revision,connected,room.animationSpeed]);
  return {captions,emoteCooldown:!!cue||emoteCooldown};
}
export const DialogueCaptions=memo(function DialogueCaptions({captions,side,catalog,hero,heroForm,mode='all'}:{captions:readonly Caption[];side:PlayerId;catalog:Catalog;hero:HeroClass;heroForm?:'jaraxxus';mode?:CaptionMode}){
  const lines=filterCaptions(captions,side,mode),visible=lines.slice(-3);
  return <div className="battle-dialogue-captions" aria-live="polite" aria-relevant="additions" aria-atomic="false">{visible.map(c=>{const card=c.cardId?catalog[c.cardId]:undefined,isHero=!c.cardId&&c.speaker===className[hero];return <div key={c.key} className={`battle-dialogue-line line-${c.kind}`}><span className="dialogue-portrait" aria-hidden="true">{card?<LocalCardArt card={card}/>:isHero?<LocalHeroArt heroClass={hero} heroForm={heroForm}/>:<span className="dialogue-portrait-placeholder">{c.speaker==='비밀'?'?':'✦'}</span>}</span><span className="dialogue-copy"><small>{c.speaker} · {kindLabel[c.kind]}</small><span>{c.text}</span></span></div>;})}{lines.length>3&&<small className="dialogue-overflow">외 {lines.length-3}개 대사</small>}</div>;
});
export function DialogueSettings({hero,mode,onMode,disabled,flat=false}:{hero:HeroClass;mode:CaptionMode;onMode:(mode:CaptionMode)=>void;disabled:boolean;flat?:boolean}){
  const [voice,setVoice]=useState(dialogueVoiceEnabled);
  const [voiceCount,setVoiceCount]=useState(installedKoreanVoiceCount),[message,setMessage]=useState('');
  const [haptics,setHaptics]=useState(battleHapticsEnabled),[hapticMessage,setHapticMessage]=useState('');const canHaptics=hapticSupported();
  const [quality,setQuality]=useState(battleFxQuality);
  useEffect(()=>{const synth=globalThis.speechSynthesis,update=()=>setVoiceCount(installedKoreanVoiceCount());update();synth?.addEventListener?.('voiceschanged',update);return()=>synth?.removeEventListener?.('voiceschanged',update);},[]);
  const preview=()=>{setVoiceCount(installedKoreanVoiceCount());const status=previewDialogue(heroEmote(hero,0,'greet'));setMessage({requested:'기기 음성 재생 요청됨',muted:'대사 음성 및 볼륨을 켜 주세요.',unavailable:'설치된 한국어 오프라인 음성이 없어요.',failed:'음성 재생 요청에 실패했어요.'}[status]);};
  return <details className={`dialogue-settings${flat?" flat-dialogue-settings":""}`} open={flat?true:undefined} onKeyDown={e=>{if(!flat&&e.key==='Escape'&&e.currentTarget.open){e.preventDefault();e.stopPropagation();e.currentTarget.open=false;e.currentTarget.querySelector<HTMLElement>('summary')?.focus();}}}><summary>연출·대사 설정</summary><div className="dialogue-settings-panel"><AudioMixer/><button type="button" className="secondary dialogue-voice-toggle" aria-pressed={voice} onClick={()=>{setDialogueVoiceEnabled(!voice);setVoice(!voice);}} title="내장 음성 또는 기기의 한국어 음성을 사용합니다. 음성이 없으면 자막과 효과음을 사용할 수 있습니다.">대사 음성 {voice?'켜짐':'꺼짐'}</button><label>전투 연출 품질<select aria-label="전투 연출 품질" value={quality} onChange={e=>{const next=normalizeFxQuality(e.target.value);setBattleFxQuality(next);setQuality(next);}}><option value="auto">자동 · 기기 맞춤</option><option value="economy">절전 · 가벼운 효과</option><option value="rich">풍부 · 화려한 효과</option></select></label><small>피해 숫자와 게임 규칙은 항상 동일해요. 움직임 감소 설정을 존중합니다.</small><label>자막 표시<select aria-label="대사 자막 표시" value={mode} onChange={e=>onMode(captionMode(e.target.value))}><option value="all">모든 대사</option><option value="emotes">감정표현만</option><option value="off">표시 안 함</option></select></label><small>{voiceCount?`기기 한국어 음성 ${voiceCount}개 (오프라인)`:'기기 한국어 음성 없음 · 자막 사용 가능'}</small><button type="button" disabled={disabled} onClick={preview}>내 영웅 음성 미리듣기</button><span className="voice-preview-status" role="status" aria-live="polite">{message}</span><div className="haptic-controls"><button type="button" disabled={!canHaptics} aria-pressed={haptics&&canHaptics} onClick={()=>{setBattleHaptics(!haptics);setHaptics(!haptics);setHapticMessage('');}}>전투 진동 {haptics&&canHaptics?'켜짐':'꺼짐'}</button><button type="button" disabled={!canHaptics||!haptics||disabled} onClick={()=>setHapticMessage(previewBattleHaptics()?'진동 요청됨':'이 환경에서 진동을 시작할 수 없어요.')}>진동 미리 체험</button><small>{canHaptics?'짧은 피격·방어·소환 진동':'이 기기는 진동 API 미지원'}</small><span role="status" aria-live="polite">{hapticMessage}</span></div></div></details>;
}
export function EmoteMenu({hero,onEmote,cooldown}:{hero:HeroClass;onEmote:(emote:Emote)=>void;cooldown:boolean}){
  const details=useRef<HTMLDetailsElement>(null);
  const close=()=>{const menu=details.current;if(!menu)return;menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus();};
  return <details className="battle-emote-menu" ref={details} onKeyDown={e=>{if(e.key==='Escape'&&e.currentTarget.open){e.preventDefault();e.stopPropagation();close();}}}><summary>감정표현</summary><div className="battle-emote-options" role="group" aria-label="직업 고유 감정표현"><button type="button" className="battle-emote-close" onClick={close}>감정표현 닫기</button>{(Object.keys(EMOTE_LABELS) as Emote[]).map(key=><button key={key} type="button" disabled={cooldown} title={HERO_DIALOGUE[hero].emotes[key]} onClick={()=>{onEmote(key);close();}}><b>{EMOTE_LABELS[key]}</b><span>{HERO_DIALOGUE[hero].emotes[key]}</span></button>)}<small>{cooldown?'잠시 후 다시 사용할 수 있습니다.':'AI가 직업별 대사로 답합니다.'}</small></div></details>;
}
