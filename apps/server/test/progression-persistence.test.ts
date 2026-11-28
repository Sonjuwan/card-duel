import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {HERO_CLASSES,validateDeck} from '../../../packages/engine/src/index.ts';
import {buildGrowth,ownedDeck,questStatus,recommendedOwnedDeck} from '../../../packages/progression.ts';
import {simulateGrowth} from '../../../packages/progression-simulation.ts';
import type {AccountView,MatchAward} from '../../../packages/account-protocol.ts';
import {LocalAccountStore} from '../account-store.ts';
import {RoomService} from '../rooms.ts';
import {loadCatalog} from '../server.ts';

// This is a synthetic result ledger test, not a simulation of AI win strength.
test('all 25 ranks, 9-class quests and the entire card collection persist across device sessions and restarts',async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),forecast=simulateGrowth(growth,50),total=growth.starterIds.length+growth.unlocks.length;
  const dir=mkdtempSync(join(tmpdir(),'duel-long-growth-')),path=join(dir,'accounts.sqlite');
  let store=new LocalAccountStore(path,growth);
  try{
    const pc=await store.register('long-growth@example.test','test-password'),phone=await store.login(pc.account.email,'test-password');
    const id=pc.account.id;let account=pc.account,first:MatchAward|undefined,allCardsAt:number|undefined;
    const tiers:number[]=[],quests=new Set<string>();
    function checkRoom(current:AccountView){
      const rank=current.profile.rank;if(tiers.includes(rank))return;tiers.push(rank);
      const tier=growth.ranks[rank-1],hero=questStatus(current.profile.questGames).heroClass,deck=recommendedOwnedDeck(catalog,growth,hero,current.profile,rank);
      ownedDeck(deck,catalog,current.profile);
      const rooms=new RoomService(catalog),session=rooms.createRanked('fixture-player',{deck},current,growth),view=rooms.view('fixture-player');
      assert.equal(view.ranked?.rank,rank);assert.equal(view.ranked?.deckPower,tier.deckPower);assert.equal(view.botDifficulty,tier.intelligence);
      const opponent=rooms.accountSnapshot(session.code,'a'.repeat(64))?.room?.members[1]?.deck;assert.ok(opponent);validateDeck(opponent,catalog);
      assert.ok(opponent.cards.every(card=>current.profile.ownedCards.includes(card)));
    }
    checkRoom(account);
    for(let game=1;game<=forecast.games;game++){
      const before=account.profile,heroClass=questStatus(before.questGames).heroClass;quests.add(heroClass);
      const award:MatchAward={matchId:randomUUID(),rank:before.rank,heroClass,outcome:game%2===0?'win':'loss',eligible:true,completedAt:1_000_000+game,turns:12};
      first??=award;
      account=await store.recordMatch(id,award,growth);
      if(game%20===0)assert.deepEqual(await store.recordMatch(id,award,growth),account);
      const current=account.profile,base=20+10*before.rank,expectedXp=(award.outcome==='win'?base:Math.floor(base/2))+(game%10===0?100+10*before.rank:0);
      assert.equal(current.xp-before.xp,expectedXp);assert.equal(current.questGames,game);assert.equal(current.revision,before.revision+1);
      assert.ok(before.ownedCards.every(card=>current.ownedCards.includes(card)));
      assert.deepEqual(current.ownedCards,[...growth.starterIds,...growth.unlocks.filter(card=>card.xp<=current.xp).map(card=>card.cardId)].sort());
      if(current.ownedCards.length===total)allCardsAt??=game;
      checkRoom(account);
      if(game===90){
        assert.deepEqual([...quests],HERO_CLASSES);assert.equal(questStatus(current.questGames).heroClass,HERO_CLASSES[0]);
        const deck=recommendedOwnedDeck(catalog,growth,'warrior',current,game);account=await store.updateDecks(id,current.revision,[{name:'장기 성장 덱',deck}]);
      }
      if(game%30===0){
        store.close();store=new LocalAccountStore(path,growth);
        assert.deepEqual(await store.session(pc.token),account);assert.deepEqual(await store.session(phone.token),account);
      }
    }
    assert.equal(account.profile.rank,25);assert.deepEqual(tiers,Array.from({length:25},(_,i)=>i+1));assert.equal(allCardsAt,forecast.allCardsAt);
    assert.equal(account.profile.xp,forecast.xp);assert.equal(account.profile.ownedCards.length,total);assert.equal(account.profile.recentMatches?.length,30);
    assert.equal(account.profile.matchStats?.ranked.wins,forecast.wins);assert.equal(account.profile.matchStats?.ranked.losses,forecast.games-forecast.wins);
    assert.equal(account.profile.revision,forecast.games+1);assert.equal(account.profile.decks[0].name,'장기 성장 덱');
    assert.ok(first);assert.ok(!account.profile.recentMatches?.some(match=>match.matchId===first.matchId));
    // The oldest receipt is outside the visible history but the durable ledger still deduplicates it.
    assert.deepEqual(await store.recordMatch(id,first,growth),account);
    store.close();const stricter=buildGrowth(catalog,{}, {},{base:1000,perPower:1000});store=new LocalAccountStore(path,stricter);
    assert.deepEqual(await store.session(pc.token),account);assert.deepEqual(await store.session(phone.token),account);
    store.close();store=new LocalAccountStore(path,growth);assert.deepEqual(await store.session(phone.token),account);
    const db=new DatabaseSync(path,{readOnly:true});try{const count=db.prepare('SELECT count(*) AS total FROM ranked_matches WHERE account_id=?').get(id);assert.equal(count?.total,forecast.games);}finally{db.close();}
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
