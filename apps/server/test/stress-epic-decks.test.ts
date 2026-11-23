import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

test('epic-heavy stress decks remain legal for all 81 ordered hero-class pairings',()=>{
  const result=spawnSync(process.execPath,['apps/cli/stress.ts','81','0','epic'],{
    cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8',timeout:45_000,maxBuffer:2*1024*1024,
  });
  assert.equal(result.error,undefined,result.error?.message);
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/81\/81 matches complete/);
  assert.match(result.stdout,/Epic coverage: (\d+)\/\1/);
});
