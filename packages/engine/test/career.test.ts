import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceCareer,careerOf,emptyRecord,levelProgress,levelUpsFor,masteryTier,validCareer,winPercentage} from '../../career.ts';
import {decodeAccountProfile} from '../../account-profile.ts';
import type {AccountProfile,MatchHistoryEntry} from '../../account-protocol.ts';

const profile:AccountProfile={revision:1,decks:[],xp:220,rank:1,rankWins:0,questGames:0,ownedCards:[]};
const receipt=(entry:Partial<MatchHistoryEntry>={}):MatchHistoryEntry=>({
  matchId:'match',mode:'ranked',rank:1,heroClass:'mage',outcome:'win',eligible:true,completedAt:1,
  xp:30,questAdvanced:false,...entry,
});

test('account and hero XP curves retain exact boundary and frame values',()=>{
  assert.deepEqual(levelProgress(0,'account'),{level:1,progress:0,remaining:100,required:100});
  assert.deepEqual(levelProgress(99,'account'),{level:1,progress:99,remaining:1,required:100});
  assert.deepEqual(levelProgress(100,'account'),{level:2,progress:0,remaining:145,required:145});
  assert.equal(levelProgress(145,'hero').level,3);
  const tierTen=9*(60+25*8/2);
  assert.equal(masteryTier(tierTen-1),0);
  assert.equal(masteryTier(tierTen),1);
  assert.equal(masteryTier(Number.MAX_SAFE_INTEGER),4);
});

test('only verified history migrates and the legacy lifetime XP remains authoritative',()=>{
  const legacy={...profile,recentMatches:[receipt({matchId:'early',completedAt:4,eligible:false,xp:0,outcome:'loss'}),receipt({matchId:'normal',completedAt:3,outcome:'draw'}),receipt({matchId:'second',completedAt:2}),receipt({matchId:'first'})]};
  const career=careerOf(decodeAccountProfile(legacy));
  assert.deepEqual(career.record,{wins:2,losses:0,draws:1});
  assert.equal(career.heroes.mage?.bestStreak,2);
  assert.equal(career.heroes.mage?.streak,0);
  assert.equal(career.heroes.mage?.xp,90);
  assert.equal(legacy.xp,220);
  assert.equal(winPercentage(career.record),67);
  assert.equal(winPercentage(emptyRecord()),null);
  assert.equal(validCareer(career),true);
  assert.throws(()=>decodeAccountProfile({...legacy,career:{...career,record:emptyRecord()}}),/Invalid account profile/);
});

test('match and quest experience are allocated once to their owning records',()=>{
  const latest=receipt({xp:130,matchXp:30,questBonusXp:100,completedQuests:[
    {id:'quest-1',hero:'shaman',title:'퀘스트',definitionId:'shaman',metric:'matches',unit:'회',target:1,progress:1,xp:100,rewarded:true}
  ]});
  const next={...profile,xp:350,career:advanceCareer(careerOf(profile),latest)};
  assert.equal(next.career.heroes.mage?.xp,30);
  assert.equal(next.career.heroes.shaman?.xp,100);
  assert.equal(next.career.heroes.shaman?.quests,1);
  assert.equal(next.career.heroes.shaman?.wins,0);
  assert.deepEqual(levelUpsFor(profile,next,'mage'),{account:{before:2,after:3}});
  assert.equal(careerOf({...next,rewardRoad:{selectedPathId:'next',paths:{next:{xp:0,complete:false}}}}),next.career);
  assert.equal(advanceCareer(next.career,receipt({eligible:false})),next.career);
});
