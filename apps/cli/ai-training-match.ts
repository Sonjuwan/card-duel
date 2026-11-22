import { applyAction,createGame,getPlayerView,HERO_CLASSES,practiceDeck,starterDeck,strategicDeck,rankBotActions,RuleError } from '../../packages/engine/src/index.ts';
import type { BotDifficulty,BotWeights,Catalog,GameState,HeroClass,PlayerId,DeckStyle } from '../../packages/engine/src/index.ts';
import {createTrainingScenarios,variedCatalog} from './ai-training-scenarios.ts';
import type {OpponentTag,ScenarioOptions} from './ai-training-scenarios.ts';
export interface TrainingJob {
  seed:number; classes:[HeroClass,HeroClass]; styles:[boolean,boolean]; firstPlayer:PlayerId; candidateSeat:PlayerId;
  candidate:BotWeights; opponent:BotWeights; nodes:number; level:BotDifficulty;
  archetypes?:[DeckStyle,DeckStyle];deckSeeds?:[number,number];environmentSeed?:number;opponentTag?:OpponentTag;
  /** Pin the transformation algorithm so future versions can preserve paired jobs. */
  variantVersion?:1;
  /** Missing means the previous policy; saved unfinished trials never silently change. */
  policyVersion?:1|2;
}
export interface TrainingResult {score:number; moves:number; turns:number; truncated:boolean;}
export function pairedJobs(seed:number,pairs:number,candidate:BotWeights,opponent:BotWeights,nodes:number,level:BotDifficulty,scenarios?:ScenarioOptions):TrainingJob[]{
  let random=seed>>>0;
  const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random;};
  const jobs:TrainingJob[]=[],config=scenarios?createTrainingScenarios(scenarios,pairs,seed^0x35ab32):undefined;
  for(let i=0;i<pairs;i++){
    const classes:[HeroClass,HeroClass]=[HERO_CLASSES[(i+seed)%9],HERO_CLASSES[next()%9]];
    const scenario=config?.[i];
    const job={seed:next(),classes,styles:[i%4!==0,i%5!==0] as [boolean,boolean],firstPlayer:(i%2) as PlayerId,candidate,nodes,level,...scenario,opponent:scenario?.opponent??opponent};
    jobs.push({...job,candidateSeat:0},{...job,candidateSeat:1});
  }
  return jobs;
}
export function playTrainingMatch(catalog:Catalog,job:TrainingJob):TrainingResult{
  const environment=job.environmentSeed===undefined?catalog:variedCatalog(catalog,job.environmentSeed,job.variantVersion);
  const decks=job.classes.map((c,i)=>job.archetypes?strategicDeck(environment,c,job.archetypes[i],job.deckSeeds?.[i]??job.seed):job.styles[i]?practiceDeck(environment,c):starterDeck(environment,c)) as [ReturnType<typeof practiceDeck>,ReturnType<typeof practiceDeck>];
  let s=createGame(environment,decks,{seed:job.seed,firstPlayer:job.firstPlayer}),moves=0,lastTurn=-1,turnActions=0;
  while(s.phase!=='finished'&&moves<600){
    const actor:PlayerId=s.phase==='mulligan'?(s.players[0].mulliganDone?1:0):s.activePlayer;
    if(lastTurn!==s.turn){lastTurn=s.turn;turnActions=0;}
    const actions=turnActions>=40&&s.phase==='playing'&&!s.pendingChoice?[{type:'endTurn'} as const]:rankBotActions(getPlayerView(s,actor),s.catalog,actor,job.level,{weights:actor===job.candidateSeat?job.candidate:job.opponent,nodeLimit:job.nodes,responseLimit:job.level===25?2:0,policyVersion:job.policyVersion??1});
    let after:GameState|undefined;
    for(const action of actions){try{after=applyAction(s,actor,action);break;}catch(e){if(!(e instanceof RuleError))throw e;}}
    if(!after)throw Error('Training: no legal action at move '+moves);
    s=after;moves++;turnActions++;
  }
  return{score:s.phase!=='finished'||s.winner===null?.5:s.winner===job.candidateSeat?1:0,moves,turns:s.turn,truncated:s.phase!=='finished'};
}
