import type {Card,Minion} from '../../../packages/engine/src/index.ts';

export function minionVisualState(card:Card,minion:Minion){
  const printed=card.kind==='minion'&&!minion.silenced?card:undefined;
  const keys=minion.keywords;
  return {
    taunt:keys?.includes('taunt'),
    shield:keys?.includes('divineShield'),
    stealth:keys?.includes('stealth')||minion.stealthUntilStartOf!==undefined,
    wind:keys?.includes('windfury')||minion.auraWindfury,
    charge:keys?.includes('charge')||minion.auraCharge,
    frozen:minion.frozenThroughTurn!==undefined,
    poison:keys?.includes('poisonous'),
    death:(printed?.deathrattle?.length??0)>0||(minion.deathrattleSummons?.length??0)>0,
    enrage:minion.health<minion.maxHealth&&Boolean(printed?.enrageAttack||printed?.enrageWindfury||printed?.enrageWeaponAttack),
    magic:(printed?.spellDamage??0)+(minion.bonusSpellDamage??0)>0,
    persistent:Boolean(printed?.auras?.length||printed?.costAuras?.length||printed?.startTurn?.length||printed?.endTurn?.length||printed?.endAnyTurn?.length),
  };
}
