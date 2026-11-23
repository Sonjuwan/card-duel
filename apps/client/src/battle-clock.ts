/** Presentation-only timers. Turn deadlines remain authoritative engine times. */
export const secondsUntilDeadline=(deadline:number,now:number)=>Math.max(0,Math.ceil((deadline-now)/1000));

type Timer=ReturnType<typeof setInterval>;
export type DeadlineClockRuntime={
  now:()=>number;
  visible:()=>boolean;
  onVisibility:(listener:()=>void)=>(()=>void);
  every:(listener:()=>void,ms:number)=>Timer;
  clear:(timer:Timer)=>void;
};
const browserClock:DeadlineClockRuntime={
  now:()=>Date.now(),visible:()=>!document.hidden,
  onVisibility:listener=>{document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener);},
  every:(listener,ms)=>setInterval(listener,ms),clear:timer=>clearInterval(timer),
};

export function watchDeadlineSeconds(deadline:number|undefined,publish:(seconds:number|null)=>void,periodMs:number,clock=browserClock):()=>void{
  if(deadline===undefined){publish(null);return()=>{};}
  let timer:Timer|undefined,closed=false;
  const stop=()=>{if(timer!==undefined){clock.clear(timer);timer=undefined;}};
  const tick=()=>{if(closed)return;const remaining=secondsUntilDeadline(deadline,clock.now());publish(remaining);if(remaining===0)stop();};
  const visibility=()=>{
    if(closed)return;
    if(!clock.visible()){stop();return;}
    tick();
    if(timer===undefined&&secondsUntilDeadline(deadline,clock.now())>0)timer=clock.every(tick,periodMs);
  };
  const unsubscribe=clock.onVisibility(visibility);
  visibility();
  return()=>{closed=true;stop();unsubscribe();};
}
