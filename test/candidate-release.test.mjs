import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/package-source-candidate.mjs',import.meta.url),'utf8');
test('candidate packaging refuses dirty trees, mislabeled compiled assets and mismatched versions',()=>{
  assert.match(source,/git\('status','--porcelain'\)===''/);
  assert.match(source,/HEAD must identify the candidate version/);
  assert.match(source,/\['RUNEHALL','Card Duel'\]\.some\(name=>installer\.includes\(`\${name} v\${release}`\)/);
  assert.match(source,/SOURCE-ONLY candidate/);
  assert.match(source,/PREVIOUS VERIFIED/);
});
test('gitignored original AI checkpoints are included and verified byte for byte',()=>{
  assert.match(source,/walk\('data\/ai'\)/);
  assert.match(source,/Missing gitignored AI training\/checkpoint files/);
  assert.match(source,/createHash\('sha256'\)\.update\(zipRead\(stagingArchive,p\)\)/);
  assert.match(source,/AI model backup mismatch/);
});
test('commit-based archival cannot bundle an uncommitted change as a release',()=>{
  assert.match(source,/\['archive','--format=zip','--prefix=card-duel\/','HEAD'/);
  assert.match(source,/\['bundle','create',stagingBundle,'HEAD'/);
  assert.match(source,/Refusing to overwrite an earlier candidate backup/);
});
