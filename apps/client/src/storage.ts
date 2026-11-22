import { repairDeck, practiceDeck } from '../../../packages/engine/src/index.ts';
import type { Catalog, Deck } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';

/** A delayed acknowledgement must never replace a newer authoritative event. */
export function mergeRoomView(previous:RoomView|null,incoming:RoomView):RoomView{
  if(previous?.code===incoming.code&&previous.seat===incoming.seat&&previous.state&&(!incoming.state||previous.state.revision>incoming.state.revision))return previous;
  if(previous?.code===incoming.code&&previous.seat===incoming.seat&&previous.ranked&&incoming.ranked&&previous.ranked.reward!=='pending'&&(incoming.ranked.reward==='pending'||!incoming.ranked.rewardDetails))return {...incoming,ranked:{...incoming.ranked,reward:previous.ranked.reward,rewardDetails:previous.ranked.rewardDetails}};
  if(previous?.code===incoming.code&&previous.seat===incoming.seat&&previous.pvpReward==='saved'&&incoming.pvpReward==='pending')return {...incoming,pvpReward:'saved'};
  return incoming;
}

const draftPrefix='card-duel-draft-';
export function draftKey(hash:string):string{return `${draftPrefix}${hash}`;}
const lastDraftKey='card-duel-last-draft';
type StorageReader=Pick<Storage,'getItem'>&Partial<Pick<Storage,'length'|'key'>>;
type StorageWriter=Pick<Storage,'setItem'>;

export function localDraftStorage():Storage|undefined{try{return globalThis.localStorage;}catch{return undefined;}}

/** Prefer the current snapshot. A new balance version may reuse the previous
 * draft only if every card is still legal; the old snapshot stays untouched. */
export function readDraft(catalog:Catalog,hash:string,storage?:StorageReader):Deck {
  try{
    let stored=storage?.getItem(draftKey(hash));
    if(stored===null||stored===undefined){
      const previous=storage?.getItem(lastDraftKey);
      if(previous&&previous!==hash)stored=storage?.getItem(draftKey(previous));
      // v0.20 stored drafts by hash but had no latest-version marker. Recover
      // a uniquely identifiable old snapshot; never guess among several.
      else if(!previous&&storage?.key&&typeof storage.length==='number'){
        const legacy=Array.from({length:storage.length},(_,i)=>storage.key!(i)).filter((key):key is string=>typeof key==='string'&&key.startsWith(draftPrefix));
        if(legacy.length===1)stored=storage.getItem(legacy[0]!);
      }
    }
    const raw=JSON.parse(stored??'null');
    const repaired=repairDeck(catalog,raw);
    if(!repaired.discarded.length)return repaired.deck;
  }catch{/* Empty, unavailable, or invalid storage: use a legal starter deck. */}
  return practiceDeck(catalog,'warrior');
}
export function saveDraft(deck:Deck,hash:string,storage?:StorageWriter):boolean{
  try{if(!storage)return false;storage.setItem(draftKey(hash),JSON.stringify(deck));try{storage.setItem(lastDraftKey,hash);}catch{/* Draft is already stored; the migration hint is optional. */}return true;}catch{return false;}
}
