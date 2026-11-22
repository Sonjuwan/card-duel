import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newRoomTicket,readRoomTicket,saveRoomTicket,terminalSessionFailure,releaseDisposition,reserveReleaseReload,confirmRelease} from '../src/session-recovery.ts';
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
