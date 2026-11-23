import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {candidateFromReleaseStatus,planLocalBuild} from '../scripts/build-local-playable.mjs';
const pkg={version:'0.197.0'};
const lock={version:pkg.version,packages:{'':{version:pkg.version}}};
const status='v0.296.0 is a SOURCE-ONLY candidate; it has NOT passed the Node24 production build or physical-device tests.\nThe included solo-offline.html and dist/solo-app are PREVIOUS VERIFIED v0.197.0, not compiled from v0.296.0.\n';
test('gitless source archives identify their candidate without mislabelling old executable',()=>{
 assert.deepEqual(candidateFromReleaseStatus(status),{number:'296',version:'0.296.0',previous:'0.197.0'});
 const plan=planLocalBuild({nodeMajor:24,releaseStatus:status,manifest:pkg,lock});
 assert.equal(plan.stamp?.version,'0.296.0');
 assert.equal(pkg.version,'0.197.0');
 assert.equal(plan.alreadyStamped,false);
});
test('invalid, missing, stale and swapped candidate markers fail closed',()=>{
 for(const invalid of ['',status.replace('SOURCE-ONLY','VERIFIED'),status.replace('v0.296.0','v0.197.0'),status.replace('v0.296.0','v1.296.0')]){
  assert.throws(()=>candidateFromReleaseStatus(invalid));
 }
 assert.throws(()=>planLocalBuild({nodeMajor:24,releaseStatus:status,manifest:{...pkg,version:'0.199.0'},lock}));
});
test('safe build refuses unsupported Node versions before modifying source',()=>{
 assert.throws(()=>planLocalBuild({nodeMajor:22,releaseStatus:status,manifest:pkg,lock}),/Node.js 24 required/);
 assert.throws(()=>planLocalBuild({nodeMajor:25,releaseStatus:status,manifest:pkg,lock}),/Node.js 24 required/);
 const input=readFileSync(new URL('../package.json',import.meta.url),'utf8');
 if(Number(process.versions.node.split('.')[0])!==24){
  const result=spawnSync(process.execPath,['scripts/build-local-playable.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.notEqual(result.status,0);
  // Source worktrees may lack RELEASE-STATUS.txt, so either early guard is safe.
  assert.match(result.stderr,/(Node.js 24 required|RELEASE-STATUS.txt not found)/);
  assert.equal(readFileSync(new URL('../package.json',import.meta.url),'utf8'),input);
 }
});
test('already-stamped candidate can be rebuilt safely without stamp conflict',()=>{
 const next=planLocalBuild({nodeMajor:24,releaseStatus:status,manifest:pkg,lock}).stamp;
 const builtStatus='v0.296.0 fully built in Node24 and passed automated gates.\nBuild baseline: PREVIOUS VERIFIED v0.197.0.\n';
 const done=planLocalBuild({nodeMajor:24,releaseStatus:builtStatus,manifest:next.manifest,lock:next.lock});
 assert.equal(done.alreadyStamped,true);
 assert.equal(done.stamp,null);
});

test('local release builder requires real landscape and offline Chromium tests',()=>{
 const source=readFileSync(new URL('../scripts/build-local-playable.mjs',import.meta.url),'utf8');
 for(const name of ['test:solo-app','playwright','test:solo-app-browser','test:landscape-browser','verify:deployment']){
  assert.ok(source.includes(name),`Missing required browser release gate ${name}`);
 }
 assert.ok(source.indexOf("test:solo-app-browser")>source.indexOf("test:solo-app"));
 assert.ok(source.indexOf("test:landscape-browser")<source.indexOf("verify:deployment"));
});
