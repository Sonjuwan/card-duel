import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {LocalAccountStore} from '../account-store.ts';
import {backupAccountDatabase,verifyAccountBackup} from '../account-backup.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {practiceDeck} from '../../../packages/engine/src/index.ts';
import {loadCatalog} from '../server.ts';

test('live local account backup restores credentials, exact XP, deck, ledger and pending account room',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-account-backup-')),source=join(dir,'live.sqlite'),dest=join(dir,'snapshot.sqlite'),catalog=loadCatalog(),growth=buildGrowth(catalog);
  const store=new LocalAccountStore(source,growth);
  try{
    const {account,token}=await store.register('backup@example.test','backup-password');
    const deck=practiceDeck(catalog,'warrior');
    await store.updateDecks(account.id,account.profile.revision,[{name:'backup deck',deck}]);
    const award={matchId:randomUUID(),rank:1,heroClass:'warrior' as const,eligible:true,outcome:'win' as const};
    const expected=await store.recordMatch(account.id,award,growth);
    const room={schema:1 as const,code:'ABC234',catalogHash:'a'.repeat(64),room:null,pending:[{accountId:account.id,code:'ABC234',award:{...award,matchId:randomUUID()}}]};
    await store.saveRoomSnapshot(room);
    assert.equal(await store.initializeMaintenance(false),false);await store.setMaintenance(true);
    const result=backupAccountDatabase(source,dest);assert.ok(result.bytes>0);assert.deepEqual(verifyAccountBackup(dest),result);
    if(process.platform!=='win32')assert.equal(statSync(dest).mode&0o777,0o600);
    const bytes=readFileSync(dest);
    assert.throws(()=>backupAccountDatabase(source,dest),/이미 존재/);assert.deepEqual(readFileSync(dest),bytes);
    await store.recordMatch(account.id,{...award,matchId:randomUUID()},growth);
    assert.equal((await store.session(token))?.profile.xp,60);
    const restored=new LocalAccountStore(dest,growth);
    try{
      assert.equal(await restored.session(token),null); // restored sessions are intentionally revoked
      assert.deepEqual((await restored.login(account.email,'backup-password')).account.profile,expected.profile);
      assert.equal((await restored.recordMatch(account.id,award,growth)).profile.xp,30);
      assert.deepEqual(await restored.loadRoomSnapshots(),[room]);
      assert.equal(await restored.initializeMaintenance(false),true);
    }finally{restored.close();}
    assert.ok(!readdirSync(dir).some(name=>name.startsWith('.card-duel-backup-')));
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('backup fails safely for absent or unrelated source, same destination, and existing file',()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-account-backup-invalid-')),invalid=join(dir,'invalid.sqlite'),dest=join(dir,'snapshot.sqlite');
  try{
    writeFileSync(invalid,'not a database');assert.throws(()=>backupAccountDatabase(invalid,dest));
    assert.throws(()=>verifyAccountBackup(invalid));assert.throws(()=>backupAccountDatabase(join(dir,'missing.sqlite'),dest));
    assert.throws(()=>backupAccountDatabase(invalid,invalid),/이미 존재/);
    assert.deepEqual(readdirSync(dir),['invalid.sqlite']);assert.equal(readFileSync(invalid,'utf8'),'not a database');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
