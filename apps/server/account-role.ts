import {LocalAccountStore} from './account-store.ts';
const [email,role]=process.argv.slice(2);
if(!email||!role||!['player','developer'].includes(role))throw new Error('사용법: npm run account:role -- 이메일 developer|player');
if(process.env.CARD_DUEL_ACCOUNT_BACKEND==='supabase')throw new Error('클라우드 계정 권한은 Supabase SQL 관리자만 변경할 수 있습니다.');
const store=new LocalAccountStore(process.env.CARD_DUEL_ACCOUNT_DB??'data/accounts/accounts.sqlite');
try{store.setRole(email,role as 'player'|'developer');console.log('계정 역할 변경 완료');}finally{store.close();}
