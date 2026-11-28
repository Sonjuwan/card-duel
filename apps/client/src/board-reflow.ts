import {useLayoutEffect,useRef} from 'react';
import type {RefObject} from 'react';
import type {Minion} from '../../../packages/engine/src/index.ts';

type Positions={container:HTMLElement;width:number;height:number;left:Map<string,number>};

function useHorizontalReflow(ref:RefObject<HTMLDivElement|null>,selector:string,key:'previewMinion'|'handReflowId',order:string,enabled:boolean,duration:number){
  const previous=useRef<Positions|null>(null);
  useLayoutEffect(()=>{
    const container=ref.current;
    if(!container||!enabled||!matchMedia('(orientation: landscape)').matches||
      matchMedia('(prefers-reduced-motion: reduce)').matches){
      previous.current=null;return;
    }
    const {width,height}=container.getBoundingClientRect();
    const elements=Array.from(container.querySelectorAll<HTMLElement>(selector));
    const left=new Map(elements.map(element=>{
      let x=0;
      for(let node:HTMLElement|null=element;node&&node!==container;node=node.offsetParent as HTMLElement|null)x+=node.offsetLeft;
      return [element.dataset[key]!,x];
    }));
    const before=previous.current;
    previous.current={container,width,height,left};
    if(!before||before.container!==container||before.width!==width||before.height!==height||document.hidden)return;
    const movements:Animation[]=[];
    for(const element of elements){
      const id=element.dataset[key]!;
      const start=before.left.get(id),end=left.get(id);
      if(start===undefined||end===undefined||Math.abs(start-end)<1||typeof element.animate!=='function')continue;
      // Translate only the layout element, independently of the art and hit effects.
      movements.push(element.animate([{translate:`${start-end}px 0`},{translate:'0 0'}],
        {duration,easing:'cubic-bezier(.22,.62,.36,1)'}));
    }
    return ()=>{for(const movement of movements)movement.cancel();};
  },[ref,selector,key,order,enabled,duration]);
}

export function useBoardReflow(arenaRef:RefObject<HTMLDivElement|null>,enemy:readonly Minion[]|undefined,own:readonly Minion[]|undefined,enabled:boolean){
  const enemyOrder=enemy?.map(unit=>unit.instanceId).join(' ')??'';
  const ownOrder=own?.map(unit=>unit.instanceId).join(' ')??'';
  useHorizontalReflow(arenaRef,'.arena-board [data-preview-minion]','previewMinion',enemyOrder+'|'+ownOrder,enabled,190);
}

export function useHandReflow(handRef:RefObject<HTMLDivElement|null>,order:string,enabled:boolean){
  useHorizontalReflow(handRef,'[data-hand-reflow-id]','handReflowId',order,enabled,120);
}
