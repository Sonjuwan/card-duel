import type {Card,Catalog,Deck,Effect,HeroClass,Tribe} from './types.ts';
import {deckCards,starterDeck} from './decks.ts';
import {practiceDeck,legendaryPracticeDeck} from './practice-decks.ts';
import {validateDeck} from './engine.ts';
import {maxCardCopies,TRIBES} from './rules.ts';

export const DECK_STYLES=['starter','practice','aggression','control','synergy','combo','legendary'] as const;
export type DeckStyle=typeof DECK_STYLES[number];
export const RESEARCH_STRATEGIES = ['aggro', 'midrange', 'control', 'big-deck'] as const;
export type ResearchStrategy = typeof RESEARCH_STRATEGIES[number];
export type CardRole={tempo:number;reach:number;removal:number;draw:number;sustain:number;synergy:number;value:number;};
const empty=():CardRole=>({tempo:0,reach:0,removal:0,draw:0,sustain:0,synergy:0,value:0});
function add(dst:CardRole,src:CardRole,scale=1){for(const k of Object.keys(dst) as (keyof CardRole)[])dst[k]+=src[k]*scale;return dst;}
const offensive=(target:string)=>!['self','friendlyHero','friendlyMinions','otherFriendlyMinions','friendlyCharacters','adjacent'].includes(target);
const area=(target:string)=>['allMinions','allCharacters','otherMinions','otherCharacters','enemyMinions','enemyCharacters'].includes(target);
/** Data-driven roles, not IDs or original card prices. All new cards use the
 * same analysis and simulated action rules. Scores are heuristic, not labels
 * asserted by the game. */
export function effectRoles(e:Effect,catalog:Catalog):CardRole{
  const r=empty();
  switch(e.kind){
    case 'damage':if(offensive(e.target)){r.removal=e.amount*(area(e.target)?1.8:.75);r.reach=e.target.includes('Minion')?0:e.amount*.6;}break;
    case 'missiles':case 'damageDistinct':r.removal=e.amount*e.count*.65;r.reach=e.amount*e.count*.30;break;
    case 'damageSplash':r.removal=e.amount+e.splash*1.5;r.reach=e.amount*.5;break;
    case 'damageFromHeroAttack':case 'damageFromArmor':case 'weaponBurst':case 'betrayal':case 'sacrificeBlast':case 'drawCostDamage':r.removal=3;r.synergy=1;break;
    case 'destroy':case 'transform':case 'randomTransform':case 'control':case 'temporaryControl':if(offensive(e.target))r.removal=area(e.target)?7:3.5;break;
    case 'brawl':r.removal=7;break;
    case 'bounce':case 'freeze':case 'silence':case 'deferredDestroy':if(offensive(e.target))r.removal=area(e.target)?4:1.8;break;
    case 'setStats':r.removal=1.3;r.synergy=.7;break;
    case 'heal':r.sustain=e.amount*(area(e.target)?1.4:.6);break;
    case 'healFull':r.sustain=4;break;
    case 'armor':r.sustain=e.amount*.7;break;
    case 'heroImmuneThisTurn':case 'protectMinionsThisTurn':case 'immuneThisTurn':r.sustain=1.5;break;
    case 'draw':case 'drawDiscounted':if(!('side'in e)||e.side!=='enemy')r.draw=e.amount*1.1;break;
    case 'drawTribe':case 'chooseTopDeck':case 'copyEnemyCard':r.draw=e.count*.8;r.synergy=.7;break;
    case 'addCard':case 'addRandomCard':if(e.side!=='enemy'){r.draw=e.count*.9;r.value=e.count*.5;}break;
    case 'addCardNextTurn':case 'copySpellToOther':r.value=.7;break;
    case 'summon':{const c=catalog[e.cardId];if(e.side!=='enemy'&&c?.kind==='minion')r.tempo=(c.attack+c.health)*e.count*.45;break;}
    case 'summonRandom':case 'summonUniqueRandom':{const values=e.cardIds.map(id=>catalog[id]).filter(c=>c?.kind==='minion');r.tempo=values.reduce((sum,c)=>sum+(c.kind==='minion'?c.attack+c.health:0),0)/Math.max(1,values.length)*.6;break;}
    case 'summonEnemyDeckMinion':case 'copyChosenMinion':case 'reviveEventMinion':r.tempo=3;r.value=1;break;
    case 'buff':r.tempo=(e.attack+e.health)*.6*(area(e.target)||e.target.includes('Minions')?1.5:1);r.synergy=1+(e.per?1:0);break;
    case 'temporaryAttack':case 'heroAttack':r.reach=e.amount*.8;r.tempo=e.amount*.3;break;
    case 'doubleAttack':case 'giveKeyword':case 'grantDeathrattleSummon':case 'grantSpellDamage':case 'multiplyHealth':case 'drawOnAttack':case 'attackToHealth':r.synergy=2;r.value=1;break;
    case 'gainCrystal':case 'gainMana':case 'discountNextSpell':r.tempo=e.amount*.65;r.synergy=1.2;break;
    case 'equip':r.tempo=e.attack*e.durability*.35;r.reach=e.attack*.8;break;
    case 'buffWeapon':r.synergy=2;r.tempo=e.attack+e.durability*.6;break;
    case 'replaceHero':r.value=6;r.sustain=3;break;
    case 'enemyFreeSpellsNextTurn':r.value=-2;break;
    case 'discard':if(e.amount>0)r.value=-.65*Math.min(4,e.amount);break;
    case 'destroyEnemyWeaponDraw':r.removal=2;r.draw=1.5;break;
    case 'overload':r.tempo=-.4*e.amount;break;
    case 'cancelEvent':case 'destroyEnemySecrets':case 'destroyWeapon':case 'damageWeapon':r.removal=1.3;break;
    case 'consumeAdjacent':case 'consumeDivineShields':case 'swapHandMinion':case 'shadowform':r.synergy=2;break;
  }
  if(e.condition)add(r,r,-.4);
  return r;
}
export function cardRoles(c:Card,catalog:Catalog):CardRole{
  const r=empty();
  const list=(effects:Effect[]|undefined,scale=1)=>{for(const e of effects??[])add(r,effectRoles(e,catalog),scale);};
  if(c.kind==='minion'){
    r.tempo+=(c.attack*.9+c.health*.7)*.6;r.value+=(c.health*.3+c.attack*.2);
    if(c.noAttack)r.tempo-=c.attack*.45;
    if(c.keywords?.includes('charge'))r.reach+=c.attack*.8;
    if(c.keywords?.includes('taunt'))r.sustain+=c.health*.45;
    if(c.keywords?.includes('windfury'))r.reach+=c.attack*.5;
    if(c.keywords?.includes('divineShield'))r.tempo+=1.3;
    if(c.keywords?.includes('poisonous'))r.removal+=1.3;
    if(c.auras?.length||c.triggers?.length||c.spellDamage||c.spellAndPowerMultiplier||c.attackPerOtherTribe||c.chargeAuraTribe||c.costAuras?.length)r.synergy+=2;
    list(c.battlecry);list(c.deathrattle,.8);list(c.startTurn,1.05);list(c.endTurn,1.1);list(c.endAnyTurn,1.4);
    for(const t of c.triggers??[])list(t.effects,.65);
  }else if(c.kind==='weapon'){
    r.tempo+=c.attack*c.durability*.55;r.reach+=c.attack*.8;r.removal+=c.attack*.6;list(c.battlecry);list(c.beforeAttack,.7);list(c.friendlySummon,.6);
  }else if(c.kind==='secret'){list(c.effects,.8);r.tempo+=.5;}
  else list(c.effects);
  if((c.kind==='minion'||c.kind==='spell')&&c.choices?.length)for(const option of c.choices)list(option.effects,1/c.choices.length);
  return r;
}
const configs={
  midrange:{curve:[0,4,7,7,6,4,2],minions:23,roles:{tempo:1.45,reach:.35,removal:.65,draw:.35,sustain:.25,synergy:.45,value:.55}},
  bigDeck:{curve:[0,3,5,4,3,4,11],minions:19,roles:{tempo:.7,reach:.2,removal:.8,draw:.55,sustain:1,synergy:.25,value:1.35}},
  aggression:{curve:[1,8,10,7,3,1,0],minions:20,roles:{tempo:1.3,reach:1.1,removal:.3,draw:.25,sustain:.1,synergy:.3,value:.15}},
  control:{curve:[0,3,5,5,6,4,7],minions:14,roles:{tempo:.55,reach:.25,removal:1.1,draw:.9,sustain:.8,synergy:.2,value:.9}},
  synergy:{curve:[0,5,8,7,5,2,3],minions:20,roles:{tempo:.85,reach:.4,removal:.4,draw:.5,sustain:.2,synergy:1.3,value:.4}},
  combo:{curve:[1,5,7,7,4,3,3],minions:13,roles:{tempo:.65,reach:.9,removal:.4,draw:1, sustain:.25,synergy:1.4,value:.5}}
} satisfies Record<string,{curve:number[];minions:number;roles:CardRole}>;
function seeded(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
/** Deterministic, legal but varied deck construction. Curve, actual stats,
 * declared effects, class/tribe synergies and seeded taste drive every slot.
 * The output is a regular deck, so validation and gameplay stay identical. */
export function strategicDeck(catalog:Catalog,heroClass:HeroClass,style:DeckStyle,seed=0):Deck{
  if(style==='starter')return starterDeck(catalog,heroClass);
  if(style==='practice')return practiceDeck(catalog,heroClass);
  if(style==='legendary')return legendaryPracticeDeck(catalog,heroClass);
  return buildStrategyDeck(catalog,heroClass,style,seed);
}

export function researchDeck(catalog: Catalog, heroClass: HeroClass, strategy: ResearchStrategy): Deck {
  const styles = {aggro: 'aggression', midrange: 'midrange', control: 'control', 'big-deck': 'bigDeck'} as const;
  return buildStrategyDeck(catalog, heroClass, styles[strategy], 0);
}

function buildStrategyDeck(catalog: Catalog, heroClass: HeroClass, style: keyof typeof configs, seed: number): Deck {
  const cfg=configs[style],rng=seeded(seed),pool=deckCards(catalog,heroClass);
  const role=new Map(pool.map(c=>[c.id,cardRoles(c,catalog)]));
  const preferredTribes=TRIBES.filter(t=>t!=='none').map(t=>({t,score:pool.filter(c=>c.kind==='minion'&&c.tribe===t).length*.15+pool.filter(c=>c.kind==='minion'&&c.class===heroClass&&(c.tribe===t||c.auras?.some(a=>a.tribe===t)||c.chargeAuraTribe===t)).length*1.1+rng()*3})).sort((a,b)=>b.score-a.score);
  const tribe:Tribe=preferredTribes[0]?.t??'none';
  const jitter=new Map(pool.map(c=>[c.id,(rng()-.5)*2.5]));
  const cards:string[]=[],counts=new Map<string,number>(),curve=Array<number>(7).fill(0);let minions=0,weapons=0;
  while(cards.length<30){
    let best:typeof pool[number]|undefined,bestScore=-Infinity;
    for(const c of pool){
      const count=counts.get(c.id)??0;if(count>=maxCardCopies(c))continue;
      const bucket=Math.min(6,c.cost),want=cfg.curve[bucket],r=role.get(c.id)!;
      const quality=(Object.keys(r) as (keyof CardRole)[]).reduce((sum,key)=>sum+r[key]*cfg.roles[key],0)/(Math.max(1,c.cost)+.8);
      const scarcity=(want-curve[bucket])*1.35-(want===0?4:0);
      const boardNeed=(cfg.minions-minions)-(cfg.minions/30)*(30-cards.length);
      const minionScore=c.kind==='minion'?Math.min(4,boardNeed*.6):Math.max(-5,-boardNeed*.6);
      const tribal=style==='synergy'&&c.kind==='minion'?(c.tribe===tribe?2.3:0)+(c.auras?.some(a=>a.tribe===tribe)||c.chargeAuraTribe===tribe||c.attackPerOtherTribe?.tribe===tribe?2.5:0):0;
      const largeMinion = style === 'bigDeck' && c.kind === 'minion' && c.cost >= 6
        ? .32 * (c.attack + c.health) + .5 * (c.cost - 6) : 0;
      const score=largeMinion+quality*2+scarcity+minionScore+tribal+(c.class===heroClass?.7:0)+(jitter.get(c.id)??0)-count*1.8-(c.kind==='weapon'?Math.max(0,weapons-2)*2:0);
      if(score>bestScore){bestScore=score;best=c;}
    }
    if(!best)throw Error('Not enough collectible cards for strategic deck');
    cards.push(best.id);counts.set(best.id,(counts.get(best.id)??0)+1);curve[Math.min(6,best.cost)]++;
    minions+=Number(best.kind==='minion');weapons+=Number(best.kind==='weapon');
  }
  const deck={heroClass,cards};validateDeck(deck,catalog);return deck;
}
