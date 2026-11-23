import {useState} from 'react';
import {androidBackupAvailable,openAndroidBackup} from './backup-io.ts';

export function BackupFilePicker({label,disabled,onFile,onError}:{label:string;disabled?:boolean;onFile:(file:File)=>void;onError:(message:string)=>void}){
  const [picking,setPicking]=useState(false);
  const choose=async()=>{setPicking(true);try{onFile(await openAndroidBackup());}catch(e){onError(e instanceof Error?e.message:'백업 파일을 열 수 없습니다.');}finally{setPicking(false);}};
  if(androidBackupAvailable())return <button type="button" className="secondary" disabled={disabled||picking} onClick={()=>void choose()}>{picking?'파일 선택 중…':label}</button>;
  return <label>{label}<input type="file" accept=".json,application/json" disabled={disabled} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onFile(file);}}/></label>;
}
