import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HERO_CLASSES,practiceDeck,validateDeck} from '../../../packages/engine/src/index.ts';
import {awardMatch,buildGrowth,deckPowerTotal,ownedDeck,questStatus,rankedBotDeck,recommendedOwnedDeck,RANKS,syncOwned} from '../../../packages/progression.ts';
import {LocalAccountStore,newProfile} from '../account-store.ts';
import {loadCatalog} from '../server.ts';
import {loadGrowth} from '../growth-store.ts';

const catalog=loadCatalog(),growth=buildGrowth(catalog);
test('25 ranked tiers span bronze 5 through diamond 1; each AI deck uses only its available power pool',()=>{
  assert.equal(RANKS.length,25);assert.equal(RANKS[0].name,'브론즈 5');assert.equal(RANKS[24].name,'다이아몬드 1');
  assert.equal(new Set(RANKS.map(r=>r.deckPower)).size,25);assert.equal(new Set(RANKS.map(r=>r.intelligence)).size,25);
  const collectible=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);
  assert.equal(growth.starterIds.length+growth.unlocks.length,collectible.length);
  assert.deepEqual(buildGrowth(catalog),growth);assert.equal(new Set(growth.unlocks.map(c=>c.power)).size,24);
  for(const r of RANKS)for(const hero of HERO_CLASSES){const deck=rankedBotDeck(catalog,growth,hero,r.deckPower,123);validateDeck(deck,catalog);assert.ok(deck.cards.every(id=>growth.starterIds.includes(id)||growth.unlocks.some(c=>c.cardId===id&&c.power<=r.deckPower)));}
  const powers=new Map(growth.unlocks.map(c=>[c.cardId,c.power]));for(const hero of HERO_CLASSES){let last=0;for(const tier of RANKS){const deck=rankedBotDeck(catalog,growth,hero,tier.deckPower,123),total=deck.cards.reduce((sum,id)=>sum+(powers.get(id)??1),0);assert.ok(total>=last,`${hero} ${tier.rank}`);last=total;}const high=rankedBotDeck(catalog,growth,hero,25,123);assert.ok(last>30);assert.ok(high.cards.some(id=>(powers.get(id)??1)>=20));}
});
test('initial decks are legal for every class; higher-power cards unlock in increasing XP order',()=>{
  const initial=syncOwned(newProfile(),growth);for(const hero of HERO_CLASSES)ownedDeck(practiceDeck(catalog,hero),catalog,initial);
  const first=growth.unlocks[0],last=growth.unlocks.at(-1)!;assert.ok(first.xp>0&&last.xp>first.xp);
  assert.ok(!initial.ownedCards.includes(first.cardId));assert.ok(syncOwned({...initial,xp:first.xp},growth).ownedCards.includes(first.cardId));
  const all=syncOwned({...initial,xp:last.xp},growth);assert.equal(all.ownedCards.length,growth.starterIds.length+growth.unlocks.length);
  assert.ok(syncOwned({...all,xp:0},growth).ownedCards.includes(last.cardId)); // patches never revoke earned ownership
});
test('growth recommendation uses actual owned IDs, never all cards in a partly unlocked tier',()=>{
  const initial=syncOwned(newProfile(),growth),xpTiers=[0,...[2,7,13,19,25].map(power=>growth.unlocks.find(c=>c.power===power)!.xp),growth.unlocks.at(-1)!.xp];
  for(const xp of xpTiers){
    const profile=syncOwned({...initial,xp},growth);
    for(const hero of HERO_CLASSES){
      const deck=recommendedOwnedDeck(catalog,growth,hero,profile,123);ownedDeck(deck,catalog,profile);
      assert.ok(deck.cards.every(id=>profile.ownedCards.includes(id)));
      if(xp===0)assert.equal(deckPowerTotal(deck,growth),30);
      if(xp===xpTiers.at(-1)){assert.ok(deckPowerTotal(deck,growth)>30);assert.deepEqual(deck,rankedBotDeck(catalog,growth,hero,25,123));}
    }
  }
  assert.throws(()=>recommendedOwnedDeck(catalog,growth,'mage',newProfile(),123),/동기화/);
});
test('developer tuning is separate from card stats and can independently adjust deck and AI intelligence',()=>{
  assert.deepEqual(loadGrowth(catalog),growth);
  const chosen=growth.unlocks.at(-1)!;const changed=buildGrowth(catalog,{[chosen.cardId]:2},{'1':{deckPower:3,intelligence:5}});
  assert.equal(changed.unlocks.find(c=>c.cardId===chosen.cardId)?.power,2);assert.equal(changed.ranks[0].deckPower,3);assert.equal(changed.ranks[0].intelligence,5);
  assert.throws(()=>buildGrowth(catalog,{[chosen.cardId]:26}),/Invalid/);assert.throws(()=>buildGrowth(catalog,{}, {'1':{deckPower:0,intelligence:1}}),/Invalid/);
});
test('quest cycles through nine classes, ten qualified games each; rank rewards increase and advance only on wins',()=>{
  let profile=syncOwned(newProfile(),growth);
  const match={matchId:randomUUID(),rank:1,heroClass:'warrior' as const,outcome:'win' as const,eligible:true};
  assert.equal(awardMatch(profile,growth,{...match,eligible:false}).xp,0);
  assert.equal(awardMatch(profile,growth,{...match,heroClass:'mage'}).questGames,0);
  for(let i=0;i<3;i++)profile=awardMatch(profile,growth,match);
  assert.equal(profile.rank,2);assert.equal(profile.rankWins,0);
  assert.ok(awardMatch(profile,growth,{...match,rank:25}).xp-profile.xp>awardMatch(profile,growth,{...match,rank:1}).xp-profile.xp);
  profile={...profile,questGames:0};for(let i=0;i<90;i++){const expected=HERO_CLASSES[Math.floor(i/10)];assert.equal(questStatus(profile.questGames).heroClass,expected);profile=awardMatch(profile,growth,{...match,heroClass:expected,outcome:'loss'});}
  assert.equal(profile.questGames,90);assert.equal(questStatus(profile.questGames).heroClass,'warrior');
});
test('server-only match ledger grants each result only once even when retried',async()=>{
  const store=new LocalAccountStore(':memory:',growth);try{
    const first=await store.register('progress@example.test','test-password');const id=first.account.id;
    const award={matchId:randomUUID(),rank:1,heroClass:'warrior' as const,outcome:'win' as const,eligible:true};
    const [a,b]=await Promise.all([store.recordMatch(id,award,growth),store.recordMatch(id,award,growth)]);
    assert.equal(a.profile.xp,30);assert.equal(a.profile.questGames,1);assert.deepEqual(a.profile,b.profile);assert.equal(a.profile.revision,1);
    const second=await store.recordMatch(id,{...award,matchId:randomUUID()},growth);assert.equal(second.profile.xp,60);assert.equal(second.profile.revision,2);
  }finally{store.close();}
});
test('match receipt records only newly earned cards, exact quest bonus and promotion',()=>{
  const start=syncOwned({...newProfile(),questGames:9,rankWins:2},growth);
  const profile=awardMatch(start,growth,{matchId:randomUUID(),rank:1,heroClass:'warrior',outcome:'win',eligible:true});
  const receipt=profile.recentMatches![0];
  assert.equal(receipt.xp,140);assert.equal(receipt.questCompleted,true);assert.equal(receipt.questAdvanced,true);assert.equal(receipt.questBonusXp,110);assert.equal(receipt.rankAfter,2);
  assert.deepEqual(receipt.unlockedCards,profile.ownedCards.filter(id=>!start.ownedCards.includes(id)));assert.ok(receipt.unlockedCards!.length>0);
  const noReward=awardMatch(profile,growth,{matchId:randomUUID(),rank:2,heroClass:'hunter',outcome:'loss',eligible:false,completedAt:Date.now()+1000}).recentMatches![0];
  assert.equal(noReward.xp,0);assert.equal(noReward.questBonusXp,0);assert.equal(noReward.questCompleted,false);assert.deepEqual(noReward.unlockedCards,[]);
});
test('rank promotion waits until player unlocks enough power for the next opponent; history is bounded',()=>{
  const rank=20,target=growth.ranks[rank].minimumXp!;assert.ok(target>0);assert.ok(growth.unlocks.some(c=>c.power===rank+1&&c.xp===target));
  let profile={...syncOwned(newProfile(),growth),rank,rankWins:2};const win={matchId:randomUUID(),rank,heroClass:'warrior' as const,outcome:'win' as const,eligible:true};
  profile=awardMatch(profile,growth,win);assert.equal(profile.rank,rank);assert.equal(profile.rankWins,3);
  profile=awardMatch({...profile,xp:target},growth,{...win,matchId:randomUUID()});assert.equal(profile.rank,rank+1);assert.ok(profile.ownedCards.includes(growth.unlocks.find(c=>c.xp===target)!.cardId));
  const oldXp=profile.xp;for(let i=0;i<40;i++)profile=awardMatch(profile,growth,{...win,matchId:randomUUID(),mode:'pvp',completedAt:i+10000000000000});
  assert.equal(profile.xp,oldXp);assert.equal(profile.matchStats?.pvp.wins,40);assert.equal(profile.recentMatches?.length,30);assert.equal(profile.recentMatches?.[0].completedAt,10000000000039);
});
