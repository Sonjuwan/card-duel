import {useLayoutEffect} from 'react';
import type {RefObject} from 'react';

const largeBook='(orientation:landscape) and (min-height:541px)';

function fitBookText(book:HTMLElement){
  const nodes=[...book.querySelectorAll<HTMLElement>('.battle-card :is(.card-name,.card-copy)')];
  for(const node of nodes)node.style.removeProperty('--rh-readable-size');
  const overflows=(node:HTMLElement)=>node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1;
  const fitting=nodes.filter(overflows).map(node=>({
    node,low:node.classList.contains('card-name')?10:8,high:parseFloat(getComputedStyle(node).fontSize),
  }));
  // Write a round together before measuring to avoid a layout flush per card.
  for(let round=0;round<6&&fitting.length;round++){
    for(const item of fitting){
      item.node.style.setProperty('--rh-readable-size',`${(item.low+item.high)/2}px`);
    }
    for(const item of fitting){
      const trial=(item.low+item.high)/2;
      if(overflows(item.node))item.high=trial;
      else item.low=trial;
    }
  }
  for(const {node,low} of fitting)node.style.setProperty('--rh-readable-size',`${low}px`);
}

export function useReadableBook(ref:RefObject<HTMLDivElement|null>){
  useLayoutEffect(()=>{
    const book=ref.current;
    if(!book||!book.closest('.collection-workspace'))return;
    const media=window.matchMedia(largeBook);
    let frame=0;
    const fit=()=>{if(media.matches)fitBookText(book);};
    const schedule=()=>{
      cancelAnimationFrame(frame);
      if(media.matches)frame=requestAnimationFrame(fit);
    };
    const resize=typeof ResizeObserver==="function"?new ResizeObserver(schedule):undefined;
    const changes=new MutationObserver(schedule);
    resize?.observe(book);
    changes.observe(book,{childList:true,subtree:true,characterData:true});
    media.addEventListener('change',schedule);
    fit();
    return()=>{resize?.disconnect();changes.disconnect();media.removeEventListener('change',schedule);cancelAnimationFrame(frame);};
  },[ref]);
}
