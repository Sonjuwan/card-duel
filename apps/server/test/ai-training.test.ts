import { test } from 'node:test';
import {trainingBudget} from '../../cli/training-budget.ts';
test('training power modes fit a laptop CPU and memory budget',()=>{
  const quiet=trainingBudget(8,16,'quiet'),normal=trainingBudget(8,16,'balanced'),max=trainingBudget(8,16,'maximum');
  assert.equal(quiet.workers,2);assert.equal(normal.workers,4);assert.equal(max.workers,7);assert.ok(quiet.restMs>normal.restMs&&normal.restMs>max.restMs);assert.ok(trainingBudget(16,4,'maximum').workers<=1);assert.ok(trainingBudget(1,2).workers>=1);
});
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CardStore } from '../card-store.ts';
import { aiCatalogHash,aiDirectory,aiWeightFingerprint,defaultChampion,parseChampion,readChampion,listChampions,saveChampion,transferSource } from '../ai-profile-store.ts';
import { BOT_DIFFICULTIES,botSearchConfig,DEFAULT_BOT_WEIGHTS } from '../../../packages/engine/src/index.ts';
import { pairedJobs,playTrainingMatch } from '../../cli/ai-training-match.ts';
import { completedTransfer,transferCandidates,validTransferAttempt } from '../../cli/ai-transfer.ts';
import { importAiData } from '../../cli/import-ai-data.ts';
import {backupAiData} from '../../cli/backup-ai-data.ts';

test('25 levels: advanced search budget is strictly increasing, depth and response budget never decrease',()=>{
  assert.equal(BOT_DIFFICULTIES.length,25);
  for(let d=7;d<=25;d++){
    const a=botSearchConfig(d-1),b=botSearchConfig(d);
    assert.ok(b.nodes>a.nodes&&b.beam>a.beam&&b.depth>=a.depth&&b.responses>=a.responses&&b.responseNodes>=a.responseNodes);
  }
  assert.equal(botSearchConfig(25).depth,8);
});
test('champions are version-isolated, atomic and reject invalid coefficients',()=>{
  const hash=aiCatalogHash(new CardStore().read().catalog),other='a'.repeat(64),root=mkdtempSync(join(tmpdir(),'card-duel-champion-'));
  const c=defaultChampion(hash);
  c.weights.attack*=1.2;c.promotions=1;
  assert.equal(readChampion(hash,root),null);
  saveChampion(c,root);assert.deepEqual(readChampion(hash,root),c);assert.equal(readChampion(other,root),null);
  assert.equal(parseChampion({...c,weights:{...c.weights,attack:-1}},hash),null);
});
test('paired seeds swap candidate seats and run to completion under engine rules',()=>{
  const {catalog}=new CardStore().read(),weights={...DEFAULT_BOT_WEIGHTS};
  const jobs=pairedJobs(23231,1,weights,weights,24,11);
  assert.equal(jobs.length,2);assert.equal(jobs[0].candidateSeat,0);assert.equal(jobs[1].candidateSeat,1);
  assert.deepEqual(jobs[0].classes,jobs[1].classes);assert.equal(jobs[0].seed,jobs[1].seed);
  const result=jobs.map(j=>playTrainingMatch(catalog,j));
  assert.equal(result[0].score+result[1].score,1);
  assert.ok(result.every(r=>r.moves>0&&!r.truncated));
});

test('cross-version transfer selects only compatible distinct weights, tracks validation and preserves prior files',t=>{
  const store=new CardStore(),oldHash=aiCatalogHash(store.read('v0.22.0.json').catalog),newHash=aiCatalogHash(store.read('v0.23.0.json').catalog),root=mkdtempSync(join(tmpdir(),'card-duel-ai-transfer-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const old=defaultChampion(oldHash),target=defaultChampion(newHash);
  old.weights.attack*=1.2;old.games=1000;old.generation=40;old.promotions=3;
  saveChampion(old,root);saveChampion(target,root);
  const oldPath=join(aiDirectory(oldHash,root),'champion.json'),bytes=readFileSync(oldPath);
  assert.equal(listChampions(root).length,2);
  const candidates=transferCandidates(target,[],root);assert.equal(candidates.length,1);assert.equal(candidates[0].source.catalogHash,oldHash);assert.equal(candidates[0].source.fingerprint,aiWeightFingerprint(old.weights));
  const rejected=completedTransfer(candidates[0].source,'screen',7,16,false);
  assert.ok(validTransferAttempt(rejected));assert.equal(transferCandidates(target,[rejected],root).length,0);
  assert.throws(()=>completedTransfer(candidates[0].source,'screen',16,16,true),/Invalid/);
  const promoted={...target,weights:candidates[0].weights,transferredFrom:candidates[0].source,promotions:1,validatedGames:24,validatedWins:15};
  saveChampion(promoted,root);assert.deepEqual(readChampion(newHash,root),promoted);assert.deepEqual(readFileSync(oldPath),bytes);
  assert.equal(parseChampion({...target,transferredFrom:transferSource(target)},newHash),null);
  assert.equal(transferCandidates(promoted,[],root).length,0);
});

test('cross-version candidate pool screens current champions then distinct historical champions without retrying rejected weights',t=>{
  const root=mkdtempSync(join(tmpdir(),'card-duel-ai-history-')),a=defaultChampion('a'.repeat(64)),b=defaultChampion('b'.repeat(64)),target=defaultChampion('c'.repeat(64));
  t.after(()=>rmSync(root,{recursive:true,force:true}));a.weights.attack*=1.1;b.weights.attack*=1.2;saveChampion(a,root);saveChampion(b,root);
  const previous={...a,promotions:1,weights:{...a.weights,attack:1.33}},prior=join(aiDirectory(a.catalogHash,root),'previous-champion-1.json');writeFileSync(prior,JSON.stringify(previous));
  const bytes=readFileSync(prior),candidates=transferCandidates(target,[],root);assert.equal(candidates.length,3);assert.equal(candidates[2].source.fingerprint,aiWeightFingerprint(previous.weights));
  const rejected=completedTransfer(candidates[2].source,'screen',7,16,false);assert.equal(transferCandidates(target,[rejected],root).length,2);
  assert.equal(transferCandidates(target,[],root,a.catalogHash).length,2);assert.deepEqual(readFileSync(prior),bytes);
});

test('CLI resumes a transfer trial independently of a previous catalog and never overwrites its learned champion',{timeout:22000},t=>{
  const store=new CardStore(),oldHash=aiCatalogHash(store.read('v0.22.0.json').catalog),newHash=aiCatalogHash(store.read('v0.23.0.json').catalog),root=mkdtempSync(join(tmpdir(),'card-duel-ai-cli-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const old=defaultChampion(oldHash);old.weights.attack*=1.2;old.promotions=3;old.games=1000;saveChampion(old,root);
  const prior=join(aiDirectory(oldHash,root),'champion.json'),before=readFileSync(prior);
  const run=(seconds:number)=>execFileSync(process.execPath,['apps/cli/train-ai.ts','--catalog','v0.23.0.json','--output',root,'--transfer-from','v0.22.0.json','--seconds',String(seconds),'--workers','1','--nodes','12','--pairs','1'],{encoding:'utf8',timeout:15000});
  const output=run(2);
  assert.match(output,/Testing prior model|transfer screen/);
  const read=()=>JSON.parse(readFileSync(join(aiDirectory(newHash,root),'checkpoint.json'),'utf8'));
  const first=read();assert.ok(first.games>0||first.trial?.source?.catalogHash===oldHash);assert.ok(first.transferAttempts.length||first.trial?.source?.catalogHash===oldHash);
  const next=readChampion(newHash,root);assert.ok(next);assert.equal(next.catalogHash,newHash);
  run(4);const second=read();assert.ok(second.elapsedMs>=first.elapsedMs);assert.ok(second.games>=first.games);assert.deepEqual(readFileSync(prior),before);
  const status=execFileSync(process.execPath,['apps/cli/train-ai.ts','--catalog','v0.23.0.json','--output',root,'--status'],{encoding:'utf8'});
  assert.match(status,/\[active\] v0.23.0.json/);assert.match(status,/\[previous\] v0.22.0.json/);
});
test('moving folders imports dormant checkpoints, live champion only and never overwrites a destination model',t=>{
  const root=mkdtempSync(join(tmpdir(),'card-duel-migrate-')),source=join(root,'old','data','ai'),destination=join(root,'new','data','ai');
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const a=defaultChampion('a'.repeat(64)),b=defaultChampion('b'.repeat(64));
  a.weights.body*=1.1;a.games=50;b.games=100;
  saveChampion(a,source);saveChampion(b,source);
  const aDir=aiDirectory(a.catalogHash,source),bDir=aiDirectory(b.catalogHash,source);
  writeFileSync(join(aDir,'checkpoint.json'),JSON.stringify({schema:1,hash:a.catalogHash,champion:a,games:50,elapsedMs:0}));
  writeFileSync(join(aDir,'previous-champion-0.json'),JSON.stringify(defaultChampion(a.catalogHash)));
  writeFileSync(join(bDir,'checkpoint.json'),JSON.stringify({schema:1,hash:b.catalogHash,champion:b}));
  writeFileSync(join(bDir,'train.lock'),'123');
  const sourceBytes=readFileSync(join(aDir,'champion.json'));
  const results=importAiData(join(root,'old'),destination);assert.equal(results.length,2);
  assert.equal(results.find(r=>r.hash===a.catalogHash)?.mode,'complete');assert.equal(results.find(r=>r.hash===b.catalogHash)?.mode,'champion');
  assert.deepEqual(readChampion(a.catalogHash,destination),a);assert.deepEqual(readChampion(b.catalogHash,destination),b);
  assert.ok(existsSync(join(aiDirectory(a.catalogHash,destination),'previous-champion-0.json')));assert.ok(!existsSync(join(aiDirectory(b.catalogHash,destination),'checkpoint.json')));assert.ok(!existsSync(join(aiDirectory(b.catalogHash,destination),'train.lock')));
  const changed={...a,weights:{...a.weights,body:2.2}};saveChampion(changed,destination);
  assert.ok(importAiData(source,destination).every(r=>r.status==='skipped'));assert.deepEqual(readChampion(a.catalogHash,destination),changed);
  assert.deepEqual(readFileSync(join(aDir,'champion.json')),sourceBytes);assert.equal(readFileSync(join(bDir,'train.lock'),'utf8'),'123');
});
test('live AI backup exports an atomic matching checkpoint and embedded champion without copying a lock',t=>{
  const root=mkdtempSync(join(tmpdir(),'card-duel-ai-backup-')),source=join(root,'current'),output=join(root,'backup'),hash='c'.repeat(64);t.after(()=>rmSync(root,{recursive:true,force:true}));
  const champion=defaultChampion(hash);champion.games=100;saveChampion(champion,source);const next={...champion,generation:1,games:108,minutes:2};const dir=aiDirectory(hash,source);
  const checkpoint={schema:1,hash,champion:next,games:108,elapsedMs:120000,round:1,rng:1,trial:null};writeFileSync(join(dir,'checkpoint.json'),JSON.stringify(checkpoint));writeFileSync(join(dir,'train.lock'),'123');const oldBytes=readFileSync(join(dir,'champion.json'));
  const copied=backupAiData(output,source);assert.deepEqual(copied,[{hash,games:108,minutes:2,promotions:0,mode:'checkpoint'}]);const snapshot=join(output,'data','ai');assert.deepEqual(readChampion(hash,snapshot),next);assert.deepEqual(JSON.parse(readFileSync(join(aiDirectory(hash,snapshot),'checkpoint.json'),'utf8')),checkpoint);assert.ok(!existsSync(join(aiDirectory(hash,snapshot),'train.lock')));
  const destination=join(root,'imported');assert.equal(importAiData(output,destination)[0].mode,'complete');assert.deepEqual(readChampion(hash,destination),next);assert.deepEqual(readFileSync(join(dir,'champion.json')),oldBytes);assert.equal(readFileSync(join(dir,'train.lock'),'utf8'),'123');assert.throws(()=>backupAiData(output,source),/already exists/);
});
