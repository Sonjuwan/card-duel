import {backupAccountDatabase,verifyAccountBackup} from './account-backup.ts';

try{
  const args=process.argv.slice(2);
  if(args.length!==2||!['--output','--verify'].includes(args[0])||!args[1])throw new Error('사용법: npm run account:backup -- --output <새 백업 파일> 또는 --verify <백업 파일>');
  if(args[0]==='--verify'){
    const checked=verifyAccountBackup(args[1]);console.log(`계정 DB 무결성 확인 완료 (${checked.bytes} bytes)`);
  }else{
    if(process.env.CARD_DUEL_ACCOUNT_BACKEND&&process.env.CARD_DUEL_ACCOUNT_BACKEND!=='local')throw new Error('로컬 SQLite 계정 DB만 백업할 수 있습니다. Supabase 운영 DB는 운영자 백업 절차를 이용하세요.');
    const checked=backupAccountDatabase(process.env.CARD_DUEL_ACCOUNT_DB??'data/accounts/accounts.sqlite',args[1]);console.log(`계정 DB 백업 및 무결성 검사 완료 (${checked.bytes} bytes). 개인정보가 포함되므로 비공개 보관하세요.`);
  }
}catch(error){console.error(error instanceof Error?error.message:'계정 DB 백업 실패');process.exitCode=1;}
