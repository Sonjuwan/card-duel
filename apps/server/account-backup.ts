import {DatabaseSync} from 'node:sqlite';
import {chmodSync,closeSync,existsSync,fsyncSync,linkSync,mkdtempSync,openSync,rmSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';

const required=['accounts','sessions','ranked_matches','account_rooms'];
function checkDatabase(db:DatabaseSync){
  const tables=new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row=>row.name));
  if(!required.every(name=>tables.has(name)))throw new Error('현재 계정 DB 스키마가 아닙니다. 먼저 게임 서버의 DB 경로를 확인하세요.');
  const check=db.prepare('PRAGMA quick_check').all();
  if(check.length!==1||Object.values(check[0])[0]!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('계정 DB 무결성 검사에 실패했습니다.');
}
function readOnly(path:string){
  if(!existsSync(path)||!statSync(path).isFile())throw new Error('계정 DB 파일이 존재하지 않습니다.');
  const db=new DatabaseSync(path,{readOnly:true});db.exec('PRAGMA busy_timeout=5000; PRAGMA query_only=ON;');return db;
}
export function verifyAccountBackup(path:string){
  const db=readOnly(path);try{checkDatabase(db);return {bytes:statSync(path).size};}finally{db.close();}
}
/** Makes a consistent SQLite snapshot, even while a local server is active.
 * Only publishes after a successful integrity check; never overwrites a file.
 * Account backups contain sensitive data and must not be bundled with source. */
export function backupAccountDatabase(source:string,destination:string){
  const from=resolve(source),to=resolve(destination);
  if(from===to||existsSync(to))throw new Error('백업 대상 파일이 이미 존재합니다. 새 파일 이름을 지정하세요.');
  const parent=dirname(to);if(!existsSync(parent)||!statSync(parent).isDirectory())throw new Error('먼저 백업 폴더를 만들어 주세요.');
  const dir=mkdtempSync(join(parent,'.card-duel-backup-')),temp=join(dir,'accounts.sqlite');
  try{
    closeSync(openSync(temp,'wx',0o600));
    // VACUUM INTO writes only the destination with the source in a read transaction.
    // query_only would also prevent writing the new database, so leave the
    // connection read-only at the file level and do not set query_only here.
    if(!existsSync(from)||!statSync(from).isFile())throw new Error('계정 DB 파일이 존재하지 않습니다.');
    const db=new DatabaseSync(from,{readOnly:true});
    try{db.exec('PRAGMA busy_timeout=5000;');checkDatabase(db);db.prepare('VACUUM INTO ?').run(temp);}finally{db.close();}
    // A restored older snapshot must not reactivate previously revoked sessions.
    // Only remove sessions from the private backup copy, never from the live DB.
    const copy=new DatabaseSync(temp);try{copy.exec('PRAGMA secure_delete=ON; DELETE FROM sessions;');}finally{copy.close();}
    chmodSync(temp,0o600);const result=verifyAccountBackup(temp);
    const fd=openSync(temp,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}
    // Hard-link creation is atomic and fails if another process used the target.
    linkSync(temp,to);return result;
  }finally{rmSync(dir,{recursive:true,force:true});}
}
