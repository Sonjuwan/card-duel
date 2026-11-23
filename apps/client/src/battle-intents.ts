import {heroPowerReason,publicCardReason} from '../../../packages/engine/src/index.ts';
import type {Action,Catalog,PlayerId,PlayerView} from '../../../packages/engine/src/index.ts';
import {planAttack,planCard,planPower,targetAction} from './battle-actions.ts';

export type BattleIntent=Extract<Action,{type:'playCard'|'attack'|'heroAttack'|'heroPower'|'endTurn'}>;

function intentKey(action:BattleIntent){
  if(action.type==='playCard')return `card:${action.instanceId}`;
  if(action.type==='attack')return `attack:${action.attackerId}`;
  return action.type;
}

export class BattleIntentQueue{
  pending:BattleIntent[]=[];
  inFlight:BattleIntent|undefined;
  private limit:number;
  constructor(limit=4){this.limit=limit;}
  get full(){return this.pending.length+Number(!!this.inFlight)>=this.limit;}
  get ending(){return this.inFlight?.type==='endTurn'||this.pending.some(action=>action.type==='endTurn');}
  offer(action:BattleIntent){
    const key=intentKey(action);
    if(this.full||this.ending||this.pending.some(item=>intentKey(item)===key)||this.inFlight&&intentKey(this.inFlight)===key)return false;
    this.pending.push(action);
    return true;
  }
  take(){
    if(this.inFlight)return undefined;
    this.inFlight=this.pending.shift();
    return this.inFlight;
  }
  acknowledge(){this.inFlight=undefined;}
  cancelPending(){this.pending=[];}
  clear(){this.cancelPending();this.acknowledge();}
}

export function isBattleIntent(action:Action):action is BattleIntent{
  return action.type!=='mulligan'&&action.type!=='chooseDeckCard'&&action.type!=='concede';
}

/** Revalidate against the latest approved view immediately before dispatch. */
export function validateBattleIntent(view:PlayerView,seat:PlayerId,catalog:Catalog,action:BattleIntent):string|undefined{
  if(view.phase!=='playing'||view.activePlayer!==seat)return '이미 내 턴이 끝났습니다.';
  if(view.choicePending)return '먼저 카드 선택을 완료해야 합니다.';
  if(action.type==='endTurn')return;
  if(action.type==='playCard'){
    const instance=view.self.hand.find(card=>card.instanceId===action.instanceId);
    if(!instance)return '해당 카드가 손패에 없습니다.';
    const reason=publicCardReason(view,seat,instance,catalog);
    if(reason)return reason;
    const plan=planCard(view,seat,catalog,action.instanceId,action.position,action.choice);
    if(action.position!==undefined&&action.position>view.self.board.length)return '예약한 전장 위치를 사용할 수 없습니다.';
    if(action.target&&targetAction(view,seat,catalog,plan?.selection??null,action.target))return;
    if(!action.target&&plan?.action)return;
    return '카드의 대상이나 효과 선택이 유효하지 않습니다.';
  }
  if(action.type==='heroPower'){
    const reason=heroPowerReason(view.self);
    if(reason)return reason;
    const plan=planPower(view,seat,catalog);
    if(!action.target&&plan?.action||action.target&&targetAction(view,seat,catalog,plan?.selection??null,action.target))return;
    return '영웅 능력의 대상을 사용할 수 없습니다.';
  }
  const selection=planAttack(view,seat,catalog,action.type==='attack'?action.attackerId:undefined);
  if(!targetAction(view,seat,catalog,selection,action.target))return '공격자나 대상을 사용할 수 없습니다.';
}
