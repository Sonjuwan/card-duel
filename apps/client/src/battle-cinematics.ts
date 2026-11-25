import type {PlayerView} from '../../../packages/engine/src/index.ts';

export const heroShatterMs=3440;
export function lethalPortraits(before:PlayerView|undefined,after:PlayerView|undefined){
  if(before?.phase!=='playing'||after?.phase!=='finished')return {own:false,enemy:false};
  return {own:before.self.health>0&&after.self.health<=0,enemy:before.opponent.health>0&&after.opponent.health<=0};
}

type HandCard=PlayerView['self']['hand'][number];
export function mulliganSlots(before:readonly HandCard[],after:readonly HandCard[],marked:readonly string[]){
  const existing=new Set(before.map(card=>card.instanceId));
  const incoming=after.filter(card=>!existing.has(card.instanceId)&&card.cardId!=='__coin');
  return before.map(card=>{
    const swapping=marked.includes(card.instanceId);
    return {key:card.instanceId,card:swapping?incoming.shift()??card:card,swapping};
  });
}
