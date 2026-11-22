import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditRankedDecks} from '../../../packages/progression-audit.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import {loadCatalog} from '../server.ts';
const catalog=loadCatalog();
test('four deterministic seeds times nine classes times 25 ranks strictly increase provisional deck power',()=>{
  const growth=buildGrowth(catalog),audit=auditRankedDecks(catalog,growth);
  assert.equal(audit.rows.length,25);assert.equal(audit.checked,900);assert.equal(audit.compared,864);assert.equal(audit.increased,864);assert.equal(audit.unchanged,0);assert.equal(audit.decreased,0);
  assert.equal(audit.rows[0].minimum,30);assert.equal(audit.rows[0].maximum,30);
  assert.ok(audit.rows.at(-1)!.minimum>300);
  assert.ok(audit.rows.slice(0,5).every(r=>r.search===null));
  const search=audit.rows.slice(5).map(r=>r.search!);assert.ok(search.every((r,i)=>i===0||r.nodes>search[i-1].nodes&&r.depth>=search[i-1].depth&&r.beam>search[i-1].beam));
});
test('custom rank tuning is preserved while equal or weaker adjacent decks are clearly counted',()=>{
  const growth=buildGrowth(catalog,{}, {'2':{deckPower:1,intelligence:1},'3':{deckPower:7,intelligence:25},'4':{deckPower:2,intelligence:3}});
  const audit=auditRankedDecks(catalog,growth);
  assert.equal(audit.rows[1].unchanged,36);assert.equal(audit.rows[3].decreased,36);assert.equal(audit.rows[2].intelligence,25);assert.equal(audit.rows[3].search,null);
  assert.equal(growth.ranks[3].deckPower,2);
});
