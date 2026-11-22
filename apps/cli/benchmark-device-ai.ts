import {availableParallelism,cpus,totalmem} from 'node:os';
import {CardStore} from '../server/card-store.ts';
import {applyAction,BOT_DIFFICULTIES,createGame,getPlayerView,HERO_CLASSES,rankBotActions,RuleError,strategicDeck} from '../../packages/engine/src/index.ts';
import type {GameState,Action,PlayerId} from '../../packages/engine/src/index.ts';
import {deviceBudget} from '../client/src/device-budget.ts';
import type {DeviceMode} from '../client/src/device-budget.ts';
const {version,catalog}=new CardStore().read();
const positions:GameState[]=[];
const count=Math.max(1,Math.min(9,Number(process.argv[2]??9)||9));
const level=(Number(process.argv[3])||0);
const modes:DeviceMode[]=process.argv[4]==='all'?['fast','auto','strong']:['auto'];
const device={cores:availableParallelism(),memoryGb:totalmem()/1024**3};
for(let i=0;i<count;i++){
  const seed=43621+i*313;
  let state=createGame(catalog,[strategicDeck(catalog,HERO_CLASSES[i],'synergy',seed),strategicDeck(catalog,HERO_CLASSES[(i+4)%9],'control',seed^779)],{seed});
  const turns=new Set<number>();
  for(let a=0;a<180&&state.phase!=='finished';a++){
    const actor:PlayerId=state.phase==='mulligan'?(state.players[0].mulliganDone?1:0):state.activePlayer;
    if(state.phase==='playing'&&state.turn>=4&&!turns.has(state.turn)&&[4,8,14,20].includes(state.turn)){positions.push(state);turns.add(state.turn);}
    let applied=false;
    for(const action of rankBotActions(getPlayerView(state,actor),state.catalog,actor,3))try{state=applyAction(state,actor,action);applied=true;break;}catch(e){if(!(e instanceof RuleError))throw e;}
    if(!applied)throw Error('Benchmark fixture could not advance');
  }
}
console.log(JSON.stringify({catalog:version,positions:positions.length,cpu:cpus()[0]?.model,cores:device.cores,memoryGb:Math.round(device.memoryGb),note:'Host measurements; not a physical S24 or GTX1650 Ti benchmark.'}));
const percentile=(xs:number[],p:number)=>xs[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)];
for(const mode of modes)for(const difficulty of BOT_DIFFICULTIES.filter(d=>!level||d===level)){
  const times:number[]=[];let fallbacks=0,passes=0,overBudget=0;
  const budget=deviceBudget(difficulty,mode,device);
  for(const s of positions){
    const actor=s.activePlayer,start=performance.now(),actions=rankBotActions(getPlayerView(s,actor),s.catalog,actor,difficulty,budget),elapsed=performance.now()-start;
    times.push(elapsed);if(elapsed>budget.deadlineMs)overBudget++;
    let accepted:Action|undefined;
    for(const [i,action] of actions.entries())try{applyAction(s,actor,action);accepted=action;if(i)fallbacks++;break;}catch(e){if(!(e instanceof RuleError))throw e;}
    if(!accepted)throw Error(`No legal benchmark action at difficulty ${difficulty}`);
    if(accepted.type==='endTurn')passes++;
  }
  times.sort((a,b)=>a-b);
  console.log(JSON.stringify({mode,difficulty,positions:times.length,nodeBudget:budget.nodeLimit,targetMs:budget.deadlineMs,medianMs:Math.round(percentile(times,.5)),p95Ms:Math.round(percentile(times,.95)),maxMs:Math.round(times.at(-1)!),overBudget,fallbacks,passes}));
}
