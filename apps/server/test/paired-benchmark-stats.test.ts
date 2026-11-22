import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pairedScoreStats} from '../../cli/paired-benchmark-stats.ts';
test('seat-swapped score statistics are reproducible and keep pair structure',()=>{
  const pairs=[[1,0],[0,1],[1,1],[0,0]] as const;const result=pairedScoreStats(pairs);
  assert.equal(result.scoreRate,.5);assert.equal(result.pairs,4);assert.equal(result.sweeps,1);assert.equal(result.lossSweeps,1);assert.equal(result.split,2);
  assert.deepEqual(result,pairedScoreStats(pairs));assert.ok(result.bootstrap95[0]<=.5&&result.bootstrap95[1]>=.5);
  assert.deepEqual(pairedScoreStats([[1,0],[0,1]]).bootstrap95,[.5,.5]);
});
test('paired evaluation validates data and calculates partial draw scores',()=>{
  assert.equal(pairedScoreStats([[1,.5],[.5,0]]).scoreRate,.5);
  assert.throws(()=>pairedScoreStats([]));assert.throws(()=>pairedScoreStats([[2,0]]));
});
