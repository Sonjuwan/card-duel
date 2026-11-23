import type {Card,Catalog} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import {freshAcceptedAnimation} from './battle-playback.ts';
import {impactChanges,defenseImpactLabel} from './battle-fx-model.ts';

export type ImpactHistoryEntry={revision:number;turn:number;actor:string;lines:string[]};
/** Display only consecutive, accepted public results. No hidden cards, no
 * guessed kills, and no replay of an old saved or reconnected animation. */
export function advanceImpactHistory(before:RoomView|null,after:RoomView,previous:ImpactHistoryEntry[],catalog:Catalog,name:(card:Card)=>string):ImpactHistoryEntry[]{
  if(!before?.state||!after.state||before.code!==after.code||before.seat!==after.seat)return [];
  if(before.state.revision===after.state.revision)return previous;
  if(after.state.revision!==before.state.revision+1||before.state.phase!=='playing')return [];
  const a=freshAcceptedAnimation(before,after);if(!a)return previous;
  const seat=after.seat,enemy=after.mode==='bot'?'AI':'상대',actor=a.actor===seat?'나':enemy;
  const groups=new Map<string,{label:string;items:string[];hits:number}>();
  for(const impact of impactChanges(before.state,after.state,seat,a.events)){
    const t=impact.target,id=t.kind==='hero'?`hero:${t.player}`:`minion:${t.instanceId}`;
    const owner=impact.side===seat?'내':enemy;
    const priorBoard=impact.side===seat?before.state.self.board:before.state.opponent.board,nextBoard=impact.side===seat?after.state.self.board:after.state.opponent.board;
    const priorIndex=t.kind==='minion'?priorBoard.findIndex(m=>m.instanceId===t.instanceId):-1,nextIndex=t.kind==='minion'?nextBoard.findIndex(m=>m.instanceId===t.instanceId):-1;
    const prior=priorBoard[priorIndex],next=nextBoard[nextIndex],card=catalog[prior?.cardId??next?.cardId??''];
    // Keep pre-action positions for existing units, even if a removal shifts
    // the rest. Newly summoned units use only their public post-action slot.
    const position=priorIndex>=0?` (행동 전 ${priorIndex+1}번)`:nextIndex>=0?` (행동 후 ${nextIndex+1}번)`:'';
    const label=t.kind==='hero'?`${owner} 영웅`:`${owner} ${card?name(card):'하수인'}${position}`;
    const changes=prior&&next?[...(prior.attack!==next.attack?[`공격 ${prior.attack}→${next.attack}`]:[]),...(prior.maxHealth!==next.maxHealth?[`최대 체력 ${prior.maxHealth}→${next.maxHealth}`]:[])]:[];
    const transformed=next?catalog[next.cardId]:undefined;
    const item=defenseImpactLabel(impact)??(impact.kind==='damage'?`체력 피해 ${impact.amount}`:impact.kind==='heal'?`회복 ${impact.amount}`:impact.kind==='leave'?(impact.death===true?'사망':'전장 이탈'):impact.kind==='summon'?'소환':impact.kind==='freeze'?'빙결':impact.kind==='transform'?(transformed?`변신 → ${name(transformed)}`:'변신'):impact.kind==='buff'?(changes.length?`능력치 변화 (${changes.join(', ')})`:'능력치 변화'):null);
    if(!item)continue;
    const group=groups.get(id)??{label,items:[],hits:0};group.items.push(item);group.hits=Math.max(group.hits,impact.hitCount??0);groups.set(id,group);
  }
  const lines=[...groups.values()].map(g=>`${g.label} · ${g.hits>1?`${g.hits}연타 · `:''}${g.items.join(' · ')}`);
  if(a.events?.some(e=>e.kind==='secretTriggered'))lines.unshift('비밀 발동');
  if(a.blocked)lines.unshift('공격 차단');
  if(!lines.length)return previous;
  return [{revision:a.revision,turn:after.state.turn,actor,lines},...previous].slice(0,5);
}
