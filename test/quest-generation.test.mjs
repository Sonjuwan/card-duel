import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../apps/server/server.ts';
import {HERO_CLASSES} from '../packages/engine/src/index.ts';
import {advanceQuests,fillQuests,initialQuests,questCandidates,QUEST_DEFINITIONS,validQuestProgress} from '../packages/quests.ts';
import {questDay,nextQuestMidnight} from '../packages/quest-calendar.ts';
import {offlineGrowth} from '../apps/client/src/offline-growth.ts';

const catalog=loadCatalog();
const basics=offlineGrowth(catalog).starterIds;
const owned=new Set(Object.keys(catalog));
test('86 distinct quest definitions match the 9/32/45 split and each hero has five special definitions',()=>{
  const defs=QUEST_DEFINITIONS;
  assert.equal(new Set(defs.map(q=>q.id)).size,86);
  assert.deepEqual(['basic','common','special'].map(slot=>defs.filter(q=>q.slot===slot).length),[9,32,45]);
  assert.deepEqual(HERO_CLASSES.map(hero=>defs.filter(q=>q.hero===hero&&q.slot==='special').length),Array(9).fill(5));
  assert.ok(defs.every(q=>q.target>0&&[300,600,900].includes(q.xp)));
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
  assert.ok(QUEST_DEFINITIONS.filter(q=>q.slot==='basic').every(q=>q.xp===600));
});

const midnight=Date.parse('2026-11-28T15:00:00Z');
const dayMs=86_400_000,zone='Asia/Seoul';
const charge=(state,days,starterOffset)=>fillQuests(state,catalog,basics,{zone,now:midnight+days*dayMs,starterOffset});
const size=(state)=>Object.keys(state.active).length;

test('daily recharge applies civil midnight once, caps at three, and discards full days',()=>{
  let record=charge(initialQuests(0,10),0,0);
  assert.equal(size(record),1);
  assert.equal(record.active.basic.xp,600);
  assert.strictEqual(charge(record,0),record);
  assert.equal(size(charge(record,1)),2);
  assert.equal(size(charge(record,2)),3);
  record=charge(record,5);
  assert.equal(size(record),3);
  const full=charge(record,10);
  assert.equal(full.calendar.lastDay,record.calendar.lastDay+5);
  const [slot,quest]=Object.entries(full.active)[0];
  quest.progress=quest.target-1;
  const settled=advanceQuests(full,quest.hero,{[quest.metric]:1}).state;
  assert.equal(settled.active[slot],undefined);
  assert.strictEqual(charge(settled,10),settled);
  assert.strictEqual(charge(settled,9),settled);
  assert.equal(size(charge(settled,11)),3);
  assert.equal(nextQuestMidnight(questDay(midnight-1,zone),zone),midnight);
});

test('empty ledgers catch up one per elapsed day and pin timezone across clock edits',()=>{
  const empty=charge(initialQuests(0,10),0);
  for(const [day,expected] of [[0,0],[1,1],[2,2],[3,3],[20,3]])assert.equal(size(charge(empty,day)),expected);
  const past=charge(empty,100);
  const rollback=fillQuests(past,catalog,basics,{now:midnight,zone:'Pacific/Kiritimati'});
  assert.strictEqual(rollback,past);
  assert.equal(past.calendar.zone,zone);
  const march=Date.parse('2026-03-08T05:00:00Z'),ny='America/New_York';
  assert.equal(nextQuestMidnight(questDay(march,ny),ny)-march,23*3_600_000);
});

test('mixed vacancies conserve the basic rotation and distribute heroes, metrics and strategies',()=>{
  const starter=charge(initialQuests(0,10),0,0);
  const completedBasic=[];
  let state=starter;
  for(let day=0;day<200;day++){
    if(day)state=fillQuests(state,catalog,[...owned],{now:midnight+day*dayMs,zone});
    const [quest]=Object.values(state.active);
    assert.ok(quest);
    if(quest.metric==='games')completedBasic.push(quest.hero);
    quest.progress=quest.target-1;
    const settled=advanceQuests(state,quest.hero,{[quest.metric]:1});
    assert.equal(settled.xp,quest.xp);
    assert.ok(settled.state.payments[quest.id].rewarded);
    assert.equal(size(settled.state),0);
    state=settled.state;
  }
  assert.ok(completedBasic.length>=9,JSON.stringify(completedBasic));
  assert.deepEqual(completedBasic,HERO_CLASSES.concat(...Array(22).fill(HERO_CLASSES)).slice(0,completedBasic.length));
  const counts=HERO_CLASSES.map(hero=>['basic','common','special'].reduce((sum,slot)=>sum+(state.issued[slot+':'+hero]??0),0));
  assert.ok(Math.max(...counts)-Math.min(...counts)<=3,JSON.stringify(counts));
  assert.ok(['aggressive','midrange','defensive','large','special'].every(group=>state.issued['strategy:'+group]>=4));
  assert.ok(validQuestProgress(state));
});
