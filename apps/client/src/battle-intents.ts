import {getHeroPower,heroPowerReason,publicCardCost,publicCardReason} from '../../../packages/engine/src/index.ts';
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
  offer(action:BattleIntent,allowRepeatedAttack=false){
    const key=intentKey(action);
    const repeatable=allowRepeatedAttack&&(action.type==='attack'||action.type==='heroAttack');
    if(this.full||this.ending||!repeatable&&(this.pending.some(item=>intentKey(item)===key)||this.inFlight&&intentKey(this.inFlight)===key))return false;
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


/** Reserve only public, deterministic costs and counters. Damage, random
 * outcomes and private responses are decided by the authoritative engine. */
export function projectBattleIntents(base:PlayerView,seat:PlayerId,catalog:Catalog,actions:readonly BattleIntent[]):PlayerView{
  if(!actions.length)return base;
  const self={...base.self,board:base.self.board.map(unit=>({...unit})),hand:base.self.hand.slice()};
  const projected={...base,self};
  const applyHeroEffect=(effect:import('../../../packages/engine/src/index.ts').Effect)=>{
    if(effect.condition)return;
    if(effect.kind==='heroAttack')self.heroAttack+=effect.amount;
    if(effect.kind==='armor')self.armor+=effect.amount;
    if(effect.kind==='equip'){self.weapon={attack:effect.attack,durability:effect.durability,cardId:effect.cardId};self.heroAttacksRemaining=Math.max(0,1-(self.heroAttacksMadeThisTurn??0));}
  };
  for(const action of actions){
    if(validateBattleIntent(projected,seat,catalog,action))continue;
    if(action.type==='endTurn')break;
    if(action.type==='attack'){
      const unit=self.board.find(unit=>unit.instanceId===action.attackerId);
      if(unit)unit.attacksRemaining--;
    }
    if(action.type==='heroAttack'){
      self.heroAttacksRemaining--;
      self.heroAttacksMadeThisTurn=(self.heroAttacksMadeThisTurn??0)+1;
      const weapon=self.weapon;
      const ability=weapon?.cardId?catalog[weapon.cardId]:undefined;
      if(weapon){
        const takesAttack=ability?.kind==='weapon'&&ability.attackLossVsMinion&&action.target.kind==='minion';
        const remaining=takesAttack?{...weapon,attack:weapon.attack-1}:{...weapon,durability:weapon.durability-1};
        self.weapon=remaining.durability>0&&remaining.attack>0?remaining:null;
      }
      if(!self.weapon)self.heroAttacksRemaining=Math.min(self.heroAttacksRemaining,Math.max(0,1-self.heroAttacksMadeThisTurn));
    }
    if(action.type==='heroPower'){
      const power=getHeroPower(self);
      self.mana-=power.cost;
      self.heroPowerUsed=true;
      for(const effect of power.effects)applyHeroEffect(effect);
      const summon=power.effects.find(effect=>effect.kind==='summon'||effect.kind==='summonUniqueRandom');
      const cardId=summon?.kind==='summon'?summon.cardId:summon?.cardIds.find(id=>!self.board.some(unit=>unit.cardId===id));
      const card=cardId?catalog[cardId]:undefined;
      if(card?.kind==='minion'&&self.board.length<7)self.board.push({cardId:card.id,instanceId:'reservation:power',attack:card.attack,health:card.health,maxHealth:card.health,attacksRemaining:0});
    }
    if(action.type==='playCard'){
      const held=self.hand.find(card=>card.instanceId===action.instanceId)!;
      const card=catalog[held.cardId];
      self.mana-=publicCardCost(projected,seat,card,catalog,held.costDiscount);
      self.hand=self.hand.filter(card=>card!==held);
      self.handCount--;
      self.cardsPlayedThisTurn++;
      if(card.kind==='coin')self.mana=Math.min(10,self.mana+1);
      if(card.kind==='spell'||card.kind==='coin'||card.kind==='secret')delete self.nextSpellDiscount;
      if(card.kind==='spell'){
        const effects=action.choice===undefined?card.effects:card.choices?.[action.choice]?.effects;
        for(const effect of effects??[]){
          if(effect.condition)continue;
          applyHeroEffect(effect);
          if(effect.kind==='discountNextSpell')self.nextSpellDiscount=(self.nextSpellDiscount??0)+effect.amount;
          if(effect.kind==='summon'&&effect.side!=='enemy'&&!effect.per){
            const token=catalog[effect.cardId];
            if(token?.kind==='minion')for(let i=0;i<effect.count&&self.board.length<7;i++)self.board.push({
              cardId:token.id,instanceId:`reservation:${held.instanceId}:${i}`,attack:token.attack,health:token.health,maxHealth:token.health,attacksRemaining:0,
            });
          }
        }
      }
      if(card.kind==='weapon'){self.weapon={cardId:card.id,attack:card.attack,durability:card.durability};self.heroAttacksRemaining=Math.max(0,(card.windfury?2:1)-(self.heroAttacksMadeThisTurn??0));}
      if(card.kind==='secret')self.nextSecretFree=false;
      if(card.kind==='minion')self.minionsPlayedThisTurn=(self.minionsPlayedThisTurn??0)+1;
      if(card.kind==='minion')self.board.splice(action.position??self.board.length,0,{
        cardId:card.id,instanceId:'reservation:'+held.instanceId,attack:card.attack,health:card.health,maxHealth:card.health,attacksRemaining:0,
      });
    }
  }
  return projected;
}
