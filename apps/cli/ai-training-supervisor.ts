import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {appendFileSync,closeSync,copyFileSync,existsSync,mkdirSync,openSync,readFileSync,renameSync,statSync,unlinkSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {CardStore} from '../server/card-store.ts';
import {AI_ROOT,aiCatalogHash,aiDirectory,aiWeightFingerprint,defaultChampion,listChampions,parseChampion,readChampion,readGameChampion,saveChampion,saveJsonAtomic} from '../server/ai-profile-store.ts';
import {importAiData} from './import-ai-data.ts';
import {RESULT_NAME,writeTrainingResult} from './ai-training-result.ts';
import {TRAINING_MODES} from './training-budget.ts';
import type {TrainingMode} from './training-budget.ts';

const PROJECT=fileURLToPath(new URL('../../',import.meta.url));
export const DEFAULT_SESSION=join(PROJECT,'ai-training-session');
const TRAINER=fileURLToPath(new URL('./train-ai.ts',import.meta.url));
const PROGRAM_VERSION=(JSON.parse(readFileSync(join(PROJECT,'package.json'),'utf8')) as {version:string}).version;
type Owner={pid:number;token:string};
type Options={session:string;catalog?:string;power:TrainingMode;workers?:number;cycleSeconds:number;retrySeconds:number;watchdogSeconds:number;graceSeconds:number;snapshotSeconds:number;nodes?:number;pairs?:number;maxCycles?:number;trainer?:string;seedRoot?:string;pollMs?:number;resumeAfterError?:boolean};
function readOwner(path:string):Owner|null{
  try{const v=JSON.parse(readFileSync(path,'utf8'));return Number.isSafeInteger(v.pid)&&v.pid>0&&typeof v.token==='string'&&/^[a-f0-9-]{36}$/.test(v.token)?v:null;}catch{return null;}
}
function alive(pid:number){try{process.kill(pid,0);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')return false;throw e;}}
function acquire(session:string):Owner{
  const path=join(session,'supervisor.lock'),owner={pid:process.pid,token:randomUUID()};
  for(let attempt=0;attempt<2;attempt++)try{const fd=openSync(path,'wx');try{writeFileSync(fd,JSON.stringify(owner));}finally{closeSync(fd);}return owner;}catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    const other=readOwner(path);if(!other)throw Error('Invalid supervisor lock; preserve the session and inspect the lock before restarting.');
    if(alive(other.pid))throw Error(`Training supervisor already running (PID ${other.pid}). Use STOP-AI-TRAINING.cmd.`);
    // Never break a lock that changed ownership while being inspected.
    if(readOwner(path)?.token!==other.token)throw Error('Supervisor lock changed; try again.');
    unlinkSync(path);
  }
  throw Error('Could not acquire supervisor lock.');
}
function requestFile(session:string,owner:Owner){return join(session,`stop-${owner.token}.flag`);}
function touch(path:string){try{writeFileSync(path,'stop\n',{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}
export function requestTrainingStop(session=DEFAULT_SESSION){
  if(existsSync(session))touch(join(session,'pause.flag'));
  const owner=readOwner(join(session,'supervisor.lock'));
  if(!owner||!alive(owner.pid))return false;
  touch(requestFile(session,owner));return true;
}
export function trainingStatus(session=DEFAULT_SESSION){
  try{const status=JSON.parse(readFileSync(join(session,'supervisor-status.json'),'utf8')),owner=readOwner(join(session,'supervisor.lock'));
    if(status.state!=='stopped'&&(!owner||!alive(owner.pid)))return {...status,state:'interrupted',message:'Supervisor no longer running. Last saved result is preserved; start again to resume.'};
    return status;
  }catch{return {state:'not-started',message:'Start with START-AI-TRAINING.cmd'};}
}

/** Recover only isolated session data after repeated failures without games.
 * Archive every byte first; never reset a champion or fabricate a result. */
export function recoverStalledTrial(session:string,hash:string,root:string):string|null{
  if(resolve(root)!==resolve(join(session,'data','ai'))||resolve(root)===resolve(AI_ROOT))throw Error('Recovery is only allowed in isolated learning sessions.');
  const dir=aiDirectory(hash,root),path=join(dir,'checkpoint.json'),lock=join(dir,'train.lock');
  if(!existsSync(path))return null;
  if(existsSync(lock)){const pid=Number(readFileSync(lock,'utf8'));if(!Number.isSafeInteger(pid)||pid<1||alive(pid))return null;}
  const champion=readChampion(hash,root);if(!champion)return null;
  let raw:Record<string,unknown>|null=null;try{raw=JSON.parse(readFileSync(path,'utf8'));}catch{/* Archive corrupted checkpoint. */}
  const embedded=raw&&parseChampion(raw.champion,hash);
  const valid=raw&&raw.schema===1&&raw.hash===hash&&embedded&&raw.games===embedded.games&&raw.round===embedded.generation&&typeof raw.elapsedMs==='number'&&Number.isFinite(raw.elapsedMs)&&raw.elapsedMs>=0&&Number.isSafeInteger(raw.rng);
  if(valid&&!raw!.trial)return null;
  const archive=join(session,'recovery');mkdirSync(archive,{recursive:true});const saved=join(archive,`checkpoint-${Date.now()}-${randomUUID()}.json`);
  if(valid&&embedded&&embedded.games>=champion.games&&embedded.generation>=champion.generation&&embedded.promotions>=champion.promotions){
    copyFileSync(path,saved);saveJsonAtomic(path,{...raw,trial:null,last:'Repeated worker failure: uncompleted trial archived; new trial will resume from champion.'});
    return 'Archived stalled trial and kept the exact saved champion and counters.';
  }
  // Use a previously captured coherent checkpoint only if it cannot roll back
  // the latest independently saved champion. Otherwise resume from champion.
  const backup=join(session,'last-good-checkpoint.json');let recovered:Record<string,unknown>|null=null;
  try{const candidate=JSON.parse(readFileSync(backup,'utf8')),c=parseChampion(candidate.champion,hash);if(candidate.schema===1&&candidate.hash===hash&&c&&candidate.games===c.games&&candidate.round===c.generation&&c.games>=champion.games&&c.generation>=champion.generation&&c.promotions>=champion.promotions&&typeof candidate.elapsedMs==='number'&&Number.isFinite(candidate.elapsedMs)&&candidate.elapsedMs>=0&&Number.isSafeInteger(candidate.rng))recovered=candidate;}catch{/* No valid last-good copy. */}
  renameSync(path,saved);if(recovered)saveJsonAtomic(path,{...recovered,trial:null,last:'Corrupt checkpoint archived; recovered last coherent checkpoint.'});
  return recovered?'Archived corrupted checkpoint and restored the last coherent saved champion.':'Archived corrupted checkpoint; resume from the last valid saved champion.';
}

export async function runSupervisor(o:Options){
  const session=resolve(o.session);if(resolve(join(session,'data','ai'))===resolve(AI_ROOT))throw Error('Use a separate training session; the game AI directory must never be the training output.');mkdirSync(session,{recursive:true});
  const owner=acquire(session),ownerPath=join(session,'supervisor.lock'),stopPath=requestFile(session,owner);
  const root=join(session,'data','ai'),resultPath=join(session,RESULT_NAME),logPath=join(session,'supervisor.log'),pausePath=join(session,'pause.flag');
  const stop=()=>{touch(pausePath);touch(stopPath);},stopping=()=>existsSync(stopPath)||existsSync(pausePath);
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  let child:ReturnType<typeof spawn>|undefined;
  let workerStop:string|undefined,finalized=false,cycles=0,restarts=0,recoveries=0;
  let snapshot:(state:'running'|'stopped'|'retrying',message:string)=>void=()=>{};
  const log=(message:string)=>{const line=`[${new Date().toISOString()}] ${message}`;console.log(line);appendFileSync(logPath,line+'\n');};
  try{
    if(!o.resumeAfterError&&existsSync(pausePath))unlinkSync(pausePath);
    const store=new CardStore(),{version,catalog}=store.read(o.catalog),hash=aiCatalogHash(catalog),dir=aiDirectory(hash,root),checkpoint=join(dir,'checkpoint.json');
    const manifestPath=join(session,'session.json');
    let baseline:{catalogHash:string;catalogVersion:string;initialFingerprint:string;initialGames:number;initialPromotions:number};
    if(existsSync(manifestPath)){
      baseline=JSON.parse(readFileSync(manifestPath,'utf8'));
      if(baseline.catalogHash!==hash||baseline.catalogVersion!==version||!readChampion(hash,root))throw Error('Session catalog changed or champion is missing. Keep this session and start a separate session for the new catalog.');
    }else{
      // Read existing learning without changing the normal game or release data.
      const seed=o.seedRoot??AI_ROOT;
      if(listChampions(seed).length)importAiData(seed,root);
      if(!readChampion(hash,root))saveChampion((o.seedRoot?readChampion(hash,seed):readGameChampion(hash))??defaultChampion(hash),root);
      const c=readChampion(hash,root)!;
      baseline={catalogHash:hash,catalogVersion:version,initialFingerprint:aiWeightFingerprint(c.weights),initialGames:c.games,initialPromotions:c.promotions};
      saveJsonAtomic(manifestPath,baseline);
    }
    const priorStatus=trainingStatus(session);restarts=Number.isSafeInteger(priorStatus.restarts)&&priorStatus.restarts>=0?priorStatus.restarts:0;recoveries=Number.isSafeInteger(priorStatus.recoveries)&&priorStatus.recoveries>=0?priorStatus.recoveries:0;
    snapshot=(state,message)=>{
      const result=writeTrainingResult(resultPath,root,{...baseline,programVersion:PROGRAM_VERSION,sessionState:state,restarts,recoveries});
      const c=result.payload.champion;
      if(result.payload.checkpoint)saveJsonAtomic(join(session,'last-good-checkpoint.json'),result.payload.checkpoint);
      saveJsonAtomic(join(session,'supervisor-status.json'),{state,message,pid:owner.pid,catalogVersion:version,catalogHash:hash,cycles,restarts,recoveries,games:c.games,additionalGames:c.games-baseline.initialGames,promotions:c.promotions,additionalPromotions:c.promotions-baseline.initialPromotions,trainedMinutes:c.minutes,resultPath,updatedAt:result.payload.createdAt});
      log(`${message} | games=${c.games} (+${c.games-baseline.initialGames}) | promotions=${c.promotions} (+${c.promotions-baseline.initialPromotions}) | restarts=${restarts}`);
    };
    const safeSnapshot=(state:'running'|'stopped'|'retrying',message:string)=>{try{snapshot(state,message);}catch(e){log('Snapshot failed; existing result retained: '+(e instanceof Error?e.message:e));}};
    const poll=o.pollMs??1000;let consecutiveFailures=0;
    safeSnapshot('running','Supervisor started. Leave this window open; STOP-AI-TRAINING.cmd requests a saved stop.');
    while(!stopping()&&(o.maxCycles===undefined||cycles<o.maxCycles)){
      // Pin the exact current rules; never train a different catalog silently.
      if(aiCatalogHash(store.read(version).catalog)!==hash)throw Error('Pinned card catalog changed; no new cycle started.');
      const gamesBefore=readChampion(hash,root)?.games??0;
      cycles++;workerStop=join(session,`worker-stop-${owner.token}-${cycles}.flag`);
      const args=[o.trainer??TRAINER,'--catalog',version,'--output',root,'--run-seconds',String(o.cycleSeconds),'--stop-file',workerStop,'--supervisor-pid',String(owner.pid),'--power',o.power,...(o.workers===undefined?[]:['--workers',String(o.workers)]),...(o.nodes===undefined?[]:['--nodes',String(o.nodes)]),...(o.pairs===undefined?[]:['--pairs',String(o.pairs)])];
      log(`Cycle ${cycles}: starting ${o.power} self-play.`);const cycleStarted=Date.now();
      child=spawn(process.execPath,args,{stdio:['ignore','inherit','pipe'],windowsHide:true});
      let ended=false,failed=false,exitDescription='',stopAt=0,lastProgress=Date.now(),lastSnapshot=0,lastStamp=-1;
      const handledChild=child;
      let errorTail='';handledChild.stderr?.on('data',chunk=>{process.stderr.write(chunk);errorTail=(errorTail+String(chunk)).slice(-16384);});
      handledChild.once('error',e=>{failed=true;ended=true;exitDescription=e.message;});
      handledChild.once('exit',(code,signal)=>{failed||=code!==0;ended=true;exitDescription=`exit ${code??signal}`;});
      while(!ended){
        await sleep(poll);
        if(ended)break;
        const now=Date.now();
        try{const stamp=statSync(checkpoint).mtimeMs;if(stamp!==lastStamp){lastStamp=stamp;lastProgress=now;}}catch{/* Initial worker startup. */}
        if(!stopAt&&(stopping()||now-lastProgress>=o.watchdogSeconds*1000)){
          stopAt=now;failed=!stopping();touch(workerStop);
          log(stopping()?'Stop requested; allow current games to save.':'Watchdog: no checkpoint progress; restarting after grace period.');
        }
        if(stopAt&&now-stopAt>=o.graceSeconds*1000){failed=true;log('Grace period expired; terminating stalled worker; last saved checkpoint retained.');handledChild.kill('SIGKILL');stopAt=Number.MAX_SAFE_INTEGER;}
        if(now-lastSnapshot>=o.snapshotSeconds*1000){lastSnapshot=now;safeSnapshot('running',stopping()?'Saving before stop':'Periodic result saved');}
      }
      child=undefined;
      if(!stopping()&&!failed&&Date.now()-cycleStarted+poll<o.cycleSeconds*1000){failed=true;exitDescription+=' before cycle duration';}
      if(workerStop&&existsSync(workerStop))unlinkSync(workerStop);workerStop=undefined;
      if(stopping())break;
      if(failed){
        if(errorTail.trim())log('Worker error (last 16 KiB): '+errorTail.trim());
        restarts++;consecutiveFailures=(readChampion(hash,root)?.games??0)>gamesBefore?0:consecutiveFailures+1;
        if(consecutiveFailures>=3){
          const recovery=recoverStalledTrial(session,hash,root);if(recovery){recoveries++;log(recovery);}consecutiveFailures=0;
        }
        safeSnapshot('retrying',`Worker stopped (${exitDescription}); retry in ${o.retrySeconds}s`);
        const until=Date.now()+o.retrySeconds*1000;
        while(!stopping()&&Date.now()<until)await sleep(Math.min(poll,Math.max(1,until-Date.now())));
      }else{consecutiveFailures=0;safeSnapshot('running',`Cycle ${cycles} complete; next cycle will resume checkpoint`);}
    }
    snapshot('stopped','Training stopped. Upload the result JSON to the Card Duel project chat.');finalized=true;
    return resultPath;
  }finally{
    try{
      // On supervisor failure, do not leave a child running unsupervised.
      if(child&&child.exitCode===null&&child.signalCode===null){if(workerStop)touch(workerStop);child.kill('SIGKILL');await new Promise<void>(r=>child!.once('close',()=>r()));}
      if(!finalized)try{snapshot('stopped','Supervisor stopped after an error; latest saved progress exported.');}catch{/* Keep existing atomic result. */}
    }finally{
      process.off('SIGINT',stop);process.off('SIGTERM',stop);
      if(readOwner(ownerPath)?.token===owner.token)unlinkSync(ownerPath);
      if(existsSync(stopPath))unlinkSync(stopPath);
      if(workerStop&&existsSync(workerStop))unlinkSync(workerStop);
    }
  }
}

function parseArgs(args:string[]){
  const flags=new Set(['--session','--catalog','--power','--workers','--cycle-seconds','--retry-seconds','--watchdog-seconds','--grace-seconds','--snapshot-seconds']);
  const map=new Map<string,string>();for(let i=0;i<args.length;i+=2){const f=args[i],v=args[i+1];if(!flags.has(f)||!v||v.startsWith('--')||map.has(f))throw Error('Invalid training supervisor option: '+f);map.set(f,v);}
  const positive=(key:string,fallback:number,min:number,max:number)=>{const v=Number(map.get(key)??fallback);if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid '+key);return v;};
  const power=(map.get('--power')??'balanced') as TrainingMode;if(!TRAINING_MODES.includes(power))throw Error('Invalid power mode (quiet, balanced, maximum).');
  return {session:resolve(map.get('--session')??DEFAULT_SESSION),catalog:map.get('--catalog'),power,workers:map.has('--workers')?positive('--workers',1,1,8):undefined,cycleSeconds:positive('--cycle-seconds',1800,1,864000),retrySeconds:positive('--retry-seconds',30,1,3600),watchdogSeconds:positive('--watchdog-seconds',1200,1,86400),graceSeconds:positive('--grace-seconds',180,1,3600),snapshotSeconds:positive('--snapshot-seconds',60,1,3600)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2),command=args.shift()??'start',options=parseArgs(args);
    if(command==='start'||command==='resume')await runSupervisor({...options,resumeAfterError:command==='resume'});
    else if(command==='stop')console.log(requestTrainingStop(options.session)?'Stop requested. Wait for the training window to show Training stopped.':'No running supervisor. Existing result is preserved; automatic retry is paused.');
    else if(command==='status')console.log(JSON.stringify(trainingStatus(options.session),null,2));
    else throw Error('Usage: ai-training-supervisor.ts start|stop|status [--power quiet|balanced|maximum]');
  }catch(e){const message=e instanceof Error?e.message:String(e);console.error(message);process.exitCode=/already running|Invalid |Session catalog changed|Use a separate training session|Pinned card catalog changed/.test(message)?2:1;}
}
