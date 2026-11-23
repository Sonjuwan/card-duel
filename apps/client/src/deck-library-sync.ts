import {changedDeckLibrary,isDeckLibraryStorageEvent} from './named-decks.ts';
import type {NamedDeck} from './named-decks.ts';

type DeckStore=Pick<Storage,'getItem'|'setItem'>;
export type DeckLibraryEventEnvironment={
  visible:()=>boolean;
  onStorage:(listener:(key:string|null)=>void)=>()=>void;
  onFocus:(listener:()=>void)=>()=>void;
  onVisibility:(listener:()=>void)=>()=>void;
};
const browserEnvironment:DeckLibraryEventEnvironment={
  visible:()=>document.visibilityState==='visible',
  onStorage:listener=>{const handler=(event:StorageEvent)=>listener(event.key);window.addEventListener('storage',handler);return()=>window.removeEventListener('storage',handler);},
  onFocus:listener=>{window.addEventListener('focus',listener);return()=>window.removeEventListener('focus',listener);},
  onVisibility:listener=>{document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener);},
};

/** Read-only cross-tab synchronization: strict parsing protects the currently
 * displayed library against corrupt bytes; local edit state is never written. */
export function watchDeckLibraryChanges({store,current,canRefresh,onChange,onError,onRecovered,environment=browserEnvironment}:{
  store:DeckStore;
  current:()=>readonly NamedDeck[];
  canRefresh:()=>boolean;
  onChange:(latest:NamedDeck[])=>void;
  onError:(message:string)=>void;
  onRecovered?:(previousError:string)=>void;
  environment?:DeckLibraryEventEnvironment;
}):()=>void{
  let disposed=false,lastError:string|null=null;
  const refresh=()=>{
    if(disposed||!environment.visible()||!canRefresh())return;
    try{const latest=changedDeckLibrary(current(),store);
      if(latest)onChange(latest);
      // Recover even when no rows changed: otherwise an old storage warning
      // can linger indefinitely after the browser regains storage access.
      if(lastError!==null){const recovered=lastError;lastError=null;if(!latest)onRecovered?.(recovered);}
    }
    catch(error){const message=error instanceof Error?error.message:'저장 덱을 다시 읽지 못했습니다.';lastError=message;onError(message);}
  };
  const onStorage=(key:string|null)=>{if(isDeckLibraryStorageEvent(key))refresh();};
  const unsubscribe=[environment.onStorage(onStorage),environment.onFocus(refresh),environment.onVisibility(refresh)];
  // A change can occur between an initial read and subscribing, or while the
  // screen is temporarily blocked by a local save. Recheck on every subscribe.
  refresh();
  return()=>{if(disposed)return;disposed=true;for(const stop of unsubscribe)stop();};
}
