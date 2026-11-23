import {CardStore} from '../server/card-store.ts';
import {aiCatalogHash,readChampion,aiWeightFingerprint} from '../server/ai-profile-store.ts';
import {applyAction,createGame,getPlayerView,HERO_CLASSES,rankBotActions,RuleError,strategicDeck,isBotDifficulty,DECK_STYLES,DEFAULT_BOT_WEIGHTS} from '../../packages/engine/src/index.ts';
import type {PlayerId,BotDifficulty,Deck,GameState} from '../../packages/engine/src/index.ts';
import {pairedScoreStats} from './paired-benchmark-stats.ts';
import {decisionMixturePolicy,expertProbability,experimentalPolicy} from '../../packages/experimental-difficulty.ts';

const pairs=Math.max(1,Math.min(100,Math.floor(Number(process.argv[2])||4))),opponents=(process.argv[3]??'1,5,10,15,20,24').split(',').map(Number),seedOffset=Number(process.argv[4]??900),targetValue=Number(process.argv[5]??25);
if(!opponents.length||!opponents.every(isBotDifficulty)||new Set(opponents).size!==opponents.length||!Number.isSafeInteger(seedOffset)||seedOffset<0||!isBotDifficulty(targetValue))throw Error('Usage: benchmark:ladder -- <paired fixtures 1-100> <comma-separated levels> <nonnegative seed offset> [target level 1-25]');
const targetLevel:BotDifficulty=targetValue,experiment=process.argv[6]??'turn';
if(!['turn','decision'].includes(experiment))throw Error('Experiment must be turn or decision');
const {version,catalog}=new CardStore().read(),hash=aiCatalogHash(catalog),model=readChampion(hash),weights=model?.weights??DEFAULT_BOT_WEIGHTS;
const weightHash=aiWeightFingerprint(weights);

function play(decks:[Deck,Deck],seed:number,firstPlayer:PlayerId,level:BotDifficulty,targetSeat:PlayerId){
  let state=createGame(catalog,decks,{seed,firstPlayer}),moves=0,turn=-1,turnMoves=0,expert=0,beginner=0;
  const start=performance.now();
  while(state.phase!=='finished'&&moves<600){
    const actor:PlayerId=state.phase==='mulligan'?(state.players[0].mulliganDone?1:0):state.activePlayer;
    if(turn!==state.turn){turn=state.turn;turnMoves=0;}
    const view=getPlayerView(state,actor),cap=turnMoves>=40&&state.phase==='playing'&&!state.pendingChoice;
    const tier=actor===targetSeat?targetLevel:level,selected=experiment==='decision'?decisionMixturePolicy(tier,seed,actor,state.turn,state.revision):experimentalPolicy(tier,seed,actor,state.turn);
    if(actor!==targetSeat&&!cap){if(selected===25)expert++;else beginner++;}
    const actions=cap?[{type:'endTurn'} as const]:rankBotActions(view,state.catalog,actor,selected,{weights,policyVersion:selected===25?2:1});
    let next:GameState|undefined;for(const action of actions)try{next=applyAction(state,actor,action);break;}catch(e){if(!(e instanceof RuleError))throw e;}
    if(!next)throw Error('No legal experimental benchmark action');state=next;moves++;turnMoves++;
  }
  return {state,moves,expert,beginner,ms:performance.now()-start};
}
console.log(JSON.stringify({version,hash,weights:weightHash,pairs,seedOffset,target:targetLevel,experiment:`${experiment}-stable beginner/expert mixture (not production)`,method:`same decks, seed and first player within each swapped pair; fixed public turn/seed/seat${experiment==='decision'?'/revision':''} draw; expert probability (level-1)/24; original weight and card snapshot, no time deadline`}));
for(const level of opponents as BotDifficulty[]){
  let wins=0,losses=0,draws=0,capped=0,moves=0,expert=0,beginner=0,ms=0;
  const pairScores:[number,number][]=[];
  for(let i=0;i<pairs;i++){
    const seed=(70381+Math.imul(i+seedOffset,3167))>>>0,style1=DECK_STYLES[(i+seedOffset+2)%DECK_STYLES.length],style2=DECK_STYLES[(i+seedOffset+4)%DECK_STYLES.length];
    const decks:[Deck,Deck]=[strategicDeck(catalog,HERO_CLASSES[i%9],style1,seed),strategicDeck(catalog,HERO_CLASSES[(i*5+3)%9],style2,seed^4123)];
    const results:[number,number]=[0,0];
    for(const seat of [0,1] as const){const r=play(decks,seed,(i%2) as PlayerId,level,seat);moves+=r.moves;expert+=r.expert;beginner+=r.beginner;ms+=r.ms;
      if(r.state.phase!=='finished'){capped++;draws++;results[seat]=.5;}else if(r.state.winner===seat){wins++;results[seat]=1;}else if(r.state.winner===null){draws++;results[seat]=.5;}else losses++;
    }
    pairScores.push(results);
  }
  console.log(JSON.stringify({target:targetLevel,level,expertProbability:expertProbability(level),wins,losses,draws,capped,valid:capped===0,...pairedScoreStats(pairScores),pairScores,moves,expertDecisions:expert,beginnerDecisions:beginner,seconds:Math.round(ms/1000)}));
}
