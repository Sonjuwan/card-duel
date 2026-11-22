import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AI_RELEASE_ROOT,aiDirectory,defaultChampion,exportReleaseChampion,readChampion,readGameChampion,resolveGameChampion,saveChampion} from '../ai-profile-store.ts';

test('AI release exports only the compatible champion, not training trials; clone fallback and stale overwrite are safe',()=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-ai-release-')),local=join(dir,'local'),release=join(dir,'release'),missing=join(dir,'missing'),hash='a'.repeat(64),other='b'.repeat(64);
  try{
    const champion={...defaultChampion(hash),games:300,generation:2,promotions:1};
    saveChampion(champion,local);const path=join(aiDirectory(hash,local),'champion.json');writeFileSync(join(aiDirectory(hash,local),'checkpoint.json'),'private trial');const original=readFileSync(path);
    assert.equal(exportReleaseChampion(hash,local,release).status,'exported');assert.deepEqual(readFileSync(path),original);assert.deepEqual(readdirSync(aiDirectory(hash,release)),['champion.json']);
    assert.deepEqual(readGameChampion(hash,missing,release),champion);assert.equal(resolveGameChampion(hash,missing,release)?.source,'release');assert.equal(resolveGameChampion(hash,local,release)?.source,'local');assert.equal(readGameChampion(other,missing,release),null);
    assert.equal(exportReleaseChampion(hash,local,release).status,'unchanged');assert.throws(()=>exportReleaseChampion(other,local,release),/호환되는/);
    saveChampion({...champion,games:100,generation:1},local);assert.throws(()=>exportReleaseChampion(hash,local,release),/오래된/);assert.deepEqual(readChampion(hash,release),champion);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('the two inherited champions are shipped as catalog-isolated deployment snapshots',()=>{
  const historical='03e0c2dcec376377edec9d007a7557646397af2a03fc1b843330fc076b6f5d8f',current='4fda1c70ee9d13b2bafdc894021b7d550081b92c524d5b9aa100904d48307afb';
  const old=readChampion(historical,AI_RELEASE_ROOT),newer=readChampion(current,AI_RELEASE_ROOT);assert.ok(old&&old.games>=43912&&old.promotions>=7);assert.ok(newer&&newer.games>=6848);
});
