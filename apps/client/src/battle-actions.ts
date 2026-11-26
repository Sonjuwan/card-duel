import { cardChoiceReason, canAttackHero, canAttackMinion, effectiveTargetRule, getHeroPower, heroPowerReason, legalPublicTargets, publicAttackTargets, publicCardReason, sameTarget } from '../../../packages/engine/src/index.ts';
import type { Action, Card, Catalog, HeroClass, PlayerId, PlayerView, Target } from '../../../packages/engine/src/index.ts';

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
export type DragIntent = {kind:'card';id:string}|{kind:'attack';id:string}|{kind:'heroAttack'}|{kind:'power'};
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
/** A minion waiting for a choice/target already carries its placement.
 * Keep the visible gap and the eventual command in sync if it is changed. */
export function repositionSelection(view:PlayerView,catalog:Catalog,selection:Selection|null,position:number):Selection|null{
  if((selection?.kind!=='card'&&selection?.kind!=='cardChoice')||selectionCard(view,catalog,selection)?.kind!=='minion')return selection;
  return {...selection,position:Math.max(0,Math.min(position,view.self.board.length))};
}
/** Number insertion gaps from left to right, never offer a full board or
 * a non-minion selection. A picker change is not a play action. */
export function placementOptions(view:PlayerView,seat:PlayerId,catalog:Catalog,selection:Selection|null){
  if(!ownTurn(view,seat)||(selection?.kind!=='held'&&selection?.kind!=='card')||selectionCard(view,catalog,selection)?.kind!=='minion'||!planCard(view,seat,catalog,selection.id))return [];
  const board=view.self.board;if(board.length>=7)return [];
  return Array.from({length:board.length+1},(_,position)=>({position,leftCardId:board[position-1]?.cardId,rightCardId:board[position]?.cardId}));
}
/** A second press on the same attack/power source cancels its targeting
 * selection. Switching sources remains a single press. */
export function toggleActionSelection(current:Selection|null,next:Selection|null):Selection|null{
  if(next?.kind==='attack'&&current?.kind==='attack'&&current.id===next.id)return null;
  if(next?.kind==='heroAttack'&&current?.kind==='heroAttack'||next?.kind==='power'&&current?.kind==='power')return null;
  return next;
}
/** Arrow keys cycle the supplied navigation group (legal targets or a single
 * inspection row). Native Enter/Space still provide explicit activation. */
export function keyboardTargetIndex(key:string,current:number,count:number):number|null{
  if(!Number.isInteger(count)||count<=0)return null;
  if(key==='Home')return 0;if(key==='End')return count-1;
  // Long, scrollable target menus can advance a screenful without triggering a card.
  // Clamp at the ends: PageUp/PageDown must never wrap to a different target.
  if(key==='PageDown')return Math.min(count-1,Math.max(-1,current)+5);
  if(key==='PageUp')return Math.max(0,(current<0?0:current)-5);
  if(key==='ArrowDown'||key==='ArrowRight')return current>=0&&current<count?(current+1)%count:0;
  if(key==='ArrowUp'||key==='ArrowLeft')return current>=0&&current<count?(current+count-1)%count:count-1;
  return null;
}
/** Preserve the source of an accepted keyboard action if it remains legal;
 * otherwise prefer a playable hand card, then another public ready source. */
export function keyboardActionSource(action:Action):string|undefined{
  return action.type==='playCard'?`card:${action.instanceId}`:action.type==='attack'?`minion:${action.attackerId}`:action.type==='heroAttack'?'hero':action.type==='heroPower'?'power':undefined;
}
export function keyboardReturnIndex(preferred:string|undefined,available:readonly string[]):number{
  const exact=preferred===undefined?-1:available.indexOf(preferred);if(exact>=0)return exact;
  const hand=available.findIndex(id=>id.startsWith('card:'));return hand>=0?hand:available.length?0:-1;
}
/** Cycle only enabled controls, including when focus starts on the dialog. */
export function modalTabIndex(current:number,count:number,shift:boolean):number{
  if(count<=0)return -1;
  if(current<0||current>=count)return shift?count-1:0;
  return (current+(shift?-1:1)+count)%count;
}
export type TargetPickerRow={target:Target;side:'self'|'enemy';health:number;publicStatuses?:string[]}&({kind:'hero';heroClass:HeroClass;heroForm?:'jaraxxus';armor:number}|{kind:'minion';cardId:string;attack:number;position:number});
/** Describe only already-legal, public targets. Board position distinguishes
 * otherwise identical minions without reporting private opponent data. */
export function targetPickerRows(view:PlayerView,seat:PlayerId,targets:readonly Target[]):TargetPickerRow[]{
  const rows:TargetPickerRow[]=[];
  for(const target of targets){
    if(rows.some(r=>sameTarget(r.target,target)))continue;
    if(target.kind==='hero'){
      if(target.player!==0&&target.player!==1)continue;
      const side=target.player===seat?'self':'enemy',p=side==='self'?view.self:view.opponent;
      rows.push({target,kind:'hero',side,health:p.health,heroClass:p.heroClass,heroForm:p.heroForm,armor:p.armor,publicStatuses:[...(p.heroImmuneThisTurn?['면역']:[]),...(p.heroFrozenThroughTurn!==undefined?['빙결']:[])]});continue;
    }
    for(const side of ['self','enemy'] as const){
      const board=side==='self'?view.self.board:view.opponent.board,position=board.findIndex(m=>m.instanceId===target.instanceId&&m.health>0);
      if(position<0)continue;
      const minion=board[position];rows.push({target,kind:'minion',side,cardId:minion.cardId,attack:minion.attack,health:minion.health,position,publicStatuses:[...(minion.keywords?.includes('taunt')?['도발']:[]),...(minion.keywords?.includes('divineShield')?['천상의 보호막']:[]),...(minion.immuneThisTurn?['면역']:[]),...(minion.frozenThroughTurn!==undefined?['빙결']:[])]});break;
    }
  }
  return rows;
}
/** Clicking a hand card is an inspection/selection operation only. Explicit
 * play confirmation or drag is required; pressing the same card cancels. */
export function selectHandCard(view:PlayerView,seat:PlayerId,catalog:Catalog,id:string,selection:Selection|null):Selection|null{
  if(!planCard(view,seat,catalog,id))return null;
  return (selection?.kind==='held'||selection?.kind==='card'||selection?.kind==='cardChoice')&&selection.id===id?null:{kind:'held',id};
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
  if(drag.kind==='power')return planPower(view,seat,catalog);
  const selection=planAttack(view,seat,catalog,drag.kind==='attack'?drag.id:undefined);
  return selection?{selection}:null;
}
export function resolveDrop(view:PlayerView,seat:PlayerId,catalog:Catalog,drag:DragState|null,drop:DropLocation):Intent|null {
  if(!drag||drag.revision!==view.revision||!ownTurn(view,seat))return null;
  if(drop.kind==='board'){
    if(drag.intent.kind==='power'){const plan=planPower(view,seat,catalog);return plan?.action?plan:null;}
    return drag.intent.kind==='card'?planCard(view,seat,catalog,drag.intent.id,drop.position):null;
  }
  const plan=planDrag(view,seat,catalog,drag.intent,drop.position);
  const action=targetAction(view,seat,catalog,plan?.selection??null,drop.target);
  return action?{action}:null;
}

/** An end-turn prompt is valid only after every real legal action is exhausted. */
export function hasRemainingBattleAction(view:PlayerView,seat:PlayerId,catalog:Catalog):boolean{
  if(!ownTurn(view,seat)||view.choicePending)return false;
  if(planPower(view,seat,catalog)||planAttack(view,seat,catalog)||view.self.board.some(unit=>!!planAttack(view,seat,catalog,unit.instanceId)))return true;
  return view.self.hand.some(held=>{
    const card=catalog[held.cardId];
    if(card&&(card.kind==='minion'||card.kind==='spell')&&card.choices)return card.choices.some((_,choice)=>!!planCard(view,seat,catalog,held.instanceId,undefined,choice));
    return !!planCard(view,seat,catalog,held.instanceId);
  });
}
