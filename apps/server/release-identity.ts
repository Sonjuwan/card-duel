import {createHash} from 'node:crypto';
import {DEFAULT_BOT_WEIGHTS} from '../../packages/engine/src/index.ts';
import type {BotWeights,Catalog} from '../../packages/engine/src/index.ts';
import type {GrowthView} from '../../packages/account-protocol.ts';
import {AI_RELEASE_ROOT,aiCatalogHash,aiWeightFingerprint,readChampion} from './ai-profile-store.ts';

export const sha256Text=(value:string)=>createHash('sha256').update(value).digest('hex');
export const catalogPayload=(catalog:Catalog)=>JSON.stringify(Object.values(catalog).filter(card=>card.kind!=='coin'));
export interface ReleaseIdentity{catalogHash:string;growthHash:string;aiGeneration:number;aiWeightsHash:string;}
export function releaseIdentity(catalog:Catalog,growth:GrowthView,weights:BotWeights,generation:number):ReleaseIdentity{
  return {catalogHash:sha256Text(catalogPayload(catalog)),growthHash:sha256Text(JSON.stringify(growth)),aiGeneration:generation,aiWeightsHash:aiWeightFingerprint(weights)};
}
/** Compare against the explicitly published model, never live training data. */
export function publishedReleaseIdentity(catalog:Catalog,growth:GrowthView):ReleaseIdentity{
  const model=readChampion(aiCatalogHash(catalog),AI_RELEASE_ROOT);
  return releaseIdentity(catalog,growth,model?.weights??DEFAULT_BOT_WEIGHTS,model?.promotions??0);
}
