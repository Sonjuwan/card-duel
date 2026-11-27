import { applyAction, applySpeculativeAction, RuleError } from './engine.ts';
import { visibleCounterattack } from './bot-counterattack.ts';
import { candidates } from './simulate.ts';
import { copySimulationData } from './simulation-copy.ts';
import { snapshotBattleCatalog } from './catalog-snapshot.ts';
import type { Action, CardInstance, Catalog, GameState, HeroClass, Player, PlayerId, PlayerView, PublicPlayer } from './types.ts';
import { botSearchConfig, DEFAULT_BOT_WEIGHTS } from './bot-profile.ts';
import type { BotOptions, BotWeights } from './bot-profile.ts';
import { practiceDeck } from './practice-decks.ts';
import {cardRoles} from './deck-strategies.ts';

export const BOT_DIFFICULTIES=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25] as const;
export type BotDifficulty=typeof BOT_DIFFICULTIES[number];
export const BOT_DIFFICULTY_NAMES:Record<BotDifficulty,string>={1:'입문',2:'쉬움',3:'보통',4:'어려움',5:'전문가',6:'전술 I',7:'전술 II',8:'전술 III',9:'전술 IV',10:'정예 I',11:'정예 II',12:'정예 III',13:'정예 IV',14:'마스터 I',15:'마스터 II',16:'마스터 III',17:'마스터 IV',18:'그랜드마스터 I',19:'그랜드마스터 II',20:'그랜드마스터 III',21:'그랜드마스터 IV',22:'챔피언 I',23:'챔피언 II',24:'챔피언 III',25:'최강 · 학습형'};
export function isBotDifficulty(value:unknown):value is BotDifficulty{
  return typeof value==='number'&&BOT_DIFFICULTIES.includes(value as BotDifficulty);
}

/** Build a hypothetical position using only information visible to the bot.
 * Unknown cards are deliberately represented by placeholders; the actual shuffled
 * decks, enemy secrets, and server RNG are never passed to the decision function. */
export function projectBotPosition(view:PlayerView,catalog:Catalog,actor:PlayerId):GameState{
  const placeholder=Object.values(catalog).find(c=>c.kind==='minion'&&c.collectible!==false)?.id;
  if(!placeholder)throw new Error('AI requires a collectible minion');
  const unknown=(count:number,label:string):CardInstance[]=>Array.from({length:count},(_,i)=>({instanceId:`__bot_${label}_${i}`,cardId:placeholder}));
  const player=(p:PublicPlayer,side:string,hand:CardInstance[],secrets:CardInstance[]):Player=>({
    heroClass:p.heroClass,health:p.health,armor:p.armor,mana:p.mana,maxMana:p.maxMana,heroAttack:p.heroAttack,
    heroAttacksRemaining:p.heroAttacksRemaining,heroAttacksMadeThisTurn:p.heroAttacksMadeThisTurn,heroImmuneThisTurn:p.heroImmuneThisTurn,shadowformLevel:p.shadowformLevel,heroForm:p.heroForm,maxHealth:p.maxHealth,freeSpellsThisTurn:p.freeSpellsThisTurn,freeSpellsNextTurn:p.freeSpellsNextTurn,nextSpellDiscount:p.nextSpellDiscount,heroPowerUsed:p.heroPowerUsed,protectMinionsThisTurn:p.protectMinionsThisTurn,heroFrozenThroughTurn:p.heroFrozenThroughTurn,
    pendingOverload:p.pendingOverload,lockedMana:p.lockedMana,cardsPlayedThisTurn:p.cardsPlayedThisTurn,minionsPlayedThisTurn:p.minionsPlayedThisTurn,nextSecretFree:p.nextSecretFree,weapon:p.weapon,
    fatigue:p.fatigue,board:p.board,mulliganDone:p.mulliganDone,hand,secrets,deck:unknown(p.deckCount,`${side}_deck`),
  });
  const own=player(view.self,'own',view.self.hand,view.self.secrets);
  const enemy=player(view.opponent,'enemy',unknown(view.opponent.handCount,'enemy_hand'),[]);
  return {...structuredClone({phase:view.phase,firstPlayer:view.firstPlayer,activePlayer:view.activePlayer,turn:view.turn,
    players:actor===0?[own,enemy]:[enemy,own] as [Player,Player],winner:view.winner,reason:view.reason,rng:(view.revision*2654435761)>>>0,
    nextId:1000000,nextEntryOrder:1+Math.max(0,...[...own.board,...enemy.board].map(m=>m.enteredOrder??0)),revision:view.revision,history:[]}),catalog:snapshotBattleCatalog(catalog)} as GameState;
}

function value(s:GameState,actor:PlayerId,advanced=false):number{
  if(s.phase==='finished')return s.winner===actor?100000:s.winner===null?0:-100000;
  const side=(p:Player)=>{
    const hp=p.health+p.armor;
    const survival=hp*.8-Math.max(0,12-hp)*.6-Math.max(0,5-hp)*1.8;
    const board=p.board.reduce((n,m)=>{
      const c=s.catalog[m.cardId];
      const abilities=c?.kind==='minion'&&!m.silenced?((c.spellDamage??0)*.8+(c.deathrattle?.length??0)*.65+(c.triggers?.length??0)*.65+(c.auras?.length??0)*.6+(c.freezeOnCombatDamage?.valueOf()?0.65:0)):0;
      return n+1.1+m.attack*1.05+m.health*.73+abilities+(m.keywords??[]).reduce((a,k)=>a+({taunt:.65,charge:.2,divineShield:1.5,windfury:m.attack*.60,stealth:.55,poisonous:1.1}[k]??0),0)-(m.frozenThroughTurn===undefined?0:.55);
    },0);
    const weapon=p.weapon?p.weapon.attack*(.8+.65*p.weapon.durability):0;
    return survival+board+weapon+p.hand.length*1.45+p.secrets.length*1.75+p.maxMana*.8-p.pendingOverload*.65-p.fatigue*.3;
  };
  const own=s.players[actor],enemy=s.players[(1-actor) as PlayerId];
  // Estimate pressure on each hero from public board and weapon only.
  const danger=(p:Player,against:Player)=>{
    const guard=p.board.filter(m=>m.keywords?.includes('taunt')&&!m.keywords?.includes('stealth')).reduce((n,m)=>n+m.health+(m.keywords?.includes('divineShield')?2:0),0);
    const pressure=Math.max(0,against.board.reduce((n,m)=>n+(m.frozenThroughTurn===undefined?m.attack*(m.keywords?.includes('windfury')?2:1):0),0)+(against.weapon?.attack??0)-guard);
    return Math.max(0,pressure-(p.health+p.armor)*.55)*1.2+Math.max(0,pressure-p.health-p.armor+1)*2;
  };
  return side(own)-side(enemy)+(advanced?danger(enemy,own)-danger(own,enemy):0);
}

type Evaluated={action:Action;score:number;result:GameState};
function options(s:GameState,actor:PlayerId,advanced:boolean):Action[]{
  const list=candidates(s,actor),p=s.players[actor];
  if(!advanced||s.phase!=='playing')return list;
  const adjacentAura=(cardId:string)=>{const c=s.catalog[cardId];return c.kind==='minion'&&c.auras?.some(a=>a.target==='adjacentFriendlyMinions');};
  const hasAdjacent=p.board.some(m=>!m.silenced&&adjacentAura(m.cardId));
  return list.flatMap(action=>{
    if(action.type!=='playCard'||action.position===undefined)return [action];
    const c=s.catalog[p.hand.find(h=>h.instanceId===action.instanceId)!.cardId];
    if(c.kind!=='minion'||!(hasAdjacent||adjacentAura(c.id)||c.battlecry?.some(e=>'target' in e&&e.target==='adjacent')||c.choices?.some(ch=>ch.effects.some(e=>'target' in e&&e.target==='adjacent'))))return [action];
    return Array.from({length:p.board.length+1},(_,position)=>({...action,position}));
  });
}
function evaluate(s:GameState,actor:PlayerId,advanced:boolean,actions:Action[]):Evaluated[]{
  const baseline=value(s,actor,advanced),p=s.players[actor],ranked:Evaluated[]=[];
  for(const action of actions){
    try{
      const result=applyAction(s,actor,action),after=result.players[actor];
      let score=value(result,actor,advanced)-baseline;
      if(action.type==='playCard'){
        const card=s.catalog[p.hand.find(h=>h.instanceId===action.instanceId)!.cardId];
        if(result.pendingChoice?.owner===actor)score+=1.65; // One available card, not hidden deck contents.
        if(after.mana>p.mana&&after.hand.some(h=>s.catalog[h.cardId].cost>p.mana&&s.catalog[h.cardId].cost<=after.mana))score+=2.3;
        if(card.kind==='minion')score+=.35;
      }
      if(action.type==='heroPower')score+=.1;
      ranked.push({action,score,result});
    }catch(e){if(!(e instanceof RuleError))throw e;}
  }
  return ranked.sort((a,b)=>b.score-a.score);
}
// Reproducible variation independent of the real game RNG and hidden cards.
function randomFor(view:PlayerView,actor:PlayerId){
  let seed=(Math.imul(view.revision+1,0x9e3779b1)^Math.imul(view.turn+1,0x85ebca6b)^actor)>>>0;
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
const persistentValues=new WeakMap<Catalog,Map<string,number>>();
/** Evaluate ongoing effects generically from the active balance snapshot.
 * No hard-coded card names or knowledge of the real opponent's cards. */
function persistentValue(catalog:Catalog,id:string):number{
  let cache=persistentValues.get(catalog);if(!cache){cache=new Map();persistentValues.set(catalog,cache);}
  const found=cache.get(id);if(found!==undefined)return found;
  const card=catalog[id];if(card?.kind!=='minion')return 0;
  const ongoing=cardRoles({...card,attack:0,health:1,keywords:[],battlecry:undefined,choices:undefined},catalog);
  const estimate=Math.min(10,Math.max(0,ongoing.tempo*.72+ongoing.draw*.85+ongoing.removal*.65+ongoing.value*.5+ongoing.sustain*.35+ongoing.reach*.75+ongoing.synergy*.25-.6));
  cache.set(id,estimate);return estimate;
}
function weightedValue(s:GameState,actor:PlayerId,w:Readonly<BotWeights>,adaptive=false):number{
  if(s.phase==='finished')return s.winner===actor?100000:s.winner===null?0:-100000;
  const side=(p:Player,own:boolean)=>{
    const hp=p.health+p.armor;
    let score=hp*w.health-Math.max(0,15-hp)*w.lowHealth-Math.max(0,7-hp)*w.criticalHealth;
    for(const m of p.board){
      const c=s.catalog[m.cardId],d=c?.kind==='minion'&&!m.silenced?c:undefined;
      const ability=d?((d.spellDamage??0)*.8+(d.deathrattle?.length??0)*.75+(d.triggers?.length??0)*.9+(d.auras?.length??0)*.8+(d.freezeOnCombatDamage?.valueOf()?1:0)+(d.enrageAttack??0)*.2+(adaptive?persistentValue(s.catalog,d.id)+(d.spellAndPowerMultiplier??1)-1:0)):0;
      const keys=(m.keywords??[]).reduce((a,k)=>a+({taunt:.9,charge:.15,divineShield:1.8,windfury:Math.max(.6,m.attack*.65),stealth:.75,poisonous:1.4}[k]??0),0);
      score+=w.body+m.attack*w.attack+m.health*w.durability+ability*w.ability+keys*w.keyword-(m.frozenThroughTurn===undefined?0:Math.max(.5,m.attack*.35));
      // No-attack bodies still absorb buffs and trade damage, but don't
      // contribute lane pressure until their effect is removed.
      if(d?.noAttack)score-=m.attack*w.attack*(adaptive?1:.70);
      if(m.attacksRemaining>0&&m.frozenThroughTurn===undefined)score+=m.attack*w.initiative;
    }
    if(p.weapon)score+=p.weapon.attack*(.75+p.weapon.durability*.64)*w.weapon;
    score+=p.hand.length*w.hand+p.secrets.length*w.secret+p.maxMana*w.mana-p.pendingOverload*w.overload-p.fatigue*w.fatigue;
    if(own)for(const h of p.hand)if(!h.instanceId.startsWith('__bot_')){
      const c=s.catalog[h.cardId];if(c)score+=w.handQuality*(Math.min(5,c.cost)*.22+(c.kind==='minion'?Math.min(5,c.attack+c.health)*.16:c.kind==='spell'?1:0));
    }
    return score;
  };
  const own=s.players[actor],enemy=s.players[(1-actor) as PlayerId];
  const threat=(p:Player,against:Player)=>{
    const guard=p.board.filter(m=>m.keywords?.includes('taunt')&&!m.keywords?.includes('stealth')).reduce((n,m)=>n+m.health+(m.keywords?.includes('divineShield')?2:0),0);
    const raw=against.board.reduce((n,m)=>{const c=s.catalog[m.cardId];return n+(m.frozenThroughTurn===undefined&&!(c?.kind==='minion'&&c.noAttack&&!m.silenced)?m.attack*(m.keywords?.includes('windfury')?2:1):0);},0)+(against.weapon?.attack??0)+(against.heroAttack??0);
    const pressure=Math.max(0,raw-guard),hp=p.health+p.armor;
    return (Math.max(0,pressure-hp*.5)*1.15+Math.max(0,pressure-hp+1)*2.8)*w.pressure;
  };
  return side(own,true)-side(enemy,false)+threat(enemy,own)-threat(own,enemy)+w.face*(30-enemy.health)+w.trade*(own.board.length-enemy.board.length);
}
type SearchNode={state:GameState;first:Action;value:number;bonus:number;rank:number;path?:Action[];counterattack?:boolean};
function stateKey(s:GameState):string{
  return JSON.stringify([s.phase,s.activePlayer,s.winner,s.players.map(p=>[p.health,p.armor,p.mana,p.heroAttack,p.heroAttacksRemaining,p.heroPowerUsed,p.pendingOverload,p.cardsPlayedThisTurn,p.weapon,p.hand.map(h=>h.cardId+':'+(h.costDiscount??0)).sort(),p.secrets.map(h=>h.cardId).sort(),p.board.map(m=>[m.cardId,m.attack,m.health,m.maxHealth,m.attacksRemaining,m.frozenThroughTurn,m.silenced,[...m.keywords??[]].sort()]),p.deck.length])]);
}
function stateKeyV2(s:GameState):string{
  const cardKey=({cardId,costDiscount}:CardInstance)=>[cardId,costDiscount??0];
  return JSON.stringify([s.phase,s.activePlayer,s.winner,s.rng,s.pendingChoice?.cards.map(cardKey),s.players.map(({hand,deck,secrets,board,...publicState})=>[publicState,hand.map(cardKey),deck.map(cardKey),secrets.map(cardKey),board.map(({instanceId,...rest})=>rest)])]);
}
function optimizedOptions(s:GameState,actor:PlayerId):Action[]{
  const own=s.players[actor],enemy=s.players[(1-actor) as PlayerId];
  const taunts=new Set(enemy.board.filter(m=>m.keywords?.includes('taunt')&&!m.keywords?.includes('stealth')).map(m=>m.instanceId));
  const seen=new Set<string>();
  return options(s,actor,true).filter(a=>{
    if((a.type==='attack'||a.type==='heroAttack')&&taunts.size>0&&(a.target.kind!=='minion'||!taunts.has(a.target.instanceId)))return false;
    if(a.type==='playCard'){
      const h=own.hand.find(x=>x.instanceId===a.instanceId);if(!h)return false;
      const key=JSON.stringify([h.cardId,h.costDiscount,a.position,a.choice,a.target]);
      if(seen.has(key))return false;seen.add(key);
    }
    return true;
  });
}
function actionBonus(s:GameState,a:Action,actor:PlayerId):number{
  if(a.type==='playCard'){
    const card=s.catalog[s.players[actor].hand.find(h=>h.instanceId===a.instanceId)?.cardId??''];
    return card?.kind==='minion' ? .10 : card?.kind==='coin' ? -.12 : 0;
  }
  return a.type==='heroPower' ? .06 : 0;
}
function legalResult(s:GameState,actor:PlayerId,a:Action):GameState|null{
  // Combat history is output-only. Speculative nodes don't need to copy their
  // ancestors' messages on every engine transition.
  try{return applySpeculativeAction(s.history.length ? {...s,history:[]} : s,actor,a);}catch(e){if(e instanceof RuleError)return null;throw e;}
}
/** Sample a plausible opponent hand from its public class only. No actual
 * enemy hand/deck/secret or server random state can enter this function. */
const sampledDecks = new WeakMap<Catalog, Map<HeroClass, readonly string[]>>();
function sampleOpponent(s:GameState,actor:PlayerId,salt:number,pairedRevision=s.revision):GameState{
  const {catalog,...dynamic}=s,n={...copySimulationData(dynamic),catalog} as GameState,enemy=(1-actor) as PlayerId,p=n.players[enemy];
  let byHero = sampledDecks.get(catalog);
  if (!byHero) {
    byHero = new Map();
    sampledDecks.set(catalog, byHero);
  }
  let deck = byHero.get(p.heroClass);
  if (!deck) {
    deck = practiceDeck(catalog, p.heroClass).cards;
    byHero.set(p.heroClass, deck);
  }
  const cards = deck;
  let seed=(Math.imul(pairedRevision+1,2654435761)^salt)>>>0;
  const pick=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return cards[seed%cards.length];};
  p.hand=p.hand.map(h=>h.instanceId.startsWith('__bot_')?{...h,cardId:pick()}:h);
  p.deck=p.deck.map(h=>({...h,cardId:pick()}));return n;
}
function enemyResponse(s:GameState,actor:PlayerId,w:Readonly<BotWeights>,limit:number,salt:number,expired:()=>boolean,adaptive=false,pairedRevision?:number):number{
  if(s.phase==='finished'||s.pendingChoice||expired())return 0;
  let n=sampleOpponent(s,actor,salt,pairedRevision);const enemy=(1-actor) as PlayerId;
  // Experimental policy 3 compares passing with already-ended candidates
  // without attempting a second endTurn (which would incorrectly imply zero risk).
  if(pairedRevision===undefined||n.activePlayer===actor){const turn=legalResult(n,actor,{type:'endTurn'});if(!turn)return 0;n=turn;}
  const before=weightedValue(n,actor,w,adaptive);
  let used=0;
  // A bounded adversarial rollout. It considers weapons, direct damage,
  // trades, removal and minion development, not just face pressure.
  for(let depth=0;depth<3&&!expired()&&n.phase==='playing'&&used<limit;depth++){
    const candidate=adaptive?optimizedOptions(n,enemy):options(n,enemy,true);let best:GameState|undefined,bestValue=weightedValue(n,actor,w,adaptive);
    for(const a of candidate){if(used++>=limit||expired())break;const r=legalResult(n,enemy,a);if(!r)continue;const v=weightedValue(r,actor,w,adaptive);if(v<bestValue-.03){bestValue=v;best=r;}}
    if(!best)break;n=best;
    if(n.phase==='finished'&&n.winner===enemy)return -100000;
  }
  return Math.min(0,weightedValue(n,actor,w,adaptive)-before);
}
function confirmsLethal(s:GameState,actor:PlayerId,path:Action[],secretCount:number,expired:()=>boolean):boolean{
  if(secretCount>0)return false;
  for(const salt of [0x7f4a1,0x32905,0x7dcaf2]){
    if(expired())return false;
    let n={...s,rng:(s.rng^salt)>>>0};
    for(const a of path){const r=legalResult(n,actor,a);if(!r)return false;n=r;}
    if(n.phase!=='finished'||n.winner!==actor)return false;
  }
  return true;
}
function visibleSecretRisk(s:GameState,actor:PlayerId,path:Action[],count:number,salt:number,w:Readonly<BotWeights>,expected:number):number{
  const enemy=(1-actor) as PlayerId,cls=s.players[enemy].heroClass;
  const pool=Object.values(s.catalog).filter(c=>c.kind==='secret'&&c.class===cls&&c.collectible!==false);
  if(!count||!pool.length)return 0;
  const {catalog,...dynamic}=s;let n={...structuredClone(dynamic),catalog} as GameState,seed=(s.revision^salt)>>>0;
  const available=[...pool];
  for(let i=0;i<Math.min(count,available.length);i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const card=available.splice(seed%available.length,1)[0];n.players[enemy].secrets.push({instanceId:'__bot_secret_'+i,cardId:card.id});}
  for(const action of path){const after=legalResult(n,actor,action);if(!after)break;n=after;if(n.phase==='finished')break;}
  // A guessed secret is uncertain, but estimated losses are relevant. A
  // speculative successful lethal is not an unlimited positive score.
  const actual=weightedValue(n,actor,w,true)+count*w.secret;
  return Math.max(-24,Math.min(0,actual-expected));
}
function strongSearch(view:PlayerView,s:GameState,actor:PlayerId,difficulty:BotDifficulty,settings:BotOptions):Action[]{
  const w=settings.weights??DEFAULT_BOT_WEIGHTS,config=botSearchConfig(difficulty),end:Action={type:'endTurn'};
  const policy=settings.policyVersion??(difficulty===25?2:1),adaptive=policy>=2,pairedRisk=policy===3||policy===4;
  const getOptions=(s:GameState)=>adaptive?optimizedOptions(s,actor):options(s,actor,true);
  const deadline=settings.deadlineMs===undefined?Infinity:performance.now()+Math.max(50,settings.deadlineMs);
  const starts=getOptions(s),rootLimit=Math.max(starts.length,settings.nodeLimit??config.nodes);
  const expired=()=>performance.now()>=deadline,known=new Set(view.self.hand.map(h=>h.instanceId));
  const guarded = policy === 4 || policy === 5;
  const finalistSchedule = guarded && settings.counterattackSchedule === 'finalists';
  const hybridSchedule = guarded && settings.counterattackSchedule === 'hybrid';
  const counterLimit = Math.max(48, Math.min(128, rootLimit));
  const reserve = Math.min(24, Math.floor(counterLimit / 4));
  const beamProofLimit = finalistSchedule ? reserve : hybridSchedule ? counterLimit - reserve : counterLimit;
  const evaluateCounter = guarded ? visibleCounterattack(actor, beamProofLimit, expired, settings.counterattackOrder) : undefined;
  const counterPenalty = 200000;
  const passLoses = evaluateCounter?.(s) ?? false;
  const base = weightedValue(s,actor,w,adaptive) - (passLoses ? counterPenalty : 0);
  const lineLoses = (next: GameState) => evaluateCounter !== undefined &&
    (next.phase === 'finished' ? next.winner === 1-actor : !finalistSchedule && next.rng === s.rng && evaluateCounter(next));
  const valueFor=(r:GameState,path:Action[]):number=>{
    if(adaptive&&r.phase==='finished'&&r.winner===actor&&(view.opponent.secretCount>0||r.rng!==s.rng&&!confirmsLethal(s,actor,path,view.opponent.secretCount,expired)))return base+16;
    return weightedValue(r,actor,w,adaptive);
  };
  let used=0,frontier:SearchNode[]=[],best=new Map<Action,SearchNode>(),seen=new Set<string>();
  for(const a of starts){
    // Real-time clients may have unusually many targets on a full board. A
    // partially evaluated legal root is better than blocking the entire game.
    if(used>0&&expired())break;
    const r=legalResult(s,actor,a);used++;if(!r)continue;
    const path=adaptive?[a]:[],bonus=actionBonus(s,a,actor),raw=valueFor(r,path)+bonus;
    if(r.phase==='finished'&&r.winner===actor&&(!adaptive||raw>90000))return[a,end];
    const counterattack=lineLoses(r), v=raw-(counterattack?counterPenalty:0);
    const node={state:r,first:a,value:v,bonus,rank:v,...(adaptive?{path}:{}),counterattack};best.set(a,node);
    if(r.phase==='playing'&&r.activePlayer===actor&&!r.pendingChoice)frontier.push(node);
  }
  const breadth=(nodes:SearchNode[])=>{
    nodes.sort((a,b)=>b.rank-a.rank);
    // Preserve root diversity rather than spending every branch on one trade.
    const counts=new Map<Action,number>(),result:SearchNode[]=[];
    for(const n of nodes){const key=adaptive?stateKeyV2(n.state):stateKey(n.state);if(seen.has(key)||(counts.get(n.first)??0)>=Math.max(2,Math.ceil(config.beam/3)))continue;seen.add(key);counts.set(n.first,(counts.get(n.first)??0)+1);result.push(n);if(result.length>=config.beam)break;}
    return result;
  };
  frontier=breadth(frontier);
  for(let depth=1;depth<config.depth&&frontier.length&&used<rootLimit&&!expired();depth++){
    const next:SearchNode[]=[];
    for(const node of frontier){
      for(const a of getOptions(node.state)){
        if(used>=rootLimit||expired())break;
        if(a.type==='playCard'&&!known.has(a.instanceId))continue;
        const r=legalResult(node.state,actor,a);used++;if(!r)continue;
        const path=adaptive?[...node.path??[],a]:[],bonus=node.bonus+actionBonus(node.state,a,actor),raw=valueFor(r,path)+bonus;
        if(r.phase==='finished'&&r.winner===actor&&(!adaptive||raw>90000))return[node.first,...[...best.keys()].filter(a=>a!==node.first),end];
        const counterattack=lineLoses(r), v=raw-(counterattack?counterPenalty:0);
        const child={state:r,first:node.first,value:v,bonus,rank:v+(30-r.players[(1-actor) as PlayerId].health)*.08,...(adaptive?{path}:{}),counterattack};
        if(v>(best.get(node.first)?.value??-Infinity))best.set(node.first,child);
        if(r.phase==='playing'&&r.activePlayer===actor&&!r.pendingChoice)next.push(child);
      }
      if(used>=rootLimit||expired())break;
    }
    frontier=breadth(next);
  }
  const ordered=[...best.values()].sort((a,b)=>b.value-a.value);
  if (finalistSchedule || hybridSchedule) {
    // Each root has one finalist. An early branch cannot spend the remaining
    // proof budget before another top-ranked action gets its own check.
    const finalists = ordered.filter(node => !node.counterattack && node.state.phase === 'playing' && !node.state.pendingChoice &&
      node.state.rng === s.rng).slice(0, finalistSchedule ? 6 : 3);
    const perRoot = Math.floor((counterLimit - beamProofLimit) / Math.max(1, finalists.length));
    for (const node of finalists) {
      if (expired()) break;
      const proven = visibleCounterattack(actor, perRoot, expired, settings.counterattackOrder)(node.state);
      if (proven) {
        node.counterattack = true;
        node.value -= counterPenalty;
        node.rank -= counterPenalty;
      }
    }
    ordered.sort((a, b) => b.value - a.value);
  }
  const rescue=passLoses&&ordered.some(node=>!node.counterattack);
  const ranked=rescue?ordered.filter(node=>!node.counterattack):ordered;
  const responses=Math.min(settings.responseLimit??config.responses,ranked.length);
  if(adaptive&&responses>0&&!expired()){
    const shortlist=ranked.slice(0,responses),cap=(x:number)=>Math.max(-14,x),sampleSalts=difficulty>=20?[43,991]:[43];
    const risk=(position:GameState)=>sampleSalts.reduce((sum,salt)=>sum+cap(enemyResponse(position,actor,w,config.responseNodes,salt,expired,true,pairedRisk?view.revision:undefined)),0)/sampleSalts.length;
    // Imperfect-information responses are estimates, not proof of a defeat.
    // Cap and centre the risk relative to passing so speculative enemy cards
    // cannot dominate guaranteed current-board improvements.
    const pass=risk(s),scores:SearchNode[]=[];
    for(const n of shortlist){if(expired())break;const change=risk(n.state)-pass;if(expired())break;
      const secretRisk=view.opponent.secretCount>0?sampleSalts.reduce((sum,salt)=>sum+visibleSecretRisk(s,actor,n.path??[n.first],view.opponent.secretCount,salt,w,n.value+(n.counterattack?counterPenalty:0)),0)/sampleSalts.length:0;
      scores.push({...n,rank:n.value+.28*change+.22*secretRisk});}
    if(scores.length===shortlist.length){scores.sort((a,b)=>b.rank-a.rank);const selected=scores.filter(x=>x.rank>base+.06&&x.value>base-.6);return [...selected.map(x=>x.first),...ranked.filter(x=>x.value>base+.06&&!selected.some(y=>y.first===x.first)).map(x=>x.first),end,...ranked.filter(x=>x.value<=base+.06&&!selected.some(y=>y.first===x.first)).map(x=>x.first)];}
  }
  if(responses>0&&!expired()){
    const shortlist=ranked.slice(0,responses),pass=enemyResponse(s,actor,w,config.responseNodes,43,expired);
    const reranked:SearchNode[]=[];
    for(const n of shortlist){
      if(expired())break;
      const risk=enemyResponse(n.state,actor,w,config.responseNodes,43,expired);
      if(expired())break;
      reranked.push({...n,rank:n.value+.62*risk});
    }
    // Do not compare fully assessed moves against zero-risk unfinished runs.
    if(reranked.length!==shortlist.length)return [...ranked.filter(x=>x.value>base+.06).map(x=>x.first),end,...ranked.filter(x=>x.value<=base+.06).map(x=>x.first)];
    reranked.sort((a,b)=>b.rank-a.rank);
    const threshold=base+.62*pass+.06;
    const selected=reranked.filter(x=>x.rank>threshold);
    return [...selected.map(x=>x.first),end,...ranked.filter(x=>!selected.some(y=>y.first===x.first)).map(x=>x.first)];
  }
  return [...ranked.filter(x=>x.value>base+.06).map(x=>x.first),end,...ranked.filter(x=>x.value<=base+.06).map(x=>x.first)];
}
/** Difficulty changes decisions, never resources or rules. The expert searches
 * two consecutive actions in a bounded beam, then replans after the real result. */
export function rankBotActions(view:PlayerView,catalog:Catalog,actor:PlayerId,difficulty:BotDifficulty=3,settings:BotOptions={}):Action[]{
  if(view.phase==='finished'||(view.phase==='playing'&&view.activePlayer!==actor))return[];
  if(!isBotDifficulty(difficulty))throw new Error('Invalid AI difficulty');
  catalog=snapshotBattleCatalog(catalog);
  if(view.choicePending){
    const cards=[...view.self.pendingChoice??[]];if(difficulty>=6)cards.sort((a,b)=>{
      const score=(id:string)=>{const c=catalog[id];return c?(c.cost<=view.self.mana?2:0)+(c.kind==='minion'?(c.attack+c.health)*.45:1.5)-c.cost*.15:0;};
      return score(b.cardId)-score(a.cardId);
    });
    return cards.map(c=>({type:'chooseDeckCard',instanceId:c.instanceId}));
  }
  const s=projectBotPosition(view,catalog,actor);
  const end:Action={type:'endTurn'};
  if(view.phase==='mulligan'){
    if(view.self.mulliganDone)return [];
    const threshold=difficulty===1?6:difficulty===2?5:difficulty>=4?3:4;
    const early=view.self.hand.some(h=>catalog[h.cardId].kind==='minion'&&catalog[h.cardId].cost<=2);
    return [{type:'mulligan',replace:view.self.hand.filter(h=>catalog[h.cardId].cost>=(difficulty>=6&&early?4:threshold)).map(h=>h.instanceId)}];
  }
  if(difficulty>=6)return strongSearch(view,s,actor,difficulty,settings);
  const advanced=difficulty>=4,ranked=evaluate(s,actor,advanced,options(s,actor,advanced));
  const positive=ranked.filter(x=>x.score>.15);
  const random=randomFor(view,actor);
  if(difficulty===1){
    // Beginner can overlook good moves or pass early, but won't choose
    // a visibly immediately losing move.
    const choices=ranked.filter(x=>(x.score>=-.75&&x.result.phase!=='finished')||(x.result.phase==='finished'&&x.result.winner===actor));
    for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
    const actions=choices.map(x=>x.action);
    return random()<.28?[end,...actions]:[...actions,end];
  }
  if(difficulty===2&&positive.length>1){
    const index=Math.min(positive.length-1,random()<.55?0:random()<.65?1:2);
    const [choice]=positive.splice(index,1);positive.unshift(choice);
  }
  if(difficulty===5){
    const win=ranked.find(x=>x.result.phase==='finished'&&x.result.winner===actor);
    if(win)return [win.action,...positive.filter(x=>x!==win).map(x=>x.action),end];
    const knownHand=new Set(view.self.hand.map(h=>h.instanceId));
    const first=ranked.filter(x=>x.result.phase==='playing').slice(0,6);
    const base=value(s,actor,true);
    const searched=first.map(x=>{
      const next=options(x.result,actor,true).filter(a=>a.type!=='playCard'||knownHand.has(a.instanceId));
      // Don't plan on playing a card drawn from the unknown deck.
      const follow=evaluate(x.result,actor,true,next)[0];
      const final=follow?.result;
      const wins=final?.phase==='finished'&&final.winner===actor;
      const improvement=follow?Math.max(0,value(follow.result,actor,true)-value(x.result,actor,true)):0;
      return {action:x.action,score:wins?1e6:value(x.result,actor,true)-base+.85*improvement+.1*x.score};
    }).filter(x=>x.score>.15).sort((a,b)=>b.score-a.score);
    return [...searched.map(x=>x.action),...positive.filter(x=>!searched.some(y=>y.action===x.action)).map(x=>x.action),end];
  }
  return [...positive.map(x=>x.action),end];
}
