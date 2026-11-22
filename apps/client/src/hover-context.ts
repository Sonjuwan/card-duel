import { createContext, useContext, useEffect, useId, useRef } from 'react';
import type {PointerEvent} from 'react';
import {CARD_HOVER_DELAY} from './hover-timing.ts';
import type { Inspectable } from './battle-pieces.tsx';
export type CardPreview = {item:Inspectable;side:'left'|'right'};
export type HoverControls={start:(key:string,read:()=>CardPreview|null)=>void;clear:(key?:string)=>void};
export const HoverContext=createContext<HoverControls|null>(null);

export function useCardHover(item:Inspectable|null){
  const context=useContext(HoverContext),key=useId(),latest=useRef(item);
  latest.current=item;
  // Leaving/unmounting a source never clears a different card's pending preview.
  useEffect(()=>()=>context?.clear(key),[context,key]);
  const start=(element:HTMLElement)=>context?.start(key,()=>{
    if(!element.isConnected||!latest.current)return null;
    const bounds=element.getBoundingClientRect();
    return{item:latest.current,side:bounds.left+bounds.width/2<window.innerWidth/2?'right':'left'};
  });
  const press=useRef<{id:number;x:number;y:number;at:number}|null>(null),suppress=useRef(0);
  const clear=()=>context?.clear(key);
  const touchProps={
    onPointerDown:(e:PointerEvent<HTMLElement>)=>{if(e.pointerType==='mouse'||!e.isPrimary)return;press.current={id:e.pointerId,x:e.clientX,y:e.clientY,at:Date.now()};start(e.currentTarget);},
    onPointerMove:(e:PointerEvent<HTMLElement>)=>{const p=press.current;if(p?.id===e.pointerId&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>=8){press.current=null;clear();}},
    onPointerUp:(e:PointerEvent<HTMLElement>)=>{const p=press.current;if(p?.id!==e.pointerId)return;if(Date.now()-p.at>=CARD_HOVER_DELAY)suppress.current=Date.now()+300;press.current=null;clear();},
    onPointerCancel:()=>{press.current=null;clear();},
  };
  return{start,clear,touchProps,consumeTouchClick:()=>Date.now()<suppress.current};
}
