import {useState,useSyncExternalStore} from 'react';
import {battleEffectsSoundEnabled,setBattleEffectsSound,battleSoundEnabled,battleSoundVolume,overallSoundVolume,setBattleSound,setBattleSoundVolume,setOverallSoundVolume,subscribeBattleSound} from './battle-sound.ts';
import {dialogueVoiceVolume,setDialogueVoiceVolume,stopDialogueVoice} from './dialogue-voice.ts';

const channels=[
  {label:'전체 음량',get:overallSoundVolume,set:setOverallSoundVolume,initial:100},
  {label:'캐릭터 대사 음량',ariaLabel:'대사 볼륨',get:dialogueVoiceVolume,set:setDialogueVoiceVolume,initial:90},
  {label:'전투 효과음 음량',ariaLabel:'효과음 볼륨',get:battleSoundVolume,set:setBattleSoundVolume,initial:75},
];
export function AudioMixer({includeEffects=false}:{includeEffects?:boolean}){
  const read=()=>channels.map(channel=>channel.get());
  const [values,setValues]=useState(read);
  const [effects,setEffects]=useState(battleEffectsSoundEnabled);
  const muted=!useSyncExternalStore(subscribeBattleSound,battleSoundEnabled,battleSoundEnabled);
  const mute=(value:boolean)=>{
    setBattleSound(!value);
    if(value)stopDialogueVoice();
  };
  return <div className="audio-mixer">
    {channels.map(({label,ariaLabel,set},i)=><label key={label}>{label}<output>{values[i]}%</output><input type="range" min={0} max={100} aria-label={ariaLabel??label} aria-valuetext={values[i]+'%'} value={values[i]} onChange={event=>{set(Number(event.currentTarget.value));setValues(read());}}/></label>)}
    <div className="audio-mixer-actions">
      <button type="button" className="secondary" aria-pressed={muted} onClick={()=>mute(!muted)}>전체 음소거</button>
      {includeEffects&&<button type="button" className="secondary sound-toggle" aria-pressed={effects}
        onClick={()=>{setBattleEffectsSound(!effects);setEffects(!effects);}}>효과음 {effects?'켜짐':'꺼짐'}</button>}
      <button type="button" className="secondary" onClick={()=>{
        for(const channel of channels)channel.set(channel.initial);
        if(includeEffects){setBattleEffectsSound(true);setEffects(true);}
        mute(false);setValues(read());
      }}>기본 설정으로 복원</button>
    </div>
  </div>;
}
