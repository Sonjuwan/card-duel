import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stampCandidateManifests} from '../scripts/stamp-candidate-build.mjs';
const project=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const locked=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
const flow=readFileSync(new URL('../.github/workflows/validate-playable.yml',import.meta.url),'utf8');
test('candidate CI does not misleadingly label new code as the v0.197 verified release',()=>{
  const data=stampCandidateManifests(project,locked,'249');
  assert.equal(data.version,'0.249.0');
  assert.equal(data.manifest.version,'0.249.0');
  assert.equal(data.lock.version,'0.249.0');
  assert.equal(data.lock.packages[''].version,'0.249.0');
  assert.deepEqual(data.manifest.dependencies,project.dependencies,'card libraries unchanged');
  assert.deepEqual(data.lock.packages[''].dependencies,locked.packages[''].dependencies);
  assert.equal(project.version,locked.version,'original checked-out candidate metadata remains unchanged');
});
test('stamping refuses malformed or conflicting candidate metadata',()=>{
  for(const number of ['', '0','-1','1.2','1x','1; rm -rf','0001','99999999']){
    assert.throws(()=>stampCandidateManifests(project,locked,number));
  }
  assert.throws(()=>stampCandidateManifests(project,{...locked,version:'0.1.0'},'249'));
  assert.throws(()=>stampCandidateManifests({...project,version:'0.249.0'},{...locked,version:'0.249.0',packages:{...locked.packages,'':{...locked.packages[''],version:'0.249.0'}}},'249'));
});
test('CI gates artifacts behind Node24 typecheck, tests, render, PWA and preflight',()=>{
  assert.match(flow,/workflow_dispatch:/);
  assert.match(flow,/node-version: '24'/);
  const ordered=['npm ci --no-audit --no-fund','stamp-candidate-build.mjs','npm run typecheck','npm run test:solo-app','npm run test:playable-core','npm test','npm run test:render','npm run build','npx playwright install --with-deps chromium','npm run test:solo-app-browser','npm run test:landscape-browser','npm run verify:deployment','actions\/upload-artifact@v4'];
  let last=-1;
  for(const value of ordered){const index=flow.indexOf(value);assert.ok(index>last,`CI step should follow previous step: ${value}`);last=index;}
  assert.match(flow,/not a public deployment/);
});
