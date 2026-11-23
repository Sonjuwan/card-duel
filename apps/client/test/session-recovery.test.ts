import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newRoomTicket,readRoomTicket,saveRoomTicket,terminalSessionFailure,releaseDisposition,reserveReleaseReload,confirmRelease,shouldWarnLocalExit,shouldConfirmUnstoredResultExit,reconcileSaveProbe,savedMatchConfidence,localViewAcknowledges} from '../src/session-recovery.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import type {LocalSaveSummary} from '../src/local-duel.ts';
import {slotPreviewRefreshAction} from '../src/solo-slots.ts';
test('mobile slot preview workers ignore duplicate focus and pause while hidden',()=>{
  assert.equal(slotPreviewRefreshAction(true,false),'start');
  assert.equal(slotPreviewRefreshAction(true,true),'skip','focus cannot cancel an in-flight slot probe');
  assert.equal(slotPreviewRefreshAction(false,true),'cancel','hidden tab releases the worker');
  assert.equal(slotPreviewRefreshAction(false,false),'skip','hidden tab cannot spawn workers');
  assert.equal(slotPreviewRefreshAction(true,false),'start','visible tab can recheck after pause');
});
test('failed save probes retain last confirmed summary, successful probes replace or clear it',()=>{
  const existing={code:'LOCAL-OLD',revision:2,rank:1} as LocalSaveSummary,newer={...existing,revision:5};
  assert.equal(reconcileSaveProbe(existing,undefined),existing);
  assert.equal(reconcileSaveProbe(existing,{available:false,save:null}),existing);
  assert.equal(reconcileSaveProbe(existing,{available:true,save:newer}),newer);
  assert.equal(reconcileSaveProbe(existing,{available:true,save:null}),null);
  assert.equal(reconcileSaveProbe(null,undefined),null);
  assert.match(savedMatchConfidence(undefined)??'',/재확인 중/);assert.match(savedMatchConfidence(false)??'',/마지막 확인 기록/);assert.equal(savedMatchConfidence(true),null);
});
test('only the matching local command or first start/resume view unlocks a waiting action',()=>{
  assert.equal(localViewAcknowledges(7,7,false,12),true);
  assert.equal(localViewAcknowledges(6,7,false,12),false);assert.equal(localViewAcknowledges(8,7,false,12),false);
  assert.equal(localViewAcknowledges(undefined,7,true,0),true);assert.equal(localViewAcknowledges(undefined,7,true,51,true),true);
  assert.equal(localViewAcknowledges(undefined,7,true,51),false);
  assert.equal(localViewAcknowledges(undefined,7,false,0),false);assert.equal(localViewAcknowledges(undefined,7,false,51,true),false);
  assert.equal(localViewAcknowledges(undefined,7,false,52),false);
});
test('local exit warning is scoped to unconfirmed durable state, not saved games or server rooms',()=>{
  const local={botEngine:'device',state:{phase:'playing'}} as RoomView;
  assert.equal(shouldWarnLocalExit(local,false,true,false),false);
  assert.equal(shouldWarnLocalExit(local,true,true,false),true);
  assert.equal(shouldWarnLocalExit(local,false,false,true),true);
  assert.equal(shouldWarnLocalExit(local,false,undefined,false),true);
  const finished={...local,state:{phase:'finished'}} as RoomView;
  assert.equal(shouldWarnLocalExit(finished,false,false,false),true,'finished practice result still needs verified save');
  assert.equal(shouldWarnLocalExit(finished,false,true,false),false,'confirmed completed result can safely close');
  assert.equal(shouldWarnLocalExit(finished,false,false,true),true);
  assert.equal(shouldWarnLocalExit({...finished,ranked:{reward:'pending'}} as RoomView,false,false,false),true);
  assert.equal(shouldWarnLocalExit({...local,botEngine:'server'},true,false,true),false);
  assert.equal(shouldWarnLocalExit(null,true,false,true),false);
});
test('finished offline match with unverified save needs explicit exit confirmation',()=>{
  const finished={botEngine:'device',status:'finished',state:{phase:'finished'}} as RoomView;
  const playing={...finished,status:'playing',state:{phase:'playing'}} as RoomView;
  assert.equal(shouldConfirmUnstoredResultExit(finished,false),true);
  assert.equal(shouldConfirmUnstoredResultExit(finished,undefined),true);
  assert.equal(shouldConfirmUnstoredResultExit(finished,true),false);
  assert.equal(shouldConfirmUnstoredResultExit(playing,false),false,'active matches keep their own discard confirmation');
  assert.equal(shouldConfirmUnstoredResultExit({...finished,botEngine:'server'},false),false);
  assert.equal(shouldConfirmUnstoredResultExit(null,false),false);
});
test('pending room ticket survives a reload in tab storage, rejects malformed values and can be cleared',()=>{
  const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const a=newRoomTicket(),b=newRoomTicket();assert.match(a,/^[0-9a-f]{64}$/);assert.notEqual(a,b);saveRoomTicket(storage,a);assert.equal(readRoomTicket(storage),a);saveRoomTicket(storage,'broken');assert.equal(readRoomTicket(storage),null);saveRoomTicket(storage,null);assert.equal(map.size,0);
});
test('network and rate failures preserve credentials; only invalid/expired sessions clear them',()=>{
  for(const code of ['sessionInvalid','roomExpired','ticketExpired'] as const)assert.equal(terminalSessionFailure(code),true);
  for(const code of ['rateLimit','serverError','staleRevision','opponentDisconnected','accountChanged',undefined] as const)assert.equal(terminalSessionFailure(code),false);
});
test('version and card updates wait for an active device worker, reload after release, and cancel on rollback',()=>{
  assert.equal(releaseDisposition('1','a','1','a',true),'current');
  assert.equal(releaseDisposition('1','a','2',undefined,true),'defer');
  assert.equal(releaseDisposition('1','a','2','a',true),'defer');
  assert.equal(releaseDisposition('1','a','1','b',true),'defer');
  assert.equal(releaseDisposition('1','a','2','b',false),'reload');
  assert.equal(releaseDisposition('1','a','1','b',false),'reload');
  assert.equal(releaseDisposition('1','a','1','a',false),'current');
});
test('patch reload guard survives a page reload and clears only on full release agreement',()=>{
  const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const ticket=newRoomTicket();saveRoomTicket(storage,ticket);
  assert.equal(reserveReleaseReload(storage),true);assert.equal(reserveReleaseReload(storage),false);
  assert.equal(confirmRelease(storage,'1','a','1'),false);assert.equal(reserveReleaseReload(storage),false);
  assert.equal(confirmRelease(storage,'1','a','1','b'),false);assert.equal(confirmRelease(storage,'1','a','2','a'),false);
  assert.equal(confirmRelease(storage,'1','a','1','a'),true);assert.equal(reserveReleaseReload(storage),true);
  assert.equal(readRoomTicket(storage),ticket);
  assert.equal(reserveReleaseReload(undefined),false);
  assert.equal(reserveReleaseReload({...storage,getItem:()=>null,setItem:()=>{}}),false);
  assert.equal(reserveReleaseReload({...storage,getItem:()=>{throw Error('blocked');}}),false);
});
