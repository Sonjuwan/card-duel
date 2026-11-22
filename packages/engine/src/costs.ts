import type { Card,Catalog,Minion,PlayerId,Weapon } from './types.ts';

/** Calculate the current price using only public board/weapon data. Used by both server and UI. */
export function currentCost(card:Card,catalog:Catalog,owner:PlayerId,boards:[Minion[],Minion[]],weapon:Weapon|null,discount=0,nextSecretFree=false,minionsPlayed=0,context:{handCount?:number;health?:number;maxHealth?:number;nextSpellDiscount?:number;freeSpellsThisTurn?:boolean}={}):number {
  if(nextSecretFree&&card.kind==='secret')return 0;
  let cost=card.cost;
  const kind=card.kind==='coin'||card.kind==='secret'?'spell':card.kind;
  if(kind==='spell'&&context.freeSpellsThisTurn)return 0;
  const modifiers:{amount:number;minimum?:number;order:number}[]=[];
  for(const side of [0,1] as const)for(const m of boards[side]){
    if(m.health<=0||m.silenced)continue;
    const source=catalog[m.cardId];if(source?.kind!=='minion')continue;
    for(const aura of source.costAuras??[]){
      if(aura.side==='friendly'&&side!==owner)continue;
      if(aura.kind!=='any'&&aura.kind!==kind)continue;
      if(aura.firstMinionOnly&&minionsPlayed>0)continue;
      if(aura.tribe&&(card.kind!=='minion'||card.tribe!==aura.tribe))continue;
      modifiers.push({amount:aura.amount,minimum:aura.minimum,order:m.enteredOrder??0});
    }
  }
  // Classic Summoning Portal applies before other cost modifiers, regardless of play order.
  // A minimum is a discount floor, never a cost increase for a card already below it.
  modifiers.sort((a,b)=>a.order-b.order);
  for(const a of modifiers)if(a.minimum!==undefined)cost=Math.max(Math.min(cost,a.minimum),cost+a.amount);
  cost-=discount;
  if(kind==='spell')cost-=context.nextSpellDiscount??0;
  if(card.kind==='minion'&&card.discountByWeaponAttack)cost-=weapon?.attack??0;
  if(card.kind==='minion'){
    if(card.discountBy==='boardCount')cost-=boards[0].length+boards[1].length;
    if(card.discountBy==='otherHandCards')cost-=Math.max(0,(context.handCount??1)-1);
    if(card.discountBy==='missingHeroHealth')cost-=Math.max(0,(context.maxHealth??30)-(context.health??30));
  }
  for(const a of modifiers)if(a.minimum===undefined)cost+=a.amount;
  return Math.max(0,cost);
}
