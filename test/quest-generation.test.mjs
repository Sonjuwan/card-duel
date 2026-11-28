import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../apps/server/server.ts';
import {HERO_CLASSES} from '../packages/engine/src/index.ts';
import {advanceQuests,fillQuests,initialQuests,questCandidates,QUEST_DEFINITIONS,validQuestProgress} from '../packages/quests.ts';
import {offlineGrowth} from '../apps/client/src/offline-growth.ts';

const catalog=loadCatalog();
const basics=offlineGrowth(catalog).starterIds;
const owned=new Set(Object.keys(catalog));
test('86 distinct quest definitions match the 9/32/45 split and each hero has five special definitions',()=>{
  const defs=QUEST_DEFINITIONS;
  assert.equal(new Set(defs.map(q=>q.id)).size,86);
  assert.deepEqual(['basic','common','special'].map(slot=>defs.filter(q=>q.slot===slot).length),[9,32,45]);
  assert.deepEqual(HERO_CLASSES.map(hero=>defs.filter(q=>q.hero===hero&&q.slot==='special').length),Array(9).fill(5));
  assert.ok(defs.every(q=>q.target>0&&[15,30,45].includes(q.xp)));
});
test('only owned, deck-legal capabilities qualify and great-cost spells need three kinds',()=>{
  assert.deepEqual(questCandidates(catalog,new Set(), 'mage'),[]);
  const basicCandidates=questCandidates(catalog,new Set(basics),'mage');
  const full=questCandidates(catalog,owned,'mage');
  assert.ok(basicCandidates.some(q=>q.metric==='powerDamage'));
  assert.ok(!basicCandidates.some(q=>q.metric==='spell7'));
  assert.ok(!full.some(q=>q.metric==='spell7'));
  const spell=catalog.flame_tide;
  const expanded={...catalog,fixture_spell:{...spell,id:'fixture_spell'}};
  assert.ok(questCandidates(expanded,new Set([...owned,'fixture_spell']),'mage').some(q=>q.metric==='spell7'));
  assert.ok(!questCandidates(catalog,owned,'rogue').some(q=>q.metric==='overload'));
  assert.ok(questCandidates(catalog,owned,'shaman').some(q=>q.metric==='overload'));
  const one=Object.values(catalog).find(c=>c.kind==='spell'&&c.cost>=7&&c.class==='mage'&&c.rarity!=='basic');
  assert.ok(one);
  assert.ok(!questCandidates(catalog,new Set([...basics,one.id]),'mage').some(q=>q.metric==='spell7'));
  const initial=fillQuests(initialQuests(0,10),catalog,basics);
  assert.equal(Object.keys(initial.active).length,3);
  assert.equal(new Set(Object.values(initial.active).map(q=>q.hero)).size,3);
  assert.ok(validQuestProgress(initial));
});
test('90 eligible matching games finish the full basic rotation in order without resetting other slots',()=>{
  let state=fillQuests(initialQuests(0,10),catalog,basics);
  const other=structuredClone(state.active.special);
  for(let i=0;i<90;i++){
    const hero=HERO_CLASSES[Math.floor(i/10)];
    assert.equal(state.active.basic.hero,hero);
    const result=advanceQuests(state,hero,{});
    assert.equal(result.xp,i%10===9?30:0);
    state=fillQuests(result.state,catalog,basics);
  }
  assert.equal(state.basicCompleted,9);
  assert.equal(state.active.basic.hero,HERO_CLASSES[0]);
  assert.deepEqual(state.active.special,other);
  assert.ok(validQuestProgress(state));
});
test('long-run replenishment shares each slot among heroes, metrics and strategies',()=>{
  let state=fillQuests(initialQuests(0,10),catalog,[...owned]);
  for(let i=0;i<270;i++){
    state=fillQuests(advanceQuests(state,state.active.basic.hero,{}).state,catalog,[...owned]);
    for(const slot of ['common','special']){
      const quest=state.active[slot];
      state=fillQuests(advanceQuests(state,quest.hero,{[quest.metric]:quest.target}).state,catalog,[...owned]);
    }
  }
  for(const slot of ['common','special']){
    const counts=HERO_CLASSES.map(hero=>state.issued[slot+':'+hero]??0);
    assert.ok(Math.min(...counts)>=10,JSON.stringify({slot,counts}));
    assert.ok(Math.max(...counts)<2*Math.min(...counts),JSON.stringify({slot,counts}));
  }
  assert.ok(['aggressive','midrange','defensive','large','special'].every(group=>state.issued['strategy:'+group]>=10));
});
