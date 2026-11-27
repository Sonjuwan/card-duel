import { applyAction,createGame,getPlayerView,HERO_CLASSES,practiceDeck,starterDeck,strategicDeck,rankBotActions,RuleError } from '../../packages/engine/src/index.ts';
import type { BotDifficulty,BotWeights,Catalog,GameState,HeroClass,PlayerId,DeckStyle,Deck,PlayerView,Action } from '../../packages/engine/src/index.ts';
import {createTrainingScenarios,variedCatalog} from './ai-training-scenarios.ts';
import type {OpponentTag,ScenarioOptions} from './ai-training-scenarios.ts';
import { inferOpponentStrategy, mixInitialResearchWeights, mixResearchWeights } from './research-models.ts';
import type { BotOptions } from '../../packages/engine/src/index.ts';
import type { InferenceMode, ResearchWeightRow } from './research-models.ts';
import type { ResearchStrategy } from '../../packages/engine/src/deck-strategies.ts';
export interface TrainingJob {
  seed:number; classes:[HeroClass,HeroClass]; styles:[boolean,boolean]; firstPlayer:PlayerId; candidateSeat:PlayerId;
  candidate:BotWeights; opponent:BotWeights; nodes:number; level:BotDifficulty;
  candidateStrategy?: ResearchStrategy;
  fixedDecks?: [Deck, Deck];
  archetypes?:[DeckStyle,DeckStyle];deckSeeds?:[number,number];environmentSeed?:number;opponentTag?:OpponentTag;
  /** Pin the transformation algorithm so future versions can preserve paired jobs. */
  variantVersion?:1;
  /** Missing means the previous policy; saved unfinished trials never silently change. */
  policyVersion?:BotOptions['policyVersion'];
  opponentPolicyVersion?:BotOptions['policyVersion'];
  /** Role-based rows. Their mixture uses public evidence, regardless of the trial label. */
  researchRows?: { candidate: ResearchWeightRow; opponent?: ResearchWeightRow };
}
export interface TrainingResult {score:number; moves:number; turns:number; truncated:boolean; opponentEstimate?: Record<ResearchStrategy, number>; focusExposure?: { seen: boolean; played: boolean };}
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
export interface TrainingMatchOptions {
  observeDecision?: (view: PlayerView, actor: PlayerId) => void;
  candidateInference?: InferenceMode;
  focusCard?: string;
  reuseDecisions?: Map<string, Action[]>;
  opponentResearch?: { strategy: ResearchStrategy; inference: InferenceMode };
}

export function playTrainingMatch(catalog:Catalog,job:TrainingJob,options?: TrainingMatchOptions):TrainingResult{
  const environment=job.environmentSeed===undefined?catalog:variedCatalog(catalog,job.environmentSeed,job.variantVersion);
  const decks=job.fixedDecks??job.classes.map((c,i)=>job.archetypes?strategicDeck(environment,c,job.archetypes[i],job.deckSeeds?.[i]??job.seed):job.styles[i]?practiceDeck(environment,c):starterDeck(environment,c)) as [ReturnType<typeof practiceDeck>,ReturnType<typeof practiceDeck>];
  let s=createGame(environment,decks,{seed:job.seed,firstPlayer:job.firstPlayer}),moves=0,lastTurn=-1,turnActions=0;
  const focusExposure = options?.focusCard === undefined ? undefined : { seen: false, played: false };
  let opponentEstimate: TrainingResult['opponentEstimate'];
  while(s.phase!=='finished'&&moves<600){
    const actor:PlayerId=s.phase==='mulligan'?(s.players[0].mulliganDone?1:0):s.activePlayer;
    if(lastTurn!==s.turn){lastTurn=s.turn;turnActions=0;}
    const view = getPlayerView(s, actor);
    options?.observeDecision?.(view, actor);
    const focusedCard = focusExposure && actor === job.candidateSeat
      ? view.self.hand.find(card => card.cardId === options?.focusCard) : undefined;
    if (focusedCard && focusExposure) focusExposure.seen = true;
    const isCandidate = actor === job.candidateSeat;
    const row = isCandidate ? job.researchRows?.candidate : job.researchRows?.opponent;
    let weights = job.opponent;
    if (row) {
      weights = mixResearchWeights(row, inferOpponentStrategy(view, actor, s.catalog));
    } else if (isCandidate) {
      weights = job.candidate;
      if (job.candidateStrategy !== undefined) {
        opponentEstimate = inferOpponentStrategy(view, actor, s.catalog, options?.candidateInference);
        weights = mixInitialResearchWeights(job.candidateStrategy, opponentEstimate);
      }
    } else if (options?.opponentResearch) {
      const { strategy, inference } = options.opponentResearch;
      weights = mixInitialResearchWeights(strategy, inferOpponentStrategy(view, actor, s.catalog, inference));
    }
    let actions: Action[];
    if (turnActions >= 40 && s.phase === 'playing' && !s.pendingChoice) {
      actions = [{ type: 'endTurn' }];
    } else {
      const settings: BotOptions = { weights, nodeLimit: job.nodes, responseLimit: job.level === 25 ? 2 : 0,
        policyVersion: (isCandidate ? job.policyVersion : job.opponentPolicyVersion ?? job.policyVersion) ?? 1 };
      const cache = options?.reuseDecisions;
      if (cache) {
        // Ranking consumes the projected state and resolved weights. History
        // has already been accounted for by the strategy estimator.
        const { history: _, ...position } = view;
        const key = JSON.stringify([position, actor, job.level, settings]);
        const cached = cache.get(key);
        actions = cached ?? rankBotActions(view, s.catalog, actor, job.level, settings);
        if (cached === undefined) cache.set(key, actions);
      } else actions = rankBotActions(view, s.catalog, actor, job.level, settings);
    }
    let after:GameState|undefined;
    for(const action of actions){
      try {
        after=applyAction(s,actor,action);
        if (focusExposure && focusedCard && action.type === 'playCard' && view.self.hand.some(card =>
          card.instanceId === action.instanceId && card.cardId === options?.focusCard)) focusExposure.played = true;
        break;
      } catch(e) {if(!(e instanceof RuleError))throw e;}
    }
    if(!after)throw Error('Training: no legal action at move '+moves);
    s=after;moves++;turnActions++;
  }
  return{score:s.phase!=='finished'||s.winner===null?.5:s.winner===job.candidateSeat?1:0,moves,turns:s.turn,truncated:s.phase!=='finished',...(opponentEstimate ? { opponentEstimate } : {}),...(focusExposure ? { focusExposure } : {})};
}
