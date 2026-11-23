import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CardStore} from '../server/card-store.ts';
import {aiCatalogHash,aiWeightFingerprint,readGameChampion} from '../server/ai-profile-store.ts';
import {DEFAULT_BOT_WEIGHTS,HERO_TOKENS,rankBotActions,RuleError} from '../../packages/engine/src/index.ts';
import {questStatus,rankInfo,rankedXpReward,rankedQuestBonus,ownedDeck,recommendedOwnedDeck} from '../../packages/progression.ts';
import {LocalDuel} from '../client/src/local-duel.ts';
import {createOfflineRankedInput,createGrowthBackup,decodeGrowthBackup,offlineGrowth,readOfflineGrowth,settleOfflineRanked} from '../client/src/offline-growth.ts';
import {deviceBudget} from '../client/src/device-budget.ts';

// Read-only diagnostic: play real ranked games against the released opponent
// policy using a top-level AI surrogate as the player. Never write user data,
// modify a card, train a model, or present these results as human win rates.
const count=Number(process.argv[2]??96),offset=Number(process.argv[3]??5000),allTiers=process.argv[4]==='--all-tiers';
if(!Number.isInteger(count)||count<1||count>500||!Number.isSafeInteger(offset)||offset<0||process.argv[4]!==undefined&&!allTiers||allTiers&&count!==25)throw Error('Usage: benchmark-solo-journey [matches 1-500] [seed offset] [--all-tiers (25 matches)]');
const {version,cards,catalog:base}=new CardStore().read(),hash=createHash('sha256').update(JSON.stringify(cards)).digest('hex'),champion=readGameChampion(aiCatalogHash(base));
const catalog={...base,...Object.fromEntries(HERO_TOKENS.map(c=>[c.id,c]))},weights=champion?.weights??DEFAULT_BOT_WEIGHTS,growth=offlineGrowth(catalog),device={cores:8,memoryGb:8};
let record=readOfflineGrowth(undefined,growth),moves=0,restores=0,backupChecks=0;
const outcomes={win:0,loss:0,draw:0};
const start=performance.now(),classes=new Set<string>(),ranks=new Set<number>();
console.log(JSON.stringify({version,hash,weights:aiWeightFingerprint(weights),count,offset,mode:allTiers?'independent tier fixtures':'natural growth journey',note:'Real local ranked games, top-level AI surrogate player, no account/device storage writes; not a human win rate or physical device timing.'}));
for(let i=0;i<count;i++){
  // Independent fixtures verify actual combat at all ranks without pretending
  // that these synthetic starting profiles were earned by natural progression.
  if(allTiers){const fresh=readOfflineGrowth(undefined,growth),rank=i+1;record=readOfflineGrowth({...fresh,profile:{...fresh.profile,rank,xp:rankInfo(rank,growth.ranks).minimumXp??0,questGames:(i%9)*growth.questLength}},growth);}
  const prior=record.profile,tier=rankInfo(prior.rank,growth.ranks),quest=questStatus(prior.questGames),seed=(131313+Math.imul(offset+i,4421))>>>0;
  const deck=recommendedOwnedDeck(catalog,growth,quest.heroClass,prior,seed);ownedDeck(deck,catalog,prior);
  const input=createOfflineRankedInput({catalog,catalogHash:hash,deck,heroClass:'warrior',difficulty:1,seed,code:`BENCH-JOURNEY-${offset+i}`,weights,generation:champion?.generation??0,device,animationSpeed:'instant'},record,growth);
  assert.equal(input.ranked!.deckPower,tier.deckPower);assert.equal(input.difficulty,tier.intelligence);assert.equal(input.ranked!.profileRevision,prior.revision);
  let duel=new LocalDuel(input),actions=0;
  ranks.add(prior.rank);classes.add(deck.heroClass);
  while(duel.view().status!=='finished'&&actions<600){
    if(duel.expireTurn()){actions++;continue;}
    if(duel.botReady()){assert.ok(duel.botStep());}
    else{
      const view=duel.view().state!;let applied=false;
      for(const action of rankBotActions(view,catalog,0,25,{...deviceBudget(25,'auto',device),weights,policyVersion:2}))try{duel.act(view.revision,action);applied=true;break;}catch(error){if(!(error instanceof RuleError))throw error;}
      if(!applied)throw Error(`No legal player action in match ${i+1}`);
    }
    actions++;
    if(actions===20||actions===50){const saved=duel.checkpoint()!;const now=Date.parse(saved.summary.savedAt);duel=LocalDuel.restore(saved,catalog,hash,device,now);assert.deepEqual(duel.checkpoint(now),saved);restores++;}
  }
  const award=duel.rankedAward();assert.ok(award?.eligible,`Match ${i+1} failed to complete an eligible result (${actions} actions)`);moves+=actions;outcomes[award.outcome]++;
  record=settleOfflineRanked(record,growth,input.ranked!,award);const next=record.profile;
  assert.equal(next.revision,prior.revision+1);assert.equal(next.questGames,prior.questGames+1);assert.equal(next.xp-prior.xp,rankedXpReward(prior.rank,award.outcome)+(next.questGames%growth.questLength===0?rankedQuestBonus(prior.rank):0));
  assert.ok(next.rank>=prior.rank&&next.rank<=Math.min(25,prior.rank+1));
  assert.ok(next.ownedCards.length<=growth.starterIds.length+growth.unlocks.length);
  assert.ok(prior.ownedCards.every(id=>next.ownedCards.includes(id)));assert.equal(settleOfflineRanked(record,growth,input.ranked!,award),record);
  if((i+1)%10===0||i+1===count){const backup=createGrowthBackup(record,growth);assert.deepEqual(decodeGrowthBackup(JSON.parse(JSON.stringify(backup)),growth),record);record=decodeGrowthBackup(backup,growth);backupChecks++;}
  if(allTiers)console.log(JSON.stringify({fixtureRank:prior.rank,hero:deck.heroClass,opponent:input.heroClass,difficulty:input.difficulty,deckPower:input.ranked!.deckPower,outcome:award.outcome,actions,restores}));
  else if((i+1)%10===0||next.rank!==prior.rank||i+1===count)console.log(JSON.stringify({games:i+1,rank:next.rank,xp:next.xp,owned:next.ownedCards.length,questGames:next.questGames,stats:next.matchStats?.ranked,moves,restores,backupChecks,seconds:Math.round((performance.now()-start)/1000)}));
}
const result={complete:true,games:count,ranksPlayed:[...ranks],classes:[...classes],moves,restores,backupChecks,seconds:Math.round((performance.now()-start)/1000)};
console.log(JSON.stringify(allTiers?{...result,mode:'independent tier fixtures',outcomes}:{...result,rank:record.profile.rank,xp:record.profile.xp,owned:record.profile.ownedCards.length,questCompleted:questStatus(record.profile.questGames).completed,stats:record.profile.matchStats?.ranked}));
