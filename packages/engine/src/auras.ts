import type { GameState,Minion,PlayerId } from './types.ts';
/** Recompute continuous modifiers from living sources. Store deltas separately from permanent buffs. */
export function refreshAuras(s:GameState):void{
  type Positioned={owner:PlayerId;index:number;minion:Minion};
  const board:Positioned[]=[];
  for(const owner of [0,1] as const)s.players[owner].board.forEach((minion,index)=>{if(minion.health>0)board.push({owner,index,minion});});
  const totals=new Map<Minion,{attack:number;health:number}>(board.map(({minion})=>[minion,{attack:0,health:0}]));
  const charge=new Set<Minion>();const windfury=new Set<Minion>();const weaponBonus=[0,0];
  for(const source of board){
    const card=s.catalog[source.minion.cardId];if(source.minion.silenced||card?.kind!=='minion')continue;
    if(card.chargeWithWeapon&&s.players[source.owner].weapon)charge.add(source.minion);
    if(source.minion.health<source.minion.maxHealth){if(card.enrageWindfury)windfury.add(source.minion);weaponBonus[source.owner]+=card.enrageWeaponAttack??0;}
    if(card.chargeAuraTribe)for(const t of board){
      const def=s.catalog[t.minion.cardId];if(t.owner===source.owner&&def.kind==='minion'&&def.tribe===card.chargeAuraTribe)charge.add(t.minion);
    }
    if(card.enrageAttack&&source.minion.health<source.minion.maxHealth)totals.get(source.minion)!.attack+=card.enrageAttack;
    if(card.attackPerOtherTribe){const {tribe,amount}=card.attackPerOtherTribe;totals.get(source.minion)!.attack+=amount*board.filter(t=>{const d=s.catalog[t.minion.cardId];return t.minion!==source.minion&&d.kind==='minion'&&d.tribe===tribe;}).length;}
    for(const aura of card.auras??[])for(const target of board){
      if(target.minion===source.minion)continue;
      if(aura.target!=='allOtherMinions'&&source.owner!==target.owner)continue;
      if(aura.target==='adjacentFriendlyMinions'&&Math.abs(source.index-target.index)!==1)continue;
      const def=s.catalog[target.minion.cardId];if(aura.tribe&&(def?.kind!=='minion'||def.tribe!==aura.tribe))continue;
      const sum=totals.get(target.minion)!;sum.attack+=aura.attack;sum.health+=aura.health;
    }
  }
  for(const id of [0,1] as const){const p=s.players[id],w=p.weapon;if(w){w.attack+=weaponBonus[id]-(w.auraAttack??0);if(weaponBonus[id])w.auraAttack=weaponBonus[id];else delete w.auraAttack;}if(id===s.activePlayer&&p.heroAttacksMadeThisTurn!==undefined){const def=w?.cardId?s.catalog[w.cardId]:undefined;p.heroAttacksRemaining=Math.max(0,(def?.kind==='weapon'&&def.windfury?2:1)-p.heroAttacksMadeThisTurn);}}
  for(const {owner,minion:m} of board){
    const next=totals.get(m)!,da=next.attack-(m.auraAttack??0),dh=next.health-(m.auraHealth??0);
    m.attack+=da;m.maxHealth+=dh;m.health=Math.min(m.maxHealth,m.health+dh);m.auraAttack=next.attack;m.auraHealth=next.health;
    const def=s.catalog[m.cardId];if(!m.silenced&&def.kind==='minion'&&def.attackEqualsHealth)m.attack=Math.max(0,m.health);
    const wasWind=m.auraWindfury===true,nowWind=windfury.has(m);if(nowWind)m.auraWindfury=true;else delete m.auraWindfury;
    if(owner===s.activePlayer&&wasWind!==nowWind&&(m.summonedTurn!==s.turn||m.keywords?.includes('charge')||charge.has(m))){const limit=(nowWind||m.keywords?.includes('windfury')?2:1)-(m.attacksMadeThisTurn??0);m.attacksRemaining=Math.max(0,limit);}
    const was=m.auraCharge===true,now=charge.has(m);if(now)m.auraCharge=true;else delete m.auraCharge;
    if(owner===s.activePlayer&&m.summonedTurn===s.turn){
      if(now)m.attacksRemaining=Math.max(m.attacksRemaining,(nowWind||m.keywords?.includes('windfury')?2:1)-(m.attacksMadeThisTurn??0));
      else if(was&&!m.keywords?.includes('charge')&&m.returnController===undefined)m.attacksRemaining=0;
    }
  }
}
