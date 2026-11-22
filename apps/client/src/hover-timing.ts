export const CARD_HOVER_DELAY = 1000;

/** A single pending card per view; a stale leave/timer cannot affect a newer card. */
export function createHoverTiming<T>(publish:(value:T|null)=>void,clock={set:(fn:()=>void,ms:number)=>setTimeout(fn,ms),clear:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)}){
  let current:string|null=null, pending:ReturnType<typeof setTimeout>|undefined, generation=0, reader:(()=>T|null)|null=null, opened=false;
  function clear(key?:string){
    if(key!==undefined&&key!==current)return;
    generation++;if(pending!==undefined)clock.clear(pending);pending=undefined;current=null;reader=null;opened=false;publish(null);
  }
  function start(key:string,read:()=>T|null){
    if(current===key)return;
    clear();current=key;reader=read;const token=generation;
    pending=clock.set(()=>{if(token!==generation||current!==key)return;pending=undefined;const value=read();if(value===null){clear(key);return;}opened=true;publish(value);},CARD_HOVER_DELAY);
  }
  /** Refresh a visible preview in place when the server updates attack/health,
   * without bypassing the original dwell time or exposing removed cards. */
  function refresh(){
    if(!reader)return;const value=reader();
    if(value===null){clear();return;}
    if(opened)publish(value);
  }
  return{start,clear,refresh};
}
