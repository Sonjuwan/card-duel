import {validateBotWeights,DEFAULT_BOT_WEIGHTS} from '../../../packages/engine/src/index.ts';
import type {PublicAiProfile} from '../../../packages/protocol.ts';
export function parsePublicAiProfile(input:unknown,hash:string):PublicAiProfile|null{
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const v=input as Record<string,unknown>,weights=validateBotWeights(v.weights);
  if(v.catalogHash!==hash||!weights||typeof v.generation!=='number'||!Number.isSafeInteger(v.generation)||v.generation<0)return null;
  return{catalogHash:hash,weights,generation:v.generation};
}
export async function localAiProfile(hash:string):Promise<PublicAiProfile>{
  const key='card-duel-ai-profile-'+hash;
  try{
    const r=await fetch('/api/ai-profile',{cache:'no-store',signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw Error('Profile unavailable');
    const profile=parsePublicAiProfile(await r.json(),hash);
    if(profile){try{localStorage.setItem(key,JSON.stringify(profile));}catch{}return profile;}
  }catch{/* Same catalog cached copy or default works without the server. */}
  try{const cached=parsePublicAiProfile(JSON.parse(localStorage.getItem(key)??'null'),hash);if(cached)return cached;}catch{}
  return{catalogHash:hash,weights:{...DEFAULT_BOT_WEIGHTS},generation:0};
}
