import type {FailureCode} from '../../../packages/protocol.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import type {LocalSaveSummary} from './local-duel.ts';
const key='card-duel-pending-ticket-v1',pattern=/^[0-9a-f]{64}$/;
const reloadKey='card-duel-auto-release-reload-v1';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function readRoomTicket(storage:Store|undefined):string|null{try{const value=storage?.getItem(key);return value&&pattern.test(value)?value:null;}catch{return null;}}
export function saveRoomTicket(storage:Store|undefined,value:string|null){try{if(value)storage?.setItem(key,value);else storage?.removeItem(key);}catch{/* Current-tab memory still works. */}}
export function terminalSessionFailure(code:FailureCode|undefined){return code==='sessionInvalid'||code==='roomExpired'||code==='ticketExpired';}
/** Only warn while a local match has unconfirmed durable state. A saved
 * match can be closed normally; the browser controls whether a warning shows. */
export function shouldWarnLocalExit(room:RoomView|null,busy:boolean,saveAvailable:boolean|undefined,saveRetryable:boolean):boolean{
  if(room?.botEngine!=='device'||!room.state)return false;
  // A completed match may still contain an unpersisted result. Treat a
  // failed save as unconfirmed state even after the win/lose animation.
  return busy||saveRetryable||saveAvailable!==true;
}
/** The in-game exit button does not trigger beforeunload. Do not silently
 * discard an unsaved final result when the player leaves its result screen. */
export function shouldConfirmUnstoredResultExit(room:RoomView|null,saveAvailable:boolean|undefined){
  return room?.botEngine==='device'&&room.status==='finished'&&saveAvailable!==true;
}
/** A failed or timed-out read is not evidence that a prior save vanished. */
export function reconcileSaveProbe(previous:LocalSaveSummary|null,response:{available:boolean;save:LocalSaveSummary|null}|undefined):LocalSaveSummary|null{
  return response?.available?response.save:previous;
}
export function savedMatchConfidence(available:boolean|undefined):string|null{
  return available===undefined?'저장 경기 재확인 중…':available===false?'마지막 확인 기록 · 현재 저장소 확인 실패':null;
}
/** Autonomous AI views may advance the visible board, but only the matching
 * command acknowledgement (or the first start/resume view) unlocks input. */
export function localViewAcknowledges(requestId:number|undefined,currentRequest:number,firstView:boolean,revision:number|undefined,resumed?:boolean):boolean{
  return requestId!==undefined?requestId===currentRequest:firstView&&(revision===0||resumed===true);
}
export function newRoomTicket(random:Crypto=globalThis.crypto):string{if(!random?.getRandomValues)throw Error('이 브라우저에서 안전한 방을 생성할 수 없습니다.');return Array.from(random.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
export function sessionStore():Storage|undefined{try{return globalThis.sessionStorage;}catch{return undefined;}}
/** Never automatically reload twice before a matching version AND catalog
 * handshake. With blocked storage, only a user-initiated reload is safe. */
export function reserveReleaseReload(storage:Store|undefined):boolean{
  if(!storage)return false;
  try{if(storage.getItem(reloadKey)!==null)return false;storage.setItem(reloadKey,'1');return storage.getItem(reloadKey)==='1';}catch{return false;}
}
export function confirmRelease(storage:Store|undefined,currentVersion:string,currentHash:string,remoteVersion?:string,remoteHash?:string):boolean{
  if(!remoteVersion||!remoteHash||currentVersion!==remoteVersion||currentHash!==remoteHash)return false;
  try{storage?.removeItem(reloadKey);}catch{}
  return true;
}
/** A local worker must never be torn down just because the online server was
 * upgraded. Re-evaluate once it releases the match. */
export function releaseDisposition(currentVersion:string,currentHash:string,remoteVersion:string|undefined,remoteHash:string|undefined,localWorkerActive:boolean):'current'|'defer'|'reload'{
  const changed=remoteVersion!==undefined&&remoteVersion!==currentVersion||remoteHash!==undefined&&remoteHash!==currentHash;
  return changed?(localWorkerActive?'defer':'reload'):'current';
}
