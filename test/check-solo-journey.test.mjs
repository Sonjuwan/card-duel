import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSoloJourney} from '../scripts/check-solo-journey.mjs';
const flow=readFileSync(new URL('../.github/workflows/validate-playable.yml',import.meta.url),'utf8');
const output=(patch={})=>[JSON.stringify({count:2}),JSON.stringify({complete:true,games:2,moves:85,restores:2,backupChecks:1,rank:1,stats:{wins:1,losses:1,draws:0},...patch})].join('\n');
test('bounded solo engine smoke verifies finished duels, checkpoints, results and progression backups',()=>assert.deepEqual(validateSoloJourney(output()),{games:2,moves:85,restores:2,backupChecks:1}));
test('solo smoke fails closed on partial or uncommitted results',()=>{
  for(const patch of [{complete:false},{games:1},{moves:0},{restores:1},{backupChecks:0},{rank:0},{stats:{wins:1,losses:0,draws:0}}])assert.throws(()=>validateSoloJourney(output(patch)));
  assert.throws(()=>validateSoloJourney('not json'));
});
test('candidate CI requires a bounded real-engine AI playthrough before building',()=>{
  assert.match(flow,/npm run test:solo-journey/);
  assert.ok(flow.indexOf('npm run test:solo-journey')>flow.indexOf('npm test'));
  assert.ok(flow.indexOf('npm run test:solo-journey')<flow.indexOf('npm run build'));
});
