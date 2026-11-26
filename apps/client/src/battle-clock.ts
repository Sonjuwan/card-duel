/** Presentation-only timers. Turn deadlines remain authoritative engine times. */
export const secondsUntilDeadline=(deadline:number,now:number)=>Math.max(0,Math.ceil((deadline-now)/1000));

type Timer=ReturnType<typeof setInterval>;
export type DeadlineClockRuntime={
  now:()=>number;
  visible:()=>boolean;
  onVisibility:(listener:()=>void)=>(()=>void);
  every:(listener:()=>void,ms:number)=>Timer;
  after?:(listener:()=>void,ms:number)=>Timer;
  clear:(timer:Timer)=>void;
};
const browserClock:DeadlineClockRuntime={
  now:()=>Date.now(),visible:()=>!document.hidden,
  onVisibility:listener=>{document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener);},
  every:(listener,ms)=>setInterval(listener,ms),after:(listener,ms)=>setTimeout(listener,ms),clear:timer=>clearInterval(timer),
};

export function watchDeadlineSeconds(deadline:number|undefined,publish:(seconds:number|null)=>void,periodMs:number,clock=browserClock):()=>void{
  if(deadline===undefined){publish(null);return()=>{};}
  let timer:Timer|undefined,closed=false,last:number|undefined;
  const stop=()=>{if(timer!==undefined){clock.clear(timer);timer=undefined;}};
  const tick=()=>{
    if(closed||!clock.visible()){stop();return;}
    const now=clock.now(),remaining=secondsUntilDeadline(deadline,now);
    if(remaining!==last){last=remaining;publish(remaining);}
    if(remaining===0){stop();return;}
    // On real browsers schedule only the next displayed second boundary.
    // This leaves the authoritative worker/server deadline untouched.
    if(clock.after&&timer===undefined){
      const delay=Math.max(1,Math.min(1000,deadline-now-(remaining-1)*1000));
      timer=clock.after(()=>{timer=undefined;tick();},delay);
    }
  };
  const visibility=()=>{
    if(closed)return;
    if(!clock.visible()){stop();return;}
    if(clock.after)stop();
    tick();
    if(!clock.after&&timer===undefined&&secondsUntilDeadline(deadline,clock.now())>0)timer=clock.every(tick,periodMs);
  };
  const unsubscribe=clock.onVisibility(visibility);
  visibility();
  return()=>{closed=true;stop();unsubscribe();};
}
