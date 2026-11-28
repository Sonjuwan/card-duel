import {useLayoutEffect,useRef} from 'react';
import type {RefObject} from 'react';
import type {Catalog,PlayerId} from '../../../packages/engine/src/index.ts';
import {BattleCard} from './battle-pieces.tsx';
import {discardRevealDuration} from './battle-playback.ts';
import type {PlaybackCue} from './battle-playback.ts';

export function DiscardReveal({cue,catalog,seat,arena}:{cue:PlaybackCue;catalog:Catalog;seat:PlayerId;arena:RefObject<HTMLDivElement|null>}){
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const measure=()=>{
      if(!root.current||!arena.current)return;
      const bounds=arena.current.getBoundingClientRect();
      for(const card of root.current.children){
        if(!(card instanceof HTMLElement))continue;
        const hand=arena.current.querySelector(card.dataset.discardSide==='own'?'.own-hand':'.hidden-hand');
        if(!hand)continue;
        const anchor=hand.getBoundingClientRect();
        card.style.setProperty('--discard-x',`${anchor.left+anchor.width/2-bounds.left-bounds.width/2}px`);
        card.style.setProperty('--discard-y',`${anchor.top+anchor.height/2-bounds.top-bounds.height/2}px`);
      }
    };
    measure();
    window.addEventListener('resize',measure);
    return()=>window.removeEventListener('resize',measure);
  },[cue,arena]);
  const beat=discardRevealDuration(cue.after.animationSpeed);
  return <div className="discard-reveals" ref={root} inert>
    {cue.animation.events?.filter(event=>event.kind==='discard').map((event,index)=>{
      const card=catalog[event.cardId];
      if(!card)return null;
      const own=event.side===seat;
      return <article key={index} className="discard-reveal" data-discard-side={own?'own':'opponent'}
        style={{animationDelay:`${cue.duration+index*beat}ms`,animationDuration:`${beat}ms`}}>
        <BattleCard card={card}/>
        <strong>{own?'내 카드 버림':'상대 카드 버림'}</strong>
      </article>;
    })}
  </div>;
}
