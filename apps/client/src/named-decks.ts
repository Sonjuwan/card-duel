import {HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import type {Deck} from '../../../packages/engine/src/index.ts';

export const decksKey='card-duel-saved-decks';
export const isDeckLibraryStorageEvent=(key:string|null)=>key===null||key===decksKey||key.endsWith(`:${decksKey}`);
export const MAX_SAVED_DECKS=20;
export type NamedDeck={name:string;deck:Deck};
type DeckStorage=Pick<Storage,'getItem'|'setItem'>;
const valid=(item:unknown):item is NamedDeck=>{if(!item||typeof item!=='object')return false;const v=item as NamedDeck;return typeof v.name==='string'&&v.name.trim()===v.name&&v.name.length>0&&v.name.length<=40&&HERO_CLASSES.includes(v.deck?.heroClass)&&Array.isArray(v.deck?.cards)&&v.deck.cards.length===30&&v.deck.cards.every(id=>typeof id==='string'&&id.length>0&&id.length<=128);};
const storage=():DeckStorage|undefined=>{try{return globalThis.localStorage;}catch{return undefined;}};
const browserLocks=():Pick<LockManager,'request'>|undefined=>{try{return globalThis.navigator?.locks;}catch{return undefined;}};

/** One short, origin-scoped exclusive lock for deck mutations across tabs.
 * Older browsers retain the v0.104 fresh-read checks; never retry an uncertain
 * lock request unlocked. No growth/IndexedDB operations run while held. */
export async function withDeckLibraryLock<T>(action:()=>T,locks=browserLocks()):Promise<T>{
  if(!locks)return action();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
  try{return await locks.request('card-duel-deck-library-v1',{mode:'exclusive',signal:controller.signal},()=>action());}
  catch(e){if(controller.signal.aborted)throw Error('다른 탭의 덱 저장 작업을 기다리고 있습니다. 잠시 후 다시 시도하세요.');throw e;}
  finally{clearTimeout(timer);}
}

/** Lenient display only; do not use to overwrite saved records on import. */
export function readDecks(store=storage()):NamedDeck[]{try{const raw=JSON.parse(store?.getItem(decksKey)??'[]');return Array.isArray(raw)?raw.filter(valid).slice(0,MAX_SAVED_DECKS):[];}catch{return[];}}
export function parseDeckLibrary(raw:unknown):NamedDeck[]{
  if(!Array.isArray(raw)||raw.length>MAX_SAVED_DECKS||!raw.every(valid)||new Set(raw.map(v=>v.name)).size!==raw.length)throw Error('저장 덱 데이터 형식이 손상되었습니다. 기존 덱은 변경하지 않습니다.');
  return structuredClone(raw);
}
function strictRead(store:DeckStorage){const saved=store.getItem(decksKey);if(saved===null)return [];let raw:unknown;try{raw=JSON.parse(saved);}catch{throw Error('저장 덱 데이터 형식이 손상되었습니다. 기존 덱은 변경하지 않습니다.');}return parseDeckLibrary(raw);}
export type DeckLibraryBackup={format:'card-duel-saved-decks';schema:1;exportedAt:string;decks:NamedDeck[]};
export function backupDeckLibrary(store=storage(),now=new Date().toISOString()):DeckLibraryBackup{if(!store)throw Error('덱 저장소를 사용할 수 없습니다.');return {format:'card-duel-saved-decks',schema:1,exportedAt:now,decks:strictRead(store)};}
export function parseDeckBackup(raw:unknown):NamedDeck[]{
  if(!raw||typeof raw!=='object')throw Error('저장 덱 백업 파일이 아닙니다.');const b=raw as DeckLibraryBackup;
  if(b.format!=='card-duel-saved-decks'||b.schema!==1||typeof b.exportedAt!=='string'||!Number.isFinite(Date.parse(b.exportedAt)))throw Error('지원하지 않는 덱 백업입니다.');return parseDeckLibrary(b.decks);
}
const sameDeck=(a:Deck,b:Deck)=>a.heroClass===b.heroClass&&a.cards.length===b.cards.length&&a.cards.every((card,i)=>card===b.cards[i]);
export function changedDeckLibrary(current:readonly NamedDeck[],store:DeckStorage):NamedDeck[]|null{
  // Strict read: a corrupt or inaccessible external update must not replace
  // a valid list on screen with an apparently empty library.
  const latest=strictRead(store);
  return latest.length===current.length&&latest.every((item,i)=>item.name===current[i].name&&sameDeck(item.deck,current[i].deck))?null:latest;
}

/** An unreadable library is NOT the same as a confirmed empty library.
 * Retain verified rows and tell the user why they may be out of date. */
export function checkedDeckLibrary(current:NamedDeck[],store:DeckStorage):{decks:NamedDeck[];warning:string|null}{
  try{return {decks:changedDeckLibrary(current,store)??current,warning:null};}
  catch{return {decks:current,warning:'저장 덱을 확인할 수 없습니다. 마지막으로 확인된 목록을 표시합니다. 저장 공간을 확인하고 백업하세요.'};}
}
/** Failed mutations keep the most recent strictly valid storage snapshot;
 * inaccessible or corrupt data must never blank the previously seen rows. */
export function deckLibraryAfterWriteFailure(current:NamedDeck[],store:DeckStorage):NamedDeck[]{
  return checkedDeckLibrary(current,store).decks;
}

/** Read and validate again after the user confirms the specific record. An
 * unrelated new deck must survive; a changed target requires fresh consent. */
export function saveNamedDeck(entry:NamedDeck,expected:NamedDeck|null,store:DeckStorage){
  if(!valid(entry)||expected&&expected.name!==entry.name)throw Error('저장할 덱이 올바르지 않습니다.');
  const next=strictRead(store),index=next.findIndex(d=>d.name===entry.name),current=next[index];
  if(expected?(!current||!sameDeck(current.deck,expected.deck)):!!current)throw Error('다른 탭에서 같은 이름의 덱을 변경했습니다. 목록을 확인하고 다시 저장하세요.');
  if(index<0&&next.length>=MAX_SAVED_DECKS)throw Error(`최대 ${MAX_SAVED_DECKS}개 덱을 저장할 수 있습니다.`);
  next[index<0?next.length:index]=structuredClone(entry);
  store.setItem(decksKey,JSON.stringify(next));return next;
}
export function deleteNamedDeck(expected:NamedDeck,store:DeckStorage){
  const next=strictRead(store),index=next.findIndex(d=>d.name===expected.name);
  if(index<0||!sameDeck(next[index].deck,expected.deck))throw Error('다른 탭에서 해당 덱을 변경했습니다. 목록을 확인하고 다시 선택하세요.');
  next.splice(index,1);store.setItem(decksKey,JSON.stringify(next));return next;
}

/** Never overwrite a user deck. The whole merge is computed before any write.
 * Older card IDs survive a patch; the ordinary load path handles compatibility. */
export function mergeDeckLibraries(current:NamedDeck[],incoming:NamedDeck[]){
  const next=parseDeckLibrary(current),source=parseDeckLibrary(incoming);let added=0,duplicates=0,renamed=0;
  for(const entry of source){const same=next.find(d=>d.name===entry.name);if(same&&sameDeck(same.deck,entry.deck)){duplicates++;continue;}
    let name=entry.name;if(same){let n=2;while(true){const suffix=` (복원 ${n++})`;const limit=40-suffix.length,head=entry.name.slice(0,limit);
        // Never cut a UTF-16 emoji surrogate pair while suffixing a conflict.
        name=(/[\uD800-\uDBFF]$/.test(head)?head.slice(0,-1):head)+suffix;const clash=next.find(d=>d.name===name);if(!clash)break;if(sameDeck(clash.deck,entry.deck)){name='';break;}}if(!name){duplicates++;continue;}renamed++;}
    next.push({name,deck:structuredClone(entry.deck)});added++;
  }
  if(next.length>MAX_SAVED_DECKS)throw Error(`최대 ${MAX_SAVED_DECKS}개까지 저장할 수 있습니다. 기존 덱은 변경하지 않았습니다.`);
  return {decks:next,added,duplicates,renamed};
}
export function restoreDeckLibrary(raw:unknown,store=storage()){
  if(!store)throw Error('덱 저장소를 사용할 수 없습니다.');const result=previewDeckRestore(raw,store);
  if(result.added)store.setItem(decksKey,JSON.stringify(result.decks));return result;
}
/** Validate the whole merge without touching storage. Call again at the time
 * of the actual write instead of persisting stale preflight data. */
export function previewDeckRestore(raw:unknown,store=storage()){
  if(!store)throw Error('덱 저장소를 사용할 수 없습니다.');return mergeDeckLibraries(strictRead(store),parseDeckBackup(raw));
}
