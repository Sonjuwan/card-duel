import type { BattleVisualEvent, Card, HeroClass, PlayerId, PlayerView, Target } from '../../../packages/engine/src/index.ts';
import type { BattleAnimation } from '../../../packages/protocol.ts';
import { cardArtRecipe } from './local-art-model.ts';

export type FxTheme='steel'|'fire'|'ice'|'lightning'|'arcane'|'shadow'|'holy'|'nature'|'gold'|'dust';
export const FX_COLORS:Record<FxTheme,readonly [string,string,string]>={
  steel:['#ffffff','#ffd694','#c26d44'],fire:['#fff3af','#ff9d32','#da351c'],ice:['#ffffff','#71d8ff','#2078df'],
  lightning:['#fffbdc','#90d9ff','#797dff'],arcane:['#ffffff','#c38aff','#7536f2'],shadow:['#f1c5ff','#ad6be2','#451550'],
  holy:['#fffbd5','#ffdf61','#e7a731'],nature:['#efffc0','#a8e375','#318d48'],gold:['#fff9d1','#f6bc55','#aa6134'],dust:['#fff4ce','#d5b78b','#8d6346'],
};
const powerTheme:Record<HeroClass,FxTheme>={warrior:'steel',shaman:'lightning',rogue:'steel',paladin:'holy',hunter:'nature',druid:'nature',warlock:'shadow',mage:'fire',priest:'holy'};
export function animationTheme(animation:BattleAnimation,card?:Card,heroClass?:HeroClass):FxTheme{
  if(animation.kind==='attack'||animation.kind==='heroAttack'||animation.kind==='weapon')return 'steel';
  if(animation.kind==='summon')return 'dust';
  if(animation.kind==='secret')return 'shadow';
  if(animation.kind==='coin')return 'gold';
  if(animation.kind==='power')return heroClass?powerTheme[heroClass]:'arcane';
  if(!card)return 'arcane';
  const recipe=cardArtRecipe(card),effects=card.kind==='spell'?(card.choices?.[animation.choice??-1]?.effects??card.effects??[]):[];
  if(effects.some(e=>e.kind==='freeze')||recipe.subject==='ice'||recipe.theme==='frost')return 'ice';
  if(/lightning|storm|shock|thunder|overload/.test(card.id)||recipe.subject==='lightning')return 'lightning';
  if(effects.some(e=>e.kind==='heal'||e.kind==='healFull'))return 'holy';
  if(/pyro|fire|flame|lava|infernal|ember/.test(card.id)||recipe.subject==='fire'||recipe.subject==='fireball')return 'fire';
  if(recipe.theme==='abyss')return 'shadow';
  if(recipe.theme==='forest'||recipe.subject==='nature')return 'nature';
  if(recipe.theme==='gold'||recipe.subject==='holy')return 'holy';
  return recipe.theme==='steel'?'steel':'arcane';
}
export type ImpactKind='damage'|'heal'|'leave'|'summon'|'shield'|'buff'|'freeze'|'transform';
export interface FxImpact{target:Target;kind:ImpactKind;amount?:number;side:PlayerId;death?:boolean;}
const key=(target:Target)=>target.kind==='hero'?'h'+target.player:'m'+target.instanceId;
/** Derive actual results exclusively from public snapshots; a canceled or
 * redirected attack never invents damage, and hand/deck contents stay private. */
export function impactChanges(before:PlayerView,after:PlayerView,seat:PlayerId,events?:readonly BattleVisualEvent[]):FxImpact[]{
  const result:FxImpact[]=[],enemy:PlayerId=seat===0?1:0;
  const boards=[...before.self.board,...before.opponent.board],nextBoards=[...after.self.board,...after.opponent.board];
  const old=new Map(boards.map(m=>[m.instanceId,m])),next=new Map(nextBoards.map(m=>[m.instanceId,m]));
  for(const [side,prior,now] of [[seat,before.self,after.self],[enemy,before.opponent,after.opponent]] as const){
    const target:Target={kind:'hero',player:side},delta=now.health-prior.health+Math.min(0,now.armor-prior.armor);
    if(delta&&!events)result.push({side,target,kind:delta<0?'damage':'heal',amount:Math.abs(delta)});
    else if(now.armor>prior.armor)result.push({side,target,kind:'shield',amount:now.armor-prior.armor});
    for(const m of prior.board){
      const target:Target={kind:'minion',instanceId:m.instanceId},n=next.get(m.instanceId);
      if(!n){result.push({side,target,kind:'leave',...(events?{death:events.some(e=>e.kind==='death'&&key(e.target)===key(target))}:{})});continue;}
      if(m.cardId!==n.cardId){result.push({side,target,kind:'transform'});continue;}
      if(m.health!==n.health&&!events)result.push({side,target,kind:n.health<m.health?'damage':'heal',amount:Math.abs(n.health-m.health)});
      if(m.keywords?.includes('divineShield')&&!n.keywords?.includes('divineShield'))result.push({side,target,kind:'shield'});
      if(m.attack!==n.attack||m.maxHealth!==n.maxHealth)result.push({side,target,kind:'buff'});
      if(m.frozenThroughTurn===undefined&&n.frozenThroughTurn!==undefined)result.push({side,target,kind:'freeze'});
    }
    for(const m of now.board)if(!old.has(m.instanceId))result.push({side,target:{kind:'minion',instanceId:m.instanceId},kind:'summon'});
  }
  if(events){
    // Exact hits include overkill, retaliations, interrupted attacks and
    // damage/healing in the same transaction. Group repeated missiles on
    // one target for a readable impact number.
    const totals=new Map<string,FxImpact>();
    for(const e of events)if(e.kind==='damage'||e.kind==='heal'){
      const id=e.kind+key(e.target),existing=totals.get(id);
      if(existing)existing.amount=(existing.amount??0)+e.amount;
      else totals.set(id,{kind:e.kind,side:e.side,target:e.target,amount:e.amount});
    }else if(e.kind==='shield'&&!result.some(i=>i.kind==='shield'&&key(i.target)===key(e.target)))result.push({kind:'shield',side:e.side,target:e.target});
    result.push(...totals.values());
  }
  return result;
}
