import { createHash, randomUUID } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_WEIGHT_KEYS,DEFAULT_BOT_WEIGHTS,validateBotWeights } from '../../packages/engine/src/index.ts';
import type { BotWeights,Catalog } from '../../packages/engine/src/index.ts';
export const AI_ROOT=fileURLToPath(new URL('../../data/ai/',import.meta.url));
export const AI_RELEASE_ROOT=fileURLToPath(new URL('../../data/ai-release/',import.meta.url));
export const AI_SCHEMA=1;
export function aiCatalogHash(catalog:Catalog){return createHash('sha256').update(JSON.stringify(Object.values(catalog).sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');}
export interface AiChampion{
  schema:1;catalogHash:string;weights:BotWeights;generation:number;games:number;minutes:number;promotions:number;validatedWins:number;validatedGames:number;updatedAt:string;
  /** Only set after independent target-version validation of a prior model. */
  transferredFrom?:AiTransferSource;
}
export interface AiTransferSource{catalogHash:string;fingerprint:string;generation:number;promotions:number;games:number;updatedAt:string;}
const hashPattern=/^[a-f0-9]{64}$/;
export function aiWeightFingerprint(weights:BotWeights){return createHash('sha256').update(JSON.stringify(BOT_WEIGHT_KEYS.map(k=>weights[k]))).digest('hex');}
export function transferSource(c:AiChampion):AiTransferSource{return{catalogHash:c.catalogHash,fingerprint:aiWeightFingerprint(c.weights),generation:c.generation,promotions:c.promotions,games:c.games,updatedAt:c.updatedAt};}
export function parseTransferSource(raw:unknown):AiTransferSource|null{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const v=raw as Record<string,unknown>;
  if(typeof v.catalogHash!=='string'||!hashPattern.test(v.catalogHash)||typeof v.fingerprint!=='string'||!hashPattern.test(v.fingerprint)||typeof v.updatedAt!=='string'||!Number.isFinite(Date.parse(v.updatedAt)))return null;
  if(!['generation','promotions','games'].every(k=>typeof v[k]==='number'&&Number.isSafeInteger(v[k])&&Number(v[k])>=0))return null;
  return{catalogHash:v.catalogHash,fingerprint:v.fingerprint,generation:v.generation as number,promotions:v.promotions as number,games:v.games as number,updatedAt:v.updatedAt};
}
export function defaultChampion(catalogHash:string):AiChampion{return{schema:AI_SCHEMA,catalogHash,weights:{...DEFAULT_BOT_WEIGHTS},generation:0,games:0,minutes:0,promotions:0,validatedWins:0,validatedGames:0,updatedAt:new Date().toISOString()};}
export function parseChampion(raw:unknown,hash:string):AiChampion|null{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const p=raw as Record<string,unknown>,weights=validateBotWeights(p.weights);
  if(p.schema!==AI_SCHEMA||p.catalogHash!==hash||!weights)return null;
  if(!['generation','games','promotions','validatedWins','validatedGames'].every(k=>typeof p[k]==='number'&&Number.isSafeInteger(p[k])&&Number(p[k])>=0))return null;
  if(typeof p.minutes!=='number'||!Number.isFinite(p.minutes)||p.minutes<0||Number(p.validatedWins)>Number(p.validatedGames)||typeof p.updatedAt!=='string')return null;
  const source=p.transferredFrom===undefined?undefined:parseTransferSource(p.transferredFrom);
  if(source===null||source?.catalogHash===hash)return null;
  return {schema:AI_SCHEMA,catalogHash:hash,weights,generation:p.generation as number,games:p.games as number,minutes:p.minutes,promotions:p.promotions as number,validatedWins:p.validatedWins as number,validatedGames:p.validatedGames as number,updatedAt:p.updatedAt,...(source?{transferredFrom:source}:{})};
}
export function aiDirectory(hash:string,root=AI_ROOT){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid AI catalog hash');return join(root,hash);}
export function readChampion(hash:string,root=AI_ROOT):AiChampion|null{
  try{const path=join(aiDirectory(hash,root),'champion.json');if(!existsSync(path))return null;return parseChampion(JSON.parse(readFileSync(path,'utf8')),hash);}catch{return null;}
}
/** Live local training remains isolated. A fresh deployment without its
 * ignored training directory may use only the compatible released champion. */
export function resolveGameChampion(hash:string,localRoot=AI_ROOT,releaseRoot=AI_RELEASE_ROOT):{champion:AiChampion;source:'local'|'release'}|null{
  const local=readChampion(hash,localRoot);if(local)return {champion:local,source:'local'};
  const release=readChampion(hash,releaseRoot);return release?{champion:release,source:'release'}:null;
}
export function readGameChampion(hash:string,localRoot=AI_ROOT,releaseRoot=AI_RELEASE_ROOT){return resolveGameChampion(hash,localRoot,releaseRoot)?.champion??null;}
/** Read only complete, compatible, version-isolated champions. Never load
 * checkpoint trials as a deployed model. An actively training source can be
 * read safely because champion replacement is atomic. */
export function listChampions(root=AI_ROOT):AiChampion[]{
  if(!existsSync(root))return[];
  return readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&hashPattern.test(e.name)).flatMap(e=>{const c=readChampion(e.name,root);return c?[c]:[];}).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.catalogHash.localeCompare(b.catalogHash));
}
export function listPreviousChampions(hash:string,root=AI_ROOT):AiChampion[]{
  const dir=aiDirectory(hash,root);if(!existsSync(dir))return[];
  return readdirSync(dir).filter(name=>/^previous-champion-\d+(?:-[a-f0-9]{12})?\.json$/.test(name)).flatMap(name=>{try{const c=parseChampion(JSON.parse(readFileSync(join(dir,name),'utf8')),hash);return c?[c]:[];}catch{return[];}}).sort((a,b)=>b.promotions-a.promotions||b.generation-a.generation);
}
export function saveJsonAtomic(path:string,value:unknown){
  const tmp=path+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});renameSync(tmp,path);
}
export function saveChampion(champion:AiChampion,root=AI_ROOT){
  if(!parseChampion(champion,champion.catalogHash))throw Error('Invalid AI champion');
  const dir=aiDirectory(champion.catalogHash,root);mkdirSync(dir,{recursive:true});saveJsonAtomic(join(dir,'champion.json'),champion);
}
/** Publish a verified champion only, not checkpoints, trials, or training locks.
 * Do not overwrite a newer released model with an older local checkpoint. */
export function exportReleaseChampion(hash:string,sourceRoot=AI_ROOT,releaseRoot=AI_RELEASE_ROOT){
  const champion=readChampion(hash,sourceRoot);if(!champion)throw new Error('호환되는 로컬 챔피언이 없습니다.');
  const prior=readChampion(hash,releaseRoot);
  if(prior&&(champion.games<prior.games||champion.promotions<prior.promotions||champion.generation<prior.generation))throw new Error('기존 배포 챔피언보다 오래된 모델은 덮어쓰지 않습니다.');
  if(prior&&JSON.stringify(prior)===JSON.stringify(champion))return {champion,status:'unchanged' as const};
  saveChampion(champion,releaseRoot);return {champion,status:'exported' as const};
}
