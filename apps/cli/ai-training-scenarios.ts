import {createCatalog,DEFAULT_BOT_WEIGHTS,DECK_STYLES} from '../../packages/engine/src/index.ts';
import type {BotWeights,Catalog,DeckStyle,Effect,Card} from '../../packages/engine/src/index.ts';
import type {TrainingJob,TrainingResult} from './ai-training-match.ts';

export type OpponentTag='champion'|'league'|'baseline';
export interface LeagueOpponent{weights:BotWeights;tag:'league'|'baseline';}
export interface ScenarioOptions{stage:'screen'|'validate';league?:readonly LeagueOpponent[];diverse:boolean;}
export function createTrainingScenarios(options:ScenarioOptions,pairs:number,seed:number):Array<Partial<Pick<TrainingJob,'archetypes'|'deckSeeds'|'environmentSeed'|'opponentTag'|'opponent'|'variantVersion'>>>{
  let x=seed>>>0;const next=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x;};
  const league=options.league?.length?options.league:[{weights:{...DEFAULT_BOT_WEIGHTS},tag:'baseline' as const}];
  const style=():DeckStyle=>DECK_STYLES[next()%DECK_STYLES.length];
  return Array.from({length:pairs},(_,i)=>{
    // Canonical rules form at least half of each trial; variants are held
    // in memory and use fresh seeds for independent validation.
    const variant=options.diverse&&i%3===2;
    const historical=options.diverse&&i%4===3;
    const rival=historical?league[next()%league.length]:undefined;
    return {...(options.diverse?{archetypes:[style(),style()] as [DeckStyle,DeckStyle],deckSeeds:[next(),next()] as [number,number]}:{}),...(variant?{environmentSeed:next(),variantVersion:1 as const}:{}),opponentTag:rival?.tag??'champion',...(rival?{opponent:rival.weights}:{})};
  });
}
const variants=new WeakMap<Catalog,Map<number,Catalog>>();
/** Domain randomisation: train against plausible cost/stat/effect changes,
 * preserving card IDs and effect types. Never alter the source or disk files. */
export function variedCatalog(catalog:Catalog,seed:number,version:1=1):Catalog{
  if(version!==1)throw Error('Unsupported training balance variant');
  let cache=variants.get(catalog);if(!cache){cache=new Map();variants.set(catalog,cache);}
  const existing=cache.get(seed);if(existing)return existing;
  let x=seed>>>0;const next=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
  const effectLists=(c:Exclude<Card,{kind:'coin'}>):Effect[][]=>{
    if(c.kind==='minion')return [c.battlecry,c.deathrattle,c.startTurn,c.endTurn,c.endAnyTurn,...(c.triggers??[]).map(t=>t.effects),...(c.choices??[]).map(t=>t.effects)].filter((e):e is Effect[]=>!!e);
    if(c.kind==='spell')return [c.effects,...(c.choices??[]).map(t=>t.effects)].filter((e):e is Effect[]=>!!e);
    if(c.kind==='weapon')return [c.battlecry,c.beforeAttack,c.secretRevealed,c.friendlySummon].filter((e):e is Effect[]=>!!e);
    return [c.effects];
  };
  const changeEffect=(card:Exclude<Card,{kind:'coin'}>,change:number):boolean=>{
    const possible=effectLists(card).flat().filter(e=>['damage','heal','draw','buff','summon'].includes(e.kind));
    if(!possible.length)return false;
    const e=possible[Math.floor(next()*possible.length)];
    if(e.kind==='damage'||e.kind==='heal')e.amount=clamp(e.amount+change,1,e.kind==='damage'?(e.amountMax??100):100);
    else if(e.kind==='draw')e.amount=clamp(e.amount+change,1,10);
    else if(e.kind==='summon')e.count=clamp(e.count+change,1,e.countMax??7);
    else if(e.kind==='buff'){
      if(next()<.5)e.attack=clamp(e.attack+change,e.health===0?1:0,100);
      else e.health=clamp(e.health+change,e.attack===0?1:0,100);
    }else return false;
    return true;
  };
  const cards=Object.values(catalog).filter(c=>c.kind!=='coin').sort((a,b)=>a.id.localeCompare(b.id)).map(c=>{
    const n=structuredClone(c);
    if(n.collectible===false||next()>.24)return n;
    const change=next()<.5?-1:1;
    if(next()<.28&&changeEffect(n,change))return n;
    if(n.kind==='minion'&&next()<.55){
      if(next()<.5)n.attack=clamp(n.attack+change,0,100);
      else n.health=clamp(n.health+change,1,100);
    }else if(n.kind==='weapon'&&next()<.35)n.durability=clamp(n.durability+change,1,100);
    else n.cost=clamp(n.cost+change,0,n.kind==='minion'&&n.discountBy?30:10);
    return n;
  });
  const generated=createCatalog(cards);
  if(cache.size>=12)cache.delete(cache.keys().next().value!);
  cache.set(seed,generated);return generated;
}
type Score={score:number;games:number;rate:number;};
function summary(results:readonly TrainingResult[]):Score{
  const score=results.reduce((n,r)=>n+r.score,0);return{score,games:results.length,rate:results.length?score/results.length:.5};
}
/** One-sided exact sign probability of obtaining at least the observed number
 * of successful decisive paired seeds under equal strength. Tied pairs do
 * not contribute. This is a guard against lucky tiny aggregate differences,
 * not a guarantee of generalised human-level strength. */
export function pairedSignProbability(jobs:readonly TrainingJob[],results:readonly TrainingResult[]):number{
  let wins=0,losses=0;
  for(let i=0;i+1<results.length;i+=2){
    const a=jobs[i],b=jobs[i+1];
    if(a.seed!==b.seed||a.candidateSeat===b.candidateSeat)continue;
    const score=results[i].score+results[i+1].score;
    if(score>1)wins++;else if(score<1)losses++;
  }
  const n=wins+losses;
  if(!n)return 1;
  // Compute the tail stably without large binomial coefficients.
  let term=2**-n,probability=0;
  for(let k=0;k<=n;k++){if(k>=wins)probability+=term;term=term*(n-k)/(k+1);}
  return Math.min(1,probability);
}
export function evaluateTrainingTrial(stage:'screen'|'validate',jobs:readonly TrainingJob[],results:readonly TrainingResult[]){
  if(jobs.length!==results.length||!results.length)throw Error('Incomplete training evaluation');
  const total=summary(results),subset=(pred:(job:TrainingJob)=>boolean)=>summary(results.filter((_,i)=>pred(jobs[i])));
  const rival=subset(j=>j.opponentTag===undefined||j.opponentTag==='champion');
  const canonical=subset(j=>j.environmentSeed===undefined),variants=subset(j=>j.environmentSeed!==undefined),league=subset(j=>j.opponentTag!==undefined&&j.opponentTag!=='champion');
  const diverse=jobs.some(j=>j.archetypes!==undefined);
  const p=pairedSignProbability(jobs,results);
  const enoughEvidence=stage==='screen'||!diverse||results.length<16||p<=.10;
  const minimum=(s:Score,rate:number)=>s.games===0||s.rate>=rate;
  const pass=!results.some(r=>r.truncated)&&total.rate>=(stage==='screen'?.56:.60)&&(!diverse||minimum(rival,stage==='screen'?.5:.58)&&minimum(canonical,.5)&&minimum(variants,.5)&&minimum(league,.5)&&enoughEvidence);
  return{pass,total,rival,canonical,variants,league,pairedProbability:p};
}
