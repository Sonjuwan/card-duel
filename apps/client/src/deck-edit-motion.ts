import {useLayoutEffect,useRef} from 'react';

export function useDeckEditMotion(cards:readonly string[]){
  const list=useRef<HTMLDivElement>(null);
  const pending=useRef<{id:string;from:DOMRect;ghost:HTMLElement;removing:boolean;rows:Map<string,DOMRect>}|undefined>(undefined);
  const animations=useRef(new Set<Animation>());
  const rowMap=()=>new Map(Array.from(list.current?.querySelectorAll<HTMLElement>('[data-deck-card]')??[],
    row=>[row.dataset.deckCard!,row]));
  const animate=(node:HTMLElement,frames:Keyframe[],duration:number,cleanup?:()=>void)=>{
    const animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.3,1)'});
    animations.current.add(animation);
    animation.onfinish=animation.oncancel=()=>{animations.current.delete(animation);cleanup?.();};
  };
  const prepare=(id:string,source:HTMLElement,removing=false)=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||typeof source.animate!=='function')return;
    const from=source.getBoundingClientRect();
    if(!from.width||!from.height)return;
    const ghost=source.cloneNode(true) as HTMLElement;
    pending.current={id,from,ghost,removing,rows:new Map(Array.from(rowMap(),([key,row])=>[key,row.getBoundingClientRect()]))};
  };
  useLayoutEffect(()=>{
    const move=pending.current;
    pending.current=undefined;
    if(!move)return;
    const rows=rowMap();
    const destination=rows.get(move.id);
    if(destination&&!move.removing)destination.scrollIntoView({block:'nearest',inline:'nearest'});
    for(const [id,row] of rows){
      const before=move.rows.get(id);
      if(!before)continue;
      const dy=before.top-row.getBoundingClientRect().top;
      if(Math.abs(dy)>1)animate(row,[{transform:`translateY(${dy}px)`},{transform:'none'}],220);
    }
    const {from,ghost,removing}=move;
    const to=(destination??list.current)?.getBoundingClientRect()??from;
    ghost.inert=true;
    ghost.setAttribute('aria-hidden','true');
    ghost.classList.add('deck-motion-ghost');
    Object.assign(ghost.style,{left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`});
    document.body.append(ghost);
    const x=to.left+to.width/2-from.left-from.width/2;
    const y=to.top+to.height/2-from.top-from.height/2;
    animate(ghost,removing?[{opacity:1},{opacity:0,transform:'translateX(24px) scale(.65)'}]:
      [{opacity:.9},{opacity:0,transform:`translate(${x}px,${y}px) scale(.25)`}],340,()=>ghost.remove());
  },[cards]);
  useLayoutEffect(()=>()=>{for(const animation of animations.current)animation.cancel();},[]);
  return {list,prepare};
}
