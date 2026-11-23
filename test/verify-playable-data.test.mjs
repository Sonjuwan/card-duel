import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {verifyPlayableData} from '../scripts/verify-playable-data.mjs';
const baseline=JSON.parse(readFileSync(new URL('../data/integrity/playable-baseline.json',import.meta.url),'utf8'));
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
test('the current published cards, progression and two AI champions match frozen release data',()=>{
  const result=verifyPlayableData(baseline,read);
  assert.deepEqual(result,{cards:437,aiChampions:2,guardedFiles:5});
});
test('data changed after approval fails closed rather than shipping a silent balance modification',()=>{
  assert.throws(()=>verifyPlayableData(baseline,path=>path==='data/cards/active.json'?Buffer.from('{"file":"v0.24.0.json"}'):read(path)),/data drift/);
  const ai=Object.keys(baseline.files).find(x=>x.startsWith('data/ai-release/'));
  assert.throws(()=>verifyPlayableData(baseline,path=>path===ai?Buffer.from('{}'):read(path)),/data drift/);
});
test('unsafe paths or a missing champion cannot be smuggled into the baseline',()=>{
  const [first]=Object.keys(baseline.files);
  assert.throws(()=>verifyPlayableData({...baseline,files:{...baseline.files,[first+'../x']:baseline.files[first]}},read),/Unexpected guarded/);
  const copy={...baseline.files};delete copy[Object.keys(copy).find(x=>x.startsWith('data/ai-release/'))];
  assert.throws(()=>verifyPlayableData({...baseline,files:copy},read),/Unexpected guarded/);
});
