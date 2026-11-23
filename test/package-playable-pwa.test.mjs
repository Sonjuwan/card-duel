import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectPlayablePwa,packagePlayablePwa} from '../scripts/package-playable-pwa.mjs';

test('installable PWA identifies the actual compiled binary rather than an arbitrary candidate number',()=>{
  const meta=inspectPlayablePwa();
  const packageVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
  assert.equal(meta.version,packageVersion);
  assert.match(meta.release,/^[0-9a-f]{64}$/);
  assert.equal(meta.assets.length,8);
});
test('verified installer includes 8 original assets and a clear install warning without overwriting an existing ZIP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'card-duel-install-'));
  try{
    const meta=packagePlayablePwa(dir);
    assert.equal(meta.version,JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);
    assert.equal(meta.files,9);
    assert.equal(readdirSync(dir).length,1);
    assert.throws(()=>packagePlayablePwa(dir),/Refusing to overwrite/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
