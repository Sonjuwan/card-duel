import type {DialogueLine} from './battle-dialogue.ts';

export type VoiceClip={
  key:string;
  source:string;
  license:string;
  redistributionApproved:true;
  sha256:string;
  base64:string;
};

/** Add only approved original recordings. Embedded bytes work in both builds. */
export const VOICE_CLIPS:readonly VoiceClip[]=[];

export function findVoiceClip(line:DialogueLine,clips=VOICE_CLIPS){
  const subject=line.cardId?`card:${line.cardId}`:line.hero?`hero:${line.hero}`:null;
  if(!subject)return;
  return clips.find(clip=>clip.key===`${subject}:${line.kind}`&&validVoiceClip(clip));
}

export function validVoiceClip(clip:VoiceClip){
  return clip.redistributionApproved===true&&!!clip.source.trim()&&!!clip.license.trim()
    &&/^(card|hero):[\w-]+:(play|attack|hit|death|emote)$/.test(clip.key)
    &&/^[0-9a-f]{64}$/.test(clip.sha256)&&clip.base64.length>0&&clip.base64.length<=240000
    &&/^[A-Za-z0-9+/]+={0,2}$/.test(clip.base64);
}

export async function approvedVoiceBytes(clip:VoiceClip):Promise<ArrayBuffer|undefined>{
  if(!validVoiceClip(clip)||!globalThis.crypto?.subtle)return;
  try{
    const bytes=Uint8Array.from(atob(clip.base64),character=>character.charCodeAt(0));
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    if(Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('')===clip.sha256)return bytes.buffer;
  }catch{/* Unavailable or damaged clip falls back to local speech. */}
}
