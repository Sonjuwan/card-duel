import { createContext, useContext, useEffect, useId, useRef } from 'react';
import type {PointerEvent} from 'react';
import {createTouchPreviewGuard,independentActivation} from './hover-timing.ts';
import type { Inspectable } from './battle-pieces.tsx';
export type CardPreview = {item:Inspectable;side:'left'|'right'};
export type HoverControls={start:(key:string,read:()=>CardPreview|null,delay?:number)=>void;clear:(key?:string)=>void};
export const HoverContext=createContext<HoverControls|null>(null);

export function useCardHover(item:Inspectable|null,holdDelay?:number){
  const context=useContext(HoverContext),key=useId(),latest=useRef(item);
  latest.current=item;
  // Leaving/unmounting a source never clears a different card's pending preview.
  useEffect(()=>()=>context?.clear(key),[context,key]);
  const start=(element:HTMLElement,delay?:number)=>context?.start(key,()=>{
    if(!element.isConnected||!latest.current)return null;
    const bounds=element.getBoundingClientRect();
    return{item:latest.current,side:bounds.left+bounds.width/2<window.innerWidth/2?'right':'left'};
  },delay);
  const guard=useRef<ReturnType<typeof createTouchPreviewGuard>|null>(null);if(!guard.current)guard.current=createTouchPreviewGuard(holdDelay);
  const clear=()=>context?.clear(key);
  const touchProps={
    onPointerDown:(e:PointerEvent<HTMLElement>)=>{if(!e.isPrimary)return;if(e.pointerType==='mouse'){guard.current!.reset();return;}guard.current!.begin(e.pointerId,e.clientX,e.clientY,Date.now());start(e.currentTarget,holdDelay);},
    onPointerMove:(e:PointerEvent<HTMLElement>)=>{if(guard.current!.move(e.pointerId,e.clientX,e.clientY))clear();},
    onPointerUp:(e:PointerEvent<HTMLElement>)=>{if(guard.current!.end(e.pointerId,e.clientX,e.clientY,Date.now()))clear();},
    onPointerCancel:(e:PointerEvent<HTMLElement>)=>{if(guard.current!.cancel(e.pointerId,Date.now()))clear();},
  };
  return{start,clear,touchProps,consumeTouchClick:(event:MouseEvent)=>guard.current!.suppress(Date.now())&&!independentActivation(event)};
}
