import {CardStore} from '../server/card-store.ts';
import {aiCatalogHash,readChampion,aiWeightFingerprint} from '../server/ai-profile-store.ts';
import {applyAction,createGame,getPlayerView,HERO_CLASSES,rankBotActions,RuleError,strategicDeck,isBotDifficulty,DECK_STYLES,DEFAULT_BOT_WEIGHTS} from '../../packages/engine/src/index.ts';
import type {PlayerId,BotDifficulty,Deck,GameState,BotWeights} from '../../packages/engine/src/index.ts';
import {pairedScoreStats} from './paired-benchmark-stats.ts';
const {version,catalog}=new CardStore().read(),hash=aiCatalogHash(catalog);
const pairs=Math.max(1,Math.min(100,Math.floor(Number(process.argv[2])||9))),opponents=(process.argv[3]??'3,6,11,18,24').split(',').map(Number);
if(!opponents.every(isBotDifficulty))throw Error('Specify comma-separated opponent levels 1–25');
const target=Number(process.argv[4]??25);if(!isBotDifficulty(target))throw Error('Invalid target difficulty');
function selectPolicy(value: string | undefined) {
  const policy = Number(value ?? 1);
  if (policy !== 1 && policy !== 2 && policy !== 3 && policy !== 4) throw Error('Specify policy 1–4');
  return policy;
}
const policy=selectPolicy(process.argv[5]),seedOffset=Number(process.argv[6]??0)||0;
const opponentPolicy=selectPolicy(process.argv[7]);
if(!Number.isSafeInteger(seedOffset)||seedOffset<0)throw Error('Specify a nonnegative integer seed offset');
function modelFor(selection:string){
  if(selection==='default')return {label:'default',weights:DEFAULT_BOT_WEIGHTS,promotions:0};
  const selectedHash=selection==='current'?hash:selection;
  if(!/^[a-f0-9]{64}$/.test(selectedHash))throw Error('Specify current, default, or the 64-character hash of an imported champion');
  const model=readChampion(selectedHash);if(!model&&selection!=='current')throw Error('No saved champion for '+selectedHash);
  return {label:model?.catalogHash??'default',weights:model?.weights??DEFAULT_BOT_WEIGHTS,promotions:model?.promotions??0};
}
const targetModel=modelFor(process.argv[8]??'current'),opponentModel=modelFor(process.argv[9]??'current');
function play(decks:[Deck,Deck],seed:number,firstPlayer:PlayerId,levels:[BotDifficulty,BotDifficulty],models:[Readonly<BotWeights>,Readonly<BotWeights>],targetSeat:PlayerId):{state:GameState;moves:number;ms:number}{
  let s=createGame(catalog,decks,{seed,firstPlayer}),moves=0,turn=-1,turnMoves=0;const start=performance.now();
  while(s.phase!=='finished'&&moves<600){const actor:PlayerId=s.phase==='mulligan'?(s.players[0].mulliganDone?1:0):s.activePlayer;
    if(turn!==s.turn){turn=s.turn;turnMoves=0;}
    const actions=turnMoves>=40&&s.phase==='playing'&&!s.pendingChoice?[{type:'endTurn'} as const]:rankBotActions(getPlayerView(s,actor),s.catalog,actor,levels[actor],{weights:models[actor],policyVersion:actor===targetSeat?policy:opponentPolicy});
    let next:GameState|undefined;for(const action of actions)try{next=applyAction(s,actor,action);break;}catch(e){if(!(e instanceof RuleError))throw e;}
    if(!next)throw Error('No legal benchmark action');s=next;moves++;turnMoves++;
  }
  return{state:s,moves,ms:performance.now()-start};
}
console.log(JSON.stringify({version,hash,pairs,target,promotions:targetModel.promotions,targetPolicy:policy,opponentPolicy,seedOffset,targetModel:targetModel.label,targetWeights:aiWeightFingerprint(targetModel.weights),opponentModel:opponentModel.label,opponentWeights:aiWeightFingerprint(opponentModel.weights),method:'full default node budgets, no wall-clock deadline; equal decks/seed/first player within each seat-swapped pair; uncertainty bootstraps fixtures not individual games'}));
for(const difficulty of opponents as BotDifficulty[]){let wins=0,losses=0,draws=0,capped=0,moves=0,ms=0;
  const pairScores:[number,number][]=[];for(let i=0;i<pairs;i++){
    const seed=(70381+Math.imul(i+seedOffset,3167))>>>0,style1=DECK_STYLES[(i+seedOffset+2)%DECK_STYLES.length],style2=DECK_STYLES[(i+seedOffset+4)%DECK_STYLES.length];
    const decks:[Deck,Deck]=[strategicDeck(catalog,HERO_CLASSES[i%9],style1,seed),strategicDeck(catalog,HERO_CLASSES[(i*5+3)%9],style2,seed^4123)];
    const results:[number,number]=[0,0];for(const seat of [0,1] as const){const levels:[BotDifficulty,BotDifficulty]=seat===0?[target,difficulty]:[difficulty,target],models:[Readonly<BotWeights>,Readonly<BotWeights>]=seat===0?[targetModel.weights,opponentModel.weights]:[opponentModel.weights,targetModel.weights];const r=play(decks,seed,(i%2) as PlayerId,levels,models,seat);moves+=r.moves;ms+=r.ms;if(r.state.phase!=='finished'){capped++;draws++;results[seat]=.5;}else if(r.state.winner===seat){wins++;results[seat]=1;}else if(r.state.winner===null){draws++;results[seat]=.5;}else losses++;}pairScores.push(results);
  }
  console.log(JSON.stringify({target,difficulty,wins,losses,draws,capped,valid:capped===0,...pairedScoreStats(pairScores),pairScores,moves,seconds:Math.round(ms/1000)}));
}
