import { cardChoiceReason, canAttackHero, canAttackMinion, effectiveTargetRule, getHeroPower, heroPowerReason, legalPublicTargets, publicAttackTargets, publicCardReason, sameTarget } from '../../../packages/engine/src/index.ts';
import type { Action, Card, Catalog, PlayerId, PlayerView, Target } from '../../../packages/engine/src/index.ts';

/** Only the public view is used to decide what the interface may offer. The
 * server still validates every action against the authoritative game state. */
export type Selection =
  | {kind:'held';id:string}
  | {kind:'card';id:string;position?:number;choice?:number}
  | {kind:'cardChoice';id:string;position?:number}
  | {kind:'attack';id:string}
  | {kind:'power'}
  | {kind:'heroAttack'};
export type Intent = {selection:Selection;action?:never}|{action:Action;selection?:never};
export type DragIntent = {kind:'card';id:string}|{kind:'attack';id:string}|{kind:'heroAttack'};
export type DragState={intent:DragIntent;revision:number};
export type DropLocation={kind:'board';position:number}|{kind:'target';target:Target;position?:number};

function ownTurn(view:PlayerView,seat:PlayerId):boolean {
  return view.phase==='playing'&&view.activePlayer===seat&&!view.choicePending;
}
function cardInHand(view:PlayerView,catalog:Catalog,id:string){
  const instance=view.self.hand.find(c=>c.instanceId===id);
  return instance?{instance,card:catalog[instance.cardId]}:null;
}
export function selectionCard(view:PlayerView,catalog:Catalog,selection:Selection|null):Card|undefined {
  return selection?.kind==='held'||selection?.kind==='card'||selection?.kind==='cardChoice'?cardInHand(view,catalog,selection.id)?.card:undefined;
}
/** Clicking a hand card is an inspection/selection operation only. The
 * existing drag planner is the only path that initiates a card play. */
export function selectHandCard(view:PlayerView,seat:PlayerId,catalog:Catalog,id:string,selection:Selection|null):Selection|null{
  if(!planCard(view,seat,catalog,id))return null;
  return selection?.kind==='held'&&selection.id===id?null:{kind:'held',id};
}
export function planCard(view:PlayerView,seat:PlayerId,catalog:Catalog,id:string,position?:number,choice?:number):Intent|null {
  if(!ownTurn(view,seat))return null;
  const held=cardInHand(view,catalog,id);
  if(!held?.card||publicCardReason(view,seat,held.instance,catalog))return null;
  const card=held.card;
  const pos=card.kind==='minion'?Math.max(0,Math.min(position??view.self.board.length,view.self.board.length)):undefined;
  if((card.kind==='minion'||card.kind==='spell')&&card.choices){
    if(choice===undefined)return {selection:{kind:'cardChoice',id,position:pos}};
    if(!card.choices[choice]||cardChoiceReason(view,seat,card,catalog,choice))return null;
  }
  const rule=effectiveTargetRule(card,view.self.cardsPlayedThisTurn>0,choice);
  if(rule){
    const targets=legalPublicTargets(view,seat,rule,catalog,card.kind==='spell');
    if(targets.length)return {selection:{kind:'card',id,position:pos,choice}};
    // Minion/weapon battlecries may be skipped when there is no legal target.
    if(card.kind!=='minion'&&card.kind!=='weapon')return null;
  }
  return {action:{type:'playCard',instanceId:id,position:pos,choice}};
}
export function planPower(view:PlayerView,seat:PlayerId,catalog:Catalog):Intent|null {
  if(!ownTurn(view,seat)||heroPowerReason(view.self))return null;
  const rule=getHeroPower(view.self).targetRule;
  if(!rule)return {action:{type:'heroPower'}};
  return legalPublicTargets(view,seat,rule,catalog,true).length?{selection:{kind:'power'}}:null;
}
export function planAttack(view:PlayerView,seat:PlayerId,catalog:Catalog,id?:string):Selection|null {
  if(!ownTurn(view,seat)||!publicAttackTargets(view,seat).length)return null;
  if(id===undefined)return canAttackHero(view.self)?{kind:'heroAttack'}:null;
  const minion=view.self.board.find(m=>m.instanceId===id);
  return minion&&canAttackMinion(minion,catalog)?{kind:'attack',id}:null;
}
export function targetsFor(view:PlayerView,seat:PlayerId,catalog:Catalog,selection:Selection|null):Target[] {
  if(!ownTurn(view,seat)||!selection||selection.kind==='cardChoice'||selection.kind==='held')return [];
  if(selection.kind==='attack')return planAttack(view,seat,catalog,selection.id)?publicAttackTargets(view,seat):[];
  if(selection.kind==='heroAttack')return planAttack(view,seat,catalog)?publicAttackTargets(view,seat):[];
  if(selection.kind==='power')return planPower(view,seat,catalog)?.selection?legalPublicTargets(view,seat,getHeroPower(view.self).targetRule!,catalog,true):[];
  const plan=planCard(view,seat,catalog,selection.id,selection.position,selection.choice);
  const card=selectionCard(view,catalog,selection);
  if(!card||plan?.selection?.kind!=='card')return [];
  const rule=effectiveTargetRule(card,view.self.cardsPlayedThisTurn>0,selection.choice);
  return rule?legalPublicTargets(view,seat,rule,catalog,card.kind==='spell'):[];
}
export function targetAction(view:PlayerView,seat:PlayerId,catalog:Catalog,selection:Selection|null,target:Target):Action|null {
  if(!selection||!targetsFor(view,seat,catalog,selection).some(t=>sameTarget(t,target)))return null;
  switch(selection.kind){
    case 'card':return {type:'playCard',instanceId:selection.id,target,position:selection.position,choice:selection.choice};
    case 'attack':return {type:'attack',attackerId:selection.id,target};
    case 'power':return {type:'heroPower',target};
    case 'heroAttack':return {type:'heroAttack',target};
    default:return null;
  }
}
export function planDrag(view:PlayerView,seat:PlayerId,catalog:Catalog,drag:DragIntent,position?:number):Intent|null {
  if(drag.kind==='card')return planCard(view,seat,catalog,drag.id,position);
  const selection=planAttack(view,seat,catalog,drag.kind==='attack'?drag.id:undefined);
  return selection?{selection}:null;
}
export function resolveDrop(view:PlayerView,seat:PlayerId,catalog:Catalog,drag:DragState|null,drop:DropLocation):Intent|null {
  if(!drag||drag.revision!==view.revision||!ownTurn(view,seat))return null;
  if(drop.kind==='board')return drag.intent.kind==='card'?planCard(view,seat,catalog,drag.intent.id,drop.position):null;
  const plan=planDrag(view,seat,catalog,drag.intent,drop.position);
  const action=targetAction(view,seat,catalog,plan?.selection??null,drop.target);
  return action?{action}:null;
}
