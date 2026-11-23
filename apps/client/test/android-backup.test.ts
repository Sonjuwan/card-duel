import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestAndroidBackup,androidBackupAvailable,downloadBackup,MAX_BACKUP_BYTES} from '../src/backup-io.ts';
type Request=(id:string,operation:'save'|'open',name:string,json:string)=>boolean;
type Result=(id:string,success:boolean,value:string)=>void;
function mock(request:Request){return {CardDuelAndroid:{requestBackup:request},__cardDuelAndroidResult:undefined as Result|undefined};}
type Host=Parameters<typeof requestAndroidBackup>[3];

test('native backup export resolves only after matching successful picker response',async()=>{
  let current='';const host=mock((id,operation,name,json)=>{current=id;assert.equal(operation,'save');assert.equal(name,'card-duel-growth-2026-11-22.json');assert.equal(json,'{"format":"test"}');return true;});
  const result=requestAndroidBackup('save','card-duel-growth-2026-11-22.json','{"format":"test"}',host as unknown as Host,200);
  assert.ok(host.__cardDuelAndroidResult);host.__cardDuelAndroidResult('wrong-id',true,'');assert.ok(host.__cardDuelAndroidResult);
  await assert.rejects(requestAndroidBackup('open','','',host as unknown as Host,200),/다른 백업/);
  host.__cardDuelAndroidResult(current,true,'');assert.equal(await result,'');assert.equal(host.__cardDuelAndroidResult,undefined);
});
test('native restore returns UTF-8 JSON and cancellation is surfaced as failure',async()=>{
  let id='';const host=mock(value=>{id=value;return true;});
  const opened=requestAndroidBackup('open','','',host as unknown as Host,200);host.__cardDuelAndroidResult!(id,true,'{"name":"한글 덱"}');assert.equal(await opened,'{"name":"한글 덱"}');
  const canceled=requestAndroidBackup('open','','',host as unknown as Host,200);host.__cardDuelAndroidResult!(id,false,'파일 선택을 취소했습니다.');await assert.rejects(canceled,/취소/);assert.equal(host.__cardDuelAndroidResult,undefined);
});
test('bridge rejection, exceptions, timeout and oversized browser payload fail safely',async()=>{
  for(const request of [()=>false,()=>{throw Error('native failure');}]){const host=mock(request);await assert.rejects(requestAndroidBackup('open','','',host as unknown as Host,200));assert.equal(host.__cardDuelAndroidResult,undefined);}
  const host=mock(()=>true);await assert.rejects(requestAndroidBackup('open','','',host as unknown as Host,5),/초과/);assert.equal(host.__cardDuelAndroidResult,undefined);
  assert.equal(androidBackupAvailable(),false);await assert.rejects(downloadBackup('large.json','A'.repeat(MAX_BACKUP_BYTES)),/너무 큽니다/);
});
