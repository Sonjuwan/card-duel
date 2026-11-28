import {clearMortal,emitCombat,markMortal,observedSummon,observingCombat} from './combat-observation.ts';
import type {CombatCause,CombatSource} from './combat-observation.ts';
import type { Card, Catalog, Effect, GameState, Minion, PlayerId, Selector, TargetRule, Tribe } from './types.ts';
import { emitVisual, log, RULES, TRIBES, integer, other, random, record, requireRule, validPlayer } from './rules.ts';
import {unknownEffectFields,unknownConditionFields} from './card-schema.ts';

export const TARGET_RULES = ['anyCharacter','enemyCharacter','friendlyCharacter','anyHero','anyMinion','enemyMinion','friendlyMinion','damagedMinion','enemyDamagedMinion','undamagedMinion','lowAttackEnemyMinion','highAttackEnemyMinion','lowAttackMinion','highAttackMinion','friendlyBeastMinion','demonMinion','attackAtLeast7Minion','enemyAttackAtMost2Minion','murlocMinion','tauntMinion','enemyTauntMinion'] as const;
export const KEYWORDS = ['taunt','charge','divineShield','windfury','stealth','poisonous'] as const;
const SELECTORS: readonly Selector[] = ['chosen','self','friendlyHero','enemyHero','friendlyMinions','enemyMinions','allMinions','otherMinions','allCharacters','friendlyCharacters','enemyCharacters','otherCharacters','randomEnemy','randomFriendlyMinion','randomOtherFriendlyMinion','randomDamagedFriendlyCharacter','randomEnemyMinion','eventTarget','eventAttacker','adjacent','chosenAndAdjacent','randomLowAttackEnemyMinion','otherFriendlyMinions','randomMinion','randomOtherMinion','randomDamagedCharacter'];
/** A transient death-wave snapshot: each original board slot remembers its replacements. */
export interface DeathSlot { minion:Minion; replacements:Minion[] }
export interface DeathPlacement { slots:DeathSlot[]; index:number }
export type Character = { kind:'hero'; player:PlayerId } | { kind:'minion'; player:PlayerId; minion:Minion; deathPlacement?:DeathPlacement };
export interface EffectContext { owner: PlayerId; combatSource?:CombatSource; chosen?: Character; source?: Character; eventTarget?: Character; eventAttacker?: Character; spellDamage?: number; spellPowerMultiplier?:number; eventCardId?:string; eventOwner?:PlayerId; canceled?: boolean; comboActive?:boolean; redirected?:Character; eventDamage?:number }
export interface EffectOps {
  /** True only if Health or Armor actually decreased. Shield/protection may absorb all damage. */
  damage(target:Character, amount:number,cause?:CombatCause):boolean;
  heal(target:Character,amount:number,source?:PlayerId):void;
  draw(owner:PlayerId,source?:PlayerId):void;
  drawCard(owner:PlayerId):string|undefined;
  summon(owner:PlayerId, cardId:string,card?:import('./types.ts').CardInstance,position?:number,source?:PlayerId,observe?:boolean):Minion|undefined;
  deathPlacement(minion:Minion):DeathPlacement|undefined;
  addCard(owner:PlayerId,cardId:string):void;
  overload(owner:PlayerId):void;
  settle():void;
}
export function hasKeyword(m:Minion, keyword:string):boolean { return (keyword==='windfury'&&m.auraWindfury===true)||(keyword==='charge'&&m.auraCharge===true)||(keyword==='stealth'&&m.stealthUntilStartOf!==undefined)||(m.keywords?.some(k=>k===keyword) ?? false); }
export function minions(s:GameState, player:PlayerId):Character[] {
  return s.players[player].board.filter(m=>m.health>0).map(minion=>({kind:'minion',player,minion}));
}
export function hero(player:PlayerId):Character { return {kind:'hero',player}; }
export function lookupTarget(s:GameState, owner:PlayerId, target:unknown):Character {
  requireRule(record(target),'잘못된 대상');
  if(target.kind==='hero') { requireRule(target.player===undefined || validPlayer(target.player),'잘못된 영웅 대상'); return hero(target.player ?? other(owner)); }
  requireRule(target.kind==='minion','잘못된 대상');
  const found=[...minions(s,0),...minions(s,1)].find(c=>c.kind==='minion' && c.minion.instanceId===target.instanceId);
  requireRule(found,'존재하지 않는 하수인 대상'); return found;
}
export function targetMatchesRule(rule:TargetRule,owner:PlayerId,targetOwner:PlayerId,m?:Minion,catalog?:Catalog,spellOrPower=false,heroForm?:'jaraxxus'):boolean {
  if(m&&spellOrPower&&!m.silenced){const d=catalog?.[m.cardId];if(d?.kind==='minion'&&d.untargetableBySpells)return false;}
  if(m && targetOwner!==owner && (hasKeyword(m,'stealth')||m.immuneThisTurn)) return false;
  if(rule.endsWith('Minion') && !m) return rule==='demonMinion'&&heroForm==='jaraxxus';
  if(rule==='anyHero'&&m)return false;
  if((rule.startsWith('enemy')||rule==='lowAttackEnemyMinion'||rule==='highAttackEnemyMinion') && targetOwner===owner) return false;
  if(rule.startsWith('friendly') && targetOwner!==owner) return false;
  if(m){
    if((rule==='tauntMinion'||rule==='enemyTauntMinion')&&!hasKeyword(m,'taunt'))return false;
    if(rule==='friendlyBeastMinion'||rule==='demonMinion'){
      const c=catalog?.[m.cardId];if(c?.kind!=='minion'||c.tribe!==(rule==='friendlyBeastMinion'?'beast':'demon'))return false;
    }
    if((rule==='damagedMinion'||rule==='enemyDamagedMinion')&&m.health>=m.maxHealth)return false;
    if(rule==='undamagedMinion'&&m.health<m.maxHealth)return false;
    if((rule==='lowAttackEnemyMinion'||rule==='lowAttackMinion')&&m.attack>3)return false;
    if((rule==='highAttackEnemyMinion'||rule==='highAttackMinion')&&m.attack<5)return false;
    if(rule==='attackAtLeast7Minion'&&m.attack<7)return false;
    if(rule==='enemyAttackAtMost2Minion'&&m.attack>2)return false;
    if(rule==='murlocMinion'){const d=catalog?.[m.cardId];if(d?.kind!=='minion'||d.tribe!=='murloc')return false;}
  }
  return true;
}
export function effectiveTargetRule(card:Card,comboActive:boolean,choiceIndex?:number):TargetRule|undefined{
  if(card.kind!=='spell'&&card.kind!=='minion'&&card.kind!=='weapon')return;
  const choice=card.kind==='weapon'||choiceIndex===undefined?undefined:card.choices?.[choiceIndex];
  const effects=choice?.effects??(card.kind==='spell'?card.effects:card.battlecry)??[];
  const targeted=effects.filter(e=>'target' in e&&e.target==='chosen');
  if(!comboActive&&targeted.length>0&&targeted.every(e=>e.condition?.kind==='combo'))return;
  return choice?.targetRule??card.targetRule;
}
function legalTarget(s:GameState,c:Character, owner:PlayerId, rule:TargetRule,spellOrPower=false):boolean{return !(c.kind==='hero'&&c.player!==owner&&s.players[c.player].heroImmuneThisTurn)&&targetMatchesRule(rule,owner,c.player,c.kind==='minion'?c.minion:undefined,s.catalog,spellOrPower,c.kind==='hero'?s.players[c.player].heroForm:undefined);}
export function availableTargets(s:GameState, owner:PlayerId, rule:TargetRule,spellOrPower=false):Character[] {
  return [hero(0),hero(1),...minions(s,0),...minions(s,1)].filter(c=>legalTarget(s,c,owner,rule,spellOrPower));
}
export function chooseTarget(s:GameState, owner:PlayerId, rule:TargetRule|undefined, target:unknown, optionalIfEmpty=false,spellOrPower=false):Character|undefined {
  if(!rule) { requireRule(target===undefined,'대상 선택이 필요 없는 카드입니다.'); return; }
  if(target===undefined && optionalIfEmpty && availableTargets(s,owner,rule,spellOrPower).length===0) return;
  requireRule(target!==undefined,'효과 대상을 선택해야 합니다.');
  const c=lookupTarget(s,owner,target);
  requireRule(legalTarget(s,c,owner,rule,spellOrPower),'선택할 수 없는 효과 대상'); return c;
}
export function validateEffects(raw:unknown, catalog:Catalog, context:'spell'|'battlecry'|'trigger'|'secret'|'event'|'weaponBattlecry'|'weapon', rule?:TargetRule):void {
  requireRule(Array.isArray(raw) && raw.length>0 && raw.length<=16,'효과 목록은 1~16개여야 합니다.');
  for(const e of raw){
    requireRule(record(e),'잘못된 효과 데이터');
    const unknown=unknownEffectFields(e);requireRule(!unknown.length,'지원하지 않는 효과 필드: '+unknown.join(', '));
    if(e.condition!==undefined) {
      const condition=e.condition;
      if(record(condition)){const fields=unknownConditionFields(condition);requireRule(!fields.length,'지원하지 않는 효과 조건 필드: '+fields.join(', '));}
      requireRule(record(condition)&&((condition.kind==='friendlyTribe'&&TRIBES.some(t=>t===condition.tribe)&&(condition.minCount===undefined||integer(condition.minCount,1,7)))||(condition.kind==='combo'&&(context==='spell'||context==='battlecry'||context==='weaponBattlecry'))||((condition.kind==='chosenSurvived'&&rule?.endsWith('Minion'))||(condition.kind==='chosenDied'&&!!rule))||(condition.kind==='chosenFriendlyTribe'&&rule?.endsWith('Minion')&&TRIBES.some(t=>t===condition.tribe)&&(condition.negate===undefined||typeof condition.negate==='boolean'))||(condition.kind==='enemyMinionCount'&&integer(condition.minCount,1,7))||(condition.kind==='chosenFrozen'&&!!rule&&(condition.negate===undefined||typeof condition.negate==='boolean'))||(condition.kind==='hasSecret')||(condition.kind==='eventTargetAttackAtMost'&&context==='event'&&integer(condition.amount,0,100))||(condition.kind==='chance'&&integer(condition.percent,0,100))),'잘못된 효과 조건');
    }
    if(['damage','heal','healFull','deferredDestroy','buff','destroy','freeze','silence','bounce','transform','giveKeyword','control','temporaryControl','setStats','temporaryAttack','multiplyHealth','damageFromHeroAttack','grantDeathrattleSummon','temporaryStealth','betrayal','sacrificeBlast','attackToHealth','doubleAttack','drawOnAttack','removeStealth','drawCostDamage','swapStats','grantSpellDamage','damageFromArmor','immuneThisTurn','copyChosenMinion'].some(k=>k===e.kind)) {
      requireRule(SELECTORS.some(t=>t===e.target),'지원하지 않는 대상 선택자');
      requireRule(!['chosen','chosenAndAdjacent'].some(t=>t===e.target)||!!rule,'chosen 효과에는 targetRule이 필요합니다.');
      requireRule(!['eventTarget','eventAttacker'].some(t=>t===e.target)||context==='secret'||context==='event','이벤트 대상은 비밀/이벤트 효과에만 사용 가능합니다.');
      requireRule(!['self','adjacent'].some(t=>t===e.target)||context==='battlecry'||context==='trigger'||context==='event','self/adjacent는 하수인 효과에만 사용 가능합니다.');
      requireRule(e.tribe===undefined||TRIBES.some(t=>t===e.tribe),'잘못된 종족 필터');
      if(e.kind==='grantSpellDamage')requireRule(integer(e.amount,1,10),'잘못된 부여 주문 공격력');
      if(e.kind==='damage'||e.kind==='heal') requireRule(integer(e.amount,1,100),'피해/치유 수치가 잘못됐습니다.');
      if(e.kind==='damage'&&e.amountMax!==undefined)requireRule(integer(e.amountMax,e.amount as number,100),'무작위 피해 범위가 잘못됐습니다.');
      if(e.kind==='damage'&&e.bonusIfTribe!==undefined){const bonus=e.bonusIfTribe;requireRule(record(bonus)&&TRIBES.some(t=>t===bonus.tribe)&&integer(bonus.amount,1,100),'잘못된 종족 추가 피해');}
      if(e.kind==='damage'&&e.bonusIfHeroHealthAtMost!==undefined){const bonus=e.bonusIfHeroHealthAtMost;requireRule(record(bonus)&&integer(bonus.health,1,30)&&integer(bonus.amount,1,100),'잘못된 생명력 조건 추가 피해');}
      if(e.kind==='damage'&&e.bonusIfCombo!==undefined)requireRule((context==='spell'||context==='battlecry'||context==='weaponBattlecry')&&integer(e.bonusIfCombo,1,100),'잘못된 연계 추가 피해');
      if(e.kind==='damage'&&e.excludeCardId!==undefined)requireRule(typeof e.excludeCardId==='string'&&catalog[e.excludeCardId]?.kind==='minion','제외 하수인 ID가 잘못됐습니다.');
      if(e.kind==='buff') requireRule(integer(e.attack,0,100)&&integer(e.health,0,100)&&e.attack+e.health>0&&(e.per===undefined||['otherFriendlyMinions','hand','enemyHand','friendlyWeaponAttack','previousCards'].some(x=>x===e.per)),'강화 수치 또는 배율이 잘못됐습니다.');
      if(['buff','destroy','silence','bounce','transform','giveKeyword','control','temporaryControl','setStats','multiplyHealth','deferredDestroy','grantDeathrattleSummon','temporaryStealth','betrayal','sacrificeBlast','attackToHealth','doubleAttack','drawOnAttack','removeStealth','swapStats','grantSpellDamage'].some(k=>k===e.kind)) requireRule(!['friendlyHero','enemyHero','allCharacters','friendlyCharacters','enemyCharacters','otherCharacters','randomEnemy','randomDamagedFriendlyCharacter'].some(t=>t===e.target) && (e.target!=='chosen'||rule?.endsWith('Minion')),'이 효과는 하수인만 대상으로 합니다.');
      if(e.kind==='grantDeathrattleSummon')requireRule(e.cardId===undefined||(typeof e.cardId==='string'&&Object.hasOwn(catalog,e.cardId)&&catalog[e.cardId].kind==='minion'),'잘못된 죽음의 메아리 소환 카드');
      if(e.kind==='deferredDestroy')requireRule(e.timing===undefined||e.timing==='startTurn'||e.timing==='endTurn','잘못된 파멸 시점');
      if(e.kind==='sacrificeBlast')requireRule(e.target==='chosen'&&rule==='friendlyMinion','아군 하수인 하나를 선택해야 합니다.');
      if(e.kind==='bounce')requireRule(e.discount===undefined||integer(e.discount,-10,10),'잘못된 반환 카드 할인');
      if(e.kind==='betrayal')requireRule(e.target==='chosen'&&rule==='enemyMinion','배반은 적 하수인 하나를 선택해야 합니다.');
      if(e.kind==='transform')requireRule(typeof e.cardId==='string'&&Object.hasOwn(catalog,e.cardId)&&catalog[e.cardId].kind==='minion','잘못된 변신 카드');
      if(e.kind==='giveKeyword')requireRule(KEYWORDS.some(k=>k===e.keyword),'잘못된 키워드');
      if(e.kind==='setStats')requireRule((e.attack!==undefined||e.health!==undefined)&&(e.attack===undefined||integer(e.attack,0,100))&&(e.health===undefined||integer(e.health,1,100)),'잘못된 설정 능력치');
      if(e.kind==='temporaryAttack')requireRule(integer(e.amount,1,100),'잘못된 임시 공격력');
      if(e.kind==='multiplyHealth')requireRule(integer(e.factor,2,5),'잘못된 생명력 배수');
      if(e.kind==='control'||e.kind==='temporaryControl')requireRule(e.target==='randomEnemyMinion'||(e.target==='chosen'&&['enemyMinion','enemyDamagedMinion','lowAttackEnemyMinion','highAttackEnemyMinion','enemyAttackAtMost2Minion'].some(r=>r===rule)),'정신 지배는 적 하수인을 선택해야 합니다.');
      if(e.kind==='copyChosenMinion')requireRule(context==='battlecry'&&e.target==='chosen'&&rule==='anyMinion','복사 대상은 하수인이어야 합니다.');
      if(e.kind==='immuneThisTurn')requireRule(rule?.endsWith('Minion')&&e.target==='chosen','면역 대상은 하수인이어야 합니다.');
    } else if(e.kind==='randomTransform')requireRule(['randomMinion','randomOtherMinion'].some(t=>t===e.target)&&Array.isArray(e.cardIds)&&e.cardIds.length>0&&e.cardIds.length<=20&&e.cardIds.every(id=>typeof id==='string'&&catalog[id]?.kind==='minion'),'잘못된 무작위 변신');
    else if(e.kind==='setHeroHealth')requireRule(context==='battlecry'&&rule==='anyHero'&&e.target==='chosen'&&integer(e.amount,1,30),'잘못된 영웅 체력 설정');
    else if(e.kind==='replaceHero')requireRule(context==='battlecry'&&e.form==='jaraxxus'&&integer(e.health,1,30)&&typeof e.weaponCardId==='string'&&catalog[e.weaponCardId]?.kind==='weapon','잘못된 영웅 교체');
    else if(e.kind==='enemyFreeSpellsNextTurn'||e.kind==='destroyEnemyWeaponDraw')requireRule(context==='battlecry','하수인 전투의 함성 전용 효과');
    else if(e.kind==='copySpellToOther')requireRule(context==='event','주문 복사는 이벤트 전용');
    else if(e.kind==='missiles')requireRule(['randomEnemy','randomEnemyMinion','randomOtherCharacter'].some(t=>t===e.target)&&integer(e.count,1,20)&&integer(e.amount,1,20),'잘못된 연속 무작위 피해');
    else if(e.kind==='damageDistinct')requireRule(integer(e.count,1,7)&&integer(e.amount,1,100),'잘못된 다중 무작위 피해');
    else if(e.kind==='damageSplash')requireRule(e.target==='chosen'&&((rule==='enemyCharacter'&&e.scope==='enemyCharacters')||(rule?.endsWith('Minion')&&e.scope==='chosenAndAdjacent'))&&integer(e.amount,1,100)&&integer(e.splash,1,100),'잘못된 범위 피해');
    else if(e.kind==='gainCrystal')requireRule(integer(e.amount,1,100)&&(e.overflowCardId===undefined||typeof e.overflowCardId==='string'&&Object.hasOwn(catalog,e.overflowCardId))&&(e.filled===undefined||typeof e.filled==='boolean')&&(e.side===undefined||e.side==='friendly'||e.side==='enemy'),'잘못된 마나 수정 또는 초과 카드');
    else if(e.kind==='chooseTopDeck')requireRule(context==='spell'&&!rule&&raw.length===1&&e.condition===undefined&&integer(e.count,1,10),'덱 선택은 대상 없는 단일 주문 효과여야 합니다.');
    else if(e.kind==='draw')requireRule(integer(e.amount,1,100)&&(e.side===undefined||['friendly','enemy','both'].some(x=>x===e.side))&&(e.per===undefined||['damagedFriendlyCharacters','enemyHandDifference'].some(x=>x===e.per)),'잘못된 드로우 조건');
    else if(['gainMana','armor','heroAttack','overload','discard'].some(k=>k===e.kind)) requireRule(integer(e.amount,1,100),'잘못된 효과 수치');
    else if(e.kind==='addCard')requireRule(typeof e.cardId==='string'&&Object.hasOwn(catalog,e.cardId)&&integer(e.count,1,10)&&(e.side===undefined||['friendly','enemy','both'].some(x=>x===e.side)),'잘못된 손패 추가 카드 또는 수량');
    else if(e.kind==='addRandomCard')requireRule(Array.isArray(e.cardIds)&&e.cardIds.length>0&&e.cardIds.length<=20&&e.cardIds.every(id=>typeof id==='string'&&Object.hasOwn(catalog,id))&&integer(e.count,1,10)&&(e.side===undefined||['friendly','enemy','both'].some(x=>x===e.side)),'잘못된 무작위 손패 추가');
    else if(e.kind==='addCardNextTurn')requireRule(typeof e.cardId==='string'&&Object.hasOwn(catalog,e.cardId),'잘못된 다음 턴 카드');
    else if(e.kind==='drawTribe')requireRule(TRIBES.some(t=>t===e.tribe)&&integer(e.count,1,10)&&(e.fallbackCardId===undefined||(typeof e.fallbackCardId==='string'&&Object.hasOwn(catalog,e.fallbackCardId))),'잘못된 종족 드로우');
    else if(e.kind==='loseCrystal')requireRule(integer(e.amount,1,10),'잘못된 마나 수정 감소');
    else if(e.kind==='consumeAdjacent'||e.kind==='consumeDivineShields')requireRule(context==='battlecry','전투의 함성 전용 효과');
    else if(e.kind==='brawl'||e.kind==='shadowform')requireRule(context==='spell','주문 전용 효과');
    else if(e.kind==='discountNextSpell'||e.kind==='drawDiscounted')requireRule(context==='spell'&&integer(e.amount,1,20),'잘못된 비용 할인 효과');
    else if(e.kind==='heroImmuneThisTurn')requireRule(context==='secret','비밀 전용 영웅 면역');
    else if(e.kind==='summonEnemyDeckMinion')requireRule(context==='spell'&&typeof e.fallbackCardId==='string'&&Object.hasOwn(catalog,e.fallbackCardId)&&catalog[e.fallbackCardId].kind==='minion','잘못된 덱 소환 효과');
    else if(e.kind==='weaponBurst')requireRule(context==='spell','무기 폭발은 주문으로만 지원합니다.');
    else if(e.kind==='swapHandMinion')requireRule(context==='trigger','손패 교체는 하수인 턴 효과입니다.');
    else if(e.kind==='damageWeapon')requireRule((e.side==='friendly'||e.side==='enemy')&&integer(e.amount,1,10),'잘못된 무기 내구도 피해');
    else if(e.kind==='destroyWeapon')requireRule(e.side==='friendly'||e.side==='enemy','잘못된 무기 대상');
    else if(e.kind==='buffWeapon'){const equip=e.equipIfMissing;requireRule(integer(e.attack,0,100)&&integer(e.durability,0,100)&&e.attack+e.durability>0&&(equip===undefined||(record(equip)&&integer(equip.attack,0,100)&&integer(equip.durability,1,100))),'잘못된 무기 강화 수치');}
    else if(e.kind==='protectMinionsThisTurn')requireRule(context==='spell','일시 피해 보호는 주문 효과로만 지원합니다.');
    else if(e.kind==='copyEnemyCard')requireRule((e.zone==='hand'||e.zone==='deck')&&integer(e.count,1,10),'잘못된 카드 복사 설정');
    else if(e.kind==='summon') requireRule(typeof e.cardId==='string'&&Object.hasOwn(catalog,e.cardId)&&catalog[e.cardId].kind==='minion'&&integer(e.count,1,7)&&(e.countMax===undefined||integer(e.countMax,e.count as number,7))&&(e.side===undefined||e.side==='friendly'||e.side==='enemy')&&(e.per===undefined||e.per==='enemyMinions'),'잘못된 소환 카드 또는 개수');
    else if(e.kind==='summonUniqueRandom'||e.kind==='summonRandom') requireRule(Array.isArray(e.cardIds)&&e.cardIds.length>0&&e.cardIds.length<=20&&e.cardIds.every(id=>typeof id==='string'&&Object.hasOwn(catalog,id)&&catalog[id].kind==='minion')&&new Set(e.cardIds).size===e.cardIds.length,'잘못된 무작위 소환 카드');
    else if(e.kind==='equip') requireRule(integer(e.attack,0,100)&&integer(e.durability,1,100)&&(e.cardId===undefined||typeof e.cardId==='string'&&catalog[e.cardId]?.kind==='weapon'),'잘못된 무기 수치');
    else if(e.kind==='nextSecretFree'||e.kind==='destroyEnemySecrets')requireRule(context==='spell'||context==='battlecry','잘못된 비밀 조작 효과');
    else if(['redirectAttackRandom','copyEventMinion','reviveEventMinion','reflectDamage'].some(k=>k===e.kind))requireRule(context==='secret','비밀 전용 효과입니다.');
    else if(e.kind==='redirectAttackSummon')requireRule(context==='secret'&&typeof e.cardId==='string'&&Object.hasOwn(catalog,e.cardId)&&catalog[e.cardId].kind==='minion','잘못된 공격 대상 소환');
    else if(e.kind==='cancelEvent') requireRule(context==='secret','이벤트 취소는 비밀만 가능');
    else requireRule(false,'지원하지 않는 효과');
  }
  if(rule) requireRule(raw.some(e=>e.target==='chosen'||e.target==='chosenAndAdjacent'),'targetRule에 대응하는 chosen 효과가 필요합니다.');
}
function getTribe(s:GameState,c:Character):Tribe|undefined { if(c.kind!=='minion')return; const card=s.catalog[c.minion.cardId]; return card?.kind==='minion'?card.tribe:undefined; }
function currentCharacter(s:GameState,c:Character):Character{if(c.kind==='minion'&&!s.players[c.player].board.includes(c.minion)&&s.players[other(c.player)].board.includes(c.minion))return {...c,player:other(c.player)};return c;}
function select(s:GameState,ctx:EffectContext,selector:Selector,tribe?:Tribe):Character[] {
  const ally=ctx.owner,enemy=other(ally);
  let list:Character[];
  switch(selector){
    case 'chosen':list=ctx.chosen?[ctx.chosen]:[];break;
    case 'self':list=ctx.source?[ctx.source]:[];break;
    case 'eventTarget':list=ctx.eventTarget?[ctx.eventTarget]:[];break;
    case 'eventAttacker':list=ctx.eventAttacker?[ctx.eventAttacker]:[];break;
    case 'friendlyHero':list=[hero(ally)];break;
    case 'enemyHero':list=[hero(enemy)];break;
    case 'friendlyMinions':case 'randomFriendlyMinion':list=minions(s,ally);break;
    case 'otherFriendlyMinions':case 'randomOtherFriendlyMinion':list=minions(s,ally).filter(c=>ctx.source?.kind!=='minion'||c.kind!=='minion'||ctx.source.minion!==c.minion);break;
    case 'randomDamagedFriendlyCharacter':case 'randomDamagedCharacter':list=(selector==='randomDamagedCharacter'?[hero(ally),hero(enemy),...minions(s,ally),...minions(s,enemy)]:[hero(ally),...minions(s,ally)]).filter(c=>c.kind==='hero'?s.players[c.player].health<(s.players[c.player].maxHealth??RULES.heroHealth):c.minion.health<c.minion.maxHealth);break;
    case 'randomLowAttackEnemyMinion':list=minions(s,enemy).filter(c=>c.kind==='minion'&&c.minion.attack<=2);break;
    case 'enemyMinions':case 'randomEnemyMinion':list=minions(s,enemy);break;
    case 'allMinions':case 'otherMinions':case 'randomMinion':case 'randomOtherMinion':list=[...minions(s,ally),...minions(s,enemy)];if(selector==='otherMinions'||selector==='randomOtherMinion')list=list.filter(c=>ctx.source?.kind!=='minion'||c.kind!=='minion'||ctx.source.minion!==c.minion);break;
    case 'allCharacters':case 'otherCharacters':list=[hero(ally),hero(enemy),...minions(s,ally),...minions(s,enemy)];if(selector==='otherCharacters')list=list.filter(c=>ctx.source?.kind==='minion'?(c.kind!=='minion'||c.minion!==ctx.source.minion):ctx.source?.kind==='hero'?(c.kind!=='hero'||c.player!==ctx.source.player):true);break;
    case 'friendlyCharacters':list=[hero(ally),...minions(s,ally)];break;
    case 'enemyCharacters':list=[hero(enemy),...minions(s,enemy)];break;
    case 'randomEnemy':list=[hero(enemy),...minions(s,enemy)];break;
    case 'chosenAndAdjacent':{list=[];if(ctx.chosen?.kind==='minion'){const board=s.players[ctx.chosen.player].board,i=board.indexOf(ctx.chosen.minion);if(i>=0)for(const m of [board[i-1],board[i],board[i+1]])if(m)list.push({kind:'minion',player:ctx.chosen.player,minion:m});}break;}
    case 'adjacent':{
      list=[];if(ctx.source?.kind==='minion'){const board=s.players[ctx.source.player].board,i=board.indexOf(ctx.source.minion);if(i>=0){for(const m of [board[i-1],board[i+1]])if(m)list.push({kind:'minion',player:ctx.source.player,minion:m});}}break;
    }
  }
  list=list.filter(c=>c.kind==='hero'||(c.minion.health>0&&s.players[c.player].board.includes(c.minion)));
  if(tribe)list=list.filter(c=>getTribe(s,c)===tribe);
  return selector.startsWith('random')&&list.length?[list[Math.floor(random(s)*list.length)]]:list;
}
export function uniqueSummonChoices(s:GameState,owner:PlayerId,cardIds:string[]):string[]{
  return cardIds.filter(id=>!s.players[owner].board.some(m=>m.cardId===id));
}
export function freeze(s:GameState,c:Character,source?:PlayerId):void {
  const p=s.players[c.player],canAttack=c.kind==='hero'?p.heroAttacksRemaining>0:c.minion.attacksRemaining>0;
  const through=s.turn+(s.activePlayer===c.player?(canAttack?0:2):1);
  const before=c.kind==='hero'?p.heroFrozenThroughTurn:c.minion.frozenThroughTurn;
  if(source!==undefined&&source!==c.player&&(before===undefined||through>before)&&observingCombat(s))emitCombat(s,{kind:'freeze',owner:source});
  if(c.kind==='hero')p.heroFrozenThroughTurn=Math.max(p.heroFrozenThroughTurn??0,through);
  else c.minion.frozenThroughTurn=Math.max(c.minion.frozenThroughTurn??0,through);
}
/** Original-era damage-sourced abilities apply to combat AND non-combat damage. */
export function minionDamageResult(s:GameState,source:Character,target:Character,dealt:boolean,cause?:CombatCause):void {
  if(!dealt||source.kind!=='minion')return;
  const def=s.catalog[source.minion.cardId];
  if(!source.minion.silenced&&def?.kind==='minion'&&def.freezeOnCombatDamage&&(target.kind==='hero'||target.minion.health>0))freeze(s,target,cause?.owner);
  if(target.kind==='minion'&&hasKeyword(source.minion,'poisonous')){
    if(cause)markMortal(s,target.minion,cause);
    target.minion.health=0;
  }
}
/** Executes declarative data only; never evaluates card-supplied code. */
const areaSelectors=new Set(['enemyMinions','enemyCharacters','allMinions','allCharacters','otherMinions','otherCharacters','chosenAndAdjacent','adjacent']);
const buffEffects=new Set(['buff','temporaryAttack','multiplyHealth','doubleAttack','setStats','giveKeyword','attackToHealth','consumeDivineShields','consumeAdjacent','grantSpellDamage','grantDeathrattleSummon']);
export function resolveEffects(s:GameState,effects:Effect[],ctx:EffectContext,ops:EffectOps):void {
  const p=s.players[ctx.owner],tracking=observingCombat(s);
  let cause:CombatCause|undefined;
  let comboReported=false;
  const destroy=(m:Minion)=>{if(cause&&m.health>0)markMortal(s,m,cause);m.health=0;};
  // A minion-generated token belongs next to its source. Spell/hero-power tokens
  // go to the right edge. A deathrattle uses the source's old board slot even
  // if multiple minions died and their triggers resolve in a different order.
  let previousSummon:Minion|undefined;
  const summonNear=(cardId:string,source=ctx.source):Minion|undefined=>{
    let position:number|undefined;
    const placement=source?.kind==='minion'&&source.player===ctx.owner?(source.deathPlacement??ops.deathPlacement(source.minion)):undefined;
    if(placement){
      const {slots,index}=placement,board=p.board;
      const indices=(slot:DeathSlot)=>[slot.minion,...slot.replacements].map(m=>board.indexOf(m)).filter(i=>i>=0);
      const own=indices(slots[index]);
      if(own.length)position=Math.max(...own)+1;
      else {
        for(let i=index+1;i<slots.length&&position===undefined;i++){const found=indices(slots[i]);if(found.length)position=Math.min(...found);}
        if(position===undefined){for(let i=index-1;i>=0&&position===undefined;i--){const found=indices(slots[i]);if(found.length)position=Math.max(...found)+1;}}
        position??=0;
      }
    }else if(source?.kind==='minion'&&source.player===ctx.owner){
      const index=p.board.indexOf(previousSummon??source.minion);
      if(index>=0)position=index+1;
      else {const original=p.board.indexOf(source.minion);if(original>=0)position=original+1;}
    }
    const m=ops.summon(ctx.owner,cardId,undefined,position);
    if(m){previousSummon=m;if(placement)placement.slots[placement.index].replacements.push(m);}
    return m;
  };
  const dealDamage=(c:Character,n:number,source=ctx.source,multiplier=ctx.spellPowerMultiplier??1)=>{if(n>0&&source?.kind==='minion'){const m=source.minion;m.keywords=m.keywords?.filter(k=>k!=='stealth');delete m.stealthUntilStartOf;}const dealt=ops.damage(c,n*multiplier,cause);if(source)minionDamageResult(s,source,c,dealt,cause);};
  for(const e of effects){
    if(s.phase==='finished')break;
    if(ctx.chosen)ctx.chosen=currentCharacter(s,ctx.chosen);
    if(ctx.source)ctx.source=currentCharacter(s,ctx.source);
    if(ctx.eventTarget)ctx.eventTarget=currentCharacter(s,ctx.eventTarget);
    if(ctx.eventAttacker)ctx.eventAttacker=currentCharacter(s,ctx.eventAttacker);
    if(e.condition?.kind==='hasSecret'&&!p.secrets.length)continue;
    if(e.condition?.kind==='chance'&&random(s)*100>=e.condition.percent)continue;
    if(e.condition?.kind==='chosenFrozen'){const c=ctx.chosen;const frozen=c?.kind==='hero'?s.players[c.player].heroFrozenThroughTurn!==undefined:c?.kind==='minion'&&c.minion.frozenThroughTurn!==undefined;if(!!frozen===!!e.condition.negate)continue;}
    if(e.condition?.kind==='combo'&&!ctx.comboActive)continue;
    if(e.condition?.kind==='chosenSurvived'&&!(ctx.chosen?.kind==='minion'&&ctx.chosen.minion.health>0&&s.players[ctx.chosen.player].board.includes(ctx.chosen.minion)))continue;
    if(e.condition?.kind==='chosenDied'&&!(ctx.chosen?.kind==='minion'&&ctx.chosen.minion.health<=0))continue;
    if(e.condition?.kind==='chosenFriendlyTribe'){const cond=e.condition,match=ctx.chosen?.kind==='minion'&&ctx.chosen.player===ctx.owner&&getTribe(s,ctx.chosen)===cond.tribe;if(!!match===!!cond.negate)continue;}
    if(e.condition?.kind==='enemyMinionCount'&&minions(s,other(ctx.owner)).length<e.condition.minCount)continue;
    if(e.condition?.kind==='eventTargetAttackAtMost'&&!(ctx.eventTarget?.kind==='minion'&&ctx.eventTarget.minion.attack<=e.condition.amount))continue;
    if(e.condition?.kind==='friendlyTribe'){const condition=e.condition;const count=minions(s,ctx.owner).filter(c=>getTribe(s,c)===condition.tribe && !(ctx.source?.kind==='minion'&&c.kind==='minion'&&c.minion===ctx.source.minion)).length;if(count<(condition.minCount??1))continue;}
    if(tracking)cause={owner:ctx.owner,source:ctx.combatSource??(ctx.source?.kind==='minion'?'minion':'card'),
      area:('target' in e&&areaSelectors.has(e.target))||e.kind==='damageDistinct'&&e.count>1||
        e.kind==='brawl'||e.kind==='damageSplash'||e.kind==='weaponBurst'||e.kind==='sacrificeBlast'};
    const beforeBuff=tracking&&buffEffects.has(e.kind)?p.board.filter(m=>m.health>0).map(m=>({
      m,attack:m.attack,maxHealth:m.maxHealth,keywords:m.keywords?.length??0,spellDamage:m.bonusSpellDamage??0,deathrattles:m.deathrattleSummons?.length??0,
    })):undefined;
    const preMana=p.mana,preCrystals=p.maxMana,preArmor=p.armor,preOverload=p.pendingOverload;
    const combo=tracking&&!comboReported&&ctx.comboActive&&(e.condition?.kind==='combo'||e.kind==='damage'&&!!e.bonusIfCombo);
    let comboApplied=false;
    switch(e.kind){
      case 'damage':{
        const bonus=e.bonusIfTribe&&minions(s,ctx.owner).some(c=>getTribe(s,c)===e.bonusIfTribe!.tribe)?e.bonusIfTribe.amount:0;
        const healthBonus=e.bonusIfHeroHealthAtMost&&p.health<=e.bonusIfHeroHealthAtMost.health?e.bonusIfHeroHealthAtMost.amount:0;
        for(const c of select(s,ctx,e.target,e.tribe))if(c.kind!=='minion'||c.minion.cardId!==e.excludeCardId){comboApplied=true;dealDamage(c,e.amount+(e.amountMax===undefined?0:Math.floor(random(s)*(e.amountMax-e.amount+1)))+bonus+healthBonus+(ctx.comboActive?e.bonusIfCombo??0:0)+(ctx.spellDamage??0));}break;
      }
      case 'damageDistinct':{
        const pool=minions(s,other(ctx.owner));
        for(let i=0;i<e.count&&pool.length;i++){const [c]=pool.splice(Math.floor(random(s)*pool.length),1);dealDamage(c,e.amount+(ctx.spellDamage??0));}
        break;
      }
      case 'damageFromHeroAttack':for(const c of select(s,ctx,e.target,e.tribe))dealDamage(c,p.heroAttack+(p.weapon?.attack??0)+(ctx.spellDamage??0));break;
      case 'damageFromArmor':for(const c of select(s,ctx,e.target,e.tribe))dealDamage(c,p.armor+(ctx.spellDamage??0));break;
      case 'immuneThisTurn':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')c.minion.immuneThisTurn=true;break;
      case 'heroImmuneThisTurn':p.heroImmuneThisTurn=true;break;
      case 'brawl':{
        const pool=select(s,ctx,'allMinions');if(pool.length>1){const survivor=pool[Math.floor(random(s)*pool.length)];for(const c of pool)if(c!==survivor&&c.kind==='minion')destroy(c.minion);}break;
      }
      case 'consumeDivineShields':{
        let n=0;for(const c of select(s,ctx,'allMinions'))if(c.kind==='minion'&&hasKeyword(c.minion,'divineShield')){c.minion.keywords=c.minion.keywords?.filter(k=>k!=='divineShield');n++;}
        if(n&&ctx.source?.kind==='minion'){const m=ctx.source.minion;m.attack+=3*n;m.health+=3*n;m.maxHealth+=3*n;}break;
      }
      case 'copyChosenMinion':if(ctx.chosen?.kind==='minion'&&ctx.source?.kind==='minion'){
        const source=ctx.source.minion,copy=structuredClone(ctx.chosen.minion);
        const {instanceId,originalOwner,enteredOrder}=source;
        for(const key of Object.keys(source))delete (source as unknown as Record<string,unknown>)[key];
        Object.assign(source,copy,{instanceId,originalOwner,enteredOrder,summonedTurn:s.turn,attacksMadeThisTurn:0});
        delete source.returnController;delete source.auraCharge;delete source.auraWindfury;
        if(copy.auraCharge&&!source.keywords?.includes('charge'))source.keywords=[...(source.keywords??[]),'charge'];
        source.attacksRemaining=hasKeyword(source,'charge')?(hasKeyword(source,'windfury')?2:1):0;
        break;
      }break;
      case 'discountNextSpell':p.nextSpellDiscount=(p.nextSpellDiscount??0)+e.amount;break;
      case 'enemyFreeSpellsNextTurn':s.players[other(ctx.owner)].freeSpellsNextTurn=true;break;
      case 'destroyEnemyWeaponDraw':{const enemy=s.players[other(ctx.owner)],durability=enemy.weapon?.durability??0;enemy.weapon=null;for(let i=0;i<durability;i++)ops.draw(ctx.owner);break;}
      case 'copySpellToOther':if(ctx.eventCardId&&ctx.eventOwner!==undefined)ops.addCard(other(ctx.eventOwner),ctx.eventCardId);break;
      case 'setHeroHealth':if(ctx.chosen?.kind==='hero'){const h=s.players[ctx.chosen.player];h.health=Math.min(h.maxHealth??RULES.heroHealth,e.amount);}break;
      case 'replaceHero':if(ctx.source?.kind==='minion'&&p.board.includes(ctx.source.minion)){
        const w=s.catalog[e.weaponCardId];if(w.kind!=='weapon')break;
        const source=ctx.source.minion;p.board=p.board.filter(m=>m!==source);p.heroForm=e.form;p.maxHealth=e.health;p.health=e.health;p.armor=0;delete p.shadowformLevel;delete p.heroFrozenThroughTurn;p.heroAttack=0;p.heroPowerUsed=false;p.weapon={attack:w.attack,durability:w.durability,cardId:w.id};
      }break;
      case 'drawDiscounted':{const card=p.deck[0];ops.draw(ctx.owner);if(card&&p.hand.includes(card))card.costDiscount=(card.costDiscount??0)+e.amount;break;}
      case 'shadowform':if(p.shadowformLevel!==2){p.shadowformLevel=p.shadowformLevel===1?2:1;p.heroPowerUsed=false;}break;
      case 'summonEnemyDeckMinion':{const pool=s.players[other(ctx.owner)].deck.filter(c=>s.catalog[c.cardId]?.kind==='minion');summonNear(pool.length?pool[Math.floor(random(s)*pool.length)].cardId:e.fallbackCardId);break;}
      case 'weaponBurst':{const weapon=p.weapon;if(weapon){p.weapon=null;for(const c of select(s,ctx,'enemyCharacters'))dealDamage(c,weapon.attack+(ctx.spellDamage??0));}break;}
      case 'betrayal':{
        const chosen=ctx.chosen;if(chosen?.kind==='minion'){const board=s.players[chosen.player].board,i=board.indexOf(chosen.minion);for(const m of [board[i-1],board[i+1]])if(m&&i>=0)dealDamage({kind:'minion',player:chosen.player,minion:m},chosen.minion.attack,chosen);}break;
      }
      case 'damageSplash':{
        const chosen=ctx.chosen;if(!chosen)break;
        for(const c of select(s,ctx,e.scope)){
          const same=c.kind==='hero'?chosen.kind==='hero'&&c.player===chosen.player:chosen.kind==='minion'&&c.minion===chosen.minion;
          dealDamage(c,(same?e.amount:e.splash)+(ctx.spellDamage??0));
        }break;
      }
      case 'missiles':{
        for(let i=0;i<(e.count+(ctx.spellDamage??0))*(ctx.spellPowerMultiplier??1);i++){
          if((s as GameState).phase==='finished')break;
          const enemy=other(ctx.owner);const pool=e.target==='randomEnemy'?[hero(enemy),...minions(s,enemy)]:e.target==='randomEnemyMinion'?minions(s,enemy):[hero(0),hero(1),...minions(s,0),...minions(s,1)].filter(c=>ctx.source?.kind!=='minion'||c.kind!=='minion'||c.minion!==ctx.source.minion);
          if(!pool.length)break;dealDamage(pool[Math.floor(random(s)*pool.length)],e.amount,ctx.source,1);ops.settle();
        }break;
      }
      case 'heal':case 'healFull':{
        const invert=p.board.some(m=>{const d=s.catalog[m.cardId];return m.health>0&&!m.silenced&&d.kind==='minion'&&d.healingToDamage;});
        for(const c of select(s,ctx,e.target,e.tribe)){const n=e.kind==='heal'?e.amount:c.kind==='hero'?s.players[c.player].maxHealth??RULES.heroHealth:c.minion.maxHealth;if(invert)dealDamage(c,n+(ctx.spellDamage??0));else ops.heal(c,n*(ctx.spellPowerMultiplier??1),ctx.owner);}break;
      }
      case 'deferredDestroy':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){const key=e.timing==='endTurn'?'destroyAtEndOf':'destroyAtStartOf';c.minion[key]=[...new Set([...(c.minion[key]??[]),ctx.owner])];}break;
      case 'temporaryStealth':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')c.minion.stealthUntilStartOf=ctx.owner;break;
      case 'grantDeathrattleSummon':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')c.minion.deathrattleSummons=[...(c.minion.deathrattleSummons??[]),e.cardId??c.minion.cardId];break;
      case 'consumeAdjacent':if(ctx.source?.kind==='minion'){
        const source=ctx.source.minion;for(const c of select(s,ctx,'adjacent'))if(c.kind==='minion'){source.attack+=c.minion.attack;source.health+=c.minion.health;source.maxHealth+=c.minion.health;destroy(c.minion);}
      }break;
      case 'sacrificeBlast':if(ctx.chosen?.kind==='minion'){const n=ctx.chosen.minion.attack;destroy(ctx.chosen.minion);for(const c of select(s,ctx,'enemyMinions'))dealDamage(c,n+(ctx.spellDamage??0));}break;
      case 'grantSpellDamage':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')c.minion.bonusSpellDamage=(c.minion.bonusSpellDamage??0)+e.amount;break;
      case 'swapStats':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){const m=c.minion,a=m.attack,h=m.health;m.attack=h+(m.auraAttack??0);m.health=a+(m.auraHealth??0);m.maxHealth=m.health;m.temporaryAttack=0;}break;
      case 'swapHandMinion':if(ctx.source?.kind==='minion'){const m=ctx.source.minion,i=p.board.indexOf(m),options=p.hand.filter(x=>s.catalog[x.cardId].kind==='minion');if(i>=0&&options.length){const card=options[Math.floor(random(s)*options.length)];p.hand=p.hand.filter(x=>x!==card);p.board.splice(i,1);p.hand.push({instanceId:m.instanceId,cardId:m.cardId});ops.summon(ctx.owner,card.cardId,card,i);}}break;
      case 'damageWeapon':{const t=s.players[e.side==='friendly'?ctx.owner:other(ctx.owner)],w=t.weapon;if(w){w.durability-=e.amount;if(w.durability<=0)t.weapon=null;}break;}
      case 'doubleAttack':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')c.minion.attack*=2;break;
      case 'drawOnAttack':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')c.minion.drawOnAttackOwners=[...(c.minion.drawOnAttackOwners??[]),ctx.owner];break;
      case 'removeStealth':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){c.minion.keywords=c.minion.keywords?.filter(k=>k!=='stealth');delete c.minion.stealthUntilStartOf;}break;
      case 'drawCostDamage':{const id=ops.drawCard(ctx.owner);if(id)for(const c of select(s,ctx,e.target,e.tribe))dealDamage(c,s.catalog[id].cost+(ctx.spellDamage??0));break;}
      case 'nextSecretFree':p.nextSecretFree=true;break;
      case 'destroyEnemySecrets':s.players[other(ctx.owner)].secrets=[];break;
      case 'reflectDamage':dealDamage(hero(other(ctx.owner)),ctx.eventDamage??0);break;
      case 'redirectAttackSummon':{const m=ops.summon(ctx.owner,e.cardId);if(m)ctx.redirected={kind:'minion',player:ctx.owner,minion:m};break;}
      case 'redirectAttackRandom':{const same=(a:Character,b?:Character)=>a.kind==='hero'?b?.kind==='hero'&&a.player===b.player:b?.kind==='minion'&&a.minion===b.minion;const pool=select(s,ctx,'allCharacters').filter(c=>!same(c,ctx.eventTarget)&&!same(c,ctx.eventAttacker));if(pool.length)ctx.redirected=pool[Math.floor(random(s)*pool.length)];break;}
      case 'copyEventMinion':if(ctx.eventTarget?.kind==='minion'){const src=ctx.eventTarget.minion,m=ops.summon(ctx.owner,src.cardId,undefined,undefined,ctx.owner,false);if(m){const {instanceId,originalOwner,attacksRemaining,summonedTurn,attacksMadeThisTurn,enteredOrder}=m;Object.assign(m,structuredClone(src),{instanceId,originalOwner,attacksRemaining,summonedTurn,attacksMadeThisTurn,enteredOrder});delete m.returnController;if(tracking)observedSummon(s,ctx.owner,m);}}break;
      case 'reviveEventMinion':if(ctx.eventTarget?.kind==='minion'){const m=summonNear(ctx.eventTarget.minion.cardId,ctx.eventTarget);if(m)m.health=1;}break;
      case 'attackToHealth':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){c.minion.attack=c.minion.health+(c.minion.auraAttack??0);c.minion.temporaryAttack=0;}break;
      case 'buff':{
        const n=e.per==='otherFriendlyMinions'?minions(s,ctx.owner).filter(c=>ctx.source?.kind!=='minion'||c.kind!=='minion'||c.minion!==ctx.source.minion).length:e.per==='hand'?p.hand.length:e.per==='enemyHand'?s.players[other(ctx.owner)].hand.length:e.per==='friendlyWeaponAttack'?p.weapon?.attack??0:e.per==='previousCards'?Math.max(0,p.cardsPlayedThisTurn-1):1;
        for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){c.minion.attack+=e.attack*n;c.minion.health+=e.health*n;c.minion.maxHealth+=e.health*n;}break;
      }
      case 'multiplyHealth':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){const gain=c.minion.health*(e.factor-1);c.minion.health+=gain;c.minion.maxHealth+=gain;}break;
      case 'destroy':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion')destroy(c.minion);else if(e.target==='chosen'&&s.players[c.player].heroForm==='jaraxxus')s.players[c.player].health=0;break;
      case 'freeze':for(const c of select(s,ctx,e.target,e.tribe))freeze(s,c,ctx.owner);break;
      case 'silence':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){
        const m=c.minion,def=s.catalog[m.cardId];if(def.kind!=='minion')continue;
        if(tracking&&(!m.silenced||m.keywords?.length||m.attack!==def.attack+(m.auraAttack??0)||m.maxHealth!==def.health+(m.auraHealth??0)||m.frozenThroughTurn!==undefined))
          emitCombat(s,{kind:'silence',owner:ctx.owner});
        m.silenced=true;m.keywords=[];delete m.immuneThisTurn;delete m.frozenThroughTurn;delete m.destroyAtStartOf;delete m.destroyAtEndOf;delete m.stealthUntilStartOf;delete m.deathrattleSummons;delete m.drawOnAttackOwners;delete m.bonusSpellDamage;delete m.auraWindfury;m.temporaryAttack=0;m.attack=def.attack+(m.auraAttack??0);const oldMax=m.maxHealth;m.maxHealth=def.health+(m.auraHealth??0);m.health=Math.min(m.health+Math.max(0,m.maxHealth-oldMax),m.maxHealth);m.attacksRemaining=m.summonedTurn===s.turn||((m.attacksMadeThisTurn??0)>0)?0:Math.min(m.attacksRemaining,1);
        const former=m.returnController;delete m.returnController;
        if(former!==undefined&&former!==c.player){const destination=s.players[former];if(destination.board.length>=RULES.maxBoard)destroy(m);else{s.players[c.player].board=s.players[c.player].board.filter(x=>x!==m);m.attacksRemaining=0;destination.board.push(m);}}
      }break;
      case 'bounce':for(const c of select(s,ctx,e.target,e.tribe).sort((a,b)=>(a.kind==='minion'?a.minion.enteredOrder??0:0)-(b.kind==='minion'?b.minion.enteredOrder??0:0)))if(c.kind==='minion'){
        comboApplied=true;const p=s.players[c.player];if(p.hand.length<RULES.maxHand){p.board=p.board.filter(m=>m!==c.minion);p.hand.push({instanceId:c.minion.instanceId,cardId:c.minion.cardId,...(e.discount?{costDiscount:e.discount}:{})});}else destroy(c.minion);
      }break;
      case 'randomTransform':case 'transform':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){
        const m=c.minion,def=s.catalog[e.kind==='transform'?e.cardId:e.cardIds[Math.floor(random(s)*e.cardIds.length)]];if(def.kind!=='minion')continue;
        if(tracking)clearMortal(s,m);m.cardId=def.id;m.attack=def.attack;m.health=def.health;m.maxHealth=def.health;m.keywords=[...(def.keywords??[])];m.auraAttack=0;m.auraHealth=0;m.temporaryAttack=0;delete m.silenced;delete m.immuneThisTurn;delete m.frozenThroughTurn;delete m.destroyAtStartOf;delete m.destroyAtEndOf;delete m.stealthUntilStartOf;delete m.deathrattleSummons;delete m.drawOnAttackOwners;delete m.bonusSpellDamage;delete m.auraWindfury;delete m.auraCharge;
        m.summonedTurn=s.turn;m.attacksMadeThisTurn=0;m.attacksRemaining=c.player===s.activePlayer&&m.keywords.includes('charge')?(m.keywords.includes('windfury')?2:1):0;m.enteredOrder=s.nextEntryOrder??1;s.nextEntryOrder=m.enteredOrder+1;
        // Transformation replaces the temporary control enchantment; the new
        // minion stays on its current controller's side.
        delete m.returnController;m.originalOwner=c.player;
      }break;
      case 'control':case 'temporaryControl':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'&&c.player!==ctx.owner&&p.board.length<RULES.maxBoard){const old=s.players[c.player],m=c.minion;old.board=old.board.filter(x=>x!==m);m.originalOwner??=c.player;
        if(e.kind==='temporaryControl'){m.returnController=c.player;m.attacksRemaining=s.activePlayer===ctx.owner?(hasKeyword(m,'windfury')?2:1):0;}
        else{delete m.returnController;m.attacksRemaining=hasKeyword(m,'charge')&&s.activePlayer===ctx.owner?(hasKeyword(m,'windfury')?2:1):0;}
        m.summonedTurn=s.turn;m.attacksMadeThisTurn=0;p.board.push(m);}break;
      case 'setStats':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){const m=c.minion;if(e.attack!==undefined){m.attack=e.attack+(m.auraAttack??0);m.temporaryAttack=0;}if(e.health!==undefined){m.maxHealth=e.health+(m.auraHealth??0);m.health=m.maxHealth;}}break;
      case 'temporaryAttack':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'){c.minion.attack+=e.amount;c.minion.temporaryAttack=(c.minion.temporaryAttack??0)+e.amount;}else s.players[c.player].heroAttack+=e.amount;break;
      case 'giveKeyword':for(const c of select(s,ctx,e.target,e.tribe))if(c.kind==='minion'&&!c.minion.keywords?.includes(e.keyword)){
        const m=c.minion;m.keywords=[...(m.keywords??[]),e.keyword];
        if(tracking&&c.player===ctx.owner&&e.keyword==='divineShield')emitCombat(s,{kind:'shieldGain',owner:ctx.owner});
        if(c.player===s.activePlayer&&(e.keyword==='charge'||e.keyword==='windfury')&&(m.summonedTurn!==s.turn||hasKeyword(m,'charge')))m.attacksRemaining=Math.max(m.attacksRemaining,(hasKeyword(m,'windfury')?2:1)-(m.attacksMadeThisTurn??0));
      }break;
      case 'draw':{
        const n=e.per==='damagedFriendlyCharacters'?(p.health<(p.maxHealth??RULES.heroHealth)?1:0)+p.board.filter(m=>m.health<m.maxHealth&&m.health>0).length:e.per==='enemyHandDifference'?Math.max(0,s.players[other(ctx.owner)].hand.length-p.hand.length):1;
        const owners=e.side==='both'?[ctx.owner,other(ctx.owner)]:[e.side==='enemy'?other(ctx.owner):ctx.owner];
        for(const owner of owners)for(let i=0;i<e.amount*n;i++){if((s as GameState).phase==='finished')break;ops.draw(owner,ctx.owner);}break;
      }
      case 'gainMana':p.mana=Math.min(RULES.maxMana,p.mana+e.amount);break;
      case 'gainCrystal':{
        const who=e.side==='enemy'?other(ctx.owner):ctx.owner,receiver=s.players[who],gain=Math.min(RULES.maxMana-receiver.maxMana,e.amount);
        if(receiver.maxMana===RULES.maxMana&&e.overflowCardId)ops.addCard(who,e.overflowCardId);
        receiver.maxMana+=gain;if(e.filled)receiver.mana=Math.min(RULES.maxMana,receiver.mana+gain);break;
      }
      case 'chooseTopDeck':{const cards=p.deck.splice(0,e.count);if(cards.length)s.pendingChoice={owner:ctx.owner,cards};break;}
      case 'overload':p.pendingOverload=Math.min(RULES.maxMana,p.pendingOverload+e.amount);ops.overload(ctx.owner);break;
      case 'loseCrystal':p.maxMana=Math.max(0,p.maxMana-e.amount);p.mana=Math.min(p.mana,p.maxMana);p.lockedMana=Math.min(p.lockedMana,p.maxMana);break;
      case 'drawTribe':for(let i=0;i<e.count;i++){const choices=p.deck.map((card,index)=>({card,index})).filter(({card})=>{const d=s.catalog[card.cardId];return d.kind==='minion'&&d.tribe===e.tribe;});if(choices.length){const [card]=p.deck.splice(choices[Math.floor(random(s)*choices.length)].index,1);const burned=p.hand.length>=RULES.maxHand;emitVisual(s,{kind:'draw',side:ctx.owner,burned});if(!burned){p.hand.push(card);if(tracking)emitCombat(s,{kind:'draw',owner:ctx.owner});}}else if(e.fallbackCardId)ops.addCard(ctx.owner,e.fallbackCardId);}break;
      case 'discard':{
        for(let i=0;i<e.amount&&p.hand.length;i++){
          const [discarded]=p.hand.splice(Math.floor(random(s)*p.hand.length),1);
          emitVisual(s,{kind:'discard',side:ctx.owner,cardId:discarded.cardId});
          log(s,ctx.owner,`${s.catalog[discarded.cardId].name} 버림`);
        }
        break;
      }
      case 'addRandomCard':case 'addCard':{const owners=e.side==='both'?[ctx.owner,other(ctx.owner)]:[e.side==='enemy'?other(ctx.owner):ctx.owner];for(const owner of owners)for(let i=0;i<e.count;i++)ops.addCard(owner,e.kind==='addCard'?e.cardId:e.cardIds[Math.floor(random(s)*e.cardIds.length)]);break;}
      case 'addCardNextTurn':p.nextTurnCards=[...(p.nextTurnCards??[]),e.cardId];comboApplied=true;break;
      case 'destroyWeapon':s.players[e.side==='friendly'?ctx.owner:other(ctx.owner)].weapon=null;break;
      case 'buffWeapon':if(p.weapon){p.weapon.attack+=e.attack;p.weapon.durability+=e.durability;}else if(e.equipIfMissing)p.weapon={...e.equipIfMissing};break;
      case 'protectMinionsThisTurn':p.protectMinionsThisTurn=true;break;
      case 'copyEnemyCard':{const pool=[...s.players[other(ctx.owner)][e.zone]];for(let i=0;i<e.count&&pool.length;i++){const c=pool.splice(Math.floor(random(s)*pool.length),1)[0];ops.addCard(ctx.owner,c.cardId);}break;}
      case 'armor':p.armor+=e.amount;break;
      case 'heroAttack':p.heroAttack+=e.amount;break;
      case 'summon':for(let i=0,n=(e.count+(e.countMax===undefined?0:Math.floor(random(s)*(e.countMax-e.count+1))))*(e.per==='enemyMinions'?s.players[other(ctx.owner)].board.length:1);i<n;i++){if(e.side==='enemy')ops.summon(other(ctx.owner),e.cardId,undefined,undefined,ctx.owner);else if(summonNear(e.cardId))comboApplied=true;}break;
      case 'summonUniqueRandom':{const options=uniqueSummonChoices(s,ctx.owner,e.cardIds);if(options.length)summonNear(options[Math.floor(random(s)*options.length)]);break;}
      case 'summonRandom':summonNear(e.cardIds[Math.floor(random(s)*e.cardIds.length)]);break;
      case 'equip':{const w=e.cardId?s.catalog[e.cardId]:undefined;p.weapon={attack:w?.kind==='weapon'?w.attack:e.attack,durability:w?.kind==='weapon'?w.durability:e.durability,...(e.cardId?{cardId:e.cardId}:{})};break;}
      case 'cancelEvent':ctx.canceled=true;break;
    }
    if(beforeBuff)for(const {m,attack,maxHealth,keywords,spellDamage,deathrattles} of beforeBuff){
      if(!p.board.includes(m)||m.health<=0)continue;
      if(m.attack>attack||m.maxHealth>maxHealth||(m.keywords?.length??0)>keywords||(m.bonusSpellDamage??0)>spellDamage||(m.deathrattleSummons?.length??0)>deathrattles){
        emitCombat(s,{kind:'buff',owner:ctx.owner,amount:1});comboApplied=true;
      }
      if(m.maxHealth>maxHealth)emitCombat(s,{kind:'healthBuff',owner:ctx.owner,amount:m.maxHealth-maxHealth});
    }
    if(tracking){
      if(combo&&comboApplied){comboReported=true;emitCombat(s,{kind:'combo',owner:ctx.owner});}
      if(e.kind==='armor'&&p.armor>preArmor)emitCombat(s,{kind:'armor',owner:ctx.owner,amount:p.armor-preArmor});
      if(e.kind==='overload'&&p.pendingOverload>preOverload)emitCombat(s,{kind:'overload',owner:ctx.owner,amount:p.pendingOverload-preOverload});
      if(e.kind==='gainMana'||e.kind==='gainCrystal'){
        const amount=Math.max(p.mana-preMana,p.maxMana-preCrystals);
        if(amount>0)emitCombat(s,{kind:'mana',owner:ctx.owner,amount});
      }
    }
    ops.settle();
  }
}
