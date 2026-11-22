import { aiWeightFingerprint,listChampions,listPreviousChampions,readChampion,transferSource,parseTransferSource } from '../server/ai-profile-store.ts';
import type { AiChampion,AiTransferSource } from '../server/ai-profile-store.ts';
import type { BotWeights } from '../../packages/engine/src/index.ts';
import {DEFAULT_BOT_WEIGHTS} from '../../packages/engine/src/index.ts';
import type {LeagueOpponent} from './ai-training-scenarios.ts';

/** A rejected set of weights is remembered by content, not merely version.
 * A newer checkpoint with different weights can be considered in a later run. */
export interface TransferAttempt{source:AiTransferSource;stage:'screen'|'validate';score:number;games:number;outcome:'rejected'|'promoted';completedAt:string;}
export interface TransferCandidate{weights:BotWeights;source:AiTransferSource;}
export function validTransferAttempt(input:unknown):input is TransferAttempt{
  if(!input||typeof input!=='object'||Array.isArray(input))return false;
  const a=input as Record<string,unknown>;
  return !!parseTransferSource(a.source)&&(a.stage==='screen'||a.stage==='validate')&&(a.outcome==='rejected'||a.outcome==='promoted'&&a.stage==='validate')&&typeof a.games==='number'&&Number.isSafeInteger(a.games)&&a.games>0&&typeof a.score==='number'&&Number.isFinite(a.score)&&a.score>=0&&a.score<=a.games&&typeof a.completedAt==='string'&&Number.isFinite(Date.parse(a.completedAt));
}
export function transferCandidates(target:AiChampion,attempts:readonly TransferAttempt[],root:string,explicitSource?:string):TransferCandidate[]{
  const heads=(explicitSource?[readChampion(explicitSource,root)].filter((x):x is AiChampion=>!!x):listChampions(root)).filter(c=>c.catalogHash!==target.catalogHash);
  // Screen each version's current champion first, then interleave historical
  // champions across catalogs. An earlier policy may transfer better than its
  // successor after a balance change; only validation can establish that.
  const history=heads.map(c=>listPreviousChampions(c.catalogHash,root));
  const sources=[...heads];for(let rank=0;history.some(list=>rank<list.length);rank++)for(const list of history)if(list[rank])sources.push(list[rank]);
  const seen=new Set([aiWeightFingerprint(target.weights),...attempts.map(x=>x.source.fingerprint)]);
  const candidates:TransferCandidate[]=[];
  for(const c of sources){
    if(c.catalogHash===target.catalogHash)continue;
    const source=transferSource(c);
    if(seen.has(source.fingerprint))continue;
    seen.add(source.fingerprint);
    candidates.push({weights:{...c.weights},source});
  }
  return candidates;
}
export function completedTransfer(source:AiTransferSource,stage:TransferAttempt['stage'],score:number,games:number,promoted:boolean):TransferAttempt{
  const attempt:TransferAttempt={source,stage,score,games,outcome:promoted?'promoted':'rejected',completedAt:new Date().toISOString()};
  if(!validTransferAttempt(attempt))throw Error('Invalid transfer evaluation');
  return attempt;
}
export function trainingLeague(champion:AiChampion,candidate:BotWeights,root:string):LeagueOpponent[]{
  const current=aiWeightFingerprint(champion.weights),challenger=aiWeightFingerprint(candidate);
  const seen=new Set([current,challenger]),league:LeagueOpponent[]=[];
  const baseline={...DEFAULT_BOT_WEIGHTS},baseHash=aiWeightFingerprint(baseline);
  if(!seen.has(baseHash)){league.push({weights:baseline,tag:'baseline'});seen.add(baseHash);}
  for(const c of [...listPreviousChampions(champion.catalogHash,root),...listChampions(root)]){
    const key=aiWeightFingerprint(c.weights);if(seen.has(key))continue;
    seen.add(key);league.push({weights:{...c.weights},tag:'league'});
    if(league.length>=5)break;
  }
  return league;
}
