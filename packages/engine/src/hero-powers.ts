import type { Effect, HeroClass, MinionCard, TargetRule } from './types.ts';

function token(id: string, name: string, attack: number, health: number, extra: Partial<MinionCard> = {}): MinionCard {
  return { id,name,kind:'minion',cost:1,attack,health,rarity:'basic',class:'neutral',tribe:'none',description:'',collectible:false,...extra };
}
export const HERO_TOKENS: MinionCard[] = [
  token('__squire','은빛 보병',1,1),
  token('__stone_totem','바위 토템',0,2,{tribe:'totem',keywords:['taunt']}),
  token('__flame_totem','불꽃 토템',1,1,{tribe:'totem'}),
  token('__healing_totem','치유 토템',0,2,{tribe:'totem',endTurn:[{kind:'heal',target:'friendlyMinions',amount:1}]}),
  token('__magic_totem','마력 토템',0,2,{tribe:'totem',spellDamage:1})
];
export interface HeroPower { name: string; cost: number; targetRule?: TargetRule; effects: Effect[] }
export function getHeroPower(player:{heroClass:HeroClass;shadowformLevel?:1|2;heroForm?:'jaraxxus'}):HeroPower {
  if(player.heroForm==='jaraxxus')return {name:'지옥불 소환',cost:2,effects:[{kind:'summon',cardId:'jaraxxus_infernal',count:1}]};
  return player.shadowformLevel ? {name:player.shadowformLevel===1?'정신의 쐐기':'정신 분쇄',cost:2,targetRule:'anyCharacter',effects:[{kind:'damage',target:'chosen',amount:player.shadowformLevel+1}]} : HERO_POWERS[player.heroClass];
}
export const HERO_POWERS: Record<HeroClass, HeroPower> = {
  warrior:{name:'방어 태세',cost:2,effects:[{kind:'armor',amount:2}]},
  shaman:{name:'토템 소환',cost:2,effects:[{kind:'summonUniqueRandom',cardIds:HERO_TOKENS.slice(1).map(c=>c.id)}]},
  rogue:{name:'단검 장착',cost:2,effects:[{kind:'equip',attack:1,durability:2}]},
  paladin:{name:'지원군 소집',cost:2,effects:[{kind:'summon',cardId:'__squire',count:1}]},
  hunter:{name:'정조준',cost:2,effects:[{kind:'damage',target:'enemyHero',amount:2}]},
  druid:{name:'야성의 힘',cost:2,effects:[{kind:'heroAttack',amount:1},{kind:'armor',amount:1}]},
  warlock:{name:'생명 교환',cost:2,effects:[{kind:'draw',amount:1},{kind:'damage',target:'friendlyHero',amount:2}]},
  mage:{name:'불꽃 탄환',cost:2,targetRule:'anyCharacter',effects:[{kind:'damage',target:'chosen',amount:1}]},
  priest:{name:'빛의 회복',cost:2,targetRule:'anyCharacter',effects:[{kind:'heal',target:'chosen',amount:2}]}
};
