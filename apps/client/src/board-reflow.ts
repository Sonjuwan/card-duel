import {useLayoutEffect,useRef} from 'react';
import type {RefObject} from 'react';
import type {Minion} from '../../../packages/engine/src/index.ts';

type BoardPositions={arena:HTMLElement;width:number;height:number;units:Map<string,number>};

export function useBoardReflow(arenaRef:RefObject<HTMLDivElement|null>,enemy:readonly Minion[]|undefined,own:readonly Minion[]|undefined,enabled:boolean){
  const previous=useRef<BoardPositions|null>(null);
  const enemyOrder=enemy?.map(unit=>unit.instanceId).join(' ');
  const ownOrder=own?.map(unit=>unit.instanceId).join(' ');
  useLayoutEffect(()=>{
    const arena=arenaRef.current;
    if(!arena||!enabled||!matchMedia('(orientation: landscape)').matches){
      previous.current=null;return;
    }
    const {width,height}=arena.getBoundingClientRect();
    const elements=Array.from(arena.querySelectorAll<HTMLElement>('.arena-board [data-preview-minion]'));
    const units=new Map(elements.map(element=>{
      let left=0;
      for(let node:HTMLElement|null=element;node&&node!==arena;node=node.offsetParent as HTMLElement|null){
        left+=node.offsetLeft;
      }
      return [element.dataset.previewMinion!,left];
    }));
    const before=previous.current;
    previous.current={arena,width,height,units};
    if(!before||before.arena!==arena||before.width!==width||before.height!==height||document.hidden||
      matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const movements:Animation[]=[];
    for(const element of elements){
      const id=element.dataset.previewMinion!;
      const start=before.units.get(id);
      const end=units.get(id);
      if(start===undefined||end===undefined||Math.abs(start-end)<1||typeof element.animate!=='function')continue;
      // Use the individual translate property so the attack and damage
      // transforms still run independently on their existing elements.
      movements.push(element.animate([{translate:`${start-end}px 0`},{translate:'0 0'}],
        {duration:190,easing:'cubic-bezier(.22,.62,.36,1)'}));
    }
    return ()=>{for(const movement of movements)movement.cancel();};
  },[arenaRef,enemyOrder,ownOrder,enabled]);
}
