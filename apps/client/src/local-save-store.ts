import {publicSaveSummary} from './local-duel.ts';
import type {LocalDuelCheckpoint,LocalSaveSummary,LocalSlotOverview} from './local-duel.ts';
import type {GrowthView,MatchAward} from '../../../packages/account-protocol.ts';
import {readOfflineGrowth,settleOfflineRanked,canRestoreGrowth,decodeGrowthBackup} from './offline-growth.ts';
import type {OfflineGrowthRecord} from './offline-growth.ts';
import {soloSlotDatabase} from './solo-slots.ts';
import type {SoloSlot,SoloNamespace} from './solo-slots.ts';
export type SaveVersion=Pick<LocalSaveSummary,'code'|'revision'|'savedAt'>;
export type RankedWrite={growth:GrowthView;award?:MatchAward};
export interface LocalSaveStore{read(hash:string):Promise<LocalDuelCheckpoint|null>;write(snapshot:LocalDuelCheckpoint,owner:string,claim:boolean,expected?:SaveVersion|null,ranked?:RankedWrite):Promise<boolean>;remove(hash:string,owner?:string,expected?:SaveVersion):Promise<boolean>;readGrowth?(growth:GrowthView):Promise<OfflineGrowthRecord>;restoreGrowth?(raw:unknown,growth:GrowthView):Promise<OfflineGrowthRecord>;inspectSlot?(hash:string,growth:GrowthView):Promise<LocalSlotOverview>}
export type Entry={hash:string;owner:string;snapshot:LocalDuelCheckpoint};
const storeName='matches',growthStoreName='growth',growthKey='player';
function sameVersion(current:Entry|undefined,expected:SaveVersion){const actual=current?.snapshot?.summary;return !!actual&&actual.code===expected.code&&actual.revision===expected.revision&&actual.savedAt===expected.savedAt;}
export function saveWriteAllowed(current:Entry|undefined,owner:string,claim:boolean,expected?:SaveVersion|null){return claim?(expected===null?!current:!!expected&&sameVersion(current,expected)):current?.owner===owner;}
export function saveRemoveAllowed(current:Entry|undefined,owner?:string,expected?:SaveVersion){return !current||((owner!==undefined?current.owner===owner:!!expected)&&(!expected||sameVersion(current,expected)));}
function checkedEntrySummary(current:Entry,expectedHash?:string){
  const snapshot=current?.snapshot;
  if(!snapshot?.input||!snapshot?.state||typeof current.hash!=='string'||!/^[a-f0-9]{64}$/.test(current.hash)||snapshot.input.catalogHash!==current.hash||expectedHash!==undefined&&expectedHash!==current.hash)throw Error('손상된 경기 저장 데이터입니다. 기존 기록을 변경하지 않습니다.');
  const summary=publicSaveSummary(snapshot,current.hash);
  if(snapshot.input.code!==summary.code||snapshot.state.phase!==summary.phase||snapshot.state.revision!==summary.revision)throw Error('경기 저장 요약이 일치하지 않습니다. 기존 기록을 변경하지 않습니다.');
  return summary;
}
export function activeRankedSave(current:Entry|undefined){
  if(current===undefined)return false;
  const summary=checkedEntrySummary(current);
  return summary.rank!==undefined&&summary.phase!=='finished';
}
export const canReplaceRankedSave=(current:Entry|undefined,snapshot:LocalDuelCheckpoint)=>!activeRankedSave(current)||current?.snapshot.summary.code===snapshot.summary.code&&!!snapshot.input.ranked;
export const otherActiveRankedSave=(entries:readonly Entry[],hash:string)=>entries.some(entry=>entry.hash!==hash&&activeRankedSave(entry));
export const rankedClaimAllowedAcrossVersions=(entries:readonly Entry[],current:Entry|undefined,snapshot:LocalDuelCheckpoint)=>current?.snapshot.summary.code===snapshot.summary.code||!otherActiveRankedSave(entries,snapshot.catalogHash);
export function slotOverview(raw:unknown,entry:Entry|undefined,saveCount:number,hash:string,growth:GrowthView,otherActiveRanked=false):LocalSlotOverview{
  const {profile}=readOfflineGrowth(raw,growth);
  if(!Number.isSafeInteger(saveCount)||saveCount<(entry?1:0))throw Error('저장 슬롯 정보가 손상되었습니다.');
  return {initialized:raw!==undefined,rank:profile.rank,xp:profile.xp,ownedCards:profile.ownedCards.length,save:entry===undefined?null:checkedEntrySummary(entry,hash),otherSaves:saveCount-(entry?1:0),otherActiveRanked};
}
/** The renderer receives only the public summary. The canonical local game
 * lives inside the worker and IndexedDB. Ownership fencing prevents an older
 * worker/tab from overwriting a save that a newer worker has claimed. */
export class IndexedLocalSaveStore implements LocalSaveStore{
  private db:Promise<IDBDatabase>|undefined;
  private readonly dbName:string;
  constructor(slot:SoloSlot=1,namespace:SoloNamespace='main',developerFree=false){this.dbName=soloSlotDatabase(slot,namespace,developerFree);}
  private open(){
    if(this.db)return this.db;
    const opening=new Promise<IDBDatabase>((resolve,reject)=>{
      let request:IDBOpenDBRequest;try{if(!globalThis.indexedDB)throw Error('이 브라우저는 경기 저장을 지원하지 않습니다.');request=indexedDB.open(this.dbName,2);}catch(e){reject(e);return;}
      let failed=false;
      const failure=(reason:unknown)=>{failed=true;clearTimeout(timer);reject(reason);};
      const timer=setTimeout(()=>failure(Error('경기 저장소 연결이 지연되었습니다.')),3000);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName,{keyPath:'hash'});if(!request.result.objectStoreNames.contains(growthStoreName))request.result.createObjectStore(growthStoreName);};
      request.onerror=()=>failure(request.error??Error('경기 저장소 오류'));request.onblocked=()=>failure(Error('다른 탭에서 경기 저장소를 사용 중입니다.'));
      request.onsuccess=()=>{clearTimeout(timer);const connection=request.result;if(failed){connection.close();return;}
        const invalidate=()=>{if(this.db===opening)this.db=undefined;};
        connection.onversionchange=()=>{connection.close();invalidate();};connection.onclose=invalidate;resolve(connection);};
    });
    this.db=opening;
    // Rejected opens must not permanently poison this worker. A later retry still
    // uses the same slot, and every write retains the existing ownership fence.
    void opening.catch(()=>{if(this.db===opening)this.db=undefined;});
    return opening;
  }
  async read(hash:string){const db=await this.open();return new Promise<LocalDuelCheckpoint|null>((resolve,reject)=>{const tx=db.transaction(storeName,'readonly'),req=tx.objectStore(storeName).get(hash);const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('경기 저장소 읽기 시간 초과'));},3000);tx.oncomplete=()=>{clearTimeout(timer);try{const entry=req.result as Entry|undefined;if(entry===undefined){resolve(null);return;}checkedEntrySummary(entry,hash);resolve(entry.snapshot);}catch(e){reject(e);}};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error??req.error??Error('경기 저장소 읽기 실패'));};});}
  async inspectSlot(hash:string,growth:GrowthView){const db=await this.open();return new Promise<LocalSlotOverview>((resolve,reject)=>{
    // A preview is read-only. In particular, do not initialize or patch another slot's growth record.
    const tx=db.transaction([storeName,growthStoreName],'readonly'),matches=tx.objectStore(storeName),all=matches.getAll(),progress=tx.objectStore(growthStoreName).get(growthKey);
    const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('저장 슬롯 미리보기 시간 초과'));},3000);
    tx.oncomplete=()=>{clearTimeout(timer);try{const entries=all.result as Entry[];const saved=entries.find(entry=>entry.hash===hash);resolve(slotOverview(progress.result,saved,entries.length,hash,growth,otherActiveRankedSave(entries,hash)));}catch(e){reject(e);}};
    tx.onabort=tx.onerror=()=>{clearTimeout(timer);reject(tx.error??Error('저장 슬롯 미리보기 실패'));};
  });}
  async readGrowth(growth:GrowthView){const db=await this.open();return new Promise<OfflineGrowthRecord>((resolve,reject)=>{const tx=db.transaction(growthStoreName,'readwrite'),store=tx.objectStore(growthStoreName),req=store.get(growthKey);let record:OfflineGrowthRecord,reason:unknown;const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('성장 기록 읽기 시간 초과'));},3000);req.onsuccess=()=>{try{record=readOfflineGrowth(req.result,growth);if(!req.result||JSON.stringify(req.result.profile.ownedCards)!==JSON.stringify(record.profile.ownedCards))store.put(record,growthKey);}catch(e){reason=e;tx.abort();}};tx.oncomplete=()=>{clearTimeout(timer);resolve(record);};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(reason??tx.error??req.error??Error('성장 기록 읽기 실패'));};});}
  async restoreGrowth(raw:unknown,growth:GrowthView){
    const incoming=decodeGrowthBackup(raw,growth),db=await this.open();return new Promise<OfflineGrowthRecord>((resolve,reject)=>{
      const tx=db.transaction([storeName,growthStoreName],'readwrite'),matches=tx.objectStore(storeName),progress=tx.objectStore(growthStoreName),get=progress.get(growthKey);let result:OfflineGrowthRecord,reason:unknown;
      const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('성장 백업 복원 시간 초과'));},3000);
      get.onsuccess=()=>{try{const current=readOfflineGrowth(get.result,growth);if(!canRestoreGrowth(current))throw Error('이미 진행한 성장 기록이 있습니다. 기존 기록을 덮어쓰지 않습니다.');const saves=matches.getAll();saves.onsuccess=()=>{try{if((saves.result as Entry[]).some(activeRankedSave))throw Error('먼저 진행 중인 랭크 경기를 완료하세요.');result={...incoming,profile:{...incoming.profile,ownedCards:[...new Set([...incoming.profile.ownedCards,...current.profile.ownedCards])].sort()}};progress.put(result,growthKey);}catch(e){reason=e;tx.abort();}};}catch(e){reason=e;tx.abort();}};
      tx.oncomplete=()=>{clearTimeout(timer);resolve(result);};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(reason??tx.error??Error('성장 백업 복원 실패'));};
    });
  }
  private async modify(hash:string,act:(store:IDBObjectStore,entry:Entry|undefined)=>boolean){const db=await this.open();return new Promise<boolean>((resolve,reject)=>{
    const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName),get=store.get(hash);let applied=false;
    const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('경기 저장 시간 초과'));},3000);
    get.onsuccess=()=>{try{applied=act(store,get.result as Entry|undefined);}catch(e){clearTimeout(timer);tx.abort();reject(e);}};
    tx.oncomplete=()=>{clearTimeout(timer);resolve(applied);};tx.onerror=()=>{clearTimeout(timer);reject(tx.error??get.error??Error('경기 저장 실패'));};tx.onabort=()=>{clearTimeout(timer);reject(tx.error??Error('경기 저장 취소'));};
  });}
  async write(snapshot:LocalDuelCheckpoint,owner:string,claim:boolean,expected?:SaveVersion|null,ranked?:RankedWrite){
    if(!snapshot.input.ranked){if(ranked)throw Error('연습 경기에는 성장 보상을 적용할 수 없습니다.');return this.modify(snapshot.catalogHash,(store,current)=>{if(!saveWriteAllowed(current,owner,claim,expected)||!canReplaceRankedSave(current,snapshot))return false;store.put({hash:snapshot.catalogHash,owner,snapshot} satisfies Entry);return true;});}
    const context=snapshot.input.ranked;if(!ranked||(snapshot.state.phase==='finished')!==!!ranked.award||ranked.award&&ranked.award.matchId!==snapshot.summary.code)throw Error('랭크 보상 데이터가 올바르지 않습니다.');
    const db=await this.open();return new Promise<boolean>((resolve,reject)=>{
      const tx=db.transaction([storeName,growthStoreName],'readwrite'),matches=tx.objectStore(storeName),progress=tx.objectStore(growthStoreName),get=matches.get(snapshot.catalogHash);let applied=false,reason:unknown;
      const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('랭크 경기 저장 시간 초과'));},3000);
      get.onsuccess=()=>{try{const current=get.result as Entry|undefined;if(!saveWriteAllowed(current,owner,claim,expected)||!canReplaceRankedSave(current,snapshot))return;const update=()=>{const request=progress.get(growthKey);request.onsuccess=()=>{try{
        let record=readOfflineGrowth(request.result,ranked.growth);const duplicate=record.settledMatchIds.includes(snapshot.summary.code);
        if(duplicate&&(!ranked.award||(get.result as Entry|undefined)?.snapshot.summary.code!==snapshot.summary.code))return;
        if(!duplicate&&(context.profileRevision!==record.profile.revision||context.rank!==record.profile.rank))return;
        if(ranked.award)record=settleOfflineRanked(record,ranked.growth,context,ranked.award);
        matches.put({hash:snapshot.catalogHash,owner,snapshot} satisfies Entry);progress.put(record,growthKey);applied=true;
      }catch(e){reason=e;tx.abort();}};};
        // Only a newly created ranked match needs the cross-version check. An existing active match must still be resumable when returning to its original release.
        if(claim&&current?.snapshot.summary.code!==snapshot.summary.code){const all=matches.getAll();all.onsuccess=()=>{try{if(rankedClaimAllowedAcrossVersions(all.result as Entry[],current,snapshot))update();}catch(e){reason=e;tx.abort();}};}else update();
      }catch(e){reason=e;tx.abort();}};
      tx.oncomplete=()=>{clearTimeout(timer);resolve(applied);};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(reason??tx.error??Error('랭크 경기 저장 실패'));};
    });
  }
  remove(hash:string,owner?:string,expected?:SaveVersion){return this.modify(hash,(store,current)=>{if(!saveRemoveAllowed(current,owner,expected)||activeRankedSave(current))return false;store.delete(hash);return true;});}
}
