export const CARD_HOVER_DELAY = 1000;
export const BATTLE_HOLD_DELAY = 300;

/** A trusted keyboard/assistive click is independent of an interrupted touch.
 * Do not treat a delayed pointer or synthetic detail-zero click as keyboard. */
export function independentActivation(event:{detail:number;isTrusted:boolean;pointerType?:string;sourceCapabilities?:{firesTouchEvents?:boolean}|null}):boolean{
  return event.isTrusted&&event.detail===0&&!event.pointerType&&!event.sourceCapabilities?.firesTouchEvents;
}

/** Cards in collections and mulligans can receive synthetic click events after
 * a scroll or a long-press. Preserve the pointer identity until release. */
export function createTouchPreviewGuard(delay=CARD_HOVER_DELAY){
  let press:{id:number;x:number;y:number;at:number;moved:boolean}|null=null,suppressUntil=0;
  const reset=()=>{press=null;suppressUntil=0;};
  return {
    begin(id:number,x:number,y:number,at:number){reset();press={id,x,y,at,moved:false};},
    // Signal the transition to a drag once; later movement cannot reopen inspection.
    move(id:number,x:number,y:number){if(!press||press.id!==id||press.moved)return false;if(Math.hypot(x-press.x,y-press.y)<8)return false;press.moved=true;return true;},
    end(id:number,x:number,y:number,at:number){if(!press||press.id!==id)return false;if(press.moved||Math.hypot(x-press.x,y-press.y)>=8||at-press.at>=delay)suppressUntil=at+300;press=null;return true;},
    // A battle inspection tap is read-only, including a stationary long press.
    // A moved or cancelled pointer cannot open it or synthesize an action.
    endTap(id:number,x:number,y:number,at:number){if(!press||press.id!==id)return false;const tap=!press.moved&&Math.hypot(x-press.x,y-press.y)<8;press=null;suppressUntil=at+300;return tap;},
    cancel(id:number,at:number){if(!press||press.id!==id)return false;press=null;suppressUntil=at+300;return true;},
    suppress(at:number){return at<suppressUntil;},reset,
  };
}

/** A single pending card per view; a stale leave/timer cannot affect a newer card. */
export function createHoverTiming<T>(publish:(value:T|null)=>void,clock={set:(fn:()=>void,ms:number)=>setTimeout(fn,ms),clear:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)}){
  let current:string|null=null, pending:ReturnType<typeof setTimeout>|undefined, generation=0, reader:(()=>T|null)|null=null, opened=false,pinned=false;
  function clear(key?:string){
    if(key!==undefined&&key!==current)return;
    generation++;if(pending!==undefined)clock.clear(pending);pending=undefined;current=null;reader=null;opened=false;pinned=false;publish(null);
  }
  function start(key:string,read:()=>T|null,delay=CARD_HOVER_DELAY){
    if(current===key)return;
    clear();current=key;reader=read;const token=generation;
    pending=clock.set(()=>{if(token!==generation||current!==key)return;pending=undefined;const value=read();if(value===null){clear(key);return;}opened=true;publish(value);},delay);
  }
  function pin(key:string,read:()=>T|null){clear();const value=read();if(value===null)return;current=key;reader=read;opened=true;pinned=true;publish(value);}
  function leave(key:string){if(!pinned)clear(key);}
  function dismissPinned(){if(pinned)clear();}
  /** Refresh a visible preview in place when the server updates attack/health,
   * without bypassing the original dwell time or exposing removed cards. */
  function refresh(){
    if(!reader)return;const value=reader();
    if(value===null){clear();return;}
    if(opened)publish(value);
  }
  return{start,clear,refresh,pin,leave,dismissPinned};
}
