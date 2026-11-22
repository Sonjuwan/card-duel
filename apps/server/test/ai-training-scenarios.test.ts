import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CardStore} from '../card-store.ts';
import {aiCatalogHash,aiDirectory,defaultChampion,saveChampion} from '../ai-profile-store.ts';
import {DEFAULT_BOT_WEIGHTS,HERO_CLASSES,strategicDeck,validateDeck} from '../../../packages/engine/src/index.ts';
import {variedCatalog,evaluateTrainingTrial,pairedSignProbability} from '../../cli/ai-training-scenarios.ts';
import {pairedJobs,playTrainingMatch} from '../../cli/ai-training-match.ts';
import type {TrainingResult} from '../../cli/ai-training-match.ts';
import {trainingLeague} from '../../cli/ai-transfer.ts';

test('training balance variants are reproducible, valid, immutable at source and leave tokens untouched',()=>{
  const catalog=new CardStore().read('v0.23.0.json').catalog,original=JSON.stringify(catalog),hash=aiCatalogHash(catalog);
  const a=variedCatalog(catalog,17283),b=variedCatalog(catalog,17283),c=variedCatalog(catalog,43912);
  assert.equal(aiCatalogHash(a),aiCatalogHash(b));assert.notEqual(aiCatalogHash(a),hash);assert.notEqual(aiCatalogHash(c),aiCatalogHash(a));
  const altered=Object.keys(a).filter(id=>JSON.stringify(a[id])!==JSON.stringify(catalog[id]));assert.ok(altered.length>30&&altered.length<150,altered.length+' changed cards');
  const withoutStats=(x:typeof a[string])=>Object.fromEntries(Object.entries(x).filter(([key])=>!['cost','attack','health','durability'].includes(key)));
  assert.ok(altered.some(id=>JSON.stringify(withoutStats(a[id]))!==JSON.stringify(withoutStats(catalog[id]))),'effect numbers are also varied');
  for(const id of Object.keys(catalog)){const d=catalog[id];if(d.kind==='coin'||d.collectible===false)assert.deepEqual(a[id],d);assert.equal(a[id].kind,d.kind);}
  for(const hero of HERO_CLASSES)for(const style of ['aggression','control','synergy','combo'] as const)validateDeck(strategicDeck(a,hero,style,12345),a);
  assert.equal(JSON.stringify(catalog),original);
});
test('paired scenario seeds keep cards, deck styles, variants and opponents identical while swapping candidate side',()=>{
  const {catalog}=new CardStore().read(),weights={...DEFAULT_BOT_WEIGHTS};
  const jobs=pairedJobs(1019,16,weights,weights,12,11,{stage:'screen',diverse:true});
  assert.equal(jobs.length,32);assert.ok(jobs.some(j=>j.environmentSeed!==undefined));assert.ok(jobs.some(j=>j.opponentTag==='baseline'));
  assert.ok(new Set(jobs.flatMap(j=>j.archetypes??[])).size>=6);
  for(let i=0;i<jobs.length;i+=2){const {candidateSeat:a,...left}=jobs[i],{candidateSeat:b,...right}=jobs[i+1];assert.deepEqual(left,right);assert.notEqual(a,b);}
  for(let i=0;i<6;i+=2){const a=playTrainingMatch(catalog,jobs[i]),b=playTrainingMatch(catalog,jobs[i+1]);assert.equal(a.score+b.score,1);assert.ok(!a.truncated&&!b.truncated);}
});
test('validation rejects aggregate winners that lose canonical or varied games; decisive paired results pass',()=>{
  const w={...DEFAULT_BOT_WEIGHTS},jobs=pairedJobs(93,16,w,w,12,25,{stage:'validate',diverse:true});
  const result=(score:number,truncated=false):TrainingResult=>({score,moves:30,turns:8,truncated});
  const all=jobs.map(()=>result(1));assert.ok(evaluateTrainingTrial('validate',jobs,all).pass);assert.ok(pairedSignProbability(jobs,all)<.001);
  const loseVariants=jobs.map(j=>result(j.environmentSeed===undefined?1:0));assert.ok(evaluateTrainingTrial('validate',jobs,loseVariants).total.rate>=.60);assert.equal(evaluateTrainingTrial('validate',jobs,loseVariants).pass,false);
  const tied=jobs.map((j)=>result(j.candidateSeat===0?1:0));assert.equal(pairedSignProbability(jobs,tied),1);assert.equal(evaluateTrainingTrial('validate',jobs,tied).pass,false);
  const truncated=all.map((r,i)=>i===0?result(.5,true):r);assert.equal(evaluateTrainingTrial('validate',jobs,truncated).pass,false);
});
test('league includes old validated weights and excludes candidate/current duplicates',t=>{
  const root=mkdtempSync(join(tmpdir(),'card-duel-league-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const hash='b'.repeat(64),current=defaultChampion(hash);current.weights.health*=1.2;saveChampion(current,root);
  const past=defaultChampion(hash);past.weights.attack*=1.3;past.promotions=1;
  writeFileSync(join(aiDirectory(hash,root),'previous-champion-1.json'),JSON.stringify(past));
  const other=defaultChampion('a'.repeat(64));other.weights.pressure*=1.1;saveChampion(other,root);
  const league=trainingLeague(current,other.weights,root);
  assert.equal(league.length,2);assert.ok(league.some(x=>x.tag==='baseline'));assert.ok(league.some(x=>x.weights.attack===past.weights.attack));assert.ok(!league.some(x=>x.weights.pressure===other.weights.pressure));
});
