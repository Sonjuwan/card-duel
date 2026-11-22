import type {DragIntent,DragState,DropLocation} from './battle-actions.ts';
import type {PlayerId} from '../../../packages/engine/src/index.ts';
export type TouchGesture={pointerId:number;originX:number;originY:number;drag:DragState;phase:'pending'|'dragging'|'scrolling'};
export function intentFromSource(source:string|undefined):DragIntent|null{
  if(source==='hero')return{kind:'heroAttack'};
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
  if(gesture.drag.intent.kind==='card'&&dx>dy*1.35)return{...gesture,phase:'scrolling'};
  return{...gesture,phase:'dragging'};
}
export type TouchHit={minionId?:string;hero?:'self'|'enemy';slot?:number;ownBoard?:boolean;field?:boolean;hand?:boolean};
/** Target first, then board fallback for untargeted cards. Never submit a
 * card play on the hand, another UI control, or the area outside the field. */
export function touchDropLocations(hit:TouchHit,seat:PlayerId,position:number,canDropOnField:boolean):DropLocation[]{
  if(hit.hand)return [];
  const result:DropLocation[]=[];
  if(hit.minionId)result.push({kind:'target',target:{kind:'minion',instanceId:hit.minionId},position});
  else if(hit.hero)result.push({kind:'target',target:{kind:'hero',player:hit.hero==='self'?seat:seat===0?1:0},position});
  if(hit.ownBoard||hit.field&&canDropOnField)result.push({kind:'board',position:hit.slot??position});
  return result;
}
