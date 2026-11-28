import type {PlaybackCue} from './battle-playback.ts';

/** The engine trace describes the order of publicly visible effects. */
export function battleSequence(cue:PlaybackCue):string[]{
  const steps=(cue.animation.events??[]).map(event=>{
    switch(event.kind){
      case 'combat':return '공격 충돌';
      case 'shield':return '보호막 소모';
      case 'damage':return `피해 ${event.amount}`;
      case 'heal':return `회복 ${event.amount}`;
      case 'draw':return event.burned?'드로우 카드 소실':'카드 뽑기';
      case 'fatigue':return `탈진 ${event.amount}`;
      case 'deathrattle':return '죽음의 메아리';
      case 'death':return '하수인 사망';
      case 'secretTriggered':return '비밀 발동';
      case 'discard':return '손패 카드 버림';
    }
  });
  const before=cue.before.state,after=cue.after.state;
  if(!before||!after)return steps;
  const prior=new Set([...before.self.board,...before.opponent.board].map(unit=>unit.instanceId));
  const summons=[...after.self.board,...after.opponent.board].filter(unit=>!prior.has(unit.instanceId)).length;
  if(steps.length&&summons)steps.push(`하수인 ${summons}장 등장`);
  return steps;
}
