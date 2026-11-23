import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {aiCatalogHash,aiDirectory,aiWeightFingerprint,listPreviousChampions,parseChampion,readChampion,readGameChampion,saveJsonAtomic} from '../server/ai-profile-store.ts';
import type {AiChampion} from '../server/ai-profile-store.ts';
import {CardStore} from '../server/card-store.ts';

export const RESULT_NAME='AI-TRAINING-RESULT.json';
type Checkpoint=Record<string,unknown>;
export interface TrainingResultPayload {
  kind:'card-duel-external-ai-training'; schema:1; createdAt:string;
  catalogVersion:string; catalogHash:string; programVersion:string;
  champion:AiChampion; checkpoint:Checkpoint|null; previousChampions:AiChampion[];
  initialFingerprint:string; initialGames:number; initialPromotions:number;
  sessionState:'running'|'stopped'|'retrying'; restarts:number; recoveries?:number;
}
export interface TrainingResultFile {payload:TrainingResultPayload;sha256:string;}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function coherentCheckpoint(value:unknown,hash:string,champion:AiChampion):value is Checkpoint{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Checkpoint,c=parseChampion(v.champion,hash);
  return v.schema===1&&v.hash===hash&&!!c&&JSON.stringify(c)===JSON.stringify(champion)&&v.games===c.games&&v.round===c.generation&&integer(v.rng)&&typeof v.elapsedMs==='number'&&Number.isFinite(v.elapsedMs)&&v.elapsedMs>=0;
}
/** Read a coherent, atomic checkpoint. It may be newer than champion.json
 * after an abrupt exit between the two atomic renames. Never export a trial
 * weight as the champion. */
export function captureTrainingResult(root:string,meta:Omit<TrainingResultPayload,'kind'|'schema'|'createdAt'|'champion'|'checkpoint'|'previousChampions'>):TrainingResultFile{
  const hash=meta.catalogHash;let champion=readChampion(hash,root),checkpoint:Checkpoint|null=null;
  try{
    const value=JSON.parse(readFileSync(join(aiDirectory(hash,root),'checkpoint.json'),'utf8'));
    const embedded=parseChampion(value.champion,hash);
    if(embedded&&coherentCheckpoint(value,hash,embedded)&&(!champion||embedded.games>=champion.games&&embedded.generation>=champion.generation&&embedded.promotions>=champion.promotions)){
      champion=embedded;checkpoint=value;
    }
  }catch{/* The last atomic champion can still be exported. */}
  if(!champion)throw Error('No compatible champion is available to export.');
  const previousChampions=listPreviousChampions(hash,root).filter(c=>c.generation<=champion!.generation&&c.promotions<=champion!.promotions);
  const payload:TrainingResultPayload={kind:'card-duel-external-ai-training',schema:1,createdAt:new Date().toISOString(),...meta,champion,checkpoint,previousChampions};
  return {payload,sha256:digest(payload)};
}
export function writeTrainingResult(path:string,root:string,meta:Parameters<typeof captureTrainingResult>[1]){
  const result=captureTrainingResult(root,meta);saveJsonAtomic(path,result);return result;
}
/** Uploaded files are data only. Integrity is not proof of playing strength;
 * the model must be evaluated independently before any live release changes. */
export function readTrainingResult(path:string):TrainingResultPayload{
  if(statSync(path).size>32*1024*1024)throw Error('Training result is too large.');
  const raw=JSON.parse(readFileSync(path,'utf8')) as TrainingResultFile,p=raw?.payload;
  if(!p||p.kind!=='card-duel-external-ai-training'||p.schema!==1||!hex(p.catalogHash)||!hex(raw.sha256)||digest(p)!==raw.sha256)throw Error('Training result checksum or format is invalid.');
  const c=parseChampion(p.champion,p.catalogHash);
  if(!c||!hex(p.initialFingerprint)||!integer(p.initialGames)||!integer(p.initialPromotions)||p.initialGames>c.games||p.initialPromotions>c.promotions||!integer(p.restarts)||p.recoveries!==undefined&&!integer(p.recoveries)||!['running','stopped','retrying'].includes(p.sessionState)||typeof p.catalogVersion!=='string'||typeof p.programVersion!=='string'||!Number.isFinite(Date.parse(p.createdAt)))throw Error('Invalid training result metadata or champion.');
  if(p.checkpoint!==null&&!coherentCheckpoint(p.checkpoint,p.catalogHash,c))throw Error('Checkpoint and champion do not match.');
  if(!Array.isArray(p.previousChampions)||p.previousChampions.some(old=>{const parsed=parseChampion(old,p.catalogHash);return !parsed||parsed.promotions>c.promotions||parsed.generation>c.generation;}))throw Error('Invalid historical champions.');
  return {...p,champion:c};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const path=process.argv[2];if(!path)throw Error('Usage: node apps/cli/ai-training-result.ts <AI-TRAINING-RESULT.json>');
    const p=readTrainingResult(path),{catalog,version}=new CardStore().read(),hash=aiCatalogHash(catalog),current=readGameChampion(hash);
    console.log(JSON.stringify({catalog:version,compatible:p.catalogHash===hash,sourceCatalog:p.catalogVersion,sourceHash:p.catalogHash,createdAt:p.createdAt,sessionState:p.sessionState,champion:p.champion,additionalGames:p.champion.games-p.initialGames,additionalPromotions:p.champion.promotions-p.initialPromotions,restarts:p.restarts,candidateFingerprint:aiWeightFingerprint(p.champion.weights),currentFingerprint:current?aiWeightFingerprint(current.weights):null,checkpointIncluded:!!p.checkpoint,notice:'Read-only inspection. Independently benchmark the candidate before releasing it.'},null,2));
  }catch(e){console.error(e instanceof Error?e.message:e);process.exitCode=1;}
}
