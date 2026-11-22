import { Worker } from 'node:worker_threads';
import { availableParallelism,totalmem } from 'node:os';
import {setTimeout as rest} from 'node:timers/promises';
import {trainingBudget} from './training-budget.ts';
import type {TrainingMode} from './training-budget.ts';
import { closeSync,existsSync,mkdirSync,openSync,readFileSync,unlinkSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { CardStore } from '../server/card-store.ts';
import { AI_ROOT,aiCatalogHash,aiDirectory,aiWeightFingerprint,defaultChampion,parseChampion,parseTransferSource,readChampion,listChampions,saveChampion,saveJsonAtomic } from '../server/ai-profile-store.ts';
import type { AiChampion,AiTransferSource } from '../server/ai-profile-store.ts';
import { BOT_WEIGHT_KEYS,DEFAULT_BOT_WEIGHTS,validateBotWeights } from '../../packages/engine/src/index.ts';
import type { BotWeights } from '../../packages/engine/src/index.ts';
import { pairedJobs } from './ai-training-match.ts';
import type { TrainingJob,TrainingResult } from './ai-training-match.ts';
import { completedTransfer,transferCandidates,validTransferAttempt,trainingLeague } from './ai-transfer.ts';
import type { TransferAttempt } from './ai-transfer.ts';
import {evaluateTrainingTrial} from './ai-training-scenarios.ts';
const args=process.argv.slice(2);
function arg(name:string){const i=args.indexOf(name);return i<0?undefined:args[i+1];}
function numberArg(name:string,fallback:number,min:number,max:number){const raw=arg(name),v=raw===undefined?fallback:Number(raw);if(!Number.isFinite(v)||v<min||v>max)throw Error('Invalid '+name);return v;}
const store=new CardStore(),{catalog,version}=store.read(arg('--catalog')),hash=aiCatalogHash(catalog);
const root=arg('--output')?resolve(arg('--output')!):AI_ROOT,dir=aiDirectory(hash,root),checkpoint=join(dir,'checkpoint.json'),status=join(dir,'status.txt'),lock=join(dir,'train.lock');
const knownVersions=()=>new Map(store.list().map(v=>{try{return[aiCatalogHash(store.read(v).catalog),v] as const;}catch{return['',v] as const;}}));
if(args.includes('--list')||args.includes('--status')){
  if(args.includes('--status'))console.log(existsSync(status)?readFileSync(status,'utf8'):`No training data for active catalog ${version} yet. Run train-ai-10h.cmd first.`);
  const versions=knownVersions(),profiles=listChampions(root);
  console.log('Saved compatible models:');
  for(const c of profiles)console.log(` ${c.catalogHash===hash?'[active]':'[previous]'} ${versions.get(c.catalogHash)??c.catalogHash} | ${c.games} games | ${Math.floor(c.minutes)} minutes | ${c.promotions} promotions${c.transferredFrom?' | transferred from '+(versions.get(c.transferredFrom.catalogHash)??c.transferredFrom.catalogHash.slice(0,12)):''}`);
  if(!profiles.length)console.log(' none');
  process.exit(0);
}
const sourceArg=arg('--transfer-from');
const sourceHash=sourceArg===undefined?undefined:/^[a-f0-9]{64}$/.test(sourceArg)?sourceArg:aiCatalogHash(store.read(sourceArg).catalog);
if(sourceHash===hash)throw Error('Transfer source and target catalog must differ.');
if(sourceHash&&!readChampion(sourceHash,root))throw Error('No valid source champion: '+sourceArg);
if(sourceHash&&args.includes('--no-transfer'))throw Error('Use either --transfer-from or --no-transfer.');
const targetMs=arg('--seconds')!==undefined?numberArg('--seconds',10,1,864000)*1000:numberArg('--hours',10,.001,10000)*3600000;
const power=(arg('--power')??'balanced') as TrainingMode,budget=trainingBudget(availableParallelism(),totalmem()/1024**3,power);
const count=Math.floor(numberArg('--workers',budget.workers,1,8)),nodes=Math.floor(numberArg('--nodes',60,12,300));
const screenPairs=Math.floor(numberArg('--pairs',8,1,100)),validationPairs=Math.floor(numberArg('--validation-pairs',Math.max(2,Math.min(100,screenPairs*2)),2,100));
const diverse=!args.includes('--classic-training');
const policyNumber=numberArg('--policy',diverse?2:1,1,2);if(policyNumber!==1&&policyNumber!==2)throw Error('Invalid policy');const policy:1|2=policyNumber;
type Trial={weights:BotWeights;stage:'screen'|'validate';jobs:TrainingJob[];results:(TrainingResult|null)[];source?:AiTransferSource;};
type Checkpoint={schema:1;hash:string;elapsedMs:number;games:number;moves:number;truncated:number;round:number;rng:number;champion:AiChampion;trial:Trial|null;last:string;transferAttempts?:TransferAttempt[]};
let state:Checkpoint={schema:1,hash,elapsedMs:0,games:0,moves:0,truncated:0,round:0,rng:((Date.now()^0xaeb3671)>>>0),champion:defaultChampion(hash),trial:null,last:'Initial weights',transferAttempts:[]};
mkdirSync(dir,{recursive:true});
function acquireLock(){
  for(let i=0;i<2;i++)try{const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);return;}catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    const pid=Number(readFileSync(lock,'utf8'));if(!Number.isSafeInteger(pid)||pid<1)throw Error('Training lock is invalid: '+lock);
    try{process.kill(pid,0);}catch(err){if((err as NodeJS.ErrnoException).code==='ESRCH'){unlinkSync(lock);continue;}throw err;}
    throw Error('Training is already running (PID '+pid+').');
  }
  throw Error('Could not acquire training lock');
}
acquireLock();
let workers:Worker[]=[];
try{
  if(existsSync(checkpoint)){
    const raw=JSON.parse(readFileSync(checkpoint,'utf8')) as Checkpoint;
    if(raw.schema!==1||raw.hash!==hash||!parseChampion(raw.champion,hash)||!Number.isFinite(raw.elapsedMs)||raw.elapsedMs<0||!Number.isSafeInteger(raw.round)||!Number.isSafeInteger(raw.rng)||raw.trial&&(!validateBotWeights(raw.trial.weights)||raw.trial.jobs.length!==raw.trial.results.length||raw.trial.jobs.some(j=>j.policyVersion!==undefined&&j.policyVersion!==1&&j.policyVersion!==2)||raw.trial.source!==undefined&&(!parseTransferSource(raw.trial.source)||raw.trial.source.catalogHash===hash||raw.trial.source.fingerprint!==aiWeightFingerprint(raw.trial.weights)))||raw.transferAttempts!==undefined&&(!Array.isArray(raw.transferAttempts)||!raw.transferAttempts.every(validTransferAttempt)))throw Error('Invalid checkpoint; kept unchanged: '+checkpoint);
    state=raw;
  }else{
    // A user may copy only champion.json to resume playing. Preserve it even
    // without the training checkpoint; never replace it with baseline weights.
    const saved=readChampion(hash,root);
    if(saved){state.champion=saved;state.elapsedMs=saved.minutes*60000;state.games=saved.games;state.round=saved.generation;state.last='Recovered champion (no checkpoint)';}
  }
  state.transferAttempts??=[];
  const attempts=state.transferAttempts;
  // Freeze the source weights per process; ongoing older training can continue
  // independently. A resumable trial contains its exact candidate and jobs.
  const imports=args.includes('--no-transfer')?[]:transferCandidates(state.champion,attempts,root,sourceHash).slice(0,sourceHash?1:3);
  const toImport=imports.filter(x=>x.source.fingerprint!==state.trial?.source?.fingerprint);
  const prior=state.elapsedMs,started=Date.now();
  const elapsed=()=>prior+Date.now()-started;
  let stop=false;
  process.on('SIGINT',()=>{if(!stop)console.log('Stopping after current games; saving progress...');stop=true;});
  process.on('SIGTERM',()=>{stop=true;});
  const time=(ms:number)=>{const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');};
  const shouldStop=()=>stop||elapsed()>=targetMs;
  let lastSaved=0;
  function persist(running:boolean){
    lastSaved=Date.now();
    state.elapsedMs=elapsed();
    state.champion={...state.champion,generation:state.round,games:state.games,minutes:state.elapsedMs/60000,updatedAt:new Date().toISOString()};
    saveJsonAtomic(checkpoint,state);
    saveChampion(state.champion,root);
    const report=[`AI TRAINING — ${running?'running':elapsed()>=targetMs?'complete':'paused'}`,`Card catalog: ${version}`,`Elapsed: ${time(state.elapsedMs)} / ${time(targetMs)}`,`Remaining: ${time(targetMs-state.elapsedMs)}`,`Self-play games: ${state.games} | actions: ${state.moves} | capped games: ${state.truncated}`,`Trials: ${state.round} | validated promotions: ${state.champion.promotions}`,`Transfer: ${attempts.filter(a=>a.outcome==='promoted').length} accepted / ${attempts.length} tested`,`Last: ${state.last}`,state.trial?`Active: ${state.trial.source?'transfer ':''}${state.trial.stage} ${state.trial.results.filter(Boolean).length}/${state.trial.jobs.length}`:'No active trial',`Updated: ${new Date().toISOString()}`].join('\n')+'\n';
    writeFileSync(status,report);console.log(report.trim().replace(/\n/g,' | '));
  }
  const rnd=()=>{state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;};
  function mutation():BotWeights{
    const result={...state.champion.weights},keys=[...BOT_WEIGHT_KEYS],changes=2+Math.floor(rnd()*4);
    // Occasionally blend with a historical strategy to escape a local optimum.
    if(diverse&&rnd()<.16){const pool=trainingLeague(state.champion,result,root);if(pool.length){const peer=pool[Math.floor(rnd()*pool.length)].weights,blend=.2+rnd()*.4;for(const k of BOT_WEIGHT_KEYS)result[k]=result[k]*(1-blend)+peer[k]*blend;}}
    for(let i=0;i<changes;i++){
      const key=keys.splice(Math.floor(rnd()*keys.length),1)[0],step=state.round%7===6?.65:.25;
      result[key]=Math.max(DEFAULT_BOT_WEIGHTS[key]*.25,Math.min(DEFAULT_BOT_WEIGHTS[key]*4,result[key]*Math.exp((rnd()*2-1)*step)));
    }
    return result;
  }
  function trial(weights:BotWeights,stage:Trial['stage'],source?:AiTransferSource):Trial{
    const seed=Math.floor(rnd()*4294967296),pairs=stage==='screen'?screenPairs:validationPairs,level=stage==='screen'?11:25;
    const jobs=pairedJobs(seed,pairs,weights,state.champion.weights,stage==='screen'?nodes:nodes*3,level,diverse?{stage,diverse:true,league:trainingLeague(state.champion,weights,root)}:undefined).map(j=>({...j,policyVersion:policy}));
    return{weights,stage,jobs,results:jobs.map(()=>null),...(source?{source}:{})};
  }
  async function runJob(worker:Worker,job:TrainingJob,id:number):Promise<TrainingResult>{
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{worker.off('message',message);worker.off('error',error);worker.off('exit',exit);};
      const message=(m:{id:number;result?:TrainingResult;error?:string})=>{if(m.id!==id)return;cleanup();m.result?resolve(m.result):reject(Error(m.error??'Worker failed'));};
      const error=(e:Error)=>{cleanup();reject(e);},exit=(code:number)=>{cleanup();reject(Error('Worker exited '+code));};
      worker.on('message',message);worker.once('error',error);worker.once('exit',exit);worker.postMessage({id,job});
    });
  }
  if(shouldStop()){persist(false);}
  else{
    console.log(`CPU self-play: ${count} workers (${power}) | ${version} | policy ${policy} | target ${time(targetMs)}. Keep this window open; Ctrl+C saves progress.`);
    workers=Array.from({length:count},()=>new Worker(new URL('./ai-training-worker.ts',import.meta.url),{workerData:{version,hash}}));
    persist(true);
    while(!shouldStop()){
      if(!state.trial){
        const imported=toImport.shift();
        state.trial=imported?trial(imported.weights,'screen',imported.source):trial(mutation(),'screen');
        if(imported)state.last='Testing prior model '+imported.source.catalogHash.slice(0,12)+' on '+version;
        persist(true);
      }
      const current=state.trial,indices=current.results.flatMap((r,i)=>r===null?[i]:[]);let cursor=0;
      await Promise.all(workers.map(async worker=>{
        while(cursor<indices.length&&!shouldStop()){
          const id=indices[cursor++],r=await runJob(worker,current.jobs[id],id);
          current.results[id]=r;state.games++;state.moves+=r.moves;state.truncated+=Number(r.truncated);
          // Persist at most once per second during a trial, but always save at
          // stage boundaries and graceful stop. Reduces SSD and terminal load.
          if(Date.now()-lastSaved>=budget.checkpointMs)persist(true);
          if(budget.restMs&&!shouldStop())await rest(budget.restMs);
        }
      }));
      if(current.results.some(r=>r===null))break;
      const results=current.results as TrainingResult[],wins=results.filter(r=>r.score===1).length;
      const evaluation=evaluateTrainingTrial(current.stage,current.jobs,results),{pass}=evaluation,score=evaluation.total.score;
      state.last=`${current.stage}: ${score}/${results.length} ${pass?'passed':'rejected'}`+(current.jobs.some(j=>j.archetypes)?` | champion ${Math.round(evaluation.rival.rate*100)}% | canonical ${Math.round(evaluation.canonical.rate*100)}% | variants ${Math.round(evaluation.variants.rate*100)}% | league ${Math.round(evaluation.league.rate*100)}% | paired p=${evaluation.pairedProbability.toFixed(3)}`:'');
      if(current.stage==='screen'&&pass){state.trial=trial(current.weights,'validate',current.source);}
      else{
        state.round++;
        if(current.stage==='validate'&&pass){
          const archive=join(dir,'previous-champion-'+state.champion.promotions+'.json');
          if(!existsSync(archive))saveJsonAtomic(archive,state.champion);
          else if(JSON.stringify(parseChampion(JSON.parse(readFileSync(archive,'utf8')),hash))!==JSON.stringify(state.champion)){
            // An interrupted/copy-only recovery must never erase old weights.
            const recovery=join(dir,'previous-champion-'+state.champion.promotions+'-'+aiWeightFingerprint(state.champion.weights).slice(0,12)+'.json');
            if(!existsSync(recovery))saveJsonAtomic(recovery,state.champion);
          }
          state.champion={...state.champion,weights:current.weights,promotions:state.champion.promotions+1,validatedWins:wins,validatedGames:results.length,...(current.source?{transferredFrom:current.source}:{})};
          state.last+=' — new champion';
        }
        if(current.source){attempts.push(completedTransfer(current.source,current.stage,score,results.length,pass));state.last+=' — transfer '+(pass?'accepted':'rejected');}
        state.trial=null;
      }
      persist(true);
    }
    persist(false);
  }
}finally{
  await Promise.all(workers.map(w=>w.terminate()));
  unlinkSync(lock);
}
