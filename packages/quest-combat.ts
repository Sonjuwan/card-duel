import type {CombatEvent} from './engine/src/combat-observation.ts';
import type {PlayerId} from './engine/src/types.ts';
import {printedQuestMetrics,summonMetrics} from './quests.ts';
import type {QuestCounters,QuestMetric} from './quest-types.ts';

export function countQuestEvent(counters:QuestCounters,seat:PlayerId,event:CombatEvent){
  if(event.owner!==seat)return;
  const add=(metric:QuestMetric,amount=1)=>{
    if(amount>0)counters[metric]=Math.min(1_000_000,(counters[metric]??0)+amount);
  };
  switch(event.kind){
    case 'play':
      for(const metric of printedQuestMetrics(event.card))add(metric);
      add('discount',event.card.cost-event.paid);
      break;
    case 'summon':
      for(const metric of summonMetrics(event.card))add(metric);
      break;
    case 'attack':
      if(event.source==='minion'&&event.target==='hero')add('faceAttacks');
      if(event.source==='weapon')add('weaponAttacks');
      if(event.tribe==='beast')add('beastAttacks');
      break;
    case 'damage':
      if(event.side===seat){
        if(event.target==='minion')add('allyDamage');
        else if(event.source!=='weapon')add('selfDamage',event.amount);
      }else{
        if(event.target==='hero'){
          add('heroDamage',event.amount);
          if(event.ownTurn>0&&event.ownTurn<=5)add('earlyDamage',event.amount);
        }
        if(event.source==='spell')add('spellDamage',event.amount);
        if(event.source==='weapon')add('weaponDamage',event.amount);
        if(event.source==='power')add('powerDamage',event.amount);
      }
      break;
    case 'death':
      if(event.side!==seat){
        add('kills');
        if(event.source==='minion')add('minionKills');
        if(event.source==='spell')add('spellKills');
        if(event.area)add('areaKills');
      }
      break;
    case 'minionHeal':add('heal',event.amount);add('minionHeal',event.amount);break;
    default:add(event.kind,'amount' in event?event.amount:1);
  }
}
