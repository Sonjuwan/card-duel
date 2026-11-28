import {LocalDuel,publicSaveSummary} from './local-duel.ts';
import type {LocalRequest,LocalResponse,LocalSaveSummary} from './local-duel.ts';
import type {LocalSaveStore,SaveVersion} from './local-save-store.ts';
import {createOfflineRankedInput,createOfflineDeveloperInput,offlineGrowth,createGrowthBackup} from './offline-growth.ts';
import type {AccountProfile,GrowthView} from '../../../packages/account-protocol.ts';
export type LocalDuelScope={postMessage:(message:LocalResponse)=>void;onmessage:(event:{data:LocalRequest})=>void};
/** Worker authority; storage and message transport are injectable for deterministic tests. */
export function attachLocalDuel(scope:LocalDuelScope,store:LocalSaveStore,owner:string,developerFree=false){
let duel:LocalDuel|undefined,botTimer:ReturnType<typeof setTimeout>|undefined,turnTimer:ReturnType<typeof setTimeout>|undefined;
let growth:GrowthView|undefined,profile:AccountProfile|undefined;
let ownsSave=false,saveAvailable=true,lastSaved:LocalSaveSummary|null=null,queue=Promise.resolve(),timerEpoch=0;
// A fresh PRACTICE match may fail its initial claim due to transient IndexedDB
// errors. Retry with the original expected version, never an unfenced write.
let initialClaimRetryable=false,initialClaimExpected:SaveVersion|null=null;
const clear=()=>{timerEpoch++;if(botTimer!==undefined)clearTimeout(botTimer);if(turnTimer!==undefined)clearTimeout(turnTimer);botTimer=undefined;turnTimer=undefined;};
async function refresh(hash:string){try{const saved=await store.read(hash);lastSaved=saved?publicSaveSummary(saved,hash):null;return true;}catch{return false;}}
async function persist(claim=false,expected?:SaveVersion|null){
  if(!duel||!saveAvailable&&!ownsSave&&!initialClaimRetryable)return false;
  const snapshot=duel.checkpoint();if(!snapshot)return false;
  // A claim of an unchanged game must still create a distinct save version,
  // even if both tabs act within the same millisecond.
  const prior=expected??lastSaved;if(prior&&Date.parse(snapshot.summary.savedAt)<=Date.parse(prior.savedAt))snapshot.summary.savedAt=new Date(Date.parse(prior.savedAt)+1).toISOString();
  try{
    const ranked=snapshot.input.ranked;
    if(ranked&&(!growth||!store.readGrowth))throw Error('오프라인 성장 저장소가 필요합니다.');
    const freshClaim=!ownsSave&&initialClaimRetryable;
    const claimSave=claim||freshClaim,expectedSave=freshClaim?initialClaimExpected:expected;
    const rankedWrite=ranked?{growth:growth!,award:duel.rankedAward()}:undefined;
    const committedProfile=rankedWrite&&store.writeRanked?await store.writeRanked(snapshot,owner,claimSave,expectedSave,rankedWrite):undefined;
    const written=committedProfile!==undefined?committedProfile!==null:await store.write(snapshot,owner,claimSave,expectedSave,rankedWrite);
    if(!written){
      ownsSave=false;saveAvailable=false;initialClaimRetryable=false;
      await refresh(snapshot.catalogHash);return false;
    }
    ownsSave=true;initialClaimRetryable=false;lastSaved=snapshot.summary;
    if(ranked)profile=committedProfile??(await store.readGrowth!(growth!)).profile;
    saveAvailable=true;return true;
  }catch{
    saveAvailable=false;
    // Only an exceptional first claim stays retryable. An explicit rejected
    // claim means another tab owns the save and MUST NOT be retried unfenced.
    return false;
  }
}
const view=(requestId?:number,resumed=false)=>{if(duel){const room=duel.view(),entry=profile?.recentMatches?.find(m=>m.matchId===room.code);if(room.ranked&&entry&&room.status==='finished'&&ownsSave&&saveAvailable){const {xp,questAdvanced,questCompleted,questBonusXp,matchXp,completedQuests,unlockedCards,rankAfter}=entry;room.ranked={...room.ranked,reward:entry.eligible?'saved':'notEligible',rewardDetails:{xp,questAdvanced,questCompleted,questBonusXp,matchXp,completedQuests,unlockedCards,rankAfter}};}scope.postMessage({type:'view',view:room,requestId,save:lastSaved,saveAvailable:saveAvailable&&ownsSave,saveRetryable:!saveAvailable&&(ownsSave||initialClaimRetryable),profile,...(resumed?{resumed:true}:{})});}};
const emit=async(requestId?:number)=>{if(duel){await persist();view(requestId);}};
const fail=(e:unknown,requestId?:number)=>scope.postMessage({type:'error',error:e instanceof Error?e.message:String(e),requestId,save:lastSaved,saveAvailable:saveAvailable&&ownsSave,saveRetryable:!saveAvailable&&(ownsSave||initialClaimRetryable)});
const enqueue=(f:()=>Promise<void>)=>{queue=queue.then(f).catch(e=>{fail(e);clear();});};
function schedule(){
  if(!duel)return;clear();
  const deadline=duel.turnDeadline(),epoch=timerEpoch;
  if(deadline!==undefined)turnTimer=setTimeout(()=>enqueue(async()=>{if(epoch!==timerEpoch)return;if(duel?.expireTurn())await emit();schedule();}),Math.max(1,deadline-Date.now()));
  if(duel.botReady())botTimer=setTimeout(()=>enqueue(async()=>{if(epoch!==timerEpoch)return;if(duel?.botStep())await emit();schedule();}),duel.botDelay());
}
scope.onmessage=({data})=>{
  enqueue(async()=>{try{
    if(data.type==='inspectSlot'){if(duel||!store.inspectSlot)throw Error('저장 슬롯 정보를 확인할 수 없습니다.');scope.postMessage({type:'slotInfo',overview:await store.inspectSlot(data.catalogHash,offlineGrowth(data.catalog))});return;}
    if(data.type==='selectRewardPath'){
      if(!store.readGrowth)throw Error('성장 저장소를 사용할 수 없습니다.');
      const {profile}=await store.readGrowth(offlineGrowth(data.catalog),data.pathId);
      scope.postMessage({type:'rewardPathSelected',profile});return;
    }
    if(data.type==='exportGrowth'||data.type==='restoreGrowth'){
      if(duel)throw Error('대전 중에는 성장 백업을 변경할 수 없습니다.');const currentGrowth=offlineGrowth(data.catalog);
      if(data.type==='exportGrowth'){if(!store.readGrowth)throw Error('성장 저장소를 사용할 수 없습니다.');const record=await store.readGrowth(currentGrowth);scope.postMessage({type:'growthBackup',backup:createGrowthBackup(record,currentGrowth),profile:record.profile});}
      else{if(!store.restoreGrowth)throw Error('성장 저장소를 사용할 수 없습니다.');const record=await store.restoreGrowth(data.backup,currentGrowth);scope.postMessage({type:'growthRestored',profile:record.profile});}return;
    }
    if(data.type==='inspectSave'){
      // A user who closed the UI preview during a match must return to a
      // recorded defeat rather than an unfinished game. The browser cannot
      // promise to flush IndexedDB during pagehide, so settle on next launch.
      // This is opt-in per request; older/live versions retain their saves.
      if(data.settleAbandoned){
        if(!data.catalog)throw Error('중단 경기 패배 판정에 카드 정보가 필요합니다.');
        const snapshot=await store.read(data.catalogHash);
        if(snapshot&&snapshot.summary.phase!=='finished'){
          const previous=publicSaveSummary(snapshot,data.catalogHash);
          const abandoned=LocalDuel.restore(snapshot,data.catalog,data.catalogHash);
          abandoned.forfeit();
          const completed=abandoned.checkpoint();
          if(!completed)throw Error('중단 경기 패배 상태를 기록하지 못했습니다.');
          if(Date.parse(completed.summary.savedAt)<=Date.parse(previous.savedAt))
            completed.summary.savedAt=new Date(Date.parse(previous.savedAt)+1).toISOString();
          const rules=snapshot.input.ranked?offlineGrowth(data.catalog):undefined;
          const ranked=rules?{growth:rules,award:abandoned.rankedAward()}:undefined;
          const applied=await store.write(completed,owner,true,previous,ranked);
          if(!applied)throw Error('경기 기록이 다른 탭에서 변경되었습니다. 저장소를 다시 확인하세요.');
        }
      }
      const available=await refresh(data.catalogHash);let otherActiveRanked:boolean|undefined;if(data.catalog&&store.readGrowth)try{const rules=offlineGrowth(data.catalog);profile=(await store.readGrowth(rules)).profile;if(store.inspectSlot)otherActiveRanked=(await store.inspectSlot(data.catalogHash,rules)).otherActiveRanked;}catch{/* Practice can still use the old match store. */}scope.postMessage({type:'saveInfo',save:lastSaved,available,profile,otherActiveRanked});return;}
    if(data.type==='forfeitSaved'){
      if(duel)throw Error('전투 중에는 저장 경기 교체를 처리할 수 없습니다.');
      const snapshot=await store.read(data.catalogHash);
      if(!snapshot)throw Error('기존 저장 경기 정보가 없습니다. 다시 확인하세요.');
      const previous=publicSaveSummary(snapshot,data.catalogHash);
      if(previous.code!==data.expected.code||previous.revision!==data.expected.revision||previous.savedAt!==data.expected.savedAt)
        throw Error('다른 탭에서 저장 경기가 변경되었습니다. 확인 후 다시 시도하세요.');
      if(snapshot.summary.phase!=='finished'){
        const abandoned=LocalDuel.restore(snapshot,data.catalog,data.catalogHash);
        abandoned.forfeit();
        const completed=abandoned.checkpoint();
        if(!completed)throw Error('기존 경기를 패배로 정산하지 못했습니다.');
        if(Date.parse(completed.summary.savedAt)<=Date.parse(previous.savedAt))
          completed.summary.savedAt=new Date(Date.parse(previous.savedAt)+1).toISOString();
        const growthRules=snapshot.input.ranked?offlineGrowth(data.catalog):undefined;
        if(!await store.write(completed,owner,true,previous,growthRules?{growth:growthRules,award:abandoned.rankedAward()}:undefined))
          throw Error('저장 경기 패배 정산에 실패했습니다. 기존 경기를 보존했습니다.');
      }
      if(!await refresh(data.catalogHash)||!lastSaved)throw Error('패배 정산 확인에 실패했습니다. 저장소를 다시 확인하세요.');
      if(store.readGrowth&&snapshot.input.ranked)profile=(await store.readGrowth(offlineGrowth(data.catalog))).profile;
      scope.postMessage({type:'forfeited',requestId:data.requestId,save:lastSaved,profile});
      return;
    }
    if(data.type==='start'){clear();if(developerFree!==Boolean(data.input.developerFree)||developerFree&&(data.ranked||data.developerRank!==undefined))throw Error('개발자 자유 대전 저장소가 일치하지 않습니다.');if(data.ranked&&data.developerRank!==undefined)throw Error('랭크와 개발자 시험은 동시에 시작할 수 없습니다.');if(data.developerExperiment!==undefined&&(typeof data.developerExperiment!=='boolean'||data.developerRank===undefined||data.ranked))throw Error('실험 AI는 개발자 시험에서만 사용할 수 있습니다.');const {ranked:_,developerTest:__,...practice}=data.input;growth=undefined;profile=undefined;let input=practice;if(data.ranked){if(!store.readGrowth)throw Error('오프라인 성장 저장소가 필요합니다.');growth=offlineGrowth(practice.catalog);if(store.inspectSlot&&practice.catalogHash&&(await store.inspectSlot(practice.catalogHash,growth)).otherActiveRanked)throw Error('이전 카드 버전의 진행 중인 랭크 경기가 있습니다. 해당 버전에서 경기를 완료한 뒤 다시 시작하세요.');const record=await store.readGrowth(growth);profile=record.profile;input=createOfflineRankedInput(practice,record,growth);}else if(data.developerRank!==undefined)input=createOfflineDeveloperInput(practice,offlineGrowth(practice.catalog),data.developerRank,data.developerExperiment);duel=new LocalDuel(input);ownsSave=false;saveAvailable=true;lastSaved=null;
      initialClaimExpected=data.replaceSave??null;
      initialClaimRetryable=!data.ranked;
      const saved=await persist(true,initialClaimExpected);
      if(data.ranked&&!saved){duel=undefined;initialClaimRetryable=false;throw Error('랭크 경기 저장에 실패했습니다. 다른 탭이나 저장소를 확인하세요.');}
      view();schedule();return;}
    if(data.type==='resume'){clear();initialClaimRetryable=false;const saved=await store.read(data.catalogHash);if(!saved||Boolean(saved.input.developerFree)!==developerFree){lastSaved=null;throw Error('이어할 저장 경기가 없습니다.');}lastSaved=publicSaveSummary(saved,data.catalogHash);if(data.expectedCode!==undefined&&data.expectedCode!==lastSaved.code)throw Error('다른 탭에서 새 경기를 저장했습니다. 다시 확인해 주세요.');growth=saved.input.ranked?offlineGrowth(data.catalog):undefined;profile=undefined;duel=LocalDuel.restore(saved,data.catalog,data.catalogHash,data.device);saveAvailable=true;if(!await persist(true,lastSaved)){duel=undefined;throw Error('다른 탭에서 저장 경기 또는 성장 기록을 변경했습니다. 다시 확인해 주세요.');}view(undefined,true);schedule();return;}
    if(data.type==='rematch'&&duel){clear();initialClaimRetryable=false;duel=duel.rematch(data.code,data.seed);await emit(data.requestId);schedule();return;}
    if(data.type==='retrySave'&&duel){
      // A background save may already have recovered after the user saw the
      // warning. Acknowledge it without a redundant write or claiming ownership.
      if(saveAvailable&&ownsSave){view(data.requestId);return;}
      if(!ownsSave&&!initialClaimRetryable)throw Error('현재 저장 경기를 다른 탭이 변경했거나 사용할 수 없습니다.');
      clear();if(!await persist())throw Error('경기 저장에 실패했습니다. 브라우저를 닫지 마세요.');
      view(data.requestId);schedule();return;
    }
    if(data.type==='forfeit'&&duel){
      clear();
      duel.forfeit();
      if(!await persist()||!lastSaved)throw Error('패배 기록 저장에 실패했습니다. 다시 시도하세요.');
      scope.postMessage({type:'forfeited',requestId:data.requestId,save:lastSaved,profile});
      duel=undefined;return;
    }
    if(data.type==='pause'&&duel){clear();if(!await persist()||!lastSaved)throw Error('경기 저장에 실패했습니다. 브라우저를 닫지 마세요.');scope.postMessage({type:'paused',requestId:data.requestId,save:lastSaved,profile});duel=undefined;return;}
    if(data.type==='discard'){clear();if(duel){if(ownsSave)await store.remove(data.catalogHash,owner);duel=undefined;}else if(!data.expected||!await store.remove(data.catalogHash,undefined,data.expected)){await refresh(data.catalogHash);throw Error('다른 탭에서 저장 경기를 변경했습니다. 다시 확인해 주세요.');}const available=await refresh(data.catalogHash);scope.postMessage({type:'discarded',requestId:data.requestId,save:lastSaved,available});return;}
    if(data.type==='act'&&duel){clear();if(duel.expireTurn())await emit();duel.act(data.revision,data.action);await emit(data.requestId);schedule();}
    else throw Error('진행 중인 경기가 없습니다.');
  }catch(e){fail(e,'requestId'in data?data.requestId:undefined);if(data.type==='act'||data.type==='pause'||data.type==='retrySave'||data.type==='discard'||data.type==='forfeit'||data.type==='rematch')schedule();else clear();}});
};
return ()=>{clear();duel=undefined;};
}
