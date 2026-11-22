import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {parseLanTestArgs,lanTestEnv,lanAddresses} from '../../cli/lan-test.ts';
const addresses=[{name:'Wi-Fi',address:'192.168.1.12',internal:false},{name:'Loopback',address:'127.0.0.1',internal:true}];
test('LAN test requires an explicit locally assigned private IPv4 and bounded port',()=>{
  assert.deepEqual(parseLanTestArgs(['--list'],addresses),{mode:'list'});
  assert.deepEqual(parseLanTestArgs(['--host','192.168.1.12'],addresses),{mode:'start',host:'192.168.1.12',port:3000});
  assert.deepEqual(parseLanTestArgs(['--host','127.0.0.1','--port','4000'],addresses),{mode:'start',host:'127.0.0.1',port:4000});
  for(const args of [['--host','0.0.0.0'],['--host','8.8.8.8'],['--host','192.168.1.13'],['--host','127.0.0.1','--port','0'],['--host','127.0.0.1','--port','1e4'],['--host','127.0.0.1','--extra','4000']])assert.throws(()=>parseLanTestArgs(args,addresses));
});
test('LAN test never inherits the production account database, provider or public bind',()=>{
  const base={CARD_DUEL_ACCOUNT_BACKEND:'supabase',CARD_DUEL_ACCOUNT_DB:'production.sqlite',CARD_DUEL_PUBLIC_DEPLOY:'1',CARD_DUEL_PUBLIC_ORIGIN:'https://example.test',CARD_DUEL_EMAIL_RECOVERY:'1',SUPABASE_SECRET_KEY:'fixture-only',SUPABASE_URL:'https://example.test',PORT:'9999'};
  const env=lanTestEnv(base,'/project','192.168.1.12',3000);
  assert.equal(env.CARD_DUEL_ACCOUNT_BACKEND,'local');assert.equal(env.CARD_DUEL_ACCOUNT_DB,resolve('/project','data/accounts/lan-test.sqlite'));assert.equal(env.CARD_DUEL_PUBLIC_DEPLOY,'0');assert.equal(env.CARD_DUEL_PUBLIC_ORIGIN,'');assert.equal(env.CARD_DUEL_EMAIL_RECOVERY,'0');assert.equal(env.SUPABASE_SECRET_KEY,undefined);assert.equal(env.SUPABASE_URL,undefined);assert.equal(env.PORT,'3000');assert.equal(base.CARD_DUEL_ACCOUNT_DB,'production.sqlite');
});
test('adapter enumeration failure permits only loopback, never unverified LAN addresses',()=>{
  const fallback=lanAddresses(()=>{throw new Error('fixture access denied');});
  assert.deepEqual(fallback.map(item=>item.address),['127.0.0.1']);assert.throws(()=>parseLanTestArgs(['--host','192.168.1.12'],fallback));
});
