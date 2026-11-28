import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_REWARD_PATHS} from '../../../packages/reward-path-config.ts';
import {basicDeck} from '../../../packages/basic-decks.ts';
import {collectionBotDeck} from '../../../packages/collection-bot-deck.ts';
import {activeRewardPath,selectRewardPath} from '../../../packages/reward-road.ts';
import {awardMatch,buildGrowth,ownedDeck,syncOwned} from '../../../packages/progression.ts';
import type {Card} from '../../../packages/engine/src/index.ts';
import {HERO_CLASSES,validateDeck} from '../../../packages/engine/src/index.ts';
import {LocalAccountStore,newProfile} from '../account-store.ts';
import {loadCatalog} from '../server.ts';

const catalog=loadCatalog(),growth=buildGrowth(catalog);

test('all collectible Basics are granted and rarity rounds use every card exactly once',()=>{
  const collectible=Object.values(catalog).filter((card):card is Exclude<Card,{kind:'coin'}>=>card.kind!=='coin'&&card.collectible!==false);
  assert.deepEqual(growth.starterIds,collectible.filter(card=>card.rarity==='basic').map(card=>card.id).sort());
  assert.equal(growth.starterIds.length,133);
  const cards=new Map(collectible.map(card=>[card.id,card]));
  const groups=Object.groupBy(growth.unlocks,item=>cards.get(item.cardId)!.rarity);
  assert.deepEqual(Object.keys(groups),['common','rare','epic','legendary']);
  for(const [rarity,rounds,neutralCount] of [['common',6,40],['rare',5,36],['epic',3,11],['legendary',1,27]] as const){
    const unlocks=groups[rarity]!;
    assert.equal(unlocks.length,rounds*9+neutralCount);
    let start=0;
    for(let round=0;round<rounds;round++){
      assert.deepEqual(unlocks.slice(start,start+9).map(item=>cards.get(item.cardId)!.class),HERO_CLASSES);
      start+=9;
      const count=Math.floor((round+1)*neutralCount/rounds)-Math.floor(round*neutralCount/rounds);
      assert.ok(unlocks.slice(start,start+count).every(item=>cards.get(item.cardId)!.class==='neutral'));
      start+=count;
    }
  }
  const ids=[...growth.starterIds,...growth.unlocks.map(item=>item.cardId)];
  assert.equal(new Set(ids).size,collectible.length);
  assert.equal(ids.length,collectible.length);
});

test('basic presets are legal independent copies, and a single owned card can improve a bot deck',()=>{
  const initial=syncOwned(newProfile(),growth);
  for(const hero of HERO_CLASSES){
    const deck=basicDeck(catalog,hero);
    validateDeck(deck,catalog);
    ownedDeck(deck,catalog,initial);
    assert.equal(deck.cards.length,30);
    assert.deepEqual(collectionBotDeck(catalog,growth,hero,initial),deck);
    deck.cards.pop();
    assert.equal(basicDeck(catalog,hero).cards.length,30);
  }
  const card='harvest_golem',profile={...initial,ownedCards:[...initial.ownedCards,card]};
  const improved=collectionBotDeck(catalog,growth,'mage',profile);
  ownedDeck(improved,catalog,profile);
  assert.ok(improved.cards.includes(card));
  const conditional={...initial,ownedCards:[...initial.ownedCards,'captains_parrot']};
  assert.deepEqual(collectionBotDeck(catalog,growth,'mage',conditional),basicDeck(catalog,'mage'));
});

test('old owned IDs, saved decks and lifetime XP survive reordering and tighter thresholds',()=>{
  const historic=[...basicDeck(catalog,'mage').cards.slice(0,29),'cairne_bloodhoof'];
  const legacy={...newProfile(),xp:28,rank:9,rankWins:2,questGames:14,ownedCards:['cairne_bloodhoof','retired'],decks:[{name:'legacy',deck:{heroClass:'mage' as const,cards:historic}}]};
  const migrated=syncOwned(legacy,growth);
  assert.equal(activeRewardPath(migrated,growth).xp,28);
  assert.deepEqual(migrated.decks,legacy.decks);
  assert.deepEqual([migrated.xp,migrated.rank,migrated.rankWins,migrated.questGames],[28,9,2,14]);
  const changed=buildGrowth(catalog,{}, {},{base:1000,perPower:1000});
  assert.deepEqual(syncOwned(migrated,changed).ownedCards,migrated.ownedCards);
  assert.ok(migrated.ownedCards.includes('retired'));
});

test('a fixture expansion stores independent XP and settlement uses the path selected at commit',async()=>{
  const base=catalog.harvest_golem;
  assert.equal(base.kind,'minion');
  const fixture={...base,id:'fixture-reward-card'};
  const cards={...catalog,[fixture.id]:fixture};
  const multi=buildGrowth(cards,{}, {},undefined,[...DEFAULT_REWARD_PATHS,{
    id:'fixture',name:'Fixture',cardIds:[fixture.id],order:{common:{neutral:[fixture.id]}},
    xpCosts:{[fixture.id]:12},afterCompletion:'cap'
  }]);
  assert.deepEqual(multi.ranks,growth.ranks);
  assert.deepEqual(multi.unlocks,growth.unlocks);
  const store=new LocalAccountStore(':memory:',multi);
  try{
    const registered=await store.register('multi-path@example.test','test-password');
    const id=registered.account.id;
    const match={matchId:'reward-path-match',rank:1,heroClass:'mage' as const,outcome:'win' as const,eligible:true};
    await store.updateRewardPath(id,'fixture',multi);
    const first=await store.recordMatch(id,match,multi);
    assert.equal(first.profile.xp,30);
    assert.deepEqual(first.profile.rewardRoad?.paths,{original:{xp:0,complete:false},fixture:{xp:12,complete:true}});
    assert.deepEqual(first.profile.recentMatches?.[0].unlockedCards,[fixture.id]);
    const changed=await store.updateRewardPath(id,'original',multi);
    assert.deepEqual(await store.recordMatch(id,match,multi),changed);
    const next=await store.recordMatch(id,{...match,matchId:'original-match'},multi);
    assert.equal(next.profile.xp,60);
    assert.equal(next.profile.rewardRoad?.paths.original.xp,30);
    assert.equal(next.profile.rewardRoad?.paths.fixture.xp,12);
    assert.ok(next.profile.ownedCards.includes(fixture.id));
    const mixed=basicDeck(cards,'warrior');mixed.cards.splice(0,2,fixture.id,multi.unlocks[0].cardId);
    ownedDeck(mixed,cards,next.profile);
    const completed=awardMatch(selectRewardPath(next.profile,multi,'fixture'),multi,{...match,matchId:'after-completion'});
    assert.equal(completed.xp,90);
    assert.equal(completed.rewardRoad?.paths.fixture.xp,12);
  }finally{store.close();}
});
