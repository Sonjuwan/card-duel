import type {LocalDuelCheckpoint,LocalSaveSummary} from './local-duel.ts';
export type SaveVersion=Pick<LocalSaveSummary,'code'|'revision'|'savedAt'>;
export interface LocalSaveStore{read(hash:string):Promise<LocalDuelCheckpoint|null>;write(snapshot:LocalDuelCheckpoint,owner:string,claim:boolean,expected?:SaveVersion|null):Promise<boolean>;remove(hash:string,owner?:string,expected?:SaveVersion):Promise<boolean>}
export type Entry={hash:string;owner:string;snapshot:LocalDuelCheckpoint};
const dbName='card-duel-solo-saves-v1',storeName='matches';
function sameVersion(current:Entry|undefined,expected:SaveVersion){const actual=current?.snapshot?.summary;return !!actual&&actual.code===expected.code&&actual.revision===expected.revision&&actual.savedAt===expected.savedAt;}
export function saveWriteAllowed(current:Entry|undefined,owner:string,claim:boolean,expected?:SaveVersion|null){return claim?(expected===null?!current:!!expected&&sameVersion(current,expected)):current?.owner===owner;}
export function saveRemoveAllowed(current:Entry|undefined,owner?:string,expected?:SaveVersion){return !current||((owner!==undefined?current.owner===owner:!!expected)&&(!expected||sameVersion(current,expected)));}
/** The renderer receives only the public summary. The canonical local game
 * lives inside the worker and IndexedDB. Ownership fencing prevents an older
 * worker/tab from overwriting a save that a newer worker has claimed. */
export class IndexedLocalSaveStore implements LocalSaveStore{
  private db:Promise<IDBDatabase>|undefined;
  private open(){
    return this.db??=new Promise<IDBDatabase>((resolve,reject)=>{
      let request:IDBOpenDBRequest;try{if(!globalThis.indexedDB)throw Error('이 브라우저는 경기 저장을 지원하지 않습니다.');request=indexedDB.open(dbName,1);}catch(e){reject(e);return;}
      const timer=setTimeout(()=>reject(Error('경기 저장소 연결이 지연되었습니다.')),3000);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName,{keyPath:'hash'});};
      request.onerror=()=>{clearTimeout(timer);reject(request.error??Error('경기 저장소 오류'));};request.onblocked=()=>{clearTimeout(timer);reject(Error('다른 탭에서 경기 저장소를 사용 중입니다.'));};
      request.onsuccess=()=>{clearTimeout(timer);request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    });
  }
  async read(hash:string){const db=await this.open();return new Promise<LocalDuelCheckpoint|null>((resolve,reject)=>{const tx=db.transaction(storeName,'readonly'),req=tx.objectStore(storeName).get(hash);const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('경기 저장소 읽기 시간 초과'));},3000);tx.oncomplete=()=>{clearTimeout(timer);resolve((req.result as Entry|undefined)?.snapshot??null);};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error??req.error??Error('경기 저장소 읽기 실패'));};});}
  private async modify(hash:string,act:(store:IDBObjectStore,entry:Entry|undefined)=>boolean){const db=await this.open();return new Promise<boolean>((resolve,reject)=>{
    const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName),get=store.get(hash);let applied=false;
    const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('경기 저장 시간 초과'));},3000);
    get.onsuccess=()=>{try{applied=act(store,get.result as Entry|undefined);}catch(e){clearTimeout(timer);tx.abort();reject(e);}};
    tx.oncomplete=()=>{clearTimeout(timer);resolve(applied);};tx.onerror=()=>{clearTimeout(timer);reject(tx.error??get.error??Error('경기 저장 실패'));};tx.onabort=()=>{clearTimeout(timer);reject(tx.error??Error('경기 저장 취소'));};
  });}
  write(snapshot:LocalDuelCheckpoint,owner:string,claim:boolean,expected?:SaveVersion|null){return this.modify(snapshot.catalogHash,(store,current)=>{if(!saveWriteAllowed(current,owner,claim,expected))return false;store.put({hash:snapshot.catalogHash,owner,snapshot} satisfies Entry);return true;});}
  remove(hash:string,owner?:string,expected?:SaveVersion){return this.modify(hash,(store,current)=>{if(!saveRemoveAllowed(current,owner,expected))return false;store.delete(hash);return true;});}
}
