/** Fixed, non-destructive save slots. Slot 1 keeps every legacy key/address. */
export const SOLO_SLOTS=[1,2,3] as const;
export type SoloSlot=typeof SOLO_SLOTS[number];
export const validSoloSlot=(value:unknown):value is SoloSlot=>SOLO_SLOTS.includes(value as SoloSlot);
/** Coalesce focus/visibility events without letting hidden slot probes waste CPU. */
export function slotPreviewRefreshAction(visible:boolean,active:boolean):'start'|'cancel'|'skip'{
  if(!visible)return active?'cancel':'skip';
  return active?'skip':'start';
}
export const soloSlotDatabase=(slot:SoloSlot)=>{if(!validSoloSlot(slot))throw Error('잘못된 저장 슬롯');return slot===1?'card-duel-solo-saves-v1':`card-duel-solo-saves-v1-slot-${slot}`;};
export type SlotStorage=Pick<Storage,'getItem'|'setItem'|'key'|'length'>;
const selectedKey='card-duel-active-solo-slot-v1';
const browserStorage=():SlotStorage|undefined=>{try{return globalThis.localStorage;}catch{return undefined;}};
export function readSelectedSlot(storage=browserStorage()):SoloSlot{try{const value=Number(storage?.getItem(selectedKey));if(validSoloSlot(value))return value;}catch{}return 1;}
export function rememberSlot(slot:SoloSlot,storage=browserStorage()){if(!validSoloSlot(slot))return false;try{if(!storage)return false;storage.setItem(selectedKey,String(slot));return true;}catch{return false;}}
/** Captures its slot forever; switching another tab or changing preference cannot redirect writes. */
export function soloSlotStorage(slot:SoloSlot,storage=browserStorage()):SlotStorage{
  if(!validSoloSlot(slot))throw Error('잘못된 저장 슬롯');
  const prefix=slot===1?'':`card-duel-slot-${slot}:`;
  const keys=()=>{if(!storage)return [];return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>typeof key==='string'&&(slot===1?!key.startsWith('card-duel-slot-'):key.startsWith(prefix))).map(key=>key.slice(prefix.length));};
  return {getItem:key=>storage?.getItem(prefix+key)??null,setItem:(key,value)=>{if(!storage)throw Error('저장 공간을 사용할 수 없습니다.');storage.setItem(prefix+key,value);},get length(){return keys().length;},key:index=>keys()[index]??null};
}
export function hasSlotLocalData(slot:SoloSlot,storage=browserStorage()):boolean{
  // An unavailable storage is not evidence of a fresh slot.
  if(!storage)return true;
  try{const scoped=soloSlotStorage(slot,storage);return Array.from({length:scoped.length},(_,i)=>scoped.key(i)).some(key=>!!key&&key.startsWith('card-duel-')&&key!==selectedKey);}catch{return true;}
}
