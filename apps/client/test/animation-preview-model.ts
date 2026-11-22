import {applyAction,createGame,practiceDeck} from '../../../packages/engine/src/index.ts';
import type {Action,Catalog,GameState,Minion,PlayerId,Target} from '../../../packages/engine/src/index.ts';
export const kinds=['summon','attack','hero','fire','ice','lightning','heal','shadow','area','secret','power'] as const;
export type Scenario=typeof kinds[number];
export const labels:Record<Scenario,string>={summon:'하수인 소환',attack:'하수인 공격·사망',hero:'영웅 무기 공격',fire:'강력한 화염 주문',ice:'냉기 · 빙결',lightning:'번개',heal:'광역 치유',shadow:'암흑',area:'광역 화염',secret:'비밀 설치',power:'영웅 능력'};
const handIds=['wisp','pyroblast','ice_shard','lightning_debt','healing_circle','shadow_lance','flame_tide','ice_block'];
const other=(p:PlayerId):PlayerId=>p===0?1:0;
function minion(catalog:Catalog,id:string,seat:PlayerId,i:number,health?:number):Minion{
  const c=catalog[id];if(c.kind!=='minion')throw Error(id);
  return {cardId:id,instanceId:`demo-${seat}-${i}`,attack:c.attack,health:health??c.health,maxHealth:c.health,attacksRemaining:1,keywords:[...(c.keywords??[])]};
}
export function fixture(catalog:Catalog,actor:PlayerId){
  let state=createGame(catalog,[practiceDeck(catalog,'mage'),practiceDeck(catalog,'mage')],{seed:83,firstPlayer:actor});
  state=applyAction(state,0,{type:'mulligan',replace:[]});state=applyAction(state,1,{type:'mulligan',replace:[]});
  state.turn=8;state.players[0].mana=actor===0?10:0;state.players[1].mana=actor===1?10:0;state.players[0].maxMana=10;state.players[1].maxMana=10;
  for(const seat of [0,1] as const){
    const p=state.players[seat];p.health=24;p.armor=0;p.weapon={attack:4,durability:2};p.heroAttacksRemaining=1;p.heroPowerUsed=false;
    p.board=[minion(catalog,'ogre',seat,0,5),minion(catalog,'wolf',seat,1),minion(catalog,'snow_brute',seat,2,4)];
    p.hand=handIds.map((cardId,i)=>({cardId,instanceId:`demo-hand-${seat}-${i}`}));
  }
  return state;
}
export function scenarioAction(state:GameState,actor:PlayerId,kind:Scenario):Action{
  const enemy=other(actor),hero={kind:'hero' as const,player:enemy},minion={kind:'minion' as const,instanceId:`demo-${enemy}-0`};
  const play=(cardId:string,target?:Target):Extract<Action,{type:'playCard'}>=>({type:'playCard',instanceId:state.players[actor].hand.find(c=>c.cardId===cardId)!.instanceId,...(target?{target}:{})});
  switch(kind){
    case 'summon':return {...play('wisp'),position:1};
    case 'attack':return {type:'attack',attackerId:`demo-${actor}-0`,target:{kind:'minion',instanceId:`demo-${enemy}-1`}};
    case 'hero':return {type:'heroAttack',target:hero};
    case 'fire':return play('pyroblast',hero);
    case 'ice':return play('ice_shard',minion);
    case 'lightning':return play('lightning_debt',hero);
    case 'heal':return play('healing_circle');
    case 'shadow':return play('shadow_lance',minion);
    case 'area':return play('flame_tide');
    case 'secret':return play('ice_block');
    case 'power':return {type:'heroPower',target:hero};
  }
}
