import type {CardBase,MinionCard,SpellCard,WeaponCard,SecretCard,Effect,EffectCondition} from './types.ts';
/** A single list of editable definition fields. Reject misspellings and
 * effect fields on the wrong type instead of silently ignoring a mechanic. */
const base=['id','name','cost','rarity','class','description','collectible','kind'] as const satisfies readonly (keyof CardBase|'kind')[];
export const CARD_KIND_MECHANICS={
  minion:['keywords','spellDamage','enrageAttack','enrageWindfury','enrageWeaponAttack','noAttack','chargeWithWeapon','untargetableBySpells','freezeOnCombatDamage','attackEqualsHealth','healingToDamage','spellAndPowerMultiplier','attackPerOtherTribe','turnTimeLimitSeconds','costAuras','discountByWeaponAttack','discountBy','targetRule','battlecry','deathrattle','startTurn','endTurn','endAnyTurn','auras','chargeAuraTribe','triggers','choices'],
  spell:['targetRule','effects','choices'],
  weapon:['targetRule','battlecry','beforeAttack','secretRevealed','secretRevealedSide','windfury','immuneWhileAttacking','attackLossVsMinion','friendlySummon'],
  secret:['trigger','effects','needsBoardSpace','needsMinionAttacker']
} as const satisfies {minion:readonly (keyof MinionCard)[];spell:readonly (keyof SpellCard)[];weapon:readonly (keyof WeaponCard)[];secret:readonly (keyof SecretCard)[]};
const fields={minion:[...base,'attack','health','tribe',...CARD_KIND_MECHANICS.minion],spell:[...base,...CARD_KIND_MECHANICS.spell],weapon:[...base,'attack','durability',...CARD_KIND_MECHANICS.weapon],secret:[...base,...CARD_KIND_MECHANICS.secret]};
export function unknownCardFields(card:Record<string,unknown>):string[]{
  if(typeof card.kind!=='string'||!Object.hasOwn(fields,card.kind))return[];
  const allowed:readonly string[]=fields[card.kind as keyof typeof fields];return Object.keys(card).filter(k=>!allowed.includes(k));
}
const targeted=['target','tribe'] as const;
const effectFields={
  damage:[...targeted,'amount','amountMax','excludeCardId','bonusIfTribe','bonusIfHeroHealthAtMost','bonusIfCombo'],heal:[...targeted,'amount'],healFull:targeted,deferredDestroy:[...targeted,'timing'],
  damageDistinct:['count','amount'],damageSplash:['target','amount','splash','scope'],multiplyHealth:[...targeted,'factor'],damageFromHeroAttack:targeted,damageFromArmor:targeted,immuneThisTurn:targeted,copyChosenMinion:targeted,
  brawl:[],consumeDivineShields:[],shadowform:[],discountNextSpell:['amount'],drawDiscounted:['amount'],summonEnemyDeckMinion:['fallbackCardId'],heroImmuneThisTurn:[],grantDeathrattleSummon:[...targeted,'cardId'],temporaryStealth:targeted,betrayal:targeted,weaponBurst:[],addCardNextTurn:['cardId'],drawTribe:['tribe','count','fallbackCardId'],loseCrystal:['amount'],consumeAdjacent:[],sacrificeBlast:targeted,
  attackToHealth:targeted,doubleAttack:targeted,drawOnAttack:targeted,removeStealth:targeted,drawCostDamage:targeted,swapStats:targeted,grantSpellDamage:[...targeted,'amount'],damageWeapon:['side','amount'],nextSecretFree:[],destroyEnemySecrets:[],swapHandMinion:[],redirectAttackRandom:[],copyEventMinion:[],reviveEventMinion:[],reflectDamage:[],redirectAttackSummon:['cardId'],missiles:['target','count','amount'],
  buff:[...targeted,'attack','health','per'],destroy:targeted,freeze:targeted,silence:targeted,bounce:[...targeted,'discount'],transform:[...targeted,'cardId'],randomTransform:[...targeted,'cardIds'],setHeroHealth:['target','amount'],replaceHero:['form','health','weaponCardId'],enemyFreeSpellsNextTurn:[],destroyEnemyWeaponDraw:[],copySpellToOther:[],giveKeyword:[...targeted,'keyword'],control:targeted,temporaryControl:targeted,setStats:[...targeted,'attack','health'],temporaryAttack:[...targeted,'amount'],
  destroyWeapon:['side'],buffWeapon:['attack','durability','equipIfMissing'],protectMinionsThisTurn:[],copyEnemyCard:['zone','count'],draw:['amount','side','per'],gainMana:['amount'],armor:['amount'],heroAttack:['amount'],overload:['amount'],discard:['amount'],gainCrystal:['amount','overflowCardId','filled','side'],chooseTopDeck:['count'],addCard:['cardId','count','side'],addRandomCard:['cardIds','count','side'],summon:['cardId','count','countMax','side','per'],summonUniqueRandom:['cardIds'],summonRandom:['cardIds'],equip:['attack','durability','cardId'],cancelEvent:[]
} as const satisfies Record<Effect['kind'],readonly string[]>;
const conditionFields={friendlyTribe:['tribe','minCount'],combo:[],chosenSurvived:[],chosenDied:[],chosenFriendlyTribe:['tribe','negate'],enemyMinionCount:['minCount'],eventTargetAttackAtMost:['amount'],chosenFrozen:['negate'],hasSecret:[],chance:['percent']} as const satisfies Record<EffectCondition['kind'],readonly string[]>;
export function unknownEffectFields(value:Record<string,unknown>):string[]{
  if(typeof value.kind!=='string'||!Object.hasOwn(effectFields,value.kind))return[];
  const allowed:readonly string[]=effectFields[value.kind as keyof typeof effectFields];return Object.keys(value).filter(k=>k!=='kind'&&k!=='condition'&&!allowed.includes(k));
}
export function unknownConditionFields(value:Record<string,unknown>):string[]{
  if(typeof value.kind!=='string'||!Object.hasOwn(conditionFields,value.kind))return[];
  const allowed:readonly string[]=conditionFields[value.kind as keyof typeof conditionFields];return Object.keys(value).filter(k=>k!=='kind'&&!allowed.includes(k));
}
