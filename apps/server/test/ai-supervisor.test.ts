import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {execFileSync} from 'node:child_process';
import {CardStore} from '../card-store.ts';
import {aiCatalogHash,aiDirectory,defaultChampion,saveChampion,readChampion,aiWeightFingerprint} from '../ai-profile-store.ts';
import {captureTrainingResult,readTrainingResult,RESULT_NAME,writeTrainingResult} from '../../cli/ai-training-result.ts';
import {recoverStalledTrial,requestTrainingStop,runSupervisor,trainingStatus} from '../../cli/ai-training-supervisor.ts';

const {catalog,version}=new CardStore().read(),hash=aiCatalogHash(catalog);
const fixture=fileURLToPath(new URL('./fixtures/ai-supervisor-fault.ts',import.meta.url));
const options=(session:string,seedRoot:string)=>({session,seedRoot,power:'quiet' as const,workers:1,cycleSeconds:1,retrySeconds:1,watchdogSeconds:30,graceSeconds:1,snapshotSeconds:1,pollMs:50,nodes:12,pairs:1});

test('external result exports a coherent checkpoint and rejects changed bytes or mismatched models',t=>{
  const root=mkdtempSync(join(tmpdir(),'cd-external-export-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const initial=defaultChampion(hash);saveChampion(initial,root);
  const newer={...initial,games:7,generation:2,minutes:3},checkpoint={schema:1,hash,champion:newer,games:7,round:2,rng:42,elapsedMs:180000,trial:null};
  const dir=aiDirectory(hash,root);writeFileSync(join(dir,'checkpoint.json'),JSON.stringify(checkpoint));
  const meta={catalogHash:hash,catalogVersion:version,programVersion:'0.132.0',initialGames:0,initialPromotions:0,initialFingerprint:aiWeightFingerprint(initial.weights),sessionState:'stopped' as const,restarts:2};
  const path=join(root,RESULT_NAME);writeTrainingResult(path,root,meta);const p=readTrainingResult(path);assert.equal(p.champion.games,7);assert.deepEqual(p.checkpoint,checkpoint);assert.equal(p.restarts,2);assert.equal(readChampion(hash,root)?.games,0);
  const raw=JSON.parse(readFileSync(path,'utf8'));raw.payload.champion.games=100;writeFileSync(path,JSON.stringify(raw));assert.throws(()=>readTrainingResult(path),/checksum/);
  writeFileSync(join(dir,'checkpoint.json'),'{broken');assert.equal(captureTrainingResult(root,meta).payload.checkpoint,null);
});

test('real supervisor runs repeated self-play cycles and resumes the saved checkpoint on a fresh start',{timeout:60000},async t=>{
  const base=mkdtempSync(join(tmpdir(),'cd-real-supervisor-'));t.after(()=>rmSync(base,{recursive:true,force:true}));const session=join(base,'session'),seed=join(base,'seed');
  const initial=defaultChampion(hash);saveChampion(initial,seed);const original=readFileSync(join(aiDirectory(hash,seed),'champion.json'));
  const path=await runSupervisor({...options(session,seed),cycleSeconds:2,maxCycles:2});const first=readTrainingResult(path);
  assert.equal(first.sessionState,'stopped');assert.ok(first.checkpoint);assert.ok(first.champion.minutes>=4/60);assert.ok(first.champion.games>0);assert.equal(first.initialGames,0);assert.equal(trainingStatus(session).cycles,2);
  await runSupervisor({...options(session,seed),cycleSeconds:2,maxCycles:1});const resumed=readTrainingResult(path);
  assert.ok(resumed.champion.games>=first.champion.games);assert.ok(resumed.champion.minutes>first.champion.minutes);assert.deepEqual(readFileSync(join(aiDirectory(hash,seed),'champion.json')),original);assert.ok(!existsSync(join(session,'supervisor.lock')));
  const inspected=execFileSync(process.execPath,['apps/cli/ai-training-result.ts',path],{encoding:'utf8'});assert.equal(JSON.parse(inspected).compatible,true);
});

test('failed worker is restarted and a watchdog force-terminates a hung worker',{timeout:20000},async t=>{
  const base=mkdtempSync(join(tmpdir(),'cd-supervisor-faults-'));t.after(()=>rmSync(base,{recursive:true,force:true}));const seed=join(base,'seed');saveChampion(defaultChampion(hash),seed);
  for(const type of ['crash','watchdog']){
    const session=join(base,type),path=await runSupervisor({...options(session,seed),trainer:fixture,maxCycles:2,watchdogSeconds:type==='watchdog'?2:30});
    const p=readTrainingResult(path);assert.equal(p.restarts,1);assert.equal(p.sessionState,'stopped');assert.equal(trainingStatus(session).cycles,2);assert.ok(!existsSync(join(session,'supervisor.lock')));
    const log=readFileSync(join(session,'supervisor.log'),'utf8');assert.match(log,/retry in 1s/);if(type==='watchdog')assert.match(log,/terminating stalled worker/);
  }
});

test('separate stop request interrupts retry and duplicate start cannot acquire the session',{timeout:15000},async t=>{
  const base=mkdtempSync(join(tmpdir(),'cd-supervisor-stop-'));t.after(()=>rmSync(base,{recursive:true,force:true}));const seed=join(base,'seed'),session=join(base,'crash');saveChampion(defaultChampion(hash),seed);
  const running=runSupervisor({...options(session,seed),trainer:fixture,retrySeconds:10});
  await assert.rejects(runSupervisor({...options(session,seed),maxCycles:1}),/already running/);
  const deadline=Date.now()+5000;while(trainingStatus(session).state!=='retrying'&&Date.now()<deadline)await sleep(50);
  assert.equal(trainingStatus(session).state,'retrying');assert.equal(requestTrainingStop(session),true);const path=await running;
  assert.equal(readTrainingResult(path).sessionState,'stopped');assert.equal(requestTrainingStop(session),false);assert.equal(trainingStatus(session).cycles,1);
  await runSupervisor({...options(session,seed),trainer:fixture,maxCycles:1,resumeAfterError:true});assert.equal(trainingStatus(session).cycles,0);
});

test('repeated failure recovery archives incomplete trials without losing counters or rewriting the champion',t=>{
  const session=mkdtempSync(join(tmpdir(),'cd-supervisor-recovery-'));t.after(()=>rmSync(session,{recursive:true,force:true}));const root=join(session,'data','ai'),c={...defaultChampion(hash),games:42,generation:3,minutes:4};saveChampion(c,root);
  const dir=aiDirectory(hash,root),path=join(dir,'checkpoint.json'),championBytes=readFileSync(join(dir,'champion.json'));
  const data={schema:1,hash,champion:c,games:42,round:3,rng:81,elapsedMs:240000,trial:{weights:c.weights,stage:'screen',jobs:[],results:[]}};writeFileSync(path,JSON.stringify(data));
  assert.match(recoverStalledTrial(session,hash,root)??'',/Archived stalled trial/);const recovered=JSON.parse(readFileSync(path,'utf8'));assert.equal(recovered.trial,null);assert.equal(recovered.games,42);assert.equal(recovered.rng,81);assert.deepEqual(readFileSync(join(dir,'champion.json')),championBytes);
  assert.equal(recoverStalledTrial(session,hash,root),null);writeFileSync(path,'invalid json');assert.match(recoverStalledTrial(session,hash,root)??'',/Archived corrupted checkpoint/);assert.ok(!existsSync(path));assert.deepEqual(readFileSync(join(dir,'champion.json')),championBytes);
});

test('a separate stop command gracefully stops active self-play and saves one uploadable file',{timeout:30000},async t=>{
  const base=mkdtempSync(join(tmpdir(),'cd-supervisor-live-stop-'));t.after(()=>rmSync(base,{recursive:true,force:true}));const seed=join(base,'seed'),session=join(base,'session');saveChampion(defaultChampion(hash),seed);
  const running=runSupervisor({...options(session,seed),cycleSeconds:60,graceSeconds:10});
  const deadline=Date.now()+10000;while(!(trainingStatus(session).games>0)&&Date.now()<deadline)await sleep(100);
  const stopped=execFileSync(process.execPath,['apps/cli/ai-training-supervisor.ts','stop','--session',session],{encoding:'utf8'});assert.match(stopped,/Stop requested/);
  const result=readTrainingResult(await running);assert.equal(result.sessionState,'stopped');assert.ok(result.champion.games>0);assert.ok(result.checkpoint);assert.equal(trainingStatus(session).cycles,1);assert.ok(!existsSync(join(session,'supervisor.lock')));
});
