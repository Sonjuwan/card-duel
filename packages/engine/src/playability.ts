import { hasKeyword, targetMatchesRule, effectiveTargetRule } from './effects.ts';
import { getHeroPower } from './hero-powers.ts';
import { RULES, other } from './rules.ts';
import { currentCost } from './costs.ts';
import type { Card, CardInstance, Catalog, Effect, Minion, PlayerId, PlayerView, PublicPlayer, Target, TargetRule, Weapon } from './types.ts';

/** Common, public prerequisites. These never replace authoritative validation. */
export function spellRequirementReason(effects:Effect[]|undefined, own:{board:Minion[];weapon:Weapon|null}, foe:{board:Minion[]}):string|undefined {
  if(effects?.some(e=>e.kind==='brawl')&&own.board.length+foe.board.length<2)return '난투에는 하수인이 2개 이상 필요합니다.';
  if(own.board.length>=RULES.maxBoard&&effects?.length&&effects.every(e=>e.kind==='summon'||e.kind==='summonRandom'||e.kind==='summonUniqueRandom'||e.kind==='summonEnemyDeckMinion'))return '전장이 가득 차 하수인을 소환할 수 없습니다.';
  if(effects?.some(e=>e.kind==='weaponBurst')&&!own.weapon)return '장착한 무기가 없습니다.';
  if(effects?.some(e=>e.kind==='buffWeapon'&&!e.condition&&!e.equipIfMissing)&&!own.weapon)return '강화할 무기가 없습니다.';
  for(const e of effects??[])if(e.kind==='damageDistinct'&&!e.condition&&foe.board.length<e.count)return '무작위 피해에 필요한 적 하수인이 부족합니다.';
  if(effects?.some(e=>(e.kind==='control'||e.kind==='temporaryControl')&&e.target==='chosen'&&!e.condition)&&own.board.length>=RULES.maxBoard)return '전장이 가득 차 정신 지배할 수 없습니다.';
}

export function heroPowerReason(p:Pick<PublicPlayer,'heroClass'|'heroPowerUsed'|'mana'|'board'|'shadowformLevel'|'heroForm'>):string|undefined {
  const power=getHeroPower(p);
  if(p.heroPowerUsed)return '영웅 능력은 턴당 한 번입니다.';
  if(p.mana<power.cost)return '마나가 부족합니다.';
  if((p.heroForm==='jaraxxus'||!p.shadowformLevel&&(p.heroClass==='shaman'||p.heroClass==='paladin'))&&p.board.length>=RULES.maxBoard)return '전장은 최대 7개 하수인입니다.';
  if(!p.heroForm&&!p.shadowformLevel&&p.heroClass==='shaman'){
    const e=power.effects[0];if(e.kind==='summonUniqueRandom'&&e.cardIds.every(id=>p.board.some(m=>m.cardId===id)))return '이미 모든 종류의 토템이 있습니다.';
  }
}

export function canAttackMinion(m:Minion,catalog:Catalog):boolean {
  const d=catalog[m.cardId];return m.health>0&&m.attack>0&&m.attacksRemaining>0&&m.frozenThroughTurn===undefined&&(m.silenced||d?.kind!=='minion'||!d.noAttack);
}
export function canAttackHero(p:PublicPlayer):boolean {
  return p.heroAttacksRemaining>0&&p.heroAttack+(p.weapon?.attack??0)>0&&p.heroFrozenThroughTurn===undefined;
}

/** Only the player's public view is used. No opponent hand or deck is needed. */
export function legalPublicTargets(view:PlayerView,seat:PlayerId,rule:TargetRule,catalog:Catalog,spellOrPower=false):Target[] {
  const targets:Target[]=[];
  for(const owner of [seat,other(seat)]){
    const p=owner===seat?view.self:view.opponent;
    if(!(owner!==seat&&p.heroImmuneThisTurn)&&targetMatchesRule(rule,seat,owner,undefined,catalog,spellOrPower,p.heroForm))targets.push({kind:'hero',player:owner});
    for(const m of p.board)if(m.health>0&&targetMatchesRule(rule,seat,owner,m,catalog,spellOrPower))targets.push({kind:'minion',instanceId:m.instanceId});
  }
  return targets;
}
export function publicAttackTargets(view:PlayerView,seat:PlayerId):Target[] {
  const visible=view.opponent.board.filter(m=>m.health>0&&!hasKeyword(m,'stealth')&&!m.immuneThisTurn);
  const guards=visible.filter(m=>hasKeyword(m,'taunt'));
  return [...(guards.length||view.opponent.heroImmuneThisTurn?[]:[{kind:'hero' as const,player:other(seat)}]),...(guards.length?guards:visible).map(m=>({kind:'minion' as const,instanceId:m.instanceId}))];
}
export function sameTarget(a:Target,b:Target):boolean {
  return a.kind==='hero'?b.kind==='hero'&&a.player===b.player:b.kind==='minion'&&a.instanceId===b.instanceId;
}
export function publicCardCost(view:PlayerView,seat:PlayerId,card:Card,catalog:Catalog,discount?:number):number {
  return currentCost(card,catalog,seat,seat===0?[view.self.board,view.opponent.board]:[view.opponent.board,view.self.board],view.self.weapon,discount,view.self.nextSecretFree,view.self.minionsPlayedThisTurn,view.self);
}

export function cardChoiceReason(view:PlayerView,seat:PlayerId,card:Card,catalog:Catalog,choice?:number):string|undefined {
  if(card.kind==='spell'){
    const effects=choice===undefined?card.effects:card.choices?.[choice]?.effects;
    const requirement=spellRequirementReason(effects,view.self,view.opponent);if(requirement)return requirement;
    const rule=effectiveTargetRule(card,view.self.cardsPlayedThisTurn>0,choice);
    if(rule&&!legalPublicTargets(view,seat,rule,catalog,true).length)return '선택할 수 있는 효과 대상이 없습니다.';
  }
}
export function publicCardReason(view:PlayerView,seat:PlayerId,instance:CardInstance,catalog:Catalog):string|undefined {
  const card=catalog[instance.cardId];if(!card)return '카드 정의가 없습니다.';
  if(publicCardCost(view,seat,card,catalog,instance.costDiscount)>view.self.mana)return '마나가 부족합니다.';
  if(card.kind==='minion'&&view.self.board.length>=RULES.maxBoard)return '전장은 최대 7개 하수인입니다.';
  if(card.kind==='secret'){
    if(view.self.secrets.length>=RULES.maxSecrets)return '비밀은 최대 5개입니다.';
    if(view.self.secrets.some(c=>c.cardId===card.id))return '같은 비밀은 동시에 사용할 수 없습니다.';
  }
  if(card.kind==='spell'&&card.choices){if(card.choices.every((_,i)=>cardChoiceReason(view,seat,card,catalog,i)))return '사용할 수 있는 선택 효과가 없습니다.';}
  else if(card.kind==='spell')return cardChoiceReason(view,seat,card,catalog);
}
