import {LocalDuel,publicSaveSummary} from './local-duel.ts';
import type {LocalRequest,LocalResponse,LocalSaveSummary} from './local-duel.ts';
import type {LocalSaveStore,SaveVersion} from './local-save-store.ts';
export type LocalDuelScope={postMessage:(message:LocalResponse)=>void;onmessage:(event:{data:LocalRequest})=>void};
/** Worker authority; storage and message transport are injectable for deterministic tests. */
export function attachLocalDuel(scope:LocalDuelScope,store:LocalSaveStore,owner:string){
let duel:LocalDuel|undefined,botTimer:ReturnType<typeof setTimeout>|undefined,turnTimer:ReturnType<typeof setTimeout>|undefined;
let ownsSave=false,saveAvailable=true,lastSaved:LocalSaveSummary|null=null,queue=Promise.resolve(),timerEpoch=0;
const clear=()=>{timerEpoch++;if(botTimer!==undefined)clearTimeout(botTimer);if(turnTimer!==undefined)clearTimeout(turnTimer);botTimer=undefined;turnTimer=undefined;};
async function refresh(hash:string){try{const saved=await store.read(hash);lastSaved=saved?publicSaveSummary(saved,hash):null;return true;}catch{return false;}}
async function persist(claim=false,expected?:SaveVersion|null){
  const snapshot=duel?.checkpoint();if(!snapshot||!saveAvailable)return false;
  // A claim of an unchanged game must still create a distinct save version,
  // even if both tabs act within the same millisecond.
  const prior=expected??lastSaved;if(prior&&Date.parse(snapshot.summary.savedAt)<=Date.parse(prior.savedAt))snapshot.summary.savedAt=new Date(Date.parse(prior.savedAt)+1).toISOString();
  try{if(!await store.write(snapshot,owner,claim,expected)){ownsSave=false;saveAvailable=false;await refresh(snapshot.catalogHash);return false;}ownsSave=true;lastSaved=snapshot.summary;return true;}catch{saveAvailable=false;await refresh(snapshot.catalogHash);return false;}
}
const view=(requestId?:number,resumed=false)=>{if(duel)scope.postMessage({type:'view',view:duel.view(),requestId,save:lastSaved,saveAvailable:saveAvailable&&ownsSave,...(resumed?{resumed:true}:{})});};
const emit=async(requestId?:number)=>{if(duel){await persist();view(requestId);}};
const fail=(e:unknown,requestId?:number)=>scope.postMessage({type:'error',error:e instanceof Error?e.message:String(e),requestId,save:lastSaved,saveAvailable:saveAvailable&&ownsSave});
const enqueue=(f:()=>Promise<void>)=>{queue=queue.then(f).catch(e=>{fail(e);clear();});};
function schedule(){
  if(!duel)return;clear();
  const deadline=duel.turnDeadline(),epoch=timerEpoch;
  if(deadline!==undefined)turnTimer=setTimeout(()=>enqueue(async()=>{if(epoch!==timerEpoch)return;if(duel?.expireTurn())await emit();schedule();}),Math.max(1,deadline-Date.now()));
  if(duel.botReady())botTimer=setTimeout(()=>enqueue(async()=>{if(epoch!==timerEpoch)return;if(duel?.botStep())await emit();schedule();}),duel.botDelay());
}
scope.onmessage=({data})=>{
  enqueue(async()=>{try{
    if(data.type==='inspectSave'){const available=await refresh(data.catalogHash);scope.postMessage({type:'saveInfo',save:lastSaved,available});return;}
    if(data.type==='start'){clear();duel=new LocalDuel(data.input);ownsSave=false;saveAvailable=true;lastSaved=null;await persist(true,data.replaceSave??null);view();schedule();return;}
    if(data.type==='resume'){clear();const saved=await store.read(data.catalogHash);if(!saved){lastSaved=null;throw Error('이어할 저장 경기가 없습니다.');}lastSaved=publicSaveSummary(saved,data.catalogHash);if(data.expectedCode!==undefined&&data.expectedCode!==lastSaved.code)throw Error('다른 탭에서 새 경기를 저장했습니다. 다시 확인해 주세요.');duel=LocalDuel.restore(saved,data.catalog,data.catalogHash,data.device);saveAvailable=true;if(!await persist(true,lastSaved)){duel=undefined;throw Error('다른 탭에서 저장 경기를 변경했습니다. 다시 확인해 주세요.');}view(undefined,true);schedule();return;}
    if(data.type==='rematch'&&duel){clear();duel=duel.rematch(data.code,data.seed);await emit(data.requestId);schedule();return;}
    if(data.type==='pause'&&duel){clear();if(!await persist()||!lastSaved)throw Error('경기 저장에 실패했습니다. 브라우저를 닫지 마세요.');scope.postMessage({type:'paused',requestId:data.requestId,save:lastSaved});duel=undefined;return;}
    if(data.type==='discard'){clear();if(duel){if(ownsSave)await store.remove(data.catalogHash,owner);duel=undefined;}else if(!data.expected||!await store.remove(data.catalogHash,undefined,data.expected)){await refresh(data.catalogHash);throw Error('다른 탭에서 저장 경기를 변경했습니다. 다시 확인해 주세요.');}const available=await refresh(data.catalogHash);scope.postMessage({type:'discarded',requestId:data.requestId,save:lastSaved,available});return;}
    if(data.type==='act'&&duel){clear();if(duel.expireTurn())await emit();duel.act(data.revision,data.action);await emit(data.requestId);schedule();}
    else throw Error('진행 중인 경기가 없습니다.');
  }catch(e){fail(e,'requestId'in data?data.requestId:undefined);if(data.type==='act'||data.type==='pause'||data.type==='discard'||data.type==='rematch')schedule();else clear();}});
};
return ()=>{clear();duel=undefined;};
}
