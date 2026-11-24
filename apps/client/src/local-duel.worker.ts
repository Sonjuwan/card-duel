import {attachLocalDuel} from './local-duel-session.ts';
import type {LocalDuelScope} from './local-duel-session.ts';
import {IndexedLocalSaveStore} from './local-save-store.ts';
import {validSoloSlot} from './solo-slots.ts';
import type {LocalRequest} from './local-duel.ts';
const scope=globalThis as unknown as LocalDuelScope;
const owner=typeof crypto!=='undefined'?Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''):String(Date.now())+'-'+Math.random();
// Bind once, before any reads or writes. Legacy and online workers default to slot 1.
scope.onmessage=({data})=>{
  const message=data as LocalRequest|{type:'selectSlot';slot:unknown;namespace?:unknown};
  if(message.type==='selectSlot'){
    const namespace=message.namespace;
    if(!validSoloSlot(message.slot)||namespace!==undefined&&namespace!=='ui-preview'){const reject=()=>scope.postMessage({type:'error',error:'잘못된 저장 슬롯'});scope.onmessage=reject;reject();return;}
    attachLocalDuel(scope,new IndexedLocalSaveStore(message.slot,namespace==='ui-preview'?'ui-preview':'main'),owner);return;
  }
  attachLocalDuel(scope,new IndexedLocalSaveStore(),owner);scope.onmessage({data});
};
