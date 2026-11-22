import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGrowth} from '../../../packages/progression.ts';
import {simulateGrowth} from '../../../packages/progression-simulation.ts';
import {loadCatalog} from '../server.ts';

const catalog=loadCatalog(),growth=buildGrowth(catalog);
test('forecast reaches all 25 ranks and all cards at hypothetical positive win rates without violating rank XP gates',()=>{
  const summary=[35,50,70].map(win=>simulateGrowth(growth,win));
  assert.deepEqual(summary.map(r=>[r.rank25At,r.allCardsAt]),[[206,150],[144,122],[103,100]]);
  for(const run of summary){
    assert.equal(run.rank,25);assert.equal(run.ownedCards,growth.starterIds.length+growth.unlocks.length);
    assert.equal(run.milestones.length,25);assert.equal(run.wins,Math.floor(run.games*run.winPercent/100));
    for(const [index,m] of run.milestones.entries()){
      assert.equal(m.rank,index+1);assert.ok(m.xp>=(growth.ranks[index].minimumXp??0));
      if(index){assert.ok(m.games>run.milestones[index-1].games);assert.ok(m.ownedCards>=run.milestones[index-1].ownedCards);}
    }
    const without=simulateGrowth(growth,run.winPercent,false);
    assert.equal(without.questCompleted,0);assert.ok(without.allCardsAt!>=run.allCardsAt!);assert.ok(without.rank25At!>=run.rank25At!);
  }
});
test('forecast handles unreachable rank, all-starter cards and limited horizon explicitly',()=>{
  const zero=simulateGrowth(growth,0,true,10);assert.equal(zero.rank25At,null);assert.equal(zero.allCardsAt,null);assert.equal(zero.rank,1);assert.equal(zero.wins,0);
  const allStarter={...growth,starterIds:[...growth.starterIds,...growth.unlocks.map(c=>c.cardId)],unlocks:[],ranks:growth.ranks.map(r=>({...r,minimumXp:0}))};
  const all=simulateGrowth(allStarter,100,true);assert.equal(all.allCardsAt,0);assert.equal(all.rank25At,72);
  assert.throws(()=>simulateGrowth(growth,101));assert.throws(()=>simulateGrowth(growth,50,true,10001));
  const custom=buildGrowth(catalog,{}, {},{base:1000,perPower:1000});
  const short=simulateGrowth(custom,50,true,100);assert.equal(short.allCardsAt,null);assert.equal(short.rank25At,null);assert.equal(short.games,100);
});
