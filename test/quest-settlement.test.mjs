import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../apps/server/server.ts';
import {basicDeck} from '../packages/basic-decks.ts';
import {rankedXpReward} from '../packages/progression.ts';
import {readOfflineGrowth,offlineGrowth,settleOfflineRanked,createOfflineRankedInput,createGrowthBackup,decodeGrowthBackup} from '../apps/client/src/offline-growth.ts';
import {LocalDuel} from '../apps/client/src/local-duel.ts';

const catalog=loadCatalog(),growth=offlineGrowth(catalog);
const input={catalog,catalogHash:'9'.repeat(64),code:'quest-settle-fixture',heroClass:'warrior',
  difficulty:1,deck:basicDeck(catalog,'warrior'),seed:18991,animationSpeed:'instant'};
const match={mode:'ranked',matchId:input.code,rank:1,heroClass:'warrior',opponentClass:'mage',outcome:'loss',eligible:true,turns:9};

test('legacy progress migrates without paying again or changing the original profile assets',()=>{
  const initial=readOfflineGrowth(undefined,growth);
  const {quests,rewardRoad,...old}=initial.profile;
  const legacy={...initial,profile:{...old,questGames:27,xp:73}};
  const migrated=readOfflineGrowth(legacy,growth);
  assert.equal(migrated.profile.quests.active.basic.hero,'rogue');
  assert.equal(migrated.profile.quests.active.basic.progress,7);
  assert.equal(migrated.profile.xp,73);
  assert.equal(migrated.profile.rewardRoad.paths.original.xp,73);
  assert.ok(old.ownedCards.every(id=>migrated.profile.ownedCards.includes(id)));
  assert.deepEqual(migrated.profile.decks,old.decks);
  assert.deepEqual(readOfflineGrowth(migrated,growth),migrated);
});

test('a single eligible result pays multiple quests atomically, leaves vacancies, and survives round-trip',()=>{
  const record=readOfflineGrowth(undefined,growth);
  const quests=record.profile.quests;
  quests.active.basic.progress=9;
  quests.active.common={...quests.active.basic,id:'quest-'+(++quests.serial),definitionId:'common.armor',title:'방어도 획득',unit:'방어도',hero:'warrior',metric:'armor',progress:79,target:80};
  const initial=structuredClone(record);
  const context=createOfflineRankedInput(input,record,growth).ranked;
  const result=settleOfflineRanked(record,growth,context,match,{armor:2});
  assert.deepEqual(record,initial);
  const receipt=result.profile.recentMatches[0];
  assert.equal(receipt.completedQuests.length,2);
  assert.equal(receipt.questBonusXp,1200);
  assert.equal(receipt.matchXp,rankedXpReward(1,'loss'));
  assert.equal(result.profile.xp,receipt.matchXp+1200);
  assert.equal(result.profile.rewardRoad.paths.original.xp,result.profile.xp);
  assert.ok(receipt.unlockedCards.length>1);
  assert.equal(result.profile.quests.active.basic,undefined);
  assert.equal(result.profile.quests.active.common,undefined);
  assert.deepEqual(result.profile.quests.active.special,quests.active.special);
  const restored=decodeGrowthBackup(JSON.parse(JSON.stringify(createGrowthBackup(result,growth))),growth);
  assert.deepEqual(restored,result);
  assert.equal(settleOfflineRanked(restored,growth,context,match,{armor:1000}),restored);
});

test('early concession adds no quest progress and a normal loss remains eligible',()=>{
  const record=readOfflineGrowth(undefined,growth);
  const ranked=createOfflineRankedInput(input,record,growth);
  const duel=new LocalDuel(ranked);
  duel.forfeit();
  assert.equal(duel.rankedAward().eligible,false);
  const early=settleOfflineRanked(record,growth,ranked.ranked,duel.rankedAward(),{armor:100});
  assert.deepEqual(early.profile.quests,record.profile.quests);
  assert.equal(early.profile.xp,record.profile.xp);
  assert.equal(early.settledMatchIds.length,1);
  const normal=settleOfflineRanked(record,growth,ranked.ranked,match);
  assert.equal(normal.profile.quests.active.basic.progress,1);
});

test('only the ranked worker retains counters, and its restored action continues the same accumulator',()=>{
  const ranked=createOfflineRankedInput(input,readOfflineGrowth(undefined,growth),growth);
  const snapshot=new LocalDuel(ranked).checkpoint();
  Object.assign(snapshot.state,{phase:'playing',turn:7,activePlayer:0});
  Object.assign(snapshot.summary,{phase:'playing',turn:7});
  Object.assign(snapshot.state.players[0],{mana:4,maxMana:4});
  const resumed=LocalDuel.restore(snapshot,catalog,input.catalogHash);
  resumed.act(snapshot.state.revision,{type:'heroPower'});
  const checkpoint=resumed.checkpoint();
  assert.deepEqual(checkpoint.questCounters,{power:1,armor:2});
  assert.equal(resumed.view().questCounters,undefined);
  assert.deepEqual(LocalDuel.restore(checkpoint,catalog,input.catalogHash).checkpoint().questCounters,{power:1,armor:2});
  assert.equal(new LocalDuel(input).checkpoint().questCounters,undefined);
  assert.throws(()=>LocalDuel.restore({...checkpoint,questCounters:{armor:-1}},catalog,input.catalogHash),/퀘스트 기록/);
});

test('reward path selected after match start receives the quest XP and its own unlocks',async ()=>{
  const {selectRewardPath}=await import('../packages/reward-road.ts');
  const rules=offlineGrowth(catalog),unlock={...rules.unlocks[0],xp:16};
  rules.rewardPaths=[...rules.rewardPaths,{id:'test-expansion',name:'검증용 보상의 길',cardIds:[unlock.cardId],unlocks:[unlock],afterCompletion:'accumulate'}];
  const record=readOfflineGrowth(undefined,rules);
  record.profile.quests.active.basic.progress=9;
  const context=createOfflineRankedInput(input,record,rules).ranked;
  record.profile=selectRewardPath(record.profile,rules,'test-expansion');
  const result=settleOfflineRanked(record,rules,context,match);
  assert.equal(result.profile.rewardRoad.paths.original.xp,0);
  assert.equal(result.profile.rewardRoad.paths['test-expansion'].xp,rankedXpReward(1,'loss')+600);
  assert.deepEqual(result.profile.recentMatches[0].unlockedCards,[unlock.cardId]);
  assert.equal(result.profile.recentMatches[0].questBonusXp,600);
});

test('v0.337 active rewards update without repricing any paid receipts',()=>{
  const before=readOfflineGrowth(undefined,growth);
  const context=createOfflineRankedInput(input,before,growth).ranked;
  before.profile.quests.active.basic.progress=9;
  const paid=settleOfflineRanked(before,growth,context,match);
  const history=paid.profile.recentMatches[0];
  history.completedQuests[0].xp=30;
  history.questBonusXp=30;
  history.xp=history.matchXp+30;
  const state=paid.profile.quests;
  delete state.calendar;
  delete state.payments;
  state.active.special={...before.profile.quests.active.basic,id:'quest-'+(++state.serial),xp:30,progress:4};
  const migrated=readOfflineGrowth(paid,growth);
  assert.equal(migrated.profile.quests.active.special.xp,600);
  assert.equal(migrated.profile.quests.active.special.progress,4);
  assert.equal(migrated.profile.quests.active.special.id,state.active.special.id);
  assert.deepEqual(migrated.profile.recentMatches,paid.profile.recentMatches);
  assert.equal(migrated.profile.xp,paid.profile.xp);
});

test('quests charged while a battle is paused are eligible from the next battle',()=>{
  const now=Date.now(),next=now+86_400_000;
  const record=readOfflineGrowth(undefined,growth,now);
  const paused=createOfflineRankedInput(input,record,growth).ranked;
  record.profile.quests.games.warrior=0;
  const charged=readOfflineGrowth(record,growth,next);
  assert.equal(charged.profile.quests.serial,2);
  const issued=charged.profile.quests.active.common;
  const receipt=settleOfflineRanked(charged,growth,paused,{...match,heroClass:issued.hero},{[issued.metric]:issued.target},next);
  assert.deepEqual(receipt.profile.quests.active.common,issued);
  assert.equal(receipt.profile.recentMatches[0].questBonusXp,0);
});
