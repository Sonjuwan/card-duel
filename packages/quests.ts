import definitions from '../data/quests/catalog.json' with {type:'json'};
import {HERO_CLASSES,HERO_POWERS,HERO_TOKENS,maxCardCopies,RULES} from './engine/src/index.ts';
import type {Card,Catalog,Effect,HeroClass,TargetRule} from './engine/src/types.ts';
import {QUEST_SLOTS} from './quest-types.ts';
import type {ActiveQuest,CompletedQuest,QuestCounters,QuestDefinition,QuestMetric,QuestProgress,QuestSlot} from './quest-types.ts';

export const QUEST_DEFINITIONS=definitions as readonly QuestDefinition[];
const counters=new Set<string>(QUEST_DEFINITIONS.map(q=>q.metric));
const strategyTotals=new Set<string>(QUEST_DEFINITIONS.flatMap(q=>q.strategy?[q.strategy]:[]));

export function printedQuestMetrics(card:Card):QuestMetric[]{
  const metrics:QuestMetric[]=[];
  if(card.cost<=2)metrics.push('cheapCards');
  if(card.kind==='secret')metrics.push('secrets');
  if(card.kind==='spell'){metrics.push('spells');if(card.cost>=7)metrics.push('spell7');}
  if(card.kind!=='minion')return metrics;
  if(card.cost>=1&&card.cost<=2)metrics.push('minion12');
  if(card.cost>=1&&card.cost<=3)metrics.push('minion13');
  if(card.cost>=3&&card.cost<=4)metrics.push('minion34');
  if(card.cost>=5&&card.cost<=6)metrics.push('minion56');
  if(card.cost>=6)metrics.push('minion6');
  if(card.cost>=7)metrics.push('minion7');
  if(card.cost>=8)metrics.push('minion8');
  if(card.attack>=5)metrics.push('attack5');
  if(card.attack>=6)metrics.push('attack6');
  if(card.health>=6)metrics.push('health6');
  if(card.keywords?.includes('charge'))metrics.push('charge');
  if(card.keywords?.includes('taunt'))metrics.push('taunt');
  if(card.keywords?.includes('divineShield'))metrics.push('shield');
  if(card.keywords?.includes('stealth'))metrics.push('stealth');
  if(card.keywords?.includes('windfury'))metrics.push('windfury');
  if(card.battlecry?.length)metrics.push('battlecry');
  if(card.deathrattle?.length)metrics.push('deathrattle');
  return metrics;
}

const allyMinionTargets=new Set(['friendlyMinions','otherFriendlyMinions','allMinions','allCharacters','otherCharacters','friendlyCharacters','randomFriendlyMinion','randomOtherFriendlyMinion','randomDamagedFriendlyCharacter','randomDamagedCharacter','randomMinion','otherMinions','self','adjacent','chosenAndAdjacent']);
const enemyMinionTargets=new Set(['enemyMinions','enemyCharacters','allMinions','allCharacters','otherMinions','otherCharacters','randomEnemy','randomEnemyMinion','randomLowAttackEnemyMinion','randomMinion','randomOtherMinion','chosenAndAdjacent']);
const areaTargets=new Set(['enemyMinions','enemyCharacters','allMinions','allCharacters','otherMinions','otherCharacters','chosenAndAdjacent']);
const damageKinds=new Set(['damage','damageDistinct','damageSplash','damageFromHeroAttack','damageFromArmor','missiles','weaponBurst','betrayal','sacrificeBlast','drawCostDamage','reflectDamage']);
function effectMetrics(e:Effect,rule:TargetRule|undefined,card:Card|undefined,lookup:(id:string)=>Card|undefined):QuestMetric[]{
  const metrics:QuestMetric[]=[];
  const target='target' in e?e.target:undefined;
  const chosen=target==='chosen',enemyRule=!!rule&&(rule.startsWith('enemy')||rule.includes('Enemy'));
  const friendlyRule=!!rule&&(rule.startsWith('friendly')||rule.includes('Friendly'));
  const canAllyMinion=(chosen&&!enemyRule&&rule!=='anyHero')||!!target&&allyMinionTargets.has(target);
  const canEnemyMinion=(chosen&&!friendlyRule&&rule!=='anyHero')||!!target&&enemyMinionTargets.has(target);
  const damage=damageKinds.has(e.kind);
  if(damage){
    if(card?.kind==='spell')metrics.push('spellDamage');
    if(!card)metrics.push('powerDamage');
    if(canAllyMinion)metrics.push('allyDamage');
    if(target==='friendlyHero'||target==='allCharacters'||target==='friendlyCharacters'||chosen&&!enemyRule&&!rule?.includes('Minion'))metrics.push('selfDamage');
    if(target==='enemyHero'||target==='enemyCharacters'||target==='allCharacters'||chosen&&!friendlyRule&&!rule?.includes('Minion')||e.kind==='missiles'||e.kind==='reflectDamage')metrics.push('heroDamage','earlyDamage');
  }
  const canKill=canEnemyMinion&&(damage||e.kind==='destroy'||e.kind==='deferredDestroy')||
    ['brawl','damageDistinct','damageSplash','missiles','weaponBurst','betrayal','sacrificeBlast'].includes(e.kind);
  if(canKill){
    metrics.push('kills');
    if(card?.kind==='spell')metrics.push('spellKills');
    if(!!target&&areaTargets.has(target)||['brawl','damageDistinct','damageSplash','sacrificeBlast','weaponBurst'].includes(e.kind))metrics.push('areaKills');
  }
  if((e.kind==='heal'||e.kind==='healFull')&&(canAllyMinion||target==='friendlyHero'))metrics.push('heal');
  if((e.kind==='heal'||e.kind==='healFull')&&canAllyMinion)metrics.push('minionHeal');
  if((e.kind==='buff'||e.kind==='temporaryAttack'||e.kind==='multiplyHealth'||e.kind==='doubleAttack'||e.kind==='setStats'||e.kind==='giveKeyword')&&canAllyMinion){
    metrics.push('buff');
    if(e.kind==='multiplyHealth'||e.kind==='buff'&&e.health>0||e.kind==='setStats'&&e.health!==undefined)metrics.push('healthBuff');
    if(e.kind==='giveKeyword'&&e.keyword==='divineShield')metrics.push('shieldGain');
  }
  if(e.kind==='freeze'&&(canEnemyMinion||target==='enemyHero'||target==='allCharacters'))metrics.push('freeze');
  if(e.kind==='silence')metrics.push('silence');
  if(e.kind==='armor')metrics.push('armor');
  if(e.kind==='overload')metrics.push('overload');
  if(e.kind==='gainMana'||e.kind==='gainCrystal'&&e.side!=='enemy')metrics.push('mana');
  if(e.kind==='discountNextSpell'||e.kind==='nextSecretFree'||e.kind==='drawDiscounted'||e.kind==='bounce'&&!!e.discount)metrics.push('discount');
  if(e.kind==='equip'||e.kind==='buffWeapon'&&e.equipIfMissing)metrics.push('weaponAttacks','weaponDamage');
  if(e.kind==='draw'&&e.side!=='enemy'||['drawTribe','drawDiscounted','drawCostDamage'].includes(e.kind))metrics.push('draw');
  const summons=e.kind==='summon'&&e.side!=='enemy'?[e.cardId]:e.kind==='summonRandom'||e.kind==='summonUniqueRandom'?e.cardIds:[];
  for(const id of summons){const token=lookup(id);if(token?.kind==='minion')metrics.push(...summonMetrics(token));}
  if(e.condition?.kind==='combo'||e.kind==='damage'&&!!e.bonusIfCombo)metrics.push('combo');
  return metrics;
}
export function summonMetrics(card:Extract<Card,{kind:'minion'}>):QuestMetric[]{
  const metrics:QuestMetric[]=['summons'];
  if(card.tribe==='totem')metrics.push('totems');
  if(card.tribe==='beast')metrics.push('beasts');
  if(card.tribe==='demon')metrics.push('demons');
  if(card.id==='__squire'||card.id==='silver_hand_recruit')metrics.push('recruits');
  if(card.keywords?.includes('divineShield'))metrics.push('shieldGain');
  return metrics;
}
function cardCapabilities(card:Card,lookup:(id:string)=>Card|undefined){
  const result=new Set(printedQuestMetrics(card));
  const add=(effects:readonly Effect[]|undefined,rule?:TargetRule)=>{for(const effect of effects??[])for(const m of effectMetrics(effect,rule,card,lookup))result.add(m);};
  if(card.kind==='spell'||card.kind==='secret'||card.kind==='coin')add(card.effects,card.kind==='spell'?card.targetRule:undefined);
  if(card.kind==='weapon'){
    result.add('weaponDamage');result.add('weaponAttacks');add(card.battlecry,card.targetRule);add(card.beforeAttack);add(card.friendlySummon);
  }
  if(card.kind==='minion'){
    for(const m of summonMetrics(card))result.add(m);
    if(card.attack>0){
      for(const m of ['heroDamage','earlyDamage','faceAttacks','minionKills','kills'] as const)result.add(m);
      if(card.tribe==='beast')result.add('beastAttacks');
      if(card.freezeOnCombatDamage)result.add('freeze');
    }
    if(card.costAuras?.some(a=>a.amount<0)||card.discountBy||card.discountByWeaponAttack)result.add('discount');
    if(card.auras?.length){result.add('buff');if(card.auras.some(a=>a.health>0))result.add('healthBuff');}
    add(card.battlecry,card.targetRule);
    for(const effects of [card.startTurn,card.endTurn,card.endAnyTurn,card.deathrattle])add(effects);
    for(const trigger of card.triggers??[])add(trigger.effects);
  }
  if((card.kind==='spell'||card.kind==='minion')&&card.choices?.length){
    result.add('choose');for(const choice of card.choices)add(choice.effects,choice.targetRule);
  }
  return result;
}

const capabilityCache=new WeakMap<Catalog,Map<string,Set<QuestMetric>>>();
export function questCandidates(catalog:Catalog,owned:ReadonlySet<string>,hero:HeroClass):QuestDefinition[]{
  const usable=Object.values(catalog).filter(c=>c.kind!=='coin'&&owned.has(c.id)&&(c.class==='neutral'||c.class===hero)&&maxCardCopies(c)>0);
  if(usable.reduce((n,c)=>n+maxCardCopies(c),0)<RULES.deckSize)return [];
  let capabilities=capabilityCache.get(catalog);
  if(!capabilities){capabilities=new Map();capabilityCache.set(catalog,capabilities);}
  const lookup=(id:string)=>catalog[id]??HERO_TOKENS.find(token=>token.id===id);
  const power=HERO_POWERS[hero],repeatable=new Set(power.effects.flatMap(e=>effectMetrics(e,power.targetRule,undefined,lookup)));
  const counts=new Map<QuestMetric,{kinds:number;copies:number}>();
  for(const card of usable){
    let metrics=capabilities.get(card.id);
    if(!metrics){metrics=cardCapabilities(card,lookup);capabilities.set(card.id,metrics);}
    for(const metric of metrics){
      const count=counts.get(metric)??{kinds:0,copies:0};count.kinds++;count.copies+=maxCardCopies(card);counts.set(metric,count);
    }
  }
  return QUEST_DEFINITIONS.filter(q=>{
    if(!q.enabled||q.hero!==null&&q.hero!==hero)return false;
    if(q.metric==='games'||q.metric==='draw'||q.metric==='power'||repeatable.has(q.metric))return true;
    const count=counts.get(q.metric),large=q.metric==='minion7'||q.metric==='minion8'||q.metric==='spell7';
    return !!count&&count.kinds>=(q.minKinds??(large?3:2))&&count.copies>=(q.minCopies??(large?4:3));
  });
}
const tally=(counts:Record<string,number>,key:string)=>{counts[key]=(counts[key]??0)+1;};

export function initialQuests(legacyGames:number,legacyLength:number):QuestProgress {
  return {schema:1,basicCompleted:Math.floor(legacyGames/legacyLength),serial:0,active:{},games:{},issued:{},completed:{},recent:{}};
}
export function fillQuests(state:QuestProgress,catalog:Catalog,ownedCards:readonly string[],legacyOffset=0):QuestProgress {
  if(QUEST_SLOTS.every(slot=>state.active[slot]))return state;
  const next=structuredClone(state),owned=new Set(ownedCards);
  const candidates=HERO_CLASSES.flatMap(hero=>questCandidates(catalog,owned,hero).map(def=>({hero,def})));
  for(const slot of QUEST_SLOTS){
    if(next.active[slot])continue;
    let options=candidates.filter(({def,hero})=>def.slot===slot&&(slot!=='basic'||hero===HERO_CLASSES[next.basicCompleted%HERO_CLASSES.length]));
    if(!options.length)continue;
    const existing=Object.values(next.active),recent=next.recent[slot];
    const prefer=(predicate:(item:typeof options[number])=>boolean)=>{const filtered=options.filter(predicate);if(filtered.length)options=filtered;};
    prefer(({hero,def})=>existing.every(q=>q.hero!==hero&&q.metric!==def.metric)&&hero!==recent?.hero&&def.metric!==recent?.metric);
    prefer(({hero})=>existing.every(q=>q.hero!==hero));
    prefer(({def})=>existing.every(q=>q.metric!==def.metric)&&def.metric!==recent?.metric);
    prefer(({hero})=>hero!==recent?.hero);
    const score=({hero,def}:typeof options[number])=>{
      const key=slot+':'+hero;
      return (next.issued[key]??0)*100+(next.completed[key]??0)*10+
        Math.min(30,next.games[hero]??0)+(next.issued[slot+':'+def.metric]??0)*45+
        (def.strategy?(next.issued['strategy:'+def.strategy]??0)*14:0);
    };
    options.sort((a,b)=>score(a)-score(b)||
      (HERO_CLASSES.indexOf(a.hero)+9-next.serial%9)%9-(HERO_CLASSES.indexOf(b.hero)+9-next.serial%9)%9||
      a.def.id.localeCompare(b.def.id));
    const {hero,def}=options[0],progress=slot==='basic'?Math.min(legacyOffset,def.target-1):0;
    next.active[slot]={id:`quest-${++next.serial}`,definitionId:def.id,hero,metric:def.metric,title:def.title,unit:def.unit,target:def.target,xp:def.xp,progress};
    next.recent[slot]={hero,metric:def.metric};
    tally(next.issued,slot+':'+hero);tally(next.issued,slot+':'+def.metric);
    if(def.strategy)tally(next.issued,'strategy:'+def.strategy);
  }
  return next;
}

export function advanceQuests(state:QuestProgress,hero:HeroClass,metrics:QuestCounters) {
  const next=structuredClone(state),completed:CompletedQuest[]=[];
  let advanced=false,basicAdvanced=false;
  next.games[hero]=(next.games[hero]??0)+1;
  for(const slot of QUEST_SLOTS){
    const q=next.active[slot];
    if(!q||q.hero!==hero)continue;
    const increase=slot==='basic'?1:metrics[q.metric]??0;
    if(increase<=0)continue;
    advanced=true;basicAdvanced ||= slot==='basic';
    q.progress=Math.min(q.target,q.progress+increase);
    if(q.progress===q.target){
      completed.push({...q,rewarded:true});delete next.active[slot];tally(next.completed,slot+':'+hero);
      if(slot==='basic')next.basicCompleted++;
    }
  }
  return {state:next,completed,advanced,basicAdvanced,xp:completed.reduce((n,q)=>n+q.xp,0)};
}

const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x:unknown,min=0,max=Number.MAX_SAFE_INTEGER):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=min&&x<=max;
const heroValid=(x:unknown)=>HERO_CLASSES.some(h=>x===h);
const slotValid=(x:string)=>QUEST_SLOTS.some(slot=>x===slot);
const validTally=(x:unknown,key:(k:string)=>boolean)=>object(x)&&Object.entries(x).every(([k,v])=>key(k)&&int(v));
const tallyKey=(key:string)=>{
  const [slot,kind,extra]=key.split(':');
  return !extra&&(slot==='strategy'?strategyTotals.has(kind):slotValid(slot)&&(heroValid(kind)||counters.has(kind)));
};
export function validQuestCounters(x:unknown):x is QuestCounters{
  return validTally(x,k=>counters.has(k))&&Object.values(x as Record<string,unknown>).every(v=>int(v,0,1_000_000));
}
export function validQuestProgress(x:unknown):x is QuestProgress{
  return object(x)&&x.schema===1&&int(x.basicCompleted)&&int(x.serial)&&validTally(x.games,heroValid)&&
    validTally(x.issued,tallyKey)&&validTally(x.completed,tallyKey)&&object(x.recent)&&
    Object.entries(x.recent).every(([slot,q])=>slotValid(slot)&&object(q)&&heroValid(q.hero)&&typeof q.metric==='string'&&counters.has(q.metric))&&
    object(x.active)&&Object.entries(x.active).every(([slot,q])=>slotValid(slot)&&object(q)&&typeof q.id==='string'&&/^quest-[1-9]\d*$/.test(q.id)&&
      Number(q.id.slice(6))<=Number(x.serial)&&typeof q.definitionId==='string'&&q.definitionId.length<=80&&heroValid(q.hero)&&
      typeof q.metric==='string'&&counters.has(q.metric)&&typeof q.title==='string'&&q.title.length<=160&&typeof q.unit==='string'&&
      int(q.target,1,100000)&&int(q.progress,0,q.target-1)&&int(q.xp,0,100000));
}
