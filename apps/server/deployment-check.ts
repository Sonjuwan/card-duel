import {allowedGameBind} from './config.ts';

const tables=[
  ['duel_accounts','id,email,role,profile,revision'],
  ['duel_sessions','token_hash,account_id,expires_at'],
  ['duel_ranked_matches','account_id,match_id,outcome,recorded_at'],
  ['duel_account_rooms','code,snapshot,updated_at'],
  ['duel_runtime_settings','id,maintenance'],
] as const;
export type CloudConfig={url:string;publicKey:string;secretKey:string};
export function cloudConfig(env:NodeJS.ProcessEnv):CloudConfig{
  const url=env.SUPABASE_URL??'',publicKey=env.SUPABASE_PUBLISHABLE_KEY??'',secretKey=env.SUPABASE_SECRET_KEY??'';
  let parsed:URL;try{parsed=new URL(url);}catch{throw new Error('SUPABASE_URL을 HTTPS 프로젝트 주소로 설정하세요.');}
  if(parsed.protocol!=='https:'||parsed.origin!==url||parsed.username||parsed.password||!publicKey||!secretKey||publicKey===secretKey)throw new Error('Supabase HTTPS 주소 및 서로 다른 공개/서버 키를 확인하세요.');
  return {url,publicKey,secretKey};
}
export function validatePublicDeployment(env:NodeJS.ProcessEnv){
  if(!allowedGameBind(env.CARD_DUEL_HOST??'',env.CARD_DUEL_ACCOUNT_BACKEND,env.CARD_DUEL_PUBLIC_ORIGIN,env.CARD_DUEL_PUBLIC_DEPLOY)||env.CARD_DUEL_HOST!=='0.0.0.0'||env.CARD_DUEL_ACCOUNT_BACKEND!=='supabase')throw new Error('공개 배포에는 0.0.0.0, Supabase, HTTPS 공개 출처 및 명시적 활성화 설정이 필요합니다.');
  return cloudConfig(env);
}
/** No writes, no user data downloads, no credentials logged. A table must be
 * accessible to the server key and inaccessible to the publishable key. */
export async function verifyCloudStorage(config:CloudConfig,fetcher:typeof fetch=fetch){
  const check=async(table:string,columns:string,key:string)=>{
    try{const url=new URL(`/rest/v1/${table}`,config.url);url.searchParams.set('select',columns);url.searchParams.set('limit','0');const response=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})}});await response.body?.cancel();return response.status;}
    catch{throw new Error(`Supabase 연결 확인 실패: ${table}`);}
  };
  await Promise.all(tables.map(async([table,columns])=>{
    const server=await check(table,columns,config.secretKey);if(server<200||server>=300)throw new Error(`${table}: 서버 접근 실패. SQL 마이그레이션 또는 서버 키를 확인하세요.`);
    const publicStatus=await check(table,columns,config.publicKey);if(![401,403,404].includes(publicStatus))throw new Error(`${table}: 공개 키 접근 차단을 확인할 수 없습니다. RLS/GRANT 설정을 확인하세요.`);
  }));
  // SQL 005-006 expose a stable, invoker-only RPC with booleans, no player rows.
  // This checks the award RPC, real service role/RLS bypass and grants without writes.
  const schema=async(key:string)=>{
    try{return await fetcher(new URL('/rest/v1/rpc/duel_schema_readiness',config.url),{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})}});}
    catch{throw new Error('Supabase 스키마 준비 검사 연결 실패: SQL 005~006을 확인하세요.');}
  };
  const server=await schema(config.secretKey);if(!server.ok){await server.body?.cancel();throw new Error('Supabase 스키마 준비 검사 실패: SQL 001~006을 확인하세요.');}
  let rows:unknown;try{rows=await server.json();}catch{throw new Error('Supabase 스키마 준비 응답 형식 오류');}
  const status=Array.isArray(rows)&&rows.length===1?rows[0]:null;
  if(!status||typeof status!=='object'||!Number.isSafeInteger(status.schema_version)||status.schema_version<6||status.ranked_match_rpc!==true||status.server_privileges!==true||status.private_access!==true||status.rls_enabled!==true)throw new Error('Supabase 스키마 준비 미완료: SQL 001~006, 경기 정산 함수, 실제 서버 역할과 쓰기·RLS 우회 권한 및 공개 권한을 확인하세요.');
  const publicResponse=await schema(config.publicKey);await publicResponse.body?.cancel();if(![401,403,404].includes(publicResponse.status))throw new Error('Supabase 스키마 준비 함수의 공개 키 접근 차단을 확인할 수 없습니다.');
  return {tables:tables.length,schemaVersion:status.schema_version,rankedMatchRpc:true,serverPrivileges:true,privateAccess:true,rlsEnabled:true};
}
