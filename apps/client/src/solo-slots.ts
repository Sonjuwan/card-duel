/** Fixed, non-destructive save slots. Slot 1 keeps every legacy key/address. */
export const SOLO_SLOTS=[1,2,3] as const;
export type SoloSlot=typeof SOLO_SLOTS[number];
export const validSoloSlot=(value:unknown):value is SoloSlot=>SOLO_SLOTS.includes(value as SoloSlot);
/** Coalesce focus/visibility events without letting hidden slot probes waste CPU. */
export function slotPreviewRefreshAction(visible:boolean,active:boolean):'start'|'cancel'|'skip'{
  if(!visible)return active?'cancel':'skip';
  return active?'skip':'start';
}
/** GitHub Pages hosts live v0.298 and the v0.297 UI preview under ONE origin.
 * Separate the preview's saves without reading, migrating or deleting old data.
 * The live site's legacy keys/database names must remain byte-for-byte stable. */
export type SoloNamespace='main'|'ui-preview';
export const currentSoloNamespace=(pathname=typeof window==='undefined'?'':window.location.pathname):SoloNamespace=>/(?:^|\/)ui-preview(?:\/|$)/.test(pathname)?'ui-preview':'main';
export const soloSlotDatabase=(slot:SoloSlot,namespace:SoloNamespace='main')=>{
  if(!validSoloSlot(slot))throw Error('잘못된 저장 슬롯');
  const original=slot===1?'card-duel-solo-saves-v1':`card-duel-solo-saves-v1-slot-${slot}`;
  return namespace==='ui-preview'?`${original}-ui-preview`:original;
};
export type SlotStorage=Pick<Storage,'getItem'|'setItem'|'key'|'length'>;
const selectedKey='card-duel-active-solo-slot-v1';
const selectedSlotKey=(namespace:SoloNamespace)=>namespace==='ui-preview'?'card-duel-ui-preview-active-solo-slot-v1':selectedKey;
const browserStorage=():SlotStorage|undefined=>{try{return globalThis.localStorage;}catch{return undefined;}};
export function readSelectedSlot(storage=browserStorage(),namespace:SoloNamespace=currentSoloNamespace()):SoloSlot{try{const value=Number(storage?.getItem(selectedSlotKey(namespace)));if(validSoloSlot(value))return value;}catch{}return 1;}
export function rememberSlot(slot:SoloSlot,storage=browserStorage(),namespace:SoloNamespace=currentSoloNamespace()){if(!validSoloSlot(slot))return false;try{if(!storage)return false;storage.setItem(selectedSlotKey(namespace),String(slot));return true;}catch{return false;}}
/** Captures its slot forever; switching another tab or changing preference cannot redirect writes. */
export function soloSlotStorage(slot:SoloSlot,storage=browserStorage(),namespace:SoloNamespace=currentSoloNamespace(),deckMode:'player'|'developer'='player'):SlotStorage{
  if(!validSoloSlot(slot))throw Error('잘못된 저장 슬롯');
  const slotPrefix=namespace==='ui-preview'?`card-duel-ui-preview-slot-${slot}:`:slot===1?'':`card-duel-slot-${slot}:`;
  const prefix=slotPrefix+(deckMode==='developer'?'developer:':'');
  const keys=()=>{
    if(!storage)return [];
    return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>typeof key==='string'&&(
      deckMode==='developer'?key.startsWith(prefix):
      namespace==='ui-preview'?key.startsWith(prefix)&&!key.startsWith(prefix+'developer:'):
      slot===1?!key.startsWith('card-duel-slot-')&&!key.startsWith('card-duel-ui-preview-')&&!key.startsWith('developer:'):
      key.startsWith(prefix)&&!key.startsWith(prefix+'developer:')
    )).map(key=>key.slice(prefix.length));
  };
  return {getItem:key=>storage?.getItem(prefix+key)??null,setItem:(key,value)=>{if(!storage)throw Error('저장 공간을 사용할 수 없습니다.');storage.setItem(prefix+key,value);},get length(){return keys().length;},key:index=>keys()[index]??null};
}
export function hasSlotLocalData(slot:SoloSlot,storage=browserStorage(),namespace:SoloNamespace=currentSoloNamespace()):boolean{
  // An unavailable storage is not evidence of a fresh slot.
  if(!storage)return true;
  try{const scoped=soloSlotStorage(slot,storage,namespace);return Array.from({length:scoped.length},(_,i)=>scoped.key(i)).some(key=>!!key&&key.startsWith('card-duel-')&&key!==selectedKey);}catch{return true;}
}
