import {availableParallelism,cpus,totalmem} from 'node:os';
import {createHash} from 'node:crypto';
import {CardStore} from '../server/card-store.ts';
import {aiCatalogHash,readChampion,aiWeightFingerprint} from '../server/ai-profile-store.ts';
import {applyAction,BOT_DIFFICULTIES,createGame,getPlayerView,HERO_CLASSES,rankBotActions,RuleError,strategicDeck,DEFAULT_BOT_WEIGHTS} from '../../packages/engine/src/index.ts';
import type {GameState,Action,PlayerId} from '../../packages/engine/src/index.ts';
import {deviceBudget} from '../client/src/device-budget.ts';
import type {DeviceMode,DeviceInfo} from '../client/src/device-budget.ts';
const {version,catalog}=new CardStore().read();
const positions:GameState[]=[];
const fixedNodes=process.env.CARD_DUEL_FIXED_NODES==='1';
const count=Math.max(1,Math.min(9,Number(process.argv[2]??9)||9));
const level=(Number(process.argv[3])||0);
const modes:DeviceMode[]=process.argv[4]==='all'?['fast','auto','strong']:['auto'];
const host={cores:availableParallelism(),memoryGb:totalmem()/1024**3},profileName=process.argv[5]??'host';
const profiles:Record<string,DeviceInfo>={host,low:{cores:2,memoryGb:2},mid:{cores:4,memoryGb:4}};
if(!Object.hasOwn(profiles,profileName))throw Error('Device budget profile: host, low, or mid');
const device=profiles[profileName],weights=readChampion(aiCatalogHash(catalog))?.weights??DEFAULT_BOT_WEIGHTS;
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
console.log(JSON.stringify({catalog:version,positions:positions.length,cpu:cpus()[0]?.model,hostCores:host.cores,hostMemoryGb:Math.round(host.memoryGb),budgetProfile:profileName,budgetDevice:device,weights:aiWeightFingerprint(weights),note:'Host measurements with the selected simulated search budget, not a physical S24 or GTX1650 Ti benchmark.'}));
const percentile=(xs:number[],p:number)=>xs[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)];
for(const mode of modes)for(const difficulty of BOT_DIFFICULTIES.filter(d=>!level||d===level)){
  const times:number[]=[];let fallbacks=0,passes=0,overBudget=0;
  const rankedDigest=createHash('sha256'),acceptedDigest=createHash('sha256');
  const budget=deviceBudget(difficulty,mode,device);
  const options={...budget,deadlineMs:fixedNodes?undefined:budget.deadlineMs,weights,policyVersion:difficulty===25?2 as const:1 as const};
  for(const s of positions){
    const actor=s.activePlayer,start=performance.now(),actions=rankBotActions(getPlayerView(s,actor),s.catalog,actor,difficulty,options),elapsed=performance.now()-start;
    if(fixedNodes)rankedDigest.update(JSON.stringify(actions)+'\n');
    times.push(elapsed);if(!fixedNodes&&elapsed>budget.deadlineMs)overBudget++;
    let accepted:Action|undefined;
    for(const [i,action] of actions.entries())try{applyAction(s,actor,action);accepted=action;if(i)fallbacks++;break;}catch(e){if(!(e instanceof RuleError))throw e;}
    if(!accepted)throw Error(`No legal benchmark action at difficulty ${difficulty}`);
    if(fixedNodes)acceptedDigest.update(JSON.stringify(accepted)+'\n');
    if(accepted.type==='endTurn')passes++;
  }
  times.sort((a,b)=>a-b);
  console.log(JSON.stringify({mode,difficulty,positions:times.length,nodeBudget:budget.nodeLimit,targetMs:budget.deadlineMs,medianMs:Math.round(percentile(times,.5)),p95Ms:Math.round(percentile(times,.95)),maxMs:Math.round(times.at(-1)!),overBudget,fallbacks,passes,...(fixedNodes?{fixedNodes:true,wallClockDeadlineDisabled:true,rankedActionSha256:rankedDigest.digest('hex'),acceptedActionSha256:acceptedDigest.digest('hex')}: {})}));
}
