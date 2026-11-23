export const MAX_BACKUP_BYTES=8*1024*1024;
type AndroidBridge={requestBackup:(id:string,operation:'save'|'open',name:string,json:string)=>boolean};
type BridgeWindow=Window&{CardDuelAndroid?:AndroidBridge;__cardDuelAndroidResult?:(id:string,success:boolean,value:string)=>void};
const bridgeWindow=()=>typeof window==='undefined'?undefined:window as BridgeWindow;
export const androidBackupAvailable=()=>typeof bridgeWindow()?.CardDuelAndroid?.requestBackup==='function';

/** Only the trusted bundled Android page is given this native bridge. The
 * picker reports actual completion/cancellation, rather than assuming success. */
export function requestAndroidBackup(operation:'save'|'open',name='',json='',host=bridgeWindow(),timeoutMs=300000):Promise<string>{
  return new Promise((resolve,reject)=>{
    if(!host?.CardDuelAndroid||host.__cardDuelAndroidResult){reject(Error('다른 백업 파일 작업을 먼저 완료하세요.'));return;}
    const id=crypto.getRandomValues(new Uint32Array(4)).join('-');
    const cleanup=()=>{clearTimeout(timer);delete host.__cardDuelAndroidResult;};
    const timer=setTimeout(()=>{cleanup();reject(Error('파일 선택 시간이 초과되었습니다.'));},timeoutMs);
    host.__cardDuelAndroidResult=(resultId,success,value)=>{if(resultId!==id)return;cleanup();if(success)resolve(value);else reject(Error(value||'파일 선택을 취소했습니다.'));};
    try{if(!host.CardDuelAndroid.requestBackup(id,operation,name,json)){cleanup();reject(Error('파일 선택기를 열 수 없습니다.'));}}catch(e){cleanup();reject(e);}
  });
}

export async function downloadBackup(name:string,data:unknown):Promise<void>{
  const json=JSON.stringify(data,null,2);
  if(new TextEncoder().encode(json).byteLength>MAX_BACKUP_BYTES)throw Error('백업 파일이 너무 큽니다.');
  if(androidBackupAvailable()){await requestAndroidBackup('save',name,json);return;}
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function openAndroidBackup():Promise<File>{
  const json=await requestAndroidBackup('open');
  if(new TextEncoder().encode(json).byteLength>MAX_BACKUP_BYTES)throw Error('백업 파일이 너무 큽니다.');
  return new File([json],'card-duel-backup.json',{type:'application/json'});
}
