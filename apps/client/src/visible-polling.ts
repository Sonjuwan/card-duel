/** Suspend presentation-only polling while the app is hidden. A pending
 * request is aborted on hide, and cannot overwrite a newer result on resume. */
type PollTimer=ReturnType<typeof setInterval>;
export type VisiblePollingEnvironment={
  visible:()=>boolean;
  listen:(listener:()=>void)=>()=>void;
  every:(listener:()=>void,ms:number)=>PollTimer;
  clear:(timer:PollTimer)=>void;
};
const browserEnvironment:VisiblePollingEnvironment={
  visible:()=>document.visibilityState==='visible',
  listen:listener=>{document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener);},
  every:(listener,ms)=>setInterval(listener,ms),clear:timer=>clearInterval(timer),
};
export function watchVisiblePolling({run,onTick,onError,periodMs,environment=browserEnvironment}:{
  run:(signal:AbortSignal)=>Promise<unknown>;
  onTick?:()=>void;
  onError?:(error:unknown)=>void;
  periodMs:number;
  environment?:VisiblePollingEnvironment;
}):()=>void{
  if(!Number.isFinite(periodMs)||periodMs<=0)throw Error('Invalid polling interval');
  let disposed=false,timer:PollTimer|undefined,active:AbortController|undefined;
  const stop=()=>{if(timer!==undefined){environment.clear(timer);timer=undefined;}active?.abort();active=undefined;};
  const poll=()=>{
    if(disposed||!environment.visible())return;
    onTick?.();
    if(active)return;
    const request=new AbortController();active=request;
    void Promise.resolve().then(()=>{if(!request.signal.aborted)return run(request.signal);}).catch(error=>{
      if(!disposed&&!request.signal.aborted)onError?.(error);
    }).finally(()=>{if(active===request)active=undefined;});
  };
  const onVisibility=()=>{
    if(disposed)return;
    if(!environment.visible()){stop();return;}
    if(timer===undefined)timer=environment.every(poll,periodMs);
    poll();
  };
  const unsubscribe=environment.listen(onVisibility);
  onVisibility();
  return()=>{if(disposed)return;disposed=true;stop();unsubscribe();};
}
