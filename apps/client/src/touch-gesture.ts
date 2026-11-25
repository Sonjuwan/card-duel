import {resolveDrop} from './battle-actions.ts';
import type {DragIntent,DragState,DropLocation,Intent} from './battle-actions.ts';
import type {PlayerId,PlayerView,Catalog,Target} from '../../../packages/engine/src/index.ts';
export type TouchGesture={pointerId:number;originX:number;originY:number;drag:DragState;phase:'pending'|'dragging'|'scrolling';canPanBoard?:boolean};
export function canPanBoard(overflowX:string,clientWidth:number,scrollWidth:number):boolean{
  return (overflowX==='auto'||overflowX==='scroll')&&Number.isFinite(clientWidth)&&Number.isFinite(scrollWidth)&&clientWidth>0&&scrollWidth-clientWidth>1;
}
/** Bounded edge panning for a held minion. A narrow edge zone and a caller's
 * dwell delay avoid moving the board while the player simply drops a card. */
export function boardEdgePanDelta(x:number,left:number,right:number,scrollLeft:number,maxScroll:number,elapsedMs=16):number{
  if(![x,left,right,scrollLeft,maxScroll,elapsedMs].every(Number.isFinite)||left>=right||x<left||x>right||maxScroll<=0||elapsedMs<=0)return 0;
  const edge=Math.min(24,(right-left)/3),fromLeft=x-left,fromRight=right-x,tick=Math.min(40,elapsedMs);
  if(fromLeft<edge&&scrollLeft>0)return -Math.min(scrollLeft,tick*(.12+.42*(1-fromLeft/edge)));
  if(fromRight<edge&&scrollLeft<maxScroll)return Math.min(maxScroll-scrollLeft,tick*(.12+.42*(1-fromRight/edge)));
  return 0;
}
export function intentFromSource(source:string|undefined):DragIntent|null{
  if(source==='hero')return{kind:'heroAttack'};
  if(source==='power')return{kind:'power'};
  if(source?.startsWith('card:')&&source.length>5)return{kind:'card',id:source.slice(5)};
  if(source?.startsWith('minion:')&&source.length>7)return{kind:'attack',id:source.slice(7)};
  return null;
}
export function advanceGesture(gesture:TouchGesture,x:number,y:number,revision:number):TouchGesture|null{
  if(revision!==gesture.drag.revision)return null;
  if(gesture.phase!=='pending')return gesture;
  const dx=Math.abs(x-gesture.originX),dy=Math.abs(y-gesture.originY);
  if(Math.hypot(dx,dy)<9)return gesture;
  // Natural sideways scrolling of a ten-card hand is not a card play.
  if((gesture.drag.intent.kind==='card'||gesture.canPanBoard&&gesture.drag.intent.kind==='attack')&&dx>dy*1.35)return{...gesture,phase:'scrolling'};
  return{...gesture,phase:'dragging'};
}
/** An old gesture or scroll must not turn into the browser's synthetic tap.
 * Only a current, active pending gesture is a tap; only a drag can drop. */
export function finishGesture(gesture:TouchGesture,revision:number,active:boolean):'tap'|'cancel'|'drop'{
  if(!active||gesture.drag.revision!==revision||gesture.phase==='scrolling')return 'cancel';
  return gesture.phase==='dragging'?'drop':'tap';
}
/** Losing focus, app switching or a new game revision interrupts the current
 * gesture without creating a drop. Preserve the old pointer guard across
 * repeated cancellation until its delayed release or a genuinely fresh press. */
export function interruptTouch(gesture:TouchGesture|null,cancelledPointer:number|null,suppressUntil:number,now:number){
  return gesture?{cancelledPointer:gesture.pointerId,suppressUntil:Math.max(suppressUntil,now+250)}:{cancelledPointer,suppressUntil};
}
/** Touch starts with implicit capture on the pressed card. Moving that capture
 * to the arena fires a bubbling lostpointercapture on the old card, not a
 * cancellation of the arena's new capture. Real cancellation still wins. */
export function isCaptureHandoff(type:string,fromChild:boolean,arenaHasCapture:boolean):boolean{
  return type==='lostpointercapture'&&fromChild&&arenaHasCapture;
}
export type TouchHit={minionId?:string;hero?:'self'|'enemy';slot?:number;ownBoard?:boolean;field?:boolean;hand?:boolean;control?:boolean};
/** Pick the closest actual insertion gap in the friendly row. This allows
 * a finger wider than a 5px slot to place a minion without shifting the row. */
export function nearestBoardSlot(x:number,slots:readonly {position:number;x:number}[]):number|undefined{
  if(!Number.isFinite(x))return undefined;
  let nearest:typeof slots[number]|undefined,distance=Infinity;
  for(const slot of slots){
    if(!Number.isFinite(slot.x)||!Number.isInteger(slot.position)||slot.position<0)continue;
    const delta=Math.abs(x-slot.x);
    if(delta<distance||(delta===distance&&slot.position<(nearest?.position??Infinity))){nearest=slot;distance=delta;}
  }
  return nearest?.position;
}
/** Snap only to the visible portion of each insertion gap. Scroll-clipped
 * gaps must not win a distance comparison against a visible gap. */
export function nearestVisibleBoardSlot(x:number,bounds:{left:number;right:number},slots:readonly {position:number;left:number;right:number}[]):number|undefined{
  if(!Number.isFinite(bounds.left)||!Number.isFinite(bounds.right)||bounds.left>=bounds.right)return undefined;
  return nearestBoardSlot(x,slots.flatMap(slot=>{
    const left=Math.max(bounds.left,slot.left),right=Math.min(bounds.right,slot.right);
    return Number.isFinite(left)&&Number.isFinite(right)&&left<right?[{position:slot.position,x:(left+right)/2}]:[];
  }));
}
export type TargetHitBox={target:Target;legal:boolean;left:number;right:number;top:number;bottom:number};
/** Touch-only tolerance for a finger just outside a target. Include illegal
 * and clipped targets in the geometric comparison so a nearby legal target
 * cannot steal a drop intended for a different unit. No ambiguous gap snap. */
export function nearestTouchTarget(x:number,y:number,boxes:readonly TargetHitBox[]):Target|undefined{
  if(!Number.isFinite(x)||!Number.isFinite(y))return undefined;
  const ranked=boxes.flatMap(box=>{
    if(![box.left,box.right,box.top,box.bottom].every(Number.isFinite)||box.left>=box.right||box.top>=box.bottom)return [];
    const dx=Math.max(box.left-x,0,x-box.right),dy=Math.max(box.top-y,0,y-box.bottom);
    return [{box,distance:Math.hypot(dx,dy)}];
  }).sort((a,b)=>a.distance-b.distance);
  const best=ranked[0];
  return best?.box.legal&&best.distance<=10&&(!ranked[1]||ranked[1].distance-best.distance>=4)?best.box.target:undefined;
}
/** Target first, then board fallback for untargeted cards. Never submit a
 * card play on the hand, another UI control, or the area outside the field. */
export function touchDropLocations(hit:TouchHit,seat:PlayerId,position:number,canDropOnField:boolean):DropLocation[]{
  if(hit.hand||hit.control)return [];
  const result:DropLocation[]=[];
  if(hit.minionId)result.push({kind:'target',target:{kind:'minion',instanceId:hit.minionId},position:hit.ownBoard?(hit.slot??position):position});
  else if(hit.hero)result.push({kind:'target',target:{kind:'hero',player:hit.hero==='self'?seat:seat===0?1:0},position});
  if(hit.ownBoard||hit.field&&canDropOnField)result.push({kind:'board',position:hit.slot??position});
  return result;
}
export type DropFeedback='action'|'target'|'choice'|'invalid'|'cancel';
/** One shared decision for mouse hover/drop and touch hover/drop. Invalid
 * controls or stale drags must never produce a game command. */
export function pointerDrop(view:PlayerView,seat:PlayerId,catalog:Catalog,drag:DragState|null,hit:TouchHit,position:number):{intent:Intent|null;feedback:DropFeedback}{
  if(!drag||drag.revision!==view.revision||hit.hand||hit.control||!hit.field&&!hit.ownBoard&&!hit.minionId&&!hit.hero)return {intent:null,feedback:'cancel'};
  const d=drag.intent,card=d.kind==='card'?catalog[view.self.hand.find(h=>h.instanceId===d.id)?.cardId??'']:undefined;
  if(card?.kind==='minion'&&hit.ownBoard&&hit.slot===undefined)return {intent:null,feedback:'invalid'};
  for(const location of touchDropLocations(hit,seat,position,!!card&&card.kind!=='minion')){
    const intent=resolveDrop(view,seat,catalog,drag,location);if(!intent)continue;
    return {intent,feedback:intent.action?'action':intent.selection?.kind==='cardChoice'?'choice':'target'};
  }
  return {intent:null,feedback:'invalid'};
}
export function dropFeedbackText(feedback:DropFeedback,slot?:number,targetLabel?:string):string{
  if(feedback==='action')return targetLabel?`놓기: ${targetLabel} 대상${slot===undefined?'':` · 배치 ${slot+1}번`}`:slot===undefined?'놓으면 실행됩니다.':`놓으면 ${slot+1}번 위치에 배치합니다.`;
  if(feedback==='target')return '놓은 뒤 효과 대상을 선택하세요.';
  if(feedback==='choice')return '놓은 뒤 카드 효과를 선택하세요.';
  if(feedback==='invalid')return '이 위치에는 놓을 수 없습니다.';
  return '전장 또는 유효한 대상으로 이동하세요.';
}
