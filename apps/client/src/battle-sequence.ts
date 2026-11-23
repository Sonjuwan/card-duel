import type {PlaybackCue} from './battle-playback.ts';

/** The engine trace is ordered and public. A newly present unit is evidence of
 * a summon, but the trace does not attribute it to a particular deathrattle. */
export function battleSequence(cue:PlaybackCue):string[]{
  const steps=(cue.animation.events??[]).map(event=>{
    switch(event.kind){
      case 'combat':return '공격 충돌';
      case 'shield':return '보호막 소모';
      case 'damage':return `피해 ${event.amount}`;
      case 'heal':return `회복 ${event.amount}`;
      case 'death':return '하수인 사망';
      case 'secretTriggered':return '비밀 발동';
    }
  });
  const before=cue.before.state,after=cue.after.state;
  if(!before||!after)return steps;
  const prior=new Set([...before.self.board,...before.opponent.board].map(unit=>unit.instanceId));
  const summons=[...after.self.board,...after.opponent.board].filter(unit=>!prior.has(unit.instanceId)).length;
  if(steps.length&&summons)steps.push(`하수인 ${summons}장 등장`);
  return steps;
}
