import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudConfig,validatePublicDeployment,verifyCloudStorage} from '../deployment-check.ts';

const env={CARD_DUEL_HOST:'0.0.0.0',CARD_DUEL_ACCOUNT_BACKEND:'supabase',CARD_DUEL_PUBLIC_DEPLOY:'1',CARD_DUEL_PUBLIC_ORIGIN:'https://game.example',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
test('public deployment preflight requires explicit HTTPS origin and separate server credential',()=>{
  assert.deepEqual(validatePublicDeployment(env),cloudConfig(env));for(const key of Object.keys(env))assert.throws(()=>validatePublicDeployment({...env,[key]:''}));
  assert.throws(()=>cloudConfig({...env,SUPABASE_SECRET_KEY:env.SUPABASE_PUBLISHABLE_KEY}),/서로 다른/);assert.throws(()=>cloudConfig({...env,SUPABASE_URL:'https://project.supabase.co/path'}));
});
test('storage preflight is read-only and fails closed on missing schema or public access',async()=>{
  const calls:string[]=[];let fail:'none'|'missing'|'public'='none';
  const readiness={schema_version:6,ranked_match_rpc:true,server_privileges:true,private_access:true,rls_enabled:true};
  const mock:typeof fetch=async(input,init)=>{const url=new URL(input.toString()),headers=new Headers(init?.headers);assert.equal(init?.method,'GET');assert.equal(init?.body,undefined);const key=headers.get('apikey');assert.ok(key===env.SUPABASE_SECRET_KEY||key===env.SUPABASE_PUBLISHABLE_KEY);calls.push(url.pathname);const server=key===env.SUPABASE_SECRET_KEY;if(url.pathname.endsWith('/rpc/duel_schema_readiness')){assert.equal(url.search,'');return server?Response.json([readiness]):new Response(null,{status:403});}assert.equal(url.searchParams.get('limit'),'0');return new Response(null,{status:server?(fail==='missing'?404:200):fail==='public'?200:403});};
  assert.deepEqual(await verifyCloudStorage(cloudConfig(env),mock),{tables:5,schemaVersion:6,rankedMatchRpc:true,serverPrivileges:true,privateAccess:true,rlsEnabled:true});assert.equal(calls.length,12);
  fail='missing';await assert.rejects(verifyCloudStorage(cloudConfig(env),mock),/서버 접근 실패/);
  fail='public';await assert.rejects(verifyCloudStorage(cloudConfig(env),mock),/공개 키 접근 차단/);
});
test('cloud startup requires read-only schema migration and actual privilege readiness',async()=>{
  const valid={schema_version:6,ranked_match_rpc:true,server_privileges:true,private_access:true,rls_enabled:true};
  let result:unknown=[valid],rpcStatus=200,publicRpc=403;
  const mock:typeof fetch=async(input,init)=>{
    const url=new URL(input.toString()),key=new Headers(init?.headers).get('apikey'),server=key===env.SUPABASE_SECRET_KEY;
    assert.equal(init?.method,'GET');assert.equal(init?.body,undefined);
    if(!url.pathname.endsWith('/rpc/duel_schema_readiness')){assert.equal(url.searchParams.get('limit'),'0');return new Response(null,{status:server?200:403});}
    assert.equal(url.search,'');
    return !server?new Response(null,{status:publicRpc}):new Response(typeof result==='string'?result:JSON.stringify(result),{status:rpcStatus});
  };
  for(const invalid of [[],{},[valid,valid],[{...valid,schema_version:4}],[{...valid,schema_version:5}],[{...valid,ranked_match_rpc:false}],[{...valid,server_privileges:false}],[{...valid,private_access:false}],[{...valid,rls_enabled:false}]]){result=invalid;await assert.rejects(verifyCloudStorage(cloudConfig(env),mock),/스키마 준비 미완료/);}
  result='<html>proxy</html>';await assert.rejects(verifyCloudStorage(cloudConfig(env),mock),/응답 형식 오류/);
  result=[valid];rpcStatus=404;await assert.rejects(verifyCloudStorage(cloudConfig(env),mock),/SQL 001~006/);
  rpcStatus=200;publicRpc=200;await assert.rejects(verifyCloudStorage(cloudConfig(env),mock),/함수의 공개 키 접근 차단/);
  publicRpc=403;assert.equal((await verifyCloudStorage(cloudConfig(env),mock)).schemaVersion,6);
});
test('SQL 006 keeps the prior read-only contract while checking effective server role and RLS bypass',()=>{
  const sql=readFileSync(new URL('../../../deploy/supabase/006_server_role_readiness.sql',import.meta.url),'utf8');
  assert.match(sql,/language sql stable security invoker set search_path = ''/i);assert.match(sql,/select 6,/i);
  assert.match(sql,/current_user = 'service_role'::name/);assert.match(sql,/pg_catalog\.pg_roles.+rolbypassrls/);assert.match(sql,/pg_catalog\.row_security_active/);
  assert.match(sql,/has_function_privilege\(u\.role_name::name,pg_catalog\.to_regprocedure\('public\.duel_schema_readiness\(\)'\)::oid,'EXECUTE'\)/);
  const body=sql.split('$$')[1];assert.doesNotMatch(body,/\b(?:insert into|update public\.|delete from|alter role|alter table|truncate table)\b/i);
  assert.match(sql,/revoke all on function public\.duel_schema_readiness\(\) from public,anon,authenticated/);assert.match(sql,/grant execute on function public\.duel_schema_readiness\(\) to service_role/);
});
